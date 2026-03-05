import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: (process.env.REPLICATE_API_TOKEN || "").replace(/['"]/g, "").trim(),
});

/**
 * POST /api/analyze-item
 * Replaces the old detect-item + tag-item two-route flow.
 * 2 Replicate calls instead of 4:
 *   1. Moondream2  — one comprehensive vision prompt covering type + all tags
 *   2. Llama-3-8B  — structured JSON (cheaper than 70B, fine for this task)
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

    // ── STEP 1: Vision (single comprehensive prompt) ──────────────────────────
    console.log("[analyze-item] Step 1: Moondream2 vision analysis...");

    const visionOutput = await replicate.run(
      "lucataco/moondream2:72ccb656353c348c1385df54b237eeb7bfa874bf11486cf0b9473e691b662d31",
      {
        input: {
          image,
          prompt:
            "Describe this clothing item in detail. Include: what type it is (top, bottom, dress, outerwear, shoes, or accessory), its colors, pattern, material, fit, style, and what occasions or seasons it suits.",
        },
      }
    );

    const description = Array.isArray(visionOutput)
      ? visionOutput.join("")
      : (visionOutput as unknown as string);

    console.log("[analyze-item] Vision description:", description);

    // ── STEP 2: Structure with Llama-3-8B (not 70B) ──────────────────────────
    console.log("[analyze-item] Step 2: Llama-3-8B structuring...");

    const llmPrompt = `Convert this clothing description into a JSON object.
Description: "${description}"

Return ONLY this JSON, no other text:
{
  "type": "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory",
  "color": ["string"],
  "pattern": ["string"],
  "style": ["string"],
  "fit": ["string"],
  "material": ["string"],
  "occasion": ["string"],
  "season": ["string"],
  "description": "1-2 sentence summary"
}`;

    const llmOutput = await replicate.run("meta/meta-llama-3-8b-instruct", {
      input: {
        prompt: llmPrompt,
        system_prompt:
          "You are a fashion expert. Extract structured tags from clothing descriptions. Always return valid JSON only.",
        max_new_tokens: 400,
      },
    });

    const llmContent = Array.isArray(llmOutput)
      ? llmOutput.join("")
      : (llmOutput as unknown as string);

    console.log("[analyze-item] LLM output:", llmContent);

    const objMatch = llmContent.match(/\{[\s\S]*?\}/);
    const arrMatch = llmContent.match(/\[[\s\S]*?\]/);
    let parsed: any;
    if (objMatch) {
      parsed = JSON.parse(objMatch[0]);
    } else if (arrMatch) {
      const arr = JSON.parse(arrMatch[0]);
      parsed = Array.isArray(arr) ? arr[0] : arr;
    } else {
      return NextResponse.json(
        { error: "Failed to extract JSON from LLM response", raw: llmContent },
        { status: 500 }
      );
    }

    return NextResponse.json({
      // detect-item shape
      item: {
        type: parsed.type,
        color: Array.isArray(parsed.color) ? parsed.color[0] : parsed.color,
        style: Array.isArray(parsed.style) ? parsed.style[0] : parsed.style,
        description: parsed.description,
      },
      // tag-item shape
      tags: {
        color: parsed.color,
        pattern: parsed.pattern,
        style: parsed.style,
        fit: parsed.fit,
        material: parsed.material,
        occasion: parsed.occasion,
        season: parsed.season,
        description: parsed.description,
      },
      provider: "replicate-single-step",
    });
  } catch (err: any) {
    console.error("[analyze-item] Error:", err);
    return NextResponse.json(
      { error: "Analysis failed", message: err.message },
      { status: err.status || 500 }
    );
  }
}
