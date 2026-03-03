import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: (process.env.REPLICATE_API_TOKEN || "").replace(/['"]/g, "").trim(),
});

/**
 * POST /api/tag-item
 * Analyzes clothing image and returns detailed tags using Two-Step Replicate process:
 * 1. Vision (Moondream2) -> Detailed analysis
 * 2. Structuring (Llama-3) -> JSON output
 */
export async function POST(request: NextRequest) {
  try {
    const { image, itemType } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    if (!(process.env.REPLICATE_API_TOKEN || "").replace(/['"]/g, "").trim()) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    // STEP 1: Vision - Get detailed analysis
    console.log("[tag-item] Step 1: Calling Moondream2 for detailed analysis...");
    const visionPrompt = `Analyze this ${itemType || "clothing item"} in extreme detail. Describe colors, patterns, materials, fit, style, and suitable occasions or seasons.`;
    
    const visionOutput = await replicate.run(
      "lucataco/moondream2:72ccb656353c348c1385df54b237eeb7bfa874bf11486cf0b9473e691b662d31",
      {
        input: {
          image: image,
          prompt: visionPrompt,
        },
      }
    );

    const detailedDescription = Array.isArray(visionOutput) ? visionOutput.join("") : (visionOutput as unknown as string);
    console.log("[tag-item] Vision Detailed Description:", detailedDescription);

    // STEP 2: Structuring - Get JSON
    console.log("[tag-item] Step 2: Calling Llama-3 for JSON structuring...");
    const llmPrompt = `Convert this clothing analysis into a detailed JSON object.
Analysis: "${detailedDescription}"

JSON format:
{
  "color": ["string"],
  "pattern": ["string"],
  "style": ["string"],
  "fit": ["string"],
  "material": ["string"],
  "occasion": ["string"],
  "season": ["string"],
  "condition": "excellent" | "good" | "fair",
  "description": "1-2 sentence description"
}

Return ONLY the JSON. No other text.`;

    const llmOutput = await replicate.run(
      "meta/meta-llama-3-70b-instruct",
      {
        input: {
          prompt: llmPrompt,
          system_prompt: "You are an expert fashion stylist. Extract structured tags from the description. Always return valid JSON.",
          max_new_tokens: 1000,
        },
      }
    );

    const llmContent = Array.isArray(llmOutput) ? llmOutput.join("") : (llmOutput as unknown as string);
    console.log("[tag-item] LLM Raw Tags JSON:", llmContent);

    // Extract JSON from LLM output
    let jsonStr = llmContent;
    const jsonMatch = llmContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const tags = JSON.parse(jsonStr);
      return NextResponse.json({ 
        tags,
        provider: "replicate-dual-step"
      });
    } catch (parseError) {
      console.error("[tag-item] Failed to parse LLM response:", llmContent);
      return NextResponse.json(
        { error: "Failed to structure tags response", raw: llmContent },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[tag-item] Dual-Step Error:", err);
    return NextResponse.json(
      { 
        error: "Tagging failed", 
        message: err.message,
        status: err.status || 500 
      },
      { status: err.status || 500 }
    );
  }
}
