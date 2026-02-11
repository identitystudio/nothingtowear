import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const { renderImageUrl } = await request.json();

    if (!renderImageUrl) {
      return NextResponse.json(
        { error: "Missing renderImageUrl" },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "You are a quality control system for virtual try-on renders. You evaluate whether an AI-generated image of clothing on a person looks natural and trustworthy. Be strict — users will lose trust if anything looks off.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: renderImageUrl, detail: "low" },
            },
            {
              type: "text",
              text: `Score this virtual try-on render from 1-10 on visual quality. Check for:
- Warped or melted body parts (arms, shoulders, neck, hands)
- Clothing clipping through the body or floating
- Unnatural fabric rendering (impossible wrinkles, flat texture)
- Face distortion or uncanny appearance
- Mismatched lighting or skin tone shifts
- Overall "does this look like a real person wearing real clothes?"

Respond with ONLY valid JSON, no markdown:
{"score": <1-10>, "pass": <true if score >= 7, false otherwise>, "issue": "<brief reason if fail, empty string if pass>"}`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = { score: 5, pass: false, issue: "Could not parse quality check" };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Quality check error:", error);
    const message =
      error instanceof Error ? error.message : "Quality check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
