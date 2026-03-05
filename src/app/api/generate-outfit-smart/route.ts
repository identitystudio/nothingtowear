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
${style ? `Weather/Occasion Context: ${style}` : ""}

Available Clothing Items (metadata):
${itemDescriptions}

Your task:
1. Generate ${count} cohesive outfit combinations
2. STRICTLY respect the weather/occasion context — if it's hot/summer, avoid heavy coats and layers; if it's cold/winter, include warm layers; if traveling, prioritize versatile and packable pieces
3. Each outfit must match both the user's request AND the weather/occasion context
4. Prioritize items with matching tags (color, style, occasion, season)

MANDATORY OUTFIT STRUCTURE — every outfit MUST include all three:
- ONE top (shirt, blouse, sweater, etc.)
- ONE bottom (pants, jeans, shorts, skirt, trousers)
- ONE shoes item
- Outerwear (jacket, coat, cardigan) is OPTIONAL — only include if weather/style calls for it
- Accessories (bag, scarf, hat) are OPTIONAL

EXCEPTIONS:
- Dress outfit: ONE dress + ONE shoes (no separate top or bottom)
- Swimwear outfit: ONLY the swimwear piece(s), no shoes, no top, no bottom

STRICT RULES — violating these makes the outfit invalid:
- NEVER include more than one "bottom" type item in a single outfit
- NEVER include more than one "top" type item in a single outfit
- NEVER include more than one "outerwear" item (jacket, coat, blazer, cardigan, hoodie) in a single outfit
- NEVER include more than one "dress" in a single outfit
- A dress outfit should NOT also include a separate top or bottom
- A bikini or swimsuit outfit should contain ONLY the swimwear piece(s)
- If no shoes are available in the closet, still build the outfit but note shoes are missing

Return a JSON object with:
{
  "outfits": [
    {
      "itemIds": ["item-id-1", "item-id-2", ...],
      "explanation": "Why these items work together and fit the weather/occasion"
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
          max_new_tokens: 4000,
          temperature: 0.7,
        },
      }
    );

    const content = Array.isArray(output) ? output.join("") : (output as unknown as string);
    console.log("[Generate Outfit Smart] Replicate response received");

    // Robust JSON extraction with truncation repair
    let result;
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
        // Repair truncated JSON: count and close any unclosed brackets
        let open = 0;
        for (const ch of jsonStr) {
          if (ch === "{" || ch === "[") open++;
          else if (ch === "}" || ch === "]") open--;
        }
        // If truncated, close open brackets in reverse
        const stack: string[] = [];
        for (const ch of jsonStr) {
          if (ch === "{") stack.push("}");
          else if (ch === "[") stack.push("]");
          else if (ch === "}" || ch === "]") stack.pop();
        }
        if (stack.length > 0) {
          jsonStr = jsonStr.trimEnd().replace(/,\s*$/, "") + stack.reverse().join("");
        }
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

    // Build a lookup map: itemId -> item type
    const itemTypeMap = new Map<string, string>();
    for (const item of items) {
      if (item.id && item.type) itemTypeMap.set(item.id, item.type.toLowerCase());
    }

    // Normalize any raw item type string into a canonical category
    const normalizeCategory = (type: string): string => {
      const t = type.toLowerCase().trim();
      if (["pants", "jeans", "shorts", "skirt", "trousers", "bottom", "chinos", "leggings"].includes(t)) return "bottom";
      if (["top", "shirt", "blouse", "tshirt", "t-shirt", "tank", "tank top", "polo", "tee"].includes(t)) return "top";
      if (["outerwear", "jacket", "coat", "cardigan", "blazer", "hoodie", "sweater", "vest", "parka", "windbreaker"].includes(t)) return "outerwear";
      if (["shoes", "sneakers", "boots", "heels", "sandals", "loafers", "flats", "oxfords", "mules", "slides"].includes(t)) return "shoes";
      if (["dress", "jumpsuit", "romper", "maxi", "mini dress"].includes(t)) return "dress";
      if (["bikini", "swimwear", "swimsuit", "one-piece", "swim", "swim top", "swim bottom"].includes(t)) return "swimwear";
      // accessories allow multiples — return the raw type so each unique accessory type is its own category
      return t;
    };

    // Categories where only ONE item is allowed per outfit
    const SINGULAR_CATEGORIES = new Set(["bottom", "top", "outerwear", "shoes", "dress", "swimwear"]);
    // Accessory types that can have multiples (bag, hat, scarf, belt, jewelry, etc.)
    // Anything not in SINGULAR_CATEGORIES is treated as multi-allowed

    const sanitizedOutfits = result.outfits.map((outfit: { itemIds: string[]; explanation: string }) => {
      const seenCategories = new Map<string, string>(); // category -> first item id
      const keptIds: string[] = [];

      for (const id of outfit.itemIds) {
        const rawType = itemTypeMap.get(id) || "";
        const category = normalizeCategory(rawType);

        if (SINGULAR_CATEGORIES.has(category)) {
          if (!seenCategories.has(category)) {
            seenCategories.set(category, id);
            keptIds.push(id);
          }
          // else: duplicate category — drop silently
        } else {
          keptIds.push(id); // accessories etc — allow multiples
        }
      }

      // Swimwear: keep only swimwear item(s)
      if (seenCategories.has("swimwear")) {
        return { ...outfit, itemIds: keptIds.filter(id => normalizeCategory(itemTypeMap.get(id) || "") === "swimwear") };
      }

      // Dress: strip any separate top or bottom
      if (seenCategories.has("dress")) {
        return { ...outfit, itemIds: keptIds.filter(id => !["top", "bottom"].includes(normalizeCategory(itemTypeMap.get(id) || ""))) };
      }

      // Standard outfit: auto-fill any missing required category
      const requiredCategories = ["top", "bottom", "shoes"];
      for (const required of requiredCategories) {
        if (!seenCategories.has(required)) {
          // Find any unused item of this category from the full closet
          const candidate = items.find((item: any) => {
            const cat = normalizeCategory((item.type || "").toLowerCase());
            return cat === required && !keptIds.includes(item.id);
          });
          if (candidate) {
            keptIds.push(candidate.id);
            seenCategories.set(required, candidate.id);
          }
        }
      }

      return { ...outfit, itemIds: keptIds };
    });

    return NextResponse.json({
      outfits: sanitizedOutfits,
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
