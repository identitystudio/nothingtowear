import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// Initialize Gemini client
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

async function detectWithGemini(imageDataUrl: string) {
  if (!genAI) {
    throw new Error("Gemini API key not configured");
  }

  console.log("[detect-item] Using Gemini API as fallback");
  console.log("[detect-item] Image URL type:", imageDataUrl.substring(0, 50) + "...");
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  let mimeType: string;
  let base64Data: string;

  // Check if it's a data URL or a regular URL
  if (imageDataUrl.startsWith("data:")) {
    // Extract base64 data and mime type from data URL
    const matches = imageDataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid image data URL format");
    }
    mimeType = matches[1];
    base64Data = matches[2];
  } else if (imageDataUrl.startsWith("http://") || imageDataUrl.startsWith("https://")) {
    // It's a URL, fetch the image and convert to base64
    console.log("[detect-item] Fetching image from URL for Gemini...");
    const response = await fetch(imageDataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    base64Data = Buffer.from(buffer).toString("base64");
    mimeType = response.headers.get("content-type") || "image/jpeg";
  } else {
    throw new Error("Unsupported image format - must be data URL or HTTP(S) URL");
  }

  const prompt = `Analyze this clothing item and return ONLY a JSON object with these fields: type (one of: top, bottom, dress, outerwear, shoes, accessory), color (main color), style (casual, formal, sporty, etc.), and description (brief description). No other text, just the JSON object.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
  ]);

  const response = result.response;
  const text = response.text();
  
  console.log("[detect-item] Gemini raw response:", text.substring(0, 200));
  
  // Clean up markdown code blocks if present
  let cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
  
  // Sometimes Gemini adds extra text, try to extract JSON object
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanText = jsonMatch[0];
  }
  
  try {
    return JSON.parse(cleanText);
  } catch (parseError) {
    console.error("[detect-item] Failed to parse Gemini response:", cleanText);
    throw new Error(`Failed to parse Gemini response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Missing image" },
        { status: 400 }
      );
    }

    let itemData;
    let usedGemini = false;

    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this clothing item and return ONLY a JSON object with these fields: type (one of: top, bottom, dress, outerwear, shoes, accessory), color (main color), style (casual, formal, sporty, etc.), and description (brief description). No other text.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: image,
                  },
                },
              ],
            },
          ],
          max_tokens: 300,
        });

        const result = response.choices[0]?.message?.content;
        if (result) {
          itemData = JSON.parse(result);
          console.log("[detect-item] ✓ OpenAI detection successful");
        }
      } catch (openaiError: any) {
        // Check if it's a quota/insufficient credits error
        if (
          openaiError?.status === 429 ||
          openaiError?.status === 401 ||
          openaiError?.message?.includes("quota") ||
          openaiError?.message?.includes("insufficient") ||
          openaiError?.message?.includes("credit")
        ) {
          console.warn("[detect-item] OpenAI quota/credits exceeded, trying Gemini...");
          try {
            itemData = await detectWithGemini(image);
            usedGemini = true;
          } catch (geminiError) {
            console.error("[detect-item] Gemini fallback also failed:", geminiError);
            return NextResponse.json(
              { 
                error: "Insufficient OpenAI credits",
                code: "INSUFFICIENT_CREDITS"
              },
              { status: 402 }
            );
          }
        } else {
          throw openaiError;
        }
      }
    } else {
      // No OpenAI key, use Gemini directly
      itemData = await detectWithGemini(image);
      usedGemini = true;
    }

    if (!itemData) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      item: itemData,
      provider: usedGemini ? "gemini" : "openai"
    });
  } catch (error) {
    console.error("[detect-item] Error detecting item:", error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error("[detect-item] Error message:", error.message);
      console.error("[detect-item] Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to detect item",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
