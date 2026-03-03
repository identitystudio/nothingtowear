import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: (process.env.REPLICATE_API_TOKEN || "").replace(/['"]/g, "").trim(),
});

/**
 * POST /api/generate-outfit-smart
 * Smart outfit generation using Replicate (Llama 3)
 */
export async function POST(request: NextRequest) {
  try {
    const { userRequest, items, count = 5, style } = await request.json();

    if (!userRequest || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("[Generate Outfit Smart] REPLICATE_API_TOKEN missing");
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Format items with tags for the prompt
    console.log(`[Generate Outfit Smart] Formatting ${items.length} items...`);
    const itemDescriptions = items
      .map((item: any) => {
        const tags = item.tags || {};
        const parts = [
          `ID: ${item.id}`,
          item.type && `Type: ${item.type}`,
          tags.color && `Color: ${Array.isArray(tags.color) ? tags.color.join(", ") : tags.color}`,
          tags.pattern && `Pattern: ${Array.isArray(tags.pattern) ? tags.pattern.join(", ") : tags.pattern}`,
          tags.style && `Style: ${Array.isArray(tags.style) ? tags.style.join(", ") : tags.style}`,
          tags.fit && `Fit: ${Array.isArray(tags.fit) ? tags.fit.join(", ") : tags.fit}`,
          tags.material && `Material: ${Array.isArray(tags.material) ? tags.material.join(", ") : tags.material}`,
          tags.occasion && `Occasion: ${Array.isArray(tags.occasion) ? tags.occasion.join(", ") : tags.occasion}`,
          tags.description && `Description: ${tags.description}`,
        ].filter(Boolean);
        return parts.join(" | ");
      })
      .join("\n");

    const prompt = `You are a professional stylist generating outfit combinations.

User Request: "${userRequest}"
${style ? `Preferred Style/Occasion: ${style}` : ""}

Available Clothing Items (metadata):
${itemDescriptions}

Your task:
1. Generate ${count} cohesive outfit combinations
2. Each outfit should match the user's request
3. Each outfit should be wearable (typically 2-5 items per outfit)
4. Prioritize items with matching tags (color, style, occasion)

Return a JSON object with:
{
  "outfits": [
    {
      "itemIds": ["item-id-1", "item-id-2", ...],
      "explanation": "Why these items work together"
    },
    ...
  ],
  "summary": "Overall approach taken for selections"
}

IMPORTANT: Return ONLY the JSON object, no other text.`;

    console.log("[Generate Outfit Smart] Calling Replicate Llama 3...");
    
    const output = await replicate.run(
      "meta/meta-llama-3-70b-instruct",
      {
        input: {
          prompt: prompt,
          max_new_tokens: 2000,
          temperature: 0.7,
        },
      }
    );

    const content = Array.isArray(output) ? output.join("") : (output as unknown as string);
    console.log("[Generate Outfit Smart] Replicate response received");

    // Robust JSON extraction
    let result;
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("[Generate Outfit Smart] JSON Parse Error:", parseError);
      console.error("[Generate Outfit Smart] Raw content:", content);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: content },
        { status: 500 }
      );
    }

    if (!result || !Array.isArray(result.outfits)) {
      console.error("[Generate Outfit Smart] Invalid AI response structure:", result);
      return NextResponse.json(
        { error: "Invalid response structure from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      outfits: result.outfits,
      summary: result.summary,
    });
  } catch (err) {
    console.error("[Generate Outfit Smart] Critical error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
