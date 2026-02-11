import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const { inspoImage, closetItems } = await request.json();

    if (!inspoImage) {
      return NextResponse.json(
        { error: "Missing inspiration image" },
        { status: 400 }
      );
    }

    // Step 1: Analyze the inspiration outfit
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
    let inspoAnalysis;
    try {
      inspoAnalysis = JSON.parse(analysisText);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      inspoAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { pieces: [], overall_style: "unknown" };
    }

    // Step 2: If closet items are provided, find the best matches
    let matchResult = null;
    if (closetItems && closetItems.length > 0) {
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
    }

    return NextResponse.json({
      analysis: inspoAnalysis,
      match: matchResult,
    });
  } catch (error) {
    console.error("Error analyzing inspiration:", error);
    return NextResponse.json(
      { error: "Failed to analyze inspiration photo" },
      { status: 500 }
    );
  }
}
