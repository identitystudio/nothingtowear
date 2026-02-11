import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Missing image" },
        { status: 400 }
      );
    }

    // Use GPT-4V to detect the clothing item type
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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

    if (!result) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    const itemData = JSON.parse(result);

    return NextResponse.json({ item: itemData });
  } catch (error) {
    console.error("Error detecting item:", error);
    return NextResponse.json(
      { error: "Failed to detect item" },
      { status: 500 }
    );
  }
}
