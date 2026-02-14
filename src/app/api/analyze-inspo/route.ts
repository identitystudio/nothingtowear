import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export async function POST(request: NextRequest) {
  try {
    const { inspoImage, closetItems } = await request.json();

    if (!inspoImage) {
      return NextResponse.json(
        { error: "Missing inspiration image" },
        { status: 400 }
      );
    }

    let inspoAnalysis;
    let usedGemini = false;

    // Step 1: Analyze the inspiration outfit
    try {
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a fashion stylist AI. Analyze outfit photos with precision.
Return ONLY valid JSON, no markdown, no code blocks.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this outfit photo in detail. Return a JSON object with:
{
  "pieces": [
    {
      "type": "top|bottom|dress|outerwear|shoes|accessory",
      "description": "detailed description",
      "color": "main color",
      "style": "style category",
      "fit": "loose|fitted|oversized|tailored",
      "fabric_guess": "fabric type"
    }
  ],
  "overall_style": "the overall aesthetic (e.g., quiet luxury, streetwear, preppy)",
  "color_palette": ["list of main colors"],
  "vibe": "short emotional description of the look",
  "styling_notes": "what makes this outfit work (proportions, color blocking, etc.)"
}`,
              },
              {
                type: "image_url",
                image_url: { url: inspoImage },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const analysisText = analysisResponse.choices[0]?.message?.content || "{}";
      try {
        inspoAnalysis = JSON.parse(analysisText);
      } catch {
        // Try to extract JSON from the response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        inspoAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { pieces: [], overall_style: "unknown" };
      }
    } catch (openaiError: any) {
      // Try Gemini on ANY OpenAI error
      console.warn("[analyze-inspo] OpenAI failed:", openaiError?.message || openaiError);
      
      if (!genAI) {
        console.error("[analyze-inspo] Gemini not configured");
        return NextResponse.json(
          { 
            error: "OpenAI failed and Gemini API key not configured",
            details: openaiError?.message || String(openaiError)
          },
          { status: 500 }
        );
      }

      try {
        console.log("[analyze-inspo] Attempting Gemini fallback...");
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
          
          let mimeType = "image/jpeg";
          let base64Data: string;

          // Extract base64 from data URL
          if (inspoImage.startsWith("data:")) {
            const matches = inspoImage.match(/^data:(.+?);base64,(.+)$/);
            if (!matches) {
              throw new Error("Invalid image data URL format");
            }
            mimeType = matches[1];
            base64Data = matches[2];
          } else if (inspoImage.startsWith("http://") || inspoImage.startsWith("https://")) {
            // Fetch URL and convert to base64
            const response = await fetch(inspoImage);
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            base64Data = Buffer.from(buffer).toString("base64");
            mimeType = response.headers.get("content-type") || "image/jpeg";
          } else {
            throw new Error("Unsupported image format");
          }

          const prompt = `Analyze this outfit photo in detail. Return ONLY a JSON object (no markdown, no code blocks) with:
{
  "pieces": [
    {
      "type": "top|bottom|dress|outerwear|shoes|accessory",
      "description": "detailed description",
      "color": "main color",
      "style": "style category",
      "fit": "loose|fitted|oversized|tailored",
      "fabric_guess": "fabric type"
    }
  ],
  "overall_style": "the overall aesthetic",
  "color_palette": ["list of main colors"],
  "vibe": "short emotional description",
  "styling_notes": "what makes this outfit work"
}`;

          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ]);

          const analysisText = result.response.text();
          let cleanText = analysisText.replace(/```json\n?|\n?```/g, "").trim();
          const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanText = jsonMatch[0];
          }
          
          inspoAnalysis = JSON.parse(cleanText);
          usedGemini = true;
          console.log("[analyze-inspo] ✓ Gemini fallback successful");
        } catch (geminiError) {
          console.error("[analyze-inspo] Gemini fallback failed:", geminiError instanceof Error ? geminiError.message : geminiError);
          // Return error only if both services fail
          return NextResponse.json(
            { 
              error: "Both OpenAI and Gemini failed to analyze the outfit",
              details: geminiError instanceof Error ? geminiError.message : String(geminiError),
              code: "ALL_SERVICES_FAILED"
            },
            { status: 500 }
          );
        }
    }

    // Step 2: If closet items are provided, find the best matches
    let matchResult = null;
    
    // Only attempt matching with OpenAI (Gemini has limitations with multiple images)
    if (closetItems && closetItems.length > 0 && !usedGemini) {
      try {
        const matchResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a fashion stylist AI that matches inspiration outfits to items in a user's closet.
Return ONLY valid JSON, no markdown, no code blocks.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Here is the analysis of an outfit the user wants to recreate:
${JSON.stringify(inspoAnalysis)}

Here are the items in the user's closet (with their IDs and images):
${closetItems.map((item: { id: string; type?: string; color?: string; style?: string }, i: number) => `Item ${i}: ID=${item.id}, type=${item.type || 'unknown'}, color=${item.color || 'unknown'}, style=${item.style || 'unknown'}`).join('\n')}

Return a JSON object:
{
  "matched_outfit": {
    "items": [{"closet_item_index": 0, "matches_piece": "description of what inspo piece it replaces", "match_quality": "perfect|close|approximate"}],
    "match_score": 85,
    "styling_tip": "how to style these items together to get closest to the inspo"
  },
  "missing_pieces": [
    {
      "type": "what's missing",
      "description": "what they'd need to buy",
      "search_query": "amazon or shopping search query to find this item",
      "impact": "how many additional outfits this unlocks"
    }
  ],
  "upgraded_outfit": {
    "description": "what the outfit would look like if they bought the missing piece(s)",
    "confidence": "high|medium|low"
  }
}`,
                },
                // Send closet item images for visual matching
                ...closetItems.slice(0, 20).map((item: { image: string }, i: number) => ({
                  type: "image_url" as const,
                  image_url: { url: item.image, detail: "low" as const },
                })),
              ],
            },
          ],
          max_tokens: 1500,
        });

        const matchText = matchResponse.choices[0]?.message?.content || "{}";
        try {
          matchResult = JSON.parse(matchText);
        } catch {
          const jsonMatch = matchText.match(/\{[\s\S]*\}/);
          matchResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        }
      } catch (matchError: any) {
        // Log matching error but don't fail the whole response
        console.warn("[analyze-inspo] Matching failed:", matchError?.message || matchError);
        matchResult = null;
      }
    }

    return NextResponse.json({
      analysis: inspoAnalysis,
      match: matchResult,
      provider: usedGemini ? "gemini" : "openai"
    });
  } catch (error) {
    console.error("[analyze-inspo] Unexpected error:", error);
    
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (error instanceof Error) {
      console.error("[analyze-inspo] Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to analyze inspiration photo",
        details: errorMsg
      },
      { status: 500 }
    );
  }
}
