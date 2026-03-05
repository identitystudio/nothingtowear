import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: (process.env.REPLICATE_API_TOKEN || "").replace(/['"]/g, "").trim(),
});

/**
 * POST /api/detect-item
 * Detects clothing item type, color, and style using a Two-Step Replicate process:
 * 1. Vision (Moondream2) -> Natural language description
 * 2. Structuring (Llama-3) -> JSON output
 */
export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }

    if (!(process.env.REPLICATE_API_TOKEN || "").replace(/['"]/g, "").trim()) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    // STEP 1: Vision - Get description
    console.log("[detect-item] Step 1: Calling Moondream2 for description...");
    const visionOutput = await replicate.run(
      "lucataco/moondream2:72ccb656353c348c1385df54b237eeb7bfa874bf11486cf0b9473e691b662d31",
      {
        input: {
          image: image,
          prompt: "Describe this clothing item in detail, including its type, colors, and style.",
        },
      }
    );

    const description = Array.isArray(visionOutput) ? visionOutput.join("") : (visionOutput as unknown as string);
    console.log("[detect-item] Vision Description:", description);

    // STEP 2: Structuring - Get JSON
    console.log("[detect-item] Step 2: Calling Llama-3 for JSON structuring...");
    const llmPrompt = `The image contains multiple visible items, but focus on the MAIN clothing item only.
Description: "${description}"

Return a single JSON object for the primary item:
{
  "type": "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory",
  "color": "string",
  "style": "string",
  "description": "1-sentence summary"
}

Return ONLY that one JSON object. No arrays. No other text.`;

    const llmOutput = await replicate.run(
      "meta/meta-llama-3-70b-instruct",
      {
        input: {
          prompt: llmPrompt,
          system_prompt: "You are a helpful assistant that extracts structured data from text. Always return a single valid JSON object (never an array).",
          max_new_tokens: 200,
        },
      }
    );

    const llmContent = Array.isArray(llmOutput) ? llmOutput.join("") : (llmOutput as unknown as string);
    console.log("[detect-item] LLM Raw JSON:", llmContent);

    // Extract JSON — handles both object and array responses
    let itemData: any;
    const objMatch = llmContent.match(/\{[\s\S]*?\}/);
    const arrMatch = llmContent.match(/\[[\s\S]*?\]/);
    try {
      if (objMatch) {
        itemData = JSON.parse(objMatch[0]);
      } else if (arrMatch) {
        // LLM returned an array despite instructions — take the first element
        const arr = JSON.parse(arrMatch[0]);
        itemData = Array.isArray(arr) ? arr[0] : arr;
      } else {
        throw new Error("No JSON found in response");
      }
      return NextResponse.json({ item: itemData, provider: "replicate-dual-step" });
    } catch (parseError) {
      console.error("[detect-item] Failed to parse LLM response:", llmContent);
      return NextResponse.json(
        { error: "Failed to structure response", raw: llmContent },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[detect-item] Dual-Step Error:", err);
    return NextResponse.json(
      { 
        error: "Detection failed", 
        message: err.message,
        status: err.status || 500 
      },
      { status: err.status || 500 }
    );
  }
}
