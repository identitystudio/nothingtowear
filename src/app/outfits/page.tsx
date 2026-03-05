"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getAllImagesFromSupabase } from "@/lib/supabase-storage";
import { ClothingTag } from "@/lib/tagging-system";

interface ClothingItem {
  id: string;
  image: string;
  type?: "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory";
  color?: string;
  style?: string;
  tags?: ClothingTag;
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
  analysisResult?: string;
  generatedImageUrl?: string;
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

  // Copy feedback
  const [copiedOutfitId, setCopiedOutfitId] = useState<string | null>(null);

  // Ref for capturing flat-lay board
  const flatlayRef = useRef<HTMLDivElement>(null);

  // Track which outfits need pipeline processing
  const [pendingPipelineOutfits, setPendingPipelineOutfits] = useState<string[]>([]);

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

      let meta: any[] = [];
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

      console.log("[Outfits] Loading images from Supabase Storage...");
      const imageMap = await getAllImagesFromSupabase();
      console.log(`[Outfits] Loaded ${imageMap.size} images from Supabase Storage`);

      const items: ClothingItem[] = [];
      for (const m of meta) {
        const img = imageMap.get(m.id);
        if (img) {
          items.push({
            id: m.id,
            image: img,
            type: m.type as ClothingItem["type"],
            tags: m.tags,
          });
        }
      }

