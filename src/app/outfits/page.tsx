"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getAllImagesFromDB } from "@/lib/closet-db";

interface ClothingItem {
  id: string;
  image: string;
  type?: "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory";
  color?: string;
  style?: string;
}

interface Outfit {
  id: string;
  items: ClothingItem[];
  style?: string;
  tightsRec?: string;
  tryOnImage?: string;
  tryOnLoading?: boolean;
  tryOnError?: string;
  tryOnPassed?: boolean;
  tryOnScore?: number;
  tryOnChecking?: boolean;
}

const FREE_REVEAL_LIMIT = 3;

type WeatherMode = "hot" | "cold" | "location";


// ── Tights Intelligence ──
// Nude sheer, opaque nude, skin-tone sheer, black sheer/opaque,
// grey sheer/opaque (3 shades each), white sheer/opaque, colored sheer
function getTightsRecommendation(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("date") || lower.includes("evening") || lower.includes("night"))
    return "Black sheer tights — classic evening polish";
  if (lower.includes("work") || lower.includes("office") || lower.includes("meeting"))
    return "Nude sheer or opaque nude — polished and professional";
  if (lower.includes("edgy") || lower.includes("concert") || lower.includes("party"))
    return "Black opaque or dark grey sheer — bold statement";
  if (lower.includes("brunch") || lower.includes("casual") || lower.includes("friend"))
    return "Skin-tone sheer — flawless legs, effortless";
  if (lower.includes("elegant") || lower.includes("sophisticated"))
    return "Medium grey sheer — understated elegance";
  if (lower.includes("mono") || lower.includes("color"))
    return "Match your outfit color in sheer — the monochromatic flex";
  return "Nude sheer or skin-tone sheer — your everyday secret weapon";
}

// Flat-lay positions for editorial composition
const FLATLAY_POSITIONS: Record<
  number,
  { top: string; left: string; rotate: string; width: string; zIndex: number }[]
> = {
  2: [
    { top: "8%", left: "20%", rotate: "-4deg", width: "52%", zIndex: 2 },
    { top: "48%", left: "28%", rotate: "3deg", width: "48%", zIndex: 1 },
  ],
  3: [
    { top: "5%", left: "22%", rotate: "-3deg", width: "50%", zIndex: 3 },
    { top: "42%", left: "12%", rotate: "2deg", width: "44%", zIndex: 2 },
    { top: "58%", left: "52%", rotate: "-5deg", width: "36%", zIndex: 1 },
  ],
  4: [
    { top: "3%", left: "24%", rotate: "-3deg", width: "48%", zIndex: 4 },
    { top: "38%", left: "8%", rotate: "2deg", width: "42%", zIndex: 3 },
    { top: "40%", left: "52%", rotate: "-4deg", width: "40%", zIndex: 2 },
    { top: "72%", left: "34%", rotate: "6deg", width: "30%", zIndex: 1 },
  ],
  5: [
    { top: "2%", left: "22%", rotate: "-3deg", width: "46%", zIndex: 5 },
    { top: "34%", left: "6%", rotate: "3deg", width: "40%", zIndex: 4 },
    { top: "32%", left: "54%", rotate: "-5deg", width: "38%", zIndex: 3 },
    { top: "65%", left: "16%", rotate: "4deg", width: "32%", zIndex: 2 },
    { top: "68%", left: "54%", rotate: "-2deg", width: "28%", zIndex: 1 },
  ],
};

function getFlatlayPositions(count: number) {
  const key = Math.min(count, 5);
  return FLATLAY_POSITIONS[key] || FLATLAY_POSITIONS[3];
}

