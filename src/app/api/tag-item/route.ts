import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * POST /api/tag-item
 * Auto-generates clothing tags and description from an image using Claude Vision API
 * 
 * Request body:
 * {
 *   image: string (data URI or https URL),
 *   itemType?: string (hint: "top", "bottom", "dress", etc.)
 * }
 * 
 * Response:
 * {
 *   color: string[],
 *   pattern: string[],
 *   style: string[],
 *   fit: string[],
 *   material: string[],
 *   occasion: string[],
 *   season: string[],
 *   condition: string,
 *   description: string
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const { image, itemType } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Missing image parameter" },
        { status: 400 }
      );
    }

    // Use Anthropic Claude API for vision tagging
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Prepare image for Claude
    let imageSource: {
      type: "base64" | "url";
      media_type?: string;
      data?: string;
      url?: string;
    };

    if (image.startsWith("http")) {
      imageSource = {
        type: "url",
        url: image,
      };
    } else {
      // Convert data URI to base64
      const match = image.match(/^data:(.+?);base64,(.+)$/);
      if (!match) {
        return NextResponse.json(
          { error: "Invalid image format" },
          { status: 400 }
        );
      }
      const mimeType = match[1];
      const base64Data = match[2];
      imageSource = {
        type: "base64",
        media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: base64Data,
      };
    }

    const prompt = `Analyze this clothing item image and extract the following tags and description.

${itemType ? `Item type hint: ${itemType}` : ''}

Return a valid JSON object with EXACTLY these fields (no extra fields, no markdown):
{
  "color": ["list of colors present"],
  "pattern": ["solid", "striped", etc if applicable],
  "style": ["minimalist", "bohemian", "preppy", "edgy", "romantic", "vintage", "athletic", "casual", "formal", etc],
  "fit": ["fitted", "loose", "oversized", "slim", "relaxed"],
  "material": ["cotton", "silk", "wool", "linen", "leather", "polyester", "denim", "rayon", etc],
  "occasion": ["casual", "work", "evening", "date", "sporty", "weekend", "formal"],
  "season": ["all-season", "summer", "winter", "spring", "fall"],
  "condition": "excellent|good|fair|worn",
  "description": "2-3 sentence description of the item focusing on distinctive features"
}

Guidelines:
- Be specific and precise with colors (e.g., "sage green" not just "green")
- Identify all visible patterns
- The description should highlight what makes this piece unique or notable
- condition: assess based on visible wear, stains, or damage
- Focus only on what you can see in the image`;

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: imageSource,
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Tag Item] Anthropic API error:", error);
      return NextResponse.json(
        { error: "Failed to analyze image", details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to parse the JSON response
    let tags;
    try {
      tags = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error(
        "[Tag Item] Failed to parse Claude response:",
        content,
        parseError
      );
      return NextResponse.json(
        {
          error: "Failed to parse tagging response",
          raw: content,
        },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!tags.description || typeof tags.description !== "string") {
      return NextResponse.json(
        { error: "Invalid tagging response: missing description" },
        { status: 500 }
      );
    }

    return NextResponse.json(tags);
  } catch (err) {
    console.error("[Tag Item] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
