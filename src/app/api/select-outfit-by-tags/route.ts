import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/select-outfit-by-tags
 * 
 * Selects outfit items ONLY using tag-based metadata, without analyzing images.
 * This is 10-100x cheaper and faster than image analysis.
 * 
 * Request body:
 * {
 *   request: "I need a black blazer and white shirt for work",
 *   items: [
 *     {
 *       id: "item-123",
 *       type: "top",
 *       tags: {
 *         color: ["black", "white"],
 *         pattern: ["solid"],
 *         style: ["formal"],
 *         fit: ["fitted"],
 *         material: ["wool blend"],
 *         occasion: ["work", "evening"],
 *         season: ["all-season"],
 *         description: "..."
 *       }
 *     }
 *   ]
 * }
 * 
 * Response:
 * {
 *   outfit: [{ id, type, score }],
 *   explanation: "Selected items based on matching color, style, and occasion"
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const { userRequest, items, style, rules } = await request.json();

    if (!userRequest || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid request: missing userRequest or items" },
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

    // Format items with their tags for the prompt
    const itemDescriptions = items
      .map((item: any) => {
        const tags = item.tags || {};
        const tagStr = [
          item.type && `Type: ${item.type}`,
          tags.color && `Color: ${tags.color.join(", ")}`,
          tags.pattern && `Pattern: ${tags.pattern.join(", ")}`,
          tags.style && `Style: ${tags.style.join(", ")}`,
          tags.fit && `Fit: ${tags.fit.join(", ")}`,
          tags.material && `Material: ${tags.material.join(", ")}`,
          tags.occasion && `Occasion: ${tags.occasion.join(", ")}`,
          tags.description && `Description: ${tags.description}`,
        ]
          .filter(Boolean)
          .join(" | ");

        return `ID: ${item.id}\n${tagStr}`;
      })
      .join("\n\n");

    const rulesText = rules
      ? `\n\nOutfit Rules:\n${Object.entries(rules)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join("\n")}`
      : "";

    const prompt = `You are a professional personal stylist selecting clothing items for an outfit.

User Request: "${userRequest}"
${style ? `Preferred Style: ${style}` : ""}${rulesText}

Available Items:
${itemDescriptions}

Your task:
1. Analyze which items best match the user's request based ONLY on the metadata tags provided
2. Select a valid outfit (typically 2-5 items)
3. Prioritize items that best match the request keywords
4. Ensure the outfit is cohesive and wearable

Return a JSON object with:
{
  "selectedIds": ["item-id-1", "item-id-2"],
  "explanation": "Brief explanation of selections",
  "scores": { "item-id-1": 0.95, "item-id-2": 0.87 }
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
        max_tokens: 800,
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
      console.error("[Select Outfit] Anthropic API error:", error);
      return NextResponse.json(
        { error: "Failed to select outfit", details: error },
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
      console.error("[Select Outfit] Failed to parse response:", content, parseError);
      return NextResponse.json(
        { error: "Failed to parse outfit selection", raw: content },
        { status: 500 }
      );
    }

    // Validate response
    if (!Array.isArray(result.selectedIds)) {
      return NextResponse.json(
        { error: "Invalid response: missing selectedIds" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      outfit: result.selectedIds.map((id: string) => ({
        id,
        score: result.scores?.[id] || 0.5,
      })),
      explanation: result.explanation || "Outfit selected based on matching tags",
      fullResponse: result,
    });
  } catch (err) {
    console.error("[Select Outfit] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