export default function OutfitsPage() {
  const router = useRouter();
  const [bodyPhoto, setBodyPhoto] = useState<string | null>(null);
  const [closetItems, setClosetItems] = useState<ClothingItem[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [weatherMode, setWeatherMode] = useState<WeatherMode>("hot");
  const [locationInput, setLocationInput] = useState("");
  const [generatedOutfits, setGeneratedOutfits] = useState<Outfit[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [generationProgress, setGenerationProgress] = useState("");

  // Freemium gating
  const [revealedOutfitIds, setRevealedOutfitIds] = useState<Set<string>>(
    new Set()
  );
  const [totalRevealsUsed, setTotalRevealsUsed] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  // Item type correction popup
  const [correctingItem, setCorrectingItem] = useState<ClothingItem | null>(null);

  useEffect(() => {
    const savedBodyPhoto = localStorage.getItem("bodyPhoto");
    if (!savedBodyPhoto) {
      router.push("/onboarding");
      return;
    }
    setBodyPhoto(savedBodyPhoto);

    const savedReveals = localStorage.getItem("tryOnRevealsUsed");
    if (savedReveals) setTotalRevealsUsed(parseInt(savedReveals, 10));
    const premium = localStorage.getItem("isPremium");
    if (premium === "true") setIsPremium(true);

    async function loadClosetItems() {
      console.log("[Outfits] Loading closet items...");
      const savedMeta = localStorage.getItem("closetItemsMeta");
      const legacyItems = localStorage.getItem("closetItems");

      let meta: { id: string; type?: string }[] = [];
      if (savedMeta) {
        meta = JSON.parse(savedMeta);
        console.log(`[Outfits] Found ${meta.length} items in metadata store`);
      } else if (legacyItems) {
        console.log("[Outfits] Using legacy closetItems format");
        const legacy = JSON.parse(legacyItems);
        setClosetItems(legacy);
        setIsLoading(false);
        return;
      }

      if (meta.length === 0) {
        router.push("/closet");
        return;
      }

      console.log("[Outfits] Loading images from IndexedDB...");
      const imageMap = await getAllImagesFromDB();
      console.log(`[Outfits] Loaded ${imageMap.size} images from IndexedDB`);

      const items: ClothingItem[] = [];
      for (const m of meta) {
        const img = imageMap.get(m.id);
        if (img) {
          items.push({
            id: m.id,
            image: img,
            type: m.type as ClothingItem["type"],
          });
        }
      }

      console.log(`[Outfits] ${items.length} closet items ready`);
      if (items.length === 0) {
        router.push("/closet");
        return;
      }
      setClosetItems(items);
      setIsLoading(false);
    }

    loadClosetItems();
  }, [router]);

  const shuffle = <T,>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const createOutfitCombos = useCallback(
    (items: ClothingItem[], count: number, isCold: boolean): ClothingItem[][] => {
      const byType: Record<string, ClothingItem[]> = {};
      for (const item of items) {
        const t = item.type || "unknown";
        if (!byType[t]) byType[t] = [];
        byType[t].push(item);
      }

      const tops = byType["top"] || [];
      const bottoms = byType["bottom"] || [];
      const dresses = byType["dress"] || [];
      const shoes = byType["shoes"] || [];
      const outerwear = byType["outerwear"] || [];
      const accessories = byType["accessory"] || [];

      console.log(`[Outfits] Closet breakdown — tops: ${tops.length}, bottoms: ${bottoms.length}, dresses: ${dresses.length}, shoes: ${shoes.length}, outerwear: ${outerwear.length}, accessories: ${accessories.length}, unknown: ${(byType["unknown"] || []).length}`);

      // Pre-shuffle each pool ONCE, then rotate through with offset per outfit for variety
      const shuffledTops = shuffle(tops);
      const shuffledBottoms = shuffle(bottoms);
      const shuffledDresses = shuffle(dresses);
      const shuffledShoes = shuffle(shoes);
      const shuffledOuterwear = shuffle(outerwear);
      const shuffledAccessories = shuffle(accessories);

      const usedItemSets = new Set<string>(); // track combos to avoid duplicates
      const outfits: ClothingItem[][] = [];
      const attempts = count * 3; // try extra rounds to get enough unique combos

      for (let i = 0; i < attempts && outfits.length < count; i++) {
        const outfit: ClothingItem[] = [];

        // Core: dress OR (top + bottom) — MUST have one
        const useDress = shuffledDresses.length > 0 && (shuffledTops.length === 0 || Math.random() > 0.6);
        if (useDress) {
          outfit.push(shuffledDresses[i % shuffledDresses.length]);
        } else {
          if (shuffledTops.length === 0) continue;
          outfit.push(shuffledTops[i % shuffledTops.length]);
          if (shuffledBottoms.length === 0) continue;
          outfit.push(shuffledBottoms[i % shuffledBottoms.length]);
        }

        // Shoes — rotate through pool (one per outfit, no duplicates across slides)
        if (shuffledShoes.length > 0) {
          outfit.push(shuffledShoes[i % shuffledShoes.length]);
        }

        // Outerwear — 80% in cold, 20% in hot
        const outerwearChance = isCold ? 0.8 : 0.2;
        if (shuffledOuterwear.length > 0 && Math.random() < outerwearChance) {
          outfit.push(shuffledOuterwear[i % shuffledOuterwear.length]);
        }

        // Accessory — 40% chance
        if (shuffledAccessories.length > 0 && Math.random() < 0.4) {
          outfit.push(shuffledAccessories[i % shuffledAccessories.length]);
        }

        if (outfit.length < 2) continue;

        // Deduplicate: check if this exact combo already exists
        const comboKey = outfit.map((o) => o.id).sort().join("|");
        if (usedItemSets.has(comboKey)) continue;
        usedItemSets.add(comboKey);

        outfits.push(outfit);
      }

      // Fallback if typed combos produced nothing — still enforce max 1 per core type
      if (outfits.length === 0) {
        console.log("[Outfits] Typed combos empty — using type-safe random fallback");
        const shuffled = shuffle(items);
        for (let i = 0; i < count; i++) {
          const combo: ClothingItem[] = [];
          const usedTypes = new Set<string>();
          for (const item of shuffled) {
            const t = item.type || `unknown-${item.id}`;
            // Only allow one item per core clothing type
            const coreType = ["top", "bottom", "dress", "shoes", "outerwear"].includes(t) ? t : t;
            if (usedTypes.has(coreType)) continue;
            usedTypes.add(coreType);
            combo.push(item);
            if (combo.length >= 4) break;
          }
          if (combo.length >= 2) outfits.push(combo);
        }
      }

      return outfits;
    },
    []
  );

  // Compress image for try-on — IDM-VTON works best at 768px
  const compressForTryOn = (dataUrl: string, maxSize = 768): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(dataUrl); // fallback to original
      img.src = dataUrl;
    });
  };

  // ── Tier 3 Pipeline ──
  const runTryOnPipeline = async (
    outfitId: string,
    bodyImg: string,
    garmentImg: string
  ) => {
    console.log(`[Outfits] Starting try-on pipeline for outfit ${outfitId}`);
    try {
      // Compress images for faster upload and better model performance
      console.log("[Outfits] Compressing images for try-on...");
      const [compressedBody, compressedGarment] = await Promise.all([
        compressForTryOn(bodyImg),
        compressForTryOn(garmentImg),
      ]);
      console.log(`[Outfits] Compressed — body: ${(compressedBody.length / 1024).toFixed(0)}KB, garment: ${(compressedGarment.length / 1024).toFixed(0)}KB`);

      console.log("[Outfits] Calling /api/generate-outfit...");
      const renderRes = await fetch("/api/generate-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyPhoto: compressedBody, clothingItem: compressedGarment }),
      });

      if (!renderRes.ok) {
        const errData = await renderRes.json().catch(() => ({}));
        throw new Error(errData.error || "Render failed");
      }

      const renderData = await renderRes.json();
      console.log(`[Outfits] API response:`, JSON.stringify(renderData).substring(0, 200));

      let imageUrl: string | undefined;
      if (typeof renderData.result === "string") imageUrl = renderData.result;
      else if (Array.isArray(renderData.result) && renderData.result.length > 0)
        imageUrl = typeof renderData.result[0] === "string" ? renderData.result[0] : String(renderData.result[0]);
      else if (renderData.result?.output) imageUrl = renderData.result.output;
      else if (renderData.output) imageUrl = renderData.output;

      if (!imageUrl) throw new Error(`No image returned — raw: ${JSON.stringify(renderData).substring(0, 300)}`);
      console.log(`[Outfits] Render complete for ${outfitId}: ${imageUrl.substring(0, 80)}...`);

      setGeneratedOutfits((prev) =>
        prev.map((o) =>
          o.id === outfitId
            ? { ...o, tryOnImage: imageUrl, tryOnLoading: false, tryOnChecking: true }
            : o
        )
      );

      console.log("[Outfits] Running quality check...");
      const qualityRes = await fetch("/api/check-render-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renderImageUrl: imageUrl }),
      });

      let passed = false;
      let score = 0;
      if (qualityRes.ok) {
        const qd = await qualityRes.json();
        passed = qd.pass === true;
        score = qd.score || 0;
        console.log(`[Outfits] Quality: score=${score}, passed=${passed}`);
      } else {
        console.warn(`[Outfits] Quality check failed: ${qualityRes.status}`);
      }

      setGeneratedOutfits((prev) =>
        prev.map((o) =>
          o.id === outfitId
            ? { ...o, tryOnPassed: passed, tryOnScore: score, tryOnChecking: false }
            : o
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Try-on failed";
      console.error(`[Outfits] Pipeline error for ${outfitId}:`, err);
      setGeneratedOutfits((prev) =>
        prev.map((o) =>
          o.id === outfitId
            ? { ...o, tryOnError: message, tryOnLoading: false, tryOnChecking: false }
            : o
        )
      );
    }
  };

  const handleGenerateOutfits = async () => {
    if (!customPrompt.trim()) return;
    if (!bodyPhoto) return;

    const isSummer = weatherMode === "hot";
    console.log(`[Outfits] Generating — prompt: "${customPrompt}", weather: ${weatherMode}${weatherMode === "location" ? ` (${locationInput})` : ""}, summer: ${isSummer}, items: ${closetItems.length}`);
    setIsGenerating(true);

    // Lazy detection: if any items lack types, detect them now via GPT-4o
    const untyped = closetItems.filter((item) => !item.type);
    let workingItems = closetItems;

    if (untyped.length > 0) {
      console.log(`[Outfits] ${untyped.length} untyped items — running AI detection...`);
      setGenerationProgress(`Analyzing ${untyped.length} items...`);

      const updatedItems = [...closetItems];
      const metaRaw = localStorage.getItem("closetItemsMeta");
      const meta: { id: string; type?: string }[] = metaRaw ? JSON.parse(metaRaw) : [];

      for (let i = 0; i < untyped.length; i++) {
        const item = untyped[i];
        setGenerationProgress(`Identifying item ${i + 1} of ${untyped.length}...`);

        try {
          const res = await fetch("/api/detect-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: item.image }),
          });

          if (res.ok) {
            const data = await res.json();
            const detectedType = data.item?.type as ClothingItem["type"];
            if (detectedType) {
              const idx = updatedItems.findIndex((c) => c.id === item.id);
              if (idx >= 0) updatedItems[idx] = { ...updatedItems[idx], type: detectedType };
              const metaIdx = meta.findIndex((m) => m.id === item.id);
              if (metaIdx >= 0) meta[metaIdx].type = detectedType;
              console.log(`[Outfits] Detected: ${item.id} → ${detectedType}`);
            }
          }
        } catch (err) {
          console.warn(`[Outfits] Detection failed for ${item.id}:`, err);
        }
      }

      // Persist updated types
      localStorage.setItem("closetItemsMeta", JSON.stringify(meta));
      setClosetItems(updatedItems);
      workingItems = updatedItems;
    }

    setGenerationProgress("Building outfit combinations...");
    await new Promise((resolve) => setTimeout(resolve, 400));

    const combos = createOutfitCombos(workingItems, 5, !isSummer);
    console.log(`[Outfits] Created ${combos.length} outfit combos`);
    if (combos.length === 0) {
      setIsGenerating(false);
      return;
    }

    const tightsRec = !isSummer ? getTightsRecommendation(customPrompt) : undefined;

    const outfits: Outfit[] = combos.map((items, index) => ({
      id: `outfit-${Date.now()}-${index}`,
      items,
      style: customPrompt,
      tightsRec,
      tryOnLoading: true,
    }));

    setGeneratedOutfits(outfits);
    setCurrentOutfitIndex(0);
    setRevealedOutfitIds(new Set());
    setIsGenerating(false);

    // Stagger pipelines to avoid Replicate 429 rate limit (burst=1 on low credit)
    console.log(`[Outfits] Launching ${outfits.length} try-on pipelines (staggered)...`);
    (async () => {
      for (const outfit of outfits) {
        await runTryOnPipeline(outfit.id, bodyPhoto, outfit.items[0].image);
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
  };

  const handleRevealTryOn = (outfitId: string) => {
    console.log(`[Outfits] Reveal: ${outfitId} — used: ${totalRevealsUsed}, premium: ${isPremium}`);
    if (revealedOutfitIds.has(outfitId)) return;
    if (!isPremium && totalRevealsUsed >= FREE_REVEAL_LIMIT) {
      setShowUpgradeModal(true);
      return;
    }
    const newRevealed = new Set(revealedOutfitIds);
    newRevealed.add(outfitId);
    setRevealedOutfitIds(newRevealed);
    const newCount = totalRevealsUsed + 1;
    setTotalRevealsUsed(newCount);
    localStorage.setItem("tryOnRevealsUsed", String(newCount));
  };

  const handleRetryTryOn = (outfit: Outfit) => {
    if (!bodyPhoto) return;
    setGeneratedOutfits((prev) =>
      prev.map((o) =>
        o.id === outfit.id
          ? { ...o, tryOnLoading: true, tryOnError: undefined, tryOnImage: undefined, tryOnPassed: undefined, tryOnScore: undefined, tryOnChecking: false }
          : o
      )
    );
    runTryOnPipeline(outfit.id, bodyPhoto, outfit.items[0].image);
  };

  const handleCorrectItemType = (itemId: string, newType: ClothingItem["type"]) => {
    // Update in closetItems
    setClosetItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, type: newType } : item))
    );
    // Update in generated outfits too
    setGeneratedOutfits((prev) =>
      prev.map((o) => ({
        ...o,
        items: o.items.map((item) =>
          item.id === itemId ? { ...item, type: newType } : item
        ),
      }))
    );
    // Persist to localStorage metadata
    const savedMeta = localStorage.getItem("closetItemsMeta");
    if (savedMeta) {
      const meta = JSON.parse(savedMeta);
      const updated = meta.map((m: { id: string; type?: string }) =>
        m.id === itemId ? { ...m, type: newType } : m
      );
      localStorage.setItem("closetItemsMeta", JSON.stringify(updated));
    }
    setCorrectingItem(null);
  };

  const handleNextOutfit = () =>
    setCurrentOutfitIndex((prev) => (prev + 1) % generatedOutfits.length);
  const handlePrevOutfit = () =>
    setCurrentOutfitIndex((prev) =>
      prev === 0 ? generatedOutfits.length - 1 : prev - 1
    );

  const currentOutfit = generatedOutfits[currentOutfitIndex];
  const tryOnReady = currentOutfit?.tryOnImage && currentOutfit?.tryOnPassed === true;
  const tryOnRendering = currentOutfit?.tryOnLoading || currentOutfit?.tryOnChecking;
  const tryOnFailed = currentOutfit?.tryOnError || (currentOutfit?.tryOnPassed === false && !currentOutfit?.tryOnChecking);
  const isRevealed = currentOutfit ? revealedOutfitIds.has(currentOutfit.id) : false;
  const freeRevealsLeft = Math.max(0, FREE_REVEAL_LIMIT - totalRevealsUsed);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--warm-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid var(--tan-light)", borderTopColor: "var(--tan)", animation: "spin 1s linear infinite", margin: "0 auto 1.2rem" }} />
          <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "1.2rem", color: "var(--charcoal)" }}>Loading your wardrobe...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--warm-white)" }}>
      {/* Nav */}
      <nav style={{ padding: "1.25rem 3rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(196,168,130,0.15)" }}>
        <Link href="/" className="nav-logo" style={{ textDecoration: "none" }}>NothingToWear<span>.ai</span></Link>
        <div style={{ fontFamily: "var(--sans)", fontSize: "0.85rem", fontWeight: 500, color: "var(--soft-gray)" }}>Step 3 of 3</div>
      </nav>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 2rem" }}>

        {/* Loading Overlay */}
        {isGenerating && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(42,37,32,0.85)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid rgba(247,243,238,0.2)", borderTopColor: "var(--tan)", animation: "spin 1s linear infinite", margin: "0 auto 1.5rem" }} />
              <p style={{ fontFamily: "var(--serif)", fontSize: "1.8rem", fontStyle: "italic", color: "var(--cream)", marginBottom: "0.5rem" }}>Styling you...</p>
              <p style={{ fontFamily: "var(--sans)", fontSize: "1rem", fontWeight: 400, color: "rgba(247,243,238,0.5)" }}>{generationProgress}</p>
            </div>
          </div>
        )}

        {/* ══════ UPGRADE MODAL ══════ */}
        {showUpgradeModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(42,37,32,0.8)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", animation: "fadeIn 0.3s ease" }} onClick={() => setShowUpgradeModal(false)}>
            <div style={{ background: "var(--warm-white)", borderRadius: 20, padding: "3rem 2.5rem", maxWidth: 440, width: "100%", textAlign: "center", boxShadow: "0 24px 60px rgba(42,37,32,0.2)", animation: "fadeInUp 0.4s ease" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", border: "1px solid rgba(196,168,130,0.15)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--tan)" strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.6rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.8rem" }}>You&rsquo;ve seen the magic</h2>
              <p style={{ fontFamily: "var(--sans)", fontSize: "1rem", fontWeight: 400, lineHeight: 1.7, color: "var(--warm-gray)", marginBottom: "2rem" }}>
                You&rsquo;ve used your {FREE_REVEAL_LIMIT} free try-ons. Upgrade to see every outfit on your body &mdash; unlimited.
              </p>
              <div style={{ background: "var(--cream)", borderRadius: 16, padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid rgba(196,168,130,0.12)" }}>
                <p style={{ fontFamily: "var(--sans)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "var(--soft-gray)", marginBottom: "0.5rem" }}>Premium</p>
                <p style={{ fontFamily: "var(--serif)", fontSize: "2rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.3rem" }}>$9.99<span style={{ fontFamily: "var(--sans)", fontSize: "0.9rem", fontWeight: 400, color: "var(--warm-gray)" }}>/month</span></p>
                <ul style={{ listStyle: "none", textAlign: "left", display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.8rem" }}>
                  {["Unlimited virtual try-ons", "See every outfit on your body", "AI-powered style recommendations", "Priority rendering speed"].map((f) => (
                    <li key={f} style={{ fontFamily: "var(--sans)", fontSize: "0.9rem", fontWeight: 400, color: "var(--warm-gray)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "var(--tan)" }}>&#10003;</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={() => { setIsPremium(true); localStorage.setItem("isPremium", "true"); setShowUpgradeModal(false); }} className="cta-btn" style={{ width: "100%", justifyContent: "center", opacity: 1, animation: "none", marginBottom: "0.8rem" }}>Upgrade Now</button>
              <button onClick={() => setShowUpgradeModal(false)} style={{ background: "none", border: "none", fontFamily: "var(--sans)", fontSize: "0.9rem", fontWeight: 500, color: "var(--soft-gray)", cursor: "pointer" }}>Maybe later</button>
            </div>
          </div>
        )}

        {/* ══════ PROMPT VIEW — One Decision ══════ */}
        {generatedOutfits.length === 0 ? (
          <div style={{ maxWidth: 520, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2rem, 4.5vw, 2.8rem)", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0", letterSpacing: "-0.02em" }}>
                Where are you going?
              </h1>
            </div>

            {/* Single prompt input */}
            <div style={{ marginBottom: "1.5rem" }}>
              <textarea
                placeholder={"brunch with my girlfriends\nwork meeting then drinks after\nfirst date, want to look effortless"}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && customPrompt.trim()) {
                    e.preventDefault();
                    handleGenerateOutfits();
                  }
                }}
                rows={3}
                style={{
                  width: "100%",
                  padding: "1.2rem 1.5rem",
                  borderRadius: 16,
                  border: "1px solid rgba(196,168,130,0.25)",
                  background: "var(--warm-white)",
                  fontFamily: "var(--sans)",
                  fontSize: "1.05rem",
                  fontWeight: 400,
                  color: "var(--charcoal)",
                  outline: "none",
                  resize: "none",
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* Weather selector — 3 options, zero friction */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: weatherMode === "location" ? "0.8rem" : "2rem" }}>
              {([
                { key: "hot" as const, label: "Hot", icon: "\u2600" },
                { key: "cold" as const, label: "Cold", icon: "\u2744" },
                { key: "location" as const, label: "I\u2019m traveling", icon: "\u2708" },
              ]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setWeatherMode(key)}
                  style={{
                    padding: "0.6rem 1.2rem",
                    borderRadius: 100,
                    border: weatherMode === key ? "2px solid var(--tan)" : "1px solid rgba(196,168,130,0.2)",
                    background: weatherMode === key ? "var(--cream)" : "transparent",
                    fontFamily: "var(--sans)",
                    fontSize: "0.9rem",
                    fontWeight: weatherMode === key ? 600 : 400,
                    color: weatherMode === key ? "var(--charcoal)" : "var(--soft-gray)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>

            {/* Location input — only when traveling */}
            {weatherMode === "location" && (
              <div style={{ marginBottom: "2rem" }}>
                <input
                  type="text"
                  placeholder="Where? e.g. Caribbean, Paris, Tokyo..."
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.8rem 1.2rem",
                    borderRadius: 12,
                    border: "1px solid rgba(196,168,130,0.25)",
                    background: "var(--warm-white)",
                    fontFamily: "var(--sans)",
                    fontSize: "0.95rem",
                    fontWeight: 400,
                    color: "var(--charcoal)",
                    outline: "none",
                    textAlign: "center",
                  }}
                />
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerateOutfits}
              disabled={!customPrompt.trim()}
              className="cta-btn"
              style={{
                width: "100%",
                justifyContent: "center",
                opacity: !customPrompt.trim() ? 0.4 : 1,
                animation: "none",
                cursor: !customPrompt.trim() ? "not-allowed" : "pointer",
                fontSize: "1rem",
                padding: "1rem 2rem",
              }}
            >
              Style Me
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </button>

            <div style={{ textAlign: "center", marginTop: "2rem" }}>
              <Link href="/closet" style={{ fontFamily: "var(--sans)", fontSize: "0.9rem", fontWeight: 500, color: "var(--soft-gray)", textDecoration: "none" }}>&larr; Back to Closet</Link>
            </div>
          </div>
        ) : (
          <>
            {/* ══════ OUTFIT RESULTS ══════ */}

            {/* Carousel nav — arrows + dots */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1.5rem" }}>
              <button onClick={handlePrevOutfit} style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--warm-white)", border: "1px solid rgba(196,168,130,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <svg style={{ width: 18, height: 18, color: "var(--charcoal)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {generatedOutfits.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentOutfitIndex(idx)}
                    style={{
                      width: currentOutfitIndex === idx ? 24 : 8,
                      height: 8,
                      borderRadius: 100,
                      background: currentOutfitIndex === idx ? "var(--tan)" : "rgba(196,168,130,0.25)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      padding: 0,
                    }}
                  />
                ))}
              </div>

              <button onClick={handleNextOutfit} style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--warm-white)", border: "1px solid rgba(196,168,130,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <svg style={{ width: 18, height: 18, color: "var(--charcoal)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* ── Two Panels: Tier 1 Board + Tier 3 Try-On ── */}
            <div style={{ display: "grid", gridTemplateColumns: tryOnReady || tryOnRendering ? "1fr 1fr" : "1fr", gap: "1.5rem", maxWidth: tryOnReady || tryOnRendering ? 960 : 520, margin: "0 auto 1.5rem", transition: "all 0.5s ease" }}>

              {/* ═══ TIER 1: Flat-Lay Board ═══ */}
              <div style={{ borderRadius: 16, overflow: "hidden", background: "var(--warm-white)", border: "1px solid rgba(196,168,130,0.15)" }}>
                {/* Flat-lay composition — NO text overlay */}
                <div style={{ position: "relative", aspectRatio: "4/5", background: "linear-gradient(165deg, var(--cream) 0%, #f5efe8 50%, #ede5db 100%)", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 20%, rgba(196,168,130,0.06) 0%, transparent 60%)", zIndex: 0 }} />
                  {currentOutfit?.items.map((item, idx) => {
                    const positions = getFlatlayPositions(currentOutfit.items.length);
                    const pos = positions[idx] || positions[0];
                    return (
                      <div key={item.id} style={{ position: "absolute", top: pos.top, left: pos.left, width: pos.width, aspectRatio: "1", borderRadius: 10, overflow: "hidden", transform: `rotate(${pos.rotate})`, zIndex: pos.zIndex, boxShadow: "0 8px 30px rgba(42,37,32,0.12)", background: "var(--warm-white)" }}>
                        <Image src={item.image} alt="Clothing item" fill className="object-cover" />
                      </div>
                    );
                  })}
                </div>

                {/* Info BELOW the image — not covering it */}
                <div style={{ padding: "1.2rem 1.5rem" }}>
                  {/* Occasion label */}
                  <p style={{ fontFamily: "var(--serif)", fontSize: "1rem", fontWeight: 500, fontStyle: "italic", color: "var(--charcoal)", marginBottom: "0.6rem" }}>
                    {currentOutfit?.style}
                  </p>

                  {/* Piece count */}
                  <p style={{ fontFamily: "var(--sans)", fontSize: "0.8rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--soft-gray)", marginBottom: "0.8rem" }}>
                    {currentOutfit?.items.length} pieces
                  </p>

                  {/* Item strip — clickable to correct type */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                    {currentOutfit?.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setCorrectingItem(item)}
                        style={{
                          width: 48, height: 48, borderRadius: 8, overflow: "hidden",
                          background: "var(--cream)", position: "relative", flexShrink: 0,
                          border: correctingItem?.id === item.id ? "2px solid var(--tan)" : "1px solid rgba(196,168,130,0.1)",
                          cursor: "pointer", padding: 0,
                        }}
                        title={`${item.type || "unknown"} — tap to change`}
                      >
                        <Image src={item.image} alt="Item" fill className="object-cover" />
                        <span style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          background: "rgba(42,37,32,0.65)", color: "#fff",
                          fontFamily: "var(--sans)", fontSize: "0.55rem", fontWeight: 600,
                          textAlign: "center", padding: "1px 0", letterSpacing: "0.03em",
                          textTransform: "uppercase" as const,
                        }}>
                          {item.type || "?"}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Type correction popup */}
                  {correctingItem && currentOutfit?.items.some((i) => i.id === correctingItem.id) && (
                    <div style={{
                      background: "var(--cream)", borderRadius: 12, padding: "0.8rem 1rem",
                      border: "1px solid rgba(196,168,130,0.2)", marginBottom: "1rem",
                      animation: "fadeInUp 0.2s ease",
                    }}>
                      <p style={{ fontFamily: "var(--sans)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--soft-gray)", marginBottom: "0.5rem" }}>
                        What is this item?
                      </p>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {(["dress", "top", "bottom", "outerwear", "shoes", "accessory"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => handleCorrectItemType(correctingItem.id, t)}
                            style={{
                              padding: "0.4rem 0.8rem", borderRadius: 100,
                              border: correctingItem.type === t ? "2px solid var(--tan)" : "1px solid rgba(196,168,130,0.2)",
                              background: correctingItem.type === t ? "var(--warm-white)" : "transparent",
                              fontFamily: "var(--sans)", fontSize: "0.78rem",
                              fontWeight: correctingItem.type === t ? 600 : 400,
                              color: correctingItem.type === t ? "var(--charcoal)" : "var(--soft-gray)",
                              cursor: "pointer", textTransform: "capitalize" as const,
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCorrectingItem(null)}
                        style={{ background: "none", border: "none", fontFamily: "var(--sans)", fontSize: "0.75rem", fontWeight: 500, color: "var(--soft-gray)", cursor: "pointer", marginTop: "0.5rem" }}
                      >
                        Done
                      </button>
                    </div>
                  )}

                  {/* Tights recommendation */}
                  {currentOutfit?.tightsRec && (
                    <div style={{ background: "var(--cream)", borderRadius: 10, padding: "0.8rem 1rem", border: "1px solid rgba(196,168,130,0.1)" }}>
                      <p style={{ fontFamily: "var(--sans)", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--tan)", marginBottom: "0.3rem" }}>
                        Tights Recommendation
                      </p>
                      <p style={{ fontFamily: "var(--sans)", fontSize: "0.85rem", fontWeight: 500, color: "var(--charcoal)", lineHeight: 1.5 }}>
                        {currentOutfit.tightsRec}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
                    <button className="cta-btn" style={{ flex: 1, justifyContent: "center", opacity: 1, animation: "none", padding: "0.8rem 1rem", fontSize: "0.9rem" }}>Love This</button>
                    <button onClick={handleGenerateOutfits} className="cta-outline" style={{ flex: 1, justifyContent: "center", padding: "0.8rem 1rem", fontSize: "0.85rem" }}>New Combos</button>
                  </div>
                </div>
              </div>

              {/* ═══ TIER 3: Try-On Preview ═══ */}
              {(tryOnReady || tryOnRendering) && (
                <div style={{ border: "1px solid rgba(196,168,130,0.15)", borderRadius: 16, overflow: "hidden", background: "var(--warm-white)", animation: "fadeInUp 0.5s ease" }}>
                  <p style={{ fontFamily: "var(--sans)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--soft-gray)", padding: "1.2rem 1.5rem 0", textAlign: "center" }}>On Your Body</p>

                  <div onClick={() => tryOnReady && currentOutfit && handleRevealTryOn(currentOutfit.id)} style={{ position: "relative", aspectRatio: "4/5", background: "var(--cream)", overflow: "hidden", cursor: tryOnReady && !isRevealed ? "pointer" : "default", margin: "0.8rem 1.5rem 1.5rem" , borderRadius: 12 }}>
                    {currentOutfit?.tryOnImage && (
                      <Image src={currentOutfit.tryOnImage} alt="Virtual try-on" fill className="object-contain" unoptimized style={{ filter: isRevealed || isPremium ? "blur(0px)" : "blur(20px)", transition: "filter 0.8s ease" }} />
                    )}

                    {tryOnRendering && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid var(--tan-light)", borderTopColor: "var(--tan)", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
                          <p style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", fontWeight: 500, fontStyle: "italic", color: "var(--charcoal)", marginBottom: "0.3rem" }}>
                            {currentOutfit?.tryOnChecking ? "Verifying quality..." : "Rendering on your body..."}
                          </p>
                          <p style={{ fontFamily: "var(--sans)", fontSize: "0.85rem", fontWeight: 400, color: "var(--soft-gray)" }}>20&ndash;40 seconds</p>
                        </div>
                      </div>
                    )}

                    {tryOnReady && !isRevealed && !isPremium && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(42,37,32,0.15)" }}>
                        <div style={{ textAlign: "center", padding: "0 1.5rem" }}>
                          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", boxShadow: "0 4px 20px rgba(42,37,32,0.15)" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          </div>
                          <p style={{ fontFamily: "var(--serif)", fontSize: "1.2rem", fontWeight: 500, fontStyle: "italic", color: "var(--charcoal)", marginBottom: "0.4rem", textShadow: "0 1px 4px rgba(255,255,255,0.6)" }}>See this outfit on me</p>
                          <p style={{ fontFamily: "var(--sans)", fontSize: "0.85rem", fontWeight: 500, color: "var(--warm-gray)", textShadow: "0 1px 4px rgba(255,255,255,0.6)" }}>
                            {freeRevealsLeft > 0 ? `${freeRevealsLeft} free reveal${freeRevealsLeft === 1 ? "" : "s"} left` : "Tap to upgrade"}
                          </p>
                        </div>
                      </div>
                    )}

                    {(isRevealed || isPremium) && currentOutfit?.tryOnImage && !tryOnRendering && (
                      <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", borderRadius: 100, padding: "0.35rem 0.8rem", display: "flex", alignItems: "center", gap: "0.3rem", zIndex: 10 }}>
                        <span style={{ color: "#7ea67e", fontSize: "0.75rem" }}>&#10003;</span>
                        <span style={{ fontFamily: "var(--sans)", fontSize: "0.7rem", fontWeight: 500, color: "var(--warm-gray)" }}>Quality verified</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Secondary actions */}
            <div style={{ textAlign: "center" }}>
              <button onClick={() => { setGeneratedOutfits([]); setRevealedOutfitIds(new Set()); }} style={{ background: "none", border: "none", fontFamily: "var(--sans)", fontSize: "0.9rem", fontWeight: 500, color: "var(--soft-gray)", cursor: "pointer", display: "block", margin: "0 auto 0.8rem" }}>&larr; New occasion</button>
              <button onClick={() => router.push("/closet")} style={{ background: "none", border: "none", fontFamily: "var(--sans)", fontSize: "0.9rem", fontWeight: 500, color: "var(--tan)", cursor: "pointer" }}>Add more clothes</button>
              {tryOnFailed && (
                <button onClick={() => currentOutfit && handleRetryTryOn(currentOutfit)} style={{ display: "block", margin: "0.8rem auto 0", background: "none", border: "none", fontFamily: "var(--sans)", fontSize: "0.85rem", fontWeight: 500, color: "var(--tan)", cursor: "pointer" }}>Retry virtual try-on</button>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
