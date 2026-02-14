import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "",
});

export const maxDuration = 120;

/**
 * Convert a data URI to a File object the Replicate SDK can upload.
 * If it's already an https:// URL, return as-is.
 */
function dataUriToFile(dataUri: string, name: string): File | string {
  if (dataUri.startsWith("https://") || dataUri.startsWith("http://")) {
    return dataUri;
  }

  const match = dataUri.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error(`Invalid data URI format for ${name}`);
  }

  const mimeType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");
  const blob = new Blob([buffer], { type: mimeType });
  const ext = mimeType.includes("png") ? "png" : "jpg";
  return new File([blob], `${name}.${ext}`, { type: mimeType });
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "Replicate API token not configured" },
        { status: 500 }
      );
    }

    const { bodyPhoto, clothingItem, garmentDescription } =
      await request.json();

    if (!bodyPhoto || !clothingItem) {
      return NextResponse.json(
        { error: "Missing required fields: bodyPhoto and clothingItem" },
        { status: 400 }
      );
    }

    console.log(
      `[generate-outfit] ✓ Received request — body: ${bodyPhoto.substring(0, 40)}... (${(bodyPhoto.length / 1024).toFixed(0)}KB), garment: ${clothingItem.substring(0, 40)}... (${(clothingItem.length / 1024).toFixed(0)}KB)`
    );

    console.log("[generate-outfit] 📸 Body photo type:", bodyPhoto.startsWith("data:") ? "Base64 Data URL (from localStorage)" : "HTTP URL (from Supabase)");
    console.log("[generate-outfit] 👕 Clothing item type:", clothingItem.startsWith("data:") ? "Base64 Data URL" : "HTTP URL (from Supabase)");

    // Convert data URIs to File objects for reliable Replicate upload
    const humanImg = dataUriToFile(bodyPhoto, "human");
    const garmImg = dataUriToFile(clothingItem, "garment");

    console.log(
      `[generate-outfit] ✓ Prepared for upload — human: ${typeof humanImg === "string" ? "URL" : `File (${humanImg instanceof File ? (humanImg.size / 1024).toFixed(0) + "KB" : "converted"})`}, garment: ${typeof garmImg === "string" ? "URL" : `File (${garmImg instanceof File ? (garmImg.size / 1024).toFixed(0) + "KB" : "converted"})`}`
    );

    console.log("[generate-outfit] 🚀 SENDING IMAGES TO REPLICATE AI API...");
    console.log("[generate-outfit] Model: IDM-VTON (cuuupid/idm-vton)");
    console.log("[generate-outfit] API Token:", process.env.REPLICATE_API_TOKEN ? "✓ Configured" : "✗ Missing");

    const output = await replicate.run(
      "cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4",
      {
        input: {
          human_img: humanImg,
          garm_img: garmImg,
          garment_des: garmentDescription || "a clothing garment",
        },
      }
    );

    console.log("[generate-outfit] ✅ REPLICATE AI RECEIVED IMAGES SUCCESSFULLY!");
    console.log("[generate-outfit] 🎨 Processing virtual try-on...");
    console.log(
      "[generate-outfit] Response type:",
      typeof output,
      Array.isArray(output) ? `array(${(output as unknown[]).length})` : "",
      output ? String(output).substring(0, 150) : "null"
    );

    // Replicate can return: string URL, array of URLs/FileOutputs, single FileOutput
    let imageUrl: string | null = null;

    if (typeof output === "string") {
      imageUrl = output;
    } else if (Array.isArray(output)) {
      const first = output[0];
      if (typeof first === "string") {
        imageUrl = first;
      } else if (first && typeof first === "object") {
        // FileOutput — try .url(), .toString(), or direct property access
        const fo = first as Record<string, unknown>;
        if (typeof fo.url === "function") {
          imageUrl = (fo.url as () => string)();
        } else if (typeof fo.url === "string") {
          imageUrl = fo.url;
        } else {
          const str = String(first);
          if (str.startsWith("http")) imageUrl = str;
        }
      }
    } else if (output && typeof output === "object") {
      const fo = output as Record<string, unknown>;
      if (typeof fo.url === "function") {
        imageUrl = (fo.url as () => string)();
      } else if (typeof fo.url === "string") {
        imageUrl = fo.url;
      } else {
        const str = String(output);
        if (str.startsWith("http")) imageUrl = str;
      }
    }

    console.log("[generate-outfit] ✓ Generated image URL:", imageUrl?.substring(0, 100) || "NONE");

    if (
      !imageUrl ||
      imageUrl === "[object Object]" ||
      imageUrl === "[object ReadableStream]"
    ) {
      console.error("[generate-outfit] ✗ Invalid response from Replicate");
      return NextResponse.json(
        {
          error: `Replicate returned unexpected format: ${typeof output} — ${String(output).substring(0, 200)}`,
        },
        { status: 500 }
      );
    }

    console.log("[generate-outfit] 🎉 SUCCESS! Virtual try-on complete!");
    console.log("[generate-outfit] 📤 Returning result to client");
    return NextResponse.json({ result: imageUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate outfit";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[generate-outfit] ERROR:", message);
    if (stack) console.error("[generate-outfit] Stack:", stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
