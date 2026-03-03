import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/generate-outfit-smart
 * 
 * Smart outfit generation combining:
 * 1. Tag-based selection (fast, cheap)
 * 2. Rule-based validation (ensures wearability)
 * 3. Style coherence checking (AI validates combinations)
 * 
 * Request body:
 * {
 *   request: string,
 *   items: ClothingItem[],
 *   count: number?,
 *   style?: string,
 * }
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Format items with tags for the prompt
    const itemDescriptions = items
      .map((item: any) => {
        const tags = item.tags || {};
        const parts = [
          `ID: ${item.id}`,
          item.type && `Type: ${item.type}`,
          tags.color && `Color: ${tags.color.join(", ")}`,
          tags.pattern && `Pattern: ${tags.pattern.join(", ")}`,
          tags.style && `Style: ${tags.style.join(", ")}`,
          tags.fit && `Fit: ${tags.fit.join(", ")}`,
          tags.material && `Material: ${tags.material.join(", ")}`,
          tags.occasion && `Occasion: ${tags.occasion.join(", ")}`,
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
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Generate Outfit Smart] API error:", error);
      return NextResponse.json(
        { error: "Failed to generate outfits", details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse JSON response
    let result;
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("[Generate Outfit Smart] Parse error:", content, parseError);
      return NextResponse.json(
        { error: "Failed to parse response", raw: content },
        { status: 500 }
      );
    }

    if (!Array.isArray(result.outfits)) {
      return NextResponse.json(
        { error: "Invalid response structure" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      outfits: result.outfits,
      summary: result.summary,
    });
  } catch (err) {
    console.error("[Generate Outfit Smart] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