      console.log(`[Outfits] ${items.length} closet items ready (${items.filter(i => i.tags).length} with tags)`);
      if (items.length === 0) {
        router.push("/closet");
        return;
      }
      setClosetItems(items);
      setIsLoading(false);
    }

    loadClosetItems();
  }, [router]);

  // Process pending pipelines once DOM is ready
  useEffect(() => {
    if (pendingPipelineOutfits.length === 0 || generatedOutfits.length === 0) return;

    const currentOutfit = generatedOutfits[currentOutfitIndex];
    if (!currentOutfit) return;

    const currentOutfitId = currentOutfit.id;
    if (!pendingPipelineOutfits.includes(currentOutfitId)) return;

    // Wait for DOM to be fully rendered
    const timer = setTimeout(async () => {
      console.log(`[Outfits] Processing pending pipeline for ${currentOutfitId}`);
      
      // Check if flatlay ref is available
      if (!flatlayRef.current) {
        console.warn(`[Outfits] Flatlay ref not yet available, scheduling retry...`);
        // Retry after a short delay
        setTimeout(() => {
          setPendingPipelineOutfits((prev) => prev.includes(currentOutfitId) ? prev : []);
        }, 500);
        return;
      }

      // Run the pipeline
      await runTryOnPipeline(currentOutfitId, "");
      
      // Remove from pending list and process next
      setPendingPipelineOutfits((prev) => prev.filter((id) => id !== currentOutfitId));
    }, 100);

    return () => clearTimeout(timer);
  }, [pendingPipelineOutfits, generatedOutfits, currentOutfitIndex]);

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
      
      // Set crossOrigin before setting src to avoid CORS taint
      img.crossOrigin = "anonymous";
      
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

  // Capture flat-lay board as image for webhook
  const captureFlatlayBoard = async (): Promise<string> => {
    if (!flatlayRef.current) throw new Error("Flatlay ref not available");

    try {
      // Dynamically import html2canvas
      const html2canvas = (await import("html2canvas")).default;
      
      const canvas = await html2canvas(flatlayRef.current, {
        backgroundColor: "#f9f7f2",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 10000,
      });

      return canvas.toDataURL("image/jpeg", 0.9);
    } catch (err) {
      console.error("[Outfits] Failed to capture flatlay board:", err);
      throw err;
    }
  };

  // Parse and format analysis response
  const formatAnalysisResponse = (data: unknown): string => {
    try {
      if (typeof data === "string") {
        // If it's already a string, try to parse it as JSON
        try {
          const parsed = JSON.parse(data);
          return formatAnalysisObject(parsed);
        } catch {
          // If not JSON, return as-is
          return data;
        }
      }
      
      if (data && typeof data === "object") {
        return formatAnalysisObject(data);
      }
      
      return JSON.stringify(data, null, 2);
    } catch (err) {
      return String(data);
    }
  };

  // Format analysis object/array recursively
  const formatAnalysisObject = (obj: unknown, depth = 0): string => {
    const indent = "  ".repeat(depth);
    const lines: string[] = [];

    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => {
        if (typeof item === "object" && item !== null) {
          lines.push(`${indent}${idx + 1}.`);
          lines.push(formatAnalysisObject(item, depth + 1));
        } else {
          lines.push(`${indent}• ${item}`);
        }
      });
    } else if (obj && typeof obj === "object") {
      const entries = Object.entries(obj);
      entries.forEach(([key, value], idx) => {
        // Format key nicely
        const formattedKey = key
          .replace(/_/g, " ")
          .replace(/^./, (c) => c.toUpperCase());

        if (value === null || value === undefined) {
          lines.push(`${indent}${formattedKey}: -`);
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            lines.push(`${indent}${formattedKey}: none`);
          } else {
            lines.push(`${indent}${formattedKey}:`);
            lines.push(formatAnalysisObject(value, depth + 1));
          }
        } else if (typeof value === "object") {
          lines.push(`${indent}${formattedKey}:`);
          lines.push(formatAnalysisObject(value, depth + 1));
        } else {
          lines.push(`${indent}${formattedKey}: ${value}`);
        }
      });
    }

    return lines.join("\n");
  };

  // ── Send to Webhook for Analysis ──
  const runTryOnPipeline = async (
    outfitId: string,
    boardImage: string
  ) => {
    console.log(`[Outfits] 🎬 Starting analysis pipeline for outfit ${outfitId}`);
    
    try {
      console.log("[Outfits] 📸 Capturing flat-lay board...");
      const flatlayImage = await captureFlatlayBoard();
      console.log(`[Outfits] ✓ Captured flat-lay board: ${(flatlayImage.length / 1024).toFixed(0)}KB`);

      console.log("[Outfits] 🚀 SENDING TO WEBHOOK...");
      console.log("[Outfits] 📡 Endpoint: https://themacularprogram.app.n8n.cloud/webhook/analyze-clothes2");
      
      // Create FormData for webhook request
      const formData = new FormData();
      
      // Convert data URL to blob
      const arr = flatlayImage.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      const n = bstr.length;
      const u8arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      const blob = new Blob([u8arr], { type: mime });
      
      formData.append("Compiled_Clothes", blob, "outfit.jpg");
      
      // Also send the personal mannequin photo
      // Get directly from localStorage to avoid any state synchronization issues
      const currentBodyPhoto = bodyPhoto || localStorage.getItem("bodyPhoto");
      
      if (currentBodyPhoto) {
        console.log("[Outfits] 📸 Preparing personal mannequin for webhook...");
        try {
          const bodyArr = currentBodyPhoto.split(',');
          if (bodyArr.length > 1) {
            const bodyMime = bodyArr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const bodyBstr = atob(bodyArr[1]);
            const bodyN = bodyBstr.length;
            const bodyU8arr = new Uint8Array(bodyN);
            for (let i = 0; i < bodyN; i++) {
              bodyU8arr[i] = bodyBstr.charCodeAt(i);
            }
            const bodyBlob = new Blob([bodyU8arr], { type: bodyMime });
            
            formData.append("Personal_Manequin", bodyBlob, "mannequin.jpg");
            
            console.log(`[Outfits] ✓ Attached personal mannequin: ${(currentBodyPhoto.length / 1024).toFixed(0)}KB (Key: Personal_Manequin)`);
          } else {
            console.warn("[Outfits] ⚠ bodyPhoto in localStorage is not a valid data URL");
          }
        } catch (convErr) {
          console.error("[Outfits] ❌ Failed to convert mannequin photo for webhook:", convErr);
        }
      } else {
        console.warn("[Outfits] ⚠ No bodyPhoto found in state or localStorage for webhook");
      }

      console.log("[Outfits] 📤 Sending multipart form data with keys:", Array.from((formData as any).keys()).join(", "));

      const webhookRes = await fetch(
        "https://themacularprogram.app.n8n.cloud/webhook/analyze-clothes2",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!webhookRes.ok) {
        const errText = await webhookRes.text();
        console.error("[Outfits] ❌ Webhook error:", errText);
        throw new Error(`Webhook returned ${webhookRes.status}: ${errText}`);
      }

      const analysisData = await webhookRes.json();
      console.log(`[Outfits] ✅ Webhook response received!`);
      
      // Extract generated image URL if it exists
      let generatedUrl = "";
      if (Array.isArray(analysisData) && analysisData.length > 0 && analysisData[0].secure_url) {
        generatedUrl = analysisData[0].secure_url;
        console.log(`[Outfits] 🖼 Extracted generated image URL: ${generatedUrl}`);
      }

      // Format the analysis response (fallback or if still needed)
      const analysisText = formatAnalysisResponse(analysisData);
      console.log(`[Outfits] 📋 Formatted analysis preview:`, analysisText.substring(0, 200));

      // Add prompt instruction at the bottom
      const fullAnalysisText = analysisText + "\n\n---\n\nUsing the exact facial structure, eyes, eyebrows, nose, mouth, ears, hair, skin tone, facial proportions, expression lines, natural asymmetries, and all visible skin details, together with the exact clothing structure, fabric texture, stitching details, colors, patterns, proportions, fit, wrinkles, folds, wear marks, logos, accessories, and all visible garment characteristics from the reference image — without any alteration, enhancement, redesign, beautification, stylization, or modification of any kind.";

      console.log(`[Outfits] 🎉 Analysis complete!`);

      setGeneratedOutfits((prev) =>
        prev.map((o) =>
          o.id === outfitId
            ? { 
                ...o, 
                tryOnImage: "webhook_analyzed",
                tryOnLoading: false, 
                tryOnPassed: true,
                analysisResult: fullAnalysisText,
                generatedImageUrl: generatedUrl
              }
            : o
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      console.error(`[Outfits] Pipeline error for ${outfitId}:`, err);
      setGeneratedOutfits((prev) =>
        prev.map((o) =>
          o.id === outfitId
            ? { 
                ...o, 
                tryOnError: message, 
                tryOnLoading: false, 
                tryOnChecking: false,
                analysisResult: `Error: ${message}`
              }
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

    setGenerationProgress("Stylist is selecting your pieces...");
    
    let combos: ClothingItem[][] = [];
    let explanations: string[] = [];

    try {
      const weatherContext =
        weatherMode === "hot" ? "hot weather, summer — avoid heavy coats and thick layers" :
        weatherMode === "cold" ? "cold weather, winter — include warm layers and outerwear" :
        locationInput.trim() ? `traveling to ${locationInput.trim()} — versatile, packable pieces` :
        "traveling — versatile, packable pieces";

      const smartRes = await fetch("/api/generate-outfit-smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userRequest: customPrompt,
          items: workingItems,
          count: 5,
          style: weatherContext,
        }),
      });

      if (smartRes.ok) {
        const smartData = await smartRes.json();
        combos = smartData.outfits.map((o: any) => {
          explanations.push(o.explanation);
          return o.itemIds
            .map((id: string) => workingItems.find((item) => item.id === id))
            .filter(Boolean) as ClothingItem[];
        });
      } else {
        combos = createOutfitCombos(workingItems, 5, !isSummer);
      }
    } catch (err) {
      combos = createOutfitCombos(workingItems, 5, !isSummer);
    }

    if (combos.length === 0) {
      setIsGenerating(false);
      return;
    }

    const tightsRec = !isSummer ? getTightsRecommendation(customPrompt) : undefined;

    const outfits: Outfit[] = combos.map((items, index) => ({
      id: `outfit-${Date.now()}-${index}`,
      items,
      style: explanations[index] || customPrompt,
      tightsRec,
    }));

    setGeneratedOutfits(outfits);
    setCurrentOutfitIndex(0);
    setRevealedOutfitIds(new Set());
    setIsGenerating(false);
    setPendingPipelineOutfits([]);
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

  const handleRequestTryOn = (outfit: Outfit) => {
    setGeneratedOutfits((prev) =>
      prev.map((o) =>
        o.id === outfit.id
          ? { ...o, tryOnLoading: true, tryOnError: undefined }
          : o
      )
    );
    runTryOnPipeline(outfit.id, "");
  };

  const handleRetryTryOn = (outfit: Outfit) => {
    setGeneratedOutfits((prev) =>
      prev.map((o) =>
        o.id === outfit.id
          ? { ...o, tryOnLoading: true, tryOnError: undefined, tryOnImage: undefined, tryOnPassed: undefined, tryOnScore: undefined, tryOnChecking: false, analysisResult: undefined }
          : o
      )
    );
    runTryOnPipeline(outfit.id, "");
  };

  const handleCopyAnalysis = (outfitId: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedOutfitId(outfitId);
      setTimeout(() => setCopiedOutfitId(null), 2000);
    });
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

  // Loading quotes
  const loadingQuotes = [
    "You never truly have nothing to wear.",
    "Style is the art of editing.",
    "Every great outfit starts with a single piece.",
    "Dressing well is a form of good manners.",
    "Your closet is full of potential — we're unlocking it.",
    "Fashion is what you buy. Style is what you do with it.",
    "The right outfit can change your entire day.",
    "Curating something beautiful, just for you.",
    "Great style isn't about more clothes. It's about the right ones.",
    "Turning your wardrobe into a story worth telling.",
  ];
  const [loadingQuoteIndex, setLoadingQuoteIndex] = useState(0);
  const [quoteVisible, setQuoteVisible] = useState(true);

  useEffect(() => {
    if (!currentOutfit?.tryOnLoading) return;
    const interval = setInterval(() => {
      setQuoteVisible(false);
      setTimeout(() => {
        setLoadingQuoteIndex((i) => (i + 1) % loadingQuotes.length);
        setQuoteVisible(true);
      }, 400);
    }, 3200);
    return () => clearInterval(interval);
  }, [currentOutfit?.tryOnLoading]);

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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1.5rem", paddingTop: "2rem" }}>
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

            {/* ── Two Panels: Tier 1 Board + Analysis Result ── */}
            <div style={{ display: "grid", gridTemplateColumns: currentOutfit ? "1fr 1fr" : "1fr", gap: "1.5rem", maxWidth: currentOutfit ? 960 : 520, margin: "0 auto 1.5rem", transition: "all 0.5s ease" }}>

              {/* ═══ TIER 1: Flat-Lay Board ═══ */}
              <div style={{ borderRadius: 16, overflow: "hidden", background: "var(--warm-white)", border: "1px solid rgba(196,168,130,0.15)" }}>
                {/* Flat-lay composition — NO text overlay */}
                <div ref={flatlayRef} style={{ position: "relative", aspectRatio: "4/5", background: "linear-gradient(165deg, var(--cream) 0%, #f5efe8 50%, #ede5db 100%)", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 20%, rgba(196,168,130,0.06) 0%, transparent 60%)", zIndex: 0 }} />
                  {currentOutfit?.items.map((item, idx) => {
                    const positions = getFlatlayPositions(currentOutfit.items.length);
                    const pos = positions[idx] || positions[0];
                    return (
                      <div key={item.id} style={{ position: "absolute", top: pos.top, left: pos.left, width: pos.width, aspectRatio: "1", borderRadius: 10, overflow: "hidden", transform: `rotate(${pos.rotate})`, zIndex: pos.zIndex, boxShadow: "0 8px 30px rgba(42,37,32,0.12)", background: "var(--warm-white)" }}>
                        <Image src={item.image} alt="Clothing item" fill className="object-contain" />
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

              {/* ═══ Analysis Result Panel (Right Side) ═══ */}
              {currentOutfit && (
                <div style={{ border: "1px solid rgba(196,168,130,0.15)", borderRadius: 16, overflow: "hidden", background: "var(--warm-white)", animation: "fadeInUp 0.5s ease", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.2rem 1.5rem 0.6rem" }}>
                    <p style={{ fontFamily: "var(--sans)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--soft-gray)" }}>
                      {currentOutfit?.generatedImageUrl ? "Generated Model" : currentOutfit?.tryOnLoading ? "Outfit Analysis" : "Virtual Try-On"}
                    </p>
                    {currentOutfit?.generatedImageUrl && (
                      <button
                        onClick={() => currentOutfit && handleRetryTryOn(currentOutfit)}
                        style={{
                          background: "none",
                          border: "none",
                          fontFamily: "var(--sans)",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          color: "var(--soft-gray)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          transition: "color 0.3s ease",
                        }}
                        title="Regenerate model image"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                          <path d="M3 21v-5h5" />
                        </svg>
                        Regenerate
                      </button>
                    )}
                    {currentOutfit?.analysisResult && !currentOutfit?.generatedImageUrl && (
                      <button
                        onClick={() => currentOutfit && handleCopyAnalysis(currentOutfit.id, currentOutfit.analysisResult || "")}
                        style={{
                          background: "none",
                          border: "none",
                          fontFamily: "var(--sans)",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          color: copiedOutfitId === currentOutfit?.id ? "var(--tan)" : "var(--soft-gray)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          transition: "color 0.3s ease",
                        }}
                        title="Copy analysis to clipboard"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                        </svg>
                        {copiedOutfitId === currentOutfit?.id ? "Copied!" : "Copy"}
                      </button>
                    )}
                  </div>

                  {currentOutfit?.tryOnLoading ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem 2rem", minHeight: 260 }}>
                      <div style={{ textAlign: "center", width: "100%" }}>
                        {/* Elegant animated dots */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "2rem" }}>
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "var(--tan)",
                                animation: `ntw-dot-bounce 1.4s ease-in-out ${i * 0.22}s infinite`,
                              }}
                            />
                          ))}
                        </div>

                        {/* Heading */}
                        <p style={{
                          fontFamily: "var(--serif)",
                          fontSize: "1rem",
                          fontWeight: 500,
                          fontStyle: "italic",
                          color: "var(--charcoal)",
                          marginBottom: "1.4rem",
                          letterSpacing: "0.01em",
                        }}>
                          Styling you...
                        </p>

                        {/* Divider */}
                        <div style={{ width: 32, height: 1, background: "rgba(196,168,130,0.4)", margin: "0 auto 1.4rem" }} />

                        {/* Cycling quote */}
                        <p style={{
                          fontFamily: "var(--sans)",
                          fontSize: "0.8rem",
                          fontWeight: 400,
                          color: "var(--soft-gray)",
                          lineHeight: 1.6,
                          maxWidth: 220,
                          margin: "0 auto",
                          opacity: quoteVisible ? 1 : 0,
                          transform: quoteVisible ? "translateY(0)" : "translateY(6px)",
                          transition: "opacity 0.4s ease, transform 0.4s ease",
                          minHeight: "2.8em",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          &ldquo;{loadingQuotes[loadingQuoteIndex]}&rdquo;
                        </p>
                      </div>
                    </div>
                  ) : currentOutfit?.generatedImageUrl ? (
                    <div style={{ flex: 1, position: "relative", background: "var(--cream)" }}>
                      <Image
                        src={currentOutfit.generatedImageUrl}
                        alt="Generated Outfit"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : currentOutfit?.analysisResult ? (
                    <textarea
                      value={currentOutfit.analysisResult}
                      readOnly
                      style={{
                        flex: 1,
                        padding: "1.2rem 1.5rem",
                        border: "none",
                        background: "var(--warm-white)",
                        fontFamily: "var(--sans)",
                        fontSize: "0.85rem",
                        fontWeight: 400,
                        color: "var(--charcoal)",
                        outline: "none",
                        resize: "none",
                        lineHeight: 1.6,
                      }}
                    />
                  ) : (
                    /* ── Idle state: "See it on me" CTA ── */
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem 2rem", minHeight: 280, gap: "1.4rem" }}>
                      {/* Icon */}
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--cream)", border: "1px solid rgba(196,168,130,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--tan)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>

                      {/* Copy */}
                      <div style={{ textAlign: "center" }}>
                        <p style={{ fontFamily: "var(--serif)", fontSize: "1.05rem", fontWeight: 500, fontStyle: "italic", color: "var(--charcoal)", marginBottom: "0.4rem" }}>
                          See it on you
                        </p>
                        <p style={{ fontFamily: "var(--sans)", fontSize: "0.8rem", fontWeight: 400, color: "var(--soft-gray)", lineHeight: 1.5, maxWidth: 180, margin: "0 auto" }}>
                          Generate a model photo wearing this exact outfit
                        </p>
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => currentOutfit && handleRequestTryOn(currentOutfit)}
                        className="cta-btn"
                        style={{ opacity: 1, animation: "none", padding: "0.75rem 1.8rem", fontSize: "0.88rem", justifyContent: "center" }}
                      >
                        See it on me
                      </button>
                    </div>
                  )}
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
        @keyframes ntw-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
