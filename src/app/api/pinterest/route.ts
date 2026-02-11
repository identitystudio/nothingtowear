import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const { boardUrl } = await request.json();

    if (!boardUrl) {
      return NextResponse.json(
        { error: "Missing Pinterest board URL" },
        { status: 400 }
      );
    }

    // Fetch the Pinterest board page HTML
    const response = await fetch(boardUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not fetch Pinterest board" },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Extract image URLs from the Pinterest page
    // Pinterest embeds image data in script tags as JSON
    const imageUrls: string[] = [];

    // Pattern 1: Look for og:image and pin images in meta tags
    const ogImageMatches = html.matchAll(
      /content="(https:\/\/i\.pinimg\.com\/[^"]+)"/g
    );
    for (const match of ogImageMatches) {
      if (match[1] && !imageUrls.includes(match[1])) {
        imageUrls.push(match[1]);
      }
    }

    // Pattern 2: Look for pinimg URLs in the HTML
    const pinImgMatches = html.matchAll(
      /(https:\/\/i\.pinimg\.com\/\d+x\/[a-f0-9\/]+\.[a-z]+)/g
    );
    for (const match of pinImgMatches) {
      if (match[1] && !imageUrls.includes(match[1])) {
        imageUrls.push(match[1]);
      }
    }

    // Deduplicate and limit
    const uniqueImages = [...new Set(imageUrls)].slice(0, 30);

    if (uniqueImages.length === 0) {
      return NextResponse.json(
        { error: "No images found on this board. Try a public board URL." },
        { status: 400 }
      );
    }

    // Analyze the style DNA from the collection of pins
    const styleDnaResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a fashion analyst. Analyze a collection of Pinterest outfit pins to determine someone's "Style DNA."
Return ONLY valid JSON, no markdown, no code blocks.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze these ${Math.min(uniqueImages.length, 10)} outfit pins from a user's Pinterest board.
Determine their Style DNA and return:
{
  "style_dna": {
    "primary_aesthetic": "main style (e.g., quiet luxury, clean girl, edgy minimalist)",
    "secondary_aesthetic": "secondary influence",
    "color_palette": ["their preferred colors"],
    "silhouettes": ["preferred silhouettes"],
    "patterns": ["preferred patterns or textures"],
    "brands_vibe": ["brands that match this aesthetic"],
    "mood": "emotional description of their style"
  },
  "outfit_formulas": [
    "formula 1 (e.g., oversized blazer + fitted pants + pointed shoes)",
    "formula 2",
    "formula 3"
  ],
  "styling_rules": [
    "rule 1 (e.g., always tucks in tops)",
    "rule 2",
    "rule 3"
  ],
  "key_pieces": ["essential items that define this style"]
}`,
            },
            // Send up to 10 pin images for analysis
            ...uniqueImages.slice(0, 10).map((url) => ({
              type: "image_url" as const,
              image_url: { url, detail: "low" as const },
            })),
          ],
        },
      ],
      max_tokens: 1500,
    });

    const dnaText = styleDnaResponse.choices[0]?.message?.content || "{}";
    let styleDna;
    try {
      styleDna = JSON.parse(dnaText);
    } catch {
      const jsonMatch = dnaText.match(/\{[\s\S]*\}/);
      styleDna = jsonMatch ? JSON.parse(jsonMatch[0]) : { style_dna: { primary_aesthetic: "unknown" } };
    }

    return NextResponse.json({
      images: uniqueImages,
      styleDna,
      pinCount: uniqueImages.length,
    });
  } catch (error) {
    console.error("Error fetching Pinterest board:", error);
    return NextResponse.json(
      { error: "Failed to analyze Pinterest board" },
      { status: 500 }
    );
  }
}
