"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { saveImageToSupabase, clearAllImagesFromSupabase, deleteImageFromSupabase, getAllImagesFromSupabase } from "@/lib/supabase-storage";
import { ClothingTag, flattenTags, createClothingTag, refineTags } from "@/lib/tagging-system";

interface ClothingItemMeta {
  id: string;
  type?: string;
  tags?: ClothingTag;
  autoTagged?: boolean;
  manuallyRefined?: boolean;
}

interface ClosetItem {
  id: string;
  type?: string;
  imageUrl: string;
  tags?: ClothingTag;
  autoTagged?: boolean;
  manuallyRefined?: boolean;
}

const BATCH_SIZE = 15;
const ENABLE_AI_DETECTION = true; // Now using Gemini API as fallback when OpenAI quota is exceeded

export default function ClosetPage() {
  const router = useRouter();
  const [itemCount, setItemCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processCount, setProcessCount] = useState({ done: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosetItem | null>(null);
  const [editingType, setEditingType] = useState<string>("");
  const [isItemsCollapsed, setIsItemsCollapsed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const bodyPhoto = localStorage.getItem("bodyPhoto");
    if (!bodyPhoto) {
      router.push("/onboarding");
      return;
    }
    // Just read metadata count — no need to load images on this page
    const savedMeta = localStorage.getItem("closetItemsMeta");
    const legacyItems = localStorage.getItem("closetItems");
    if (savedMeta) {
      const meta: ClothingItemMeta[] = JSON.parse(savedMeta);
      setItemCount(meta.length);
      console.log(`[Closet] ${meta.length} items in closet`);
      // Load items with images
      loadClosetItems(meta);
    } else if (legacyItems) {
      const legacy = JSON.parse(legacyItems);
      setItemCount(legacy.length);
      console.log(`[Closet] ${legacy.length} items (legacy format)`);
    }
  }, [router]);

  const loadClosetItems = async (meta: ClothingItemMeta[]) => {
    setIsLoadingItems(true);
    try {
      const imageMap = await getAllImagesFromSupabase();
      const items: ClosetItem[] = meta
        .filter(m => imageMap.has(m.id))
        .map(m => ({
          id: m.id,
          type: m.type,
          imageUrl: imageMap.get(m.id) || ""
        }));
      setClosetItems(items);
    } catch (err) {
      console.error("Error loading closet items:", err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    try {
      // Delete from Supabase Storage
      await deleteImageFromSupabase(id);
      
      // Update localStorage metadata
      const savedMeta = localStorage.getItem("closetItemsMeta");
      if (savedMeta) {
        const meta: ClothingItemMeta[] = JSON.parse(savedMeta);
        const updatedMeta = meta.filter(m => m.id !== id);
        localStorage.setItem("closetItemsMeta", JSON.stringify(updatedMeta));
        setItemCount(updatedMeta.length);
      }
      
      // Update UI
      setClosetItems(items => items.filter(item => item.id !== id));
      toast.success("Item deleted");
    } catch (err) {
      console.error("Error deleting item:", err);
      toast.error("Failed to delete item");
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    
    try {
      const savedMeta = localStorage.getItem("closetItemsMeta");
      if (savedMeta) {
        const meta: ClothingItemMeta[] = JSON.parse(savedMeta);
        const updatedMeta = meta.map(m => 
          m.id === editingItem.id ? { ...m, type: editingType } : m
        );
        localStorage.setItem("closetItemsMeta", JSON.stringify(updatedMeta));
      }
      
      setClosetItems(items => 
        items.map(item => 
          item.id === editingItem.id ? { ...item, type: editingType } : item
        )
      );
      
      toast.success("Item updated");
      setEditingItem(null);
    } catch (err) {
      console.error("Error updating item:", err);
      toast.error("Failed to update item");
    }
  };

  // Normalize image: auto-correct EXIF rotation and resize
  const normalizeImage = (
    dataUrl: string,
    maxSize = 1024,
    fileName = "unknown"
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const timeout = setTimeout(() => {
        console.warn(`[Closet] Image load timed out after 15s: ${fileName}`);
        reject(new Error(`Image load timeout: ${fileName}`));
      }, 15000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
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
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch (err) {
          console.warn(`[Closet] Canvas draw failed for ${fileName}:`, err);
          reject(err);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        const prefix = dataUrl.substring(0, 30);
        console.warn(
          `[Closet] Skipping "${fileName}" — browser could not decode this image (data starts with: ${prefix}...)`
        );
        reject(new Error(`Image failed to load: ${fileName}`));
      };

      img.src = dataUrl;
    });
  };

  const processFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      console.log(`[Closet] Processing ${imageFiles.length} image files...`);
      
      if (!ENABLE_AI_DETECTION) {
        console.log(`[Closet] ℹ️  AI detection is disabled.`);
      } else {
        console.log(`[Closet] ℹ️  AI detection enabled (OpenAI with Gemini fallback)`);
      }
      
      setIsProcessing(true);
      setProcessCount({ done: 0, total: imageFiles.length });

      // Load existing metadata
      const existingMeta: ClothingItemMeta[] = JSON.parse(
        localStorage.getItem("closetItemsMeta") || "[]"
      );
      const newMeta: ClothingItemMeta[] = [...existingMeta];
      let processed = 0;
      let failed = 0;
      let aiQuotaExceeded = false;

      for (
        let batchStart = 0;
        batchStart < imageFiles.length;
        batchStart += BATCH_SIZE
      ) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, imageFiles.length);
        const batch = imageFiles.slice(batchStart, batchEnd);
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(imageFiles.length / BATCH_SIZE);
        console.log(
          `[Closet] Batch ${batchNum}/${totalBatches} (items ${batchStart + 1}-${batchEnd})`
        );

        for (let i = 0; i < batch.length; i++) {
          const file = batch[i];
          const globalIndex = batchStart + i;

          try {
            const rawData = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () =>
                reject(new Error(`FileReader failed: ${file.name}`));
              reader.readAsDataURL(file);
            });

            const imageData = await normalizeImage(rawData, 1024, file.name);
            const id = `${Date.now()}-${globalIndex}`;

            // Upload to Supabase Storage and get public URL
            const publicUrl = await saveImageToSupabase(id, imageData);

            // Analyze item: detect type + generate tags in a single API call
            let detectedType: string | undefined;
            let itemTags: ClothingTag | undefined;

            if (ENABLE_AI_DETECTION && !aiQuotaExceeded) {
              try {
                // Add delay between requests to avoid rate limits (1 per second)
                if (globalIndex > 0) {
                  await new Promise(r => setTimeout(r, 1000));
                }

                const analyzeRes = await fetch("/api/analyze-item", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ image: imageData }),
                });

                if (analyzeRes.ok) {
                  const analyzeData = await analyzeRes.json();
                  detectedType = analyzeData.item?.type;
                  itemTags = createClothingTag(id, analyzeData.tags);
                  console.log(`[Closet] ✓ Analyzed: ${file.name} → ${detectedType} | ${itemTags?.keywords.slice(0, 5).join(", ")}`);
                } else if (analyzeRes.status === 402) {
                  toast.error("Insufficient AI credits to process more items");
                  console.warn(`[Closet] ⚠ Insufficient AI credits - skipping remaining items`);
                  aiQuotaExceeded = true;
                } else if (analyzeRes.status === 429) {
                  console.warn(`[Closet] ⏸ Rate limit hit - skipping ${file.name}`);
                } else {
                  console.warn(`[Closet] ⚠ Analysis failed for ${file.name}: ${analyzeRes.status}`);
                }
              } catch (analyzeErr) {
                console.warn(`[Closet] ⚠ Analysis error for ${file.name}:`, analyzeErr);
              }
            }

            newMeta.push({ 
              id, 
              type: detectedType,
              tags: itemTags,
              autoTagged: !!itemTags,
              manuallyRefined: false,
            });
            
            // Add to closetItems for immediate display
            setClosetItems(prev => [...prev, {
              id,
              type: detectedType,
              imageUrl: publicUrl,
              tags: itemTags,
              autoTagged: !!itemTags,
              manuallyRefined: false,
            }]);
            
            processed++;
            console.log(
              `[Closet] ✓ ${globalIndex + 1}/${imageFiles.length} — ${file.name} → ${detectedType || "undetected"} (${(imageData.length / 1024).toFixed(0)}KB)`
            );
          } catch (err) {
            failed++;
            const reason = err instanceof Error ? err.message : String(err);
            console.warn(
              `[Closet] ✗ Skipped ${globalIndex + 1}/${imageFiles.length} — ${file.name} (${file.type}, ${(file.size / 1024).toFixed(0)}KB) — ${reason}`
            );
          }

          setProcessCount({
            done: globalIndex + 1,
            total: imageFiles.length,
          });
        }

        // Save metadata after each batch
        localStorage.setItem("closetItemsMeta", JSON.stringify(newMeta));
        setItemCount(newMeta.length);

        if (batchEnd < imageFiles.length) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      if (failed > 0) {
        console.warn(
          `[Closet] Done: ${processed} added, ${failed} skipped (unsupported format or corrupt) out of ${imageFiles.length} total`
        );
      } else {
        console.log(`[Closet] Done: all ${processed} items added successfully`);
      }
      setIsProcessing(false);
    },
    []
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    console.log(`[Closet] File input: ${files.length} files selected`);
    processFiles(files);
    e.target.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      console.log(`[Closet] Drop: ${files.length} files dropped`);
      processFiles(files);
    },
    [processFiles]
  );

  const handleClearCloset = async () => {
    console.log("[Closet] Clearing all items");
    await clearAllImagesFromSupabase();
    localStorage.removeItem("closetItemsMeta");
    localStorage.removeItem("closetItems");
    setItemCount(0);
    setClosetItems([]);
  };

  const handleGenerateOutfits = () => {
    if (itemCount === 0) return;
    console.log(`[Closet] Navigating to outfits with ${itemCount} items`);
    router.push("/outfits");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--warm-white)" }}>
      {/* Nav */}
      <nav
        style={{
          padding: "1.25rem 3rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(196,168,130,0.15)",
        }}
      >
        <Link href="/" className="nav-logo" style={{ textDecoration: "none" }}>
          NothingToWear<span>.ai</span>
        </Link>
        <div
          style={{
            fontFamily: "var(--sans)",
            fontSize: "0.8rem",
            color: "var(--soft-gray)",
          }}
        >
          Step 2 of 3
        </div>
      </nav>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "3rem 2rem" }}>
        {/* Progress dots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            marginBottom: "3rem",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--tan)",
            }}
          />
          <div style={{ width: 48, height: 1, background: "var(--tan)" }} />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--tan)",
            }}
          />
          <div
            style={{ width: 48, height: 1, background: "var(--tan-light)" }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--tan-light)",
            }}
          />
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div className="section-label">{isProcessing ? "Almost there" : "Your closet, digitized"}</div>
          <h1
            style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              fontWeight: 400,
              color: "var(--charcoal)",
              marginBottom: "1rem",
              letterSpacing: "-0.02em",
            }}
          >
            {isProcessing
              ? "Syncing your wardrobe"
              : itemCount === 0
                ? "Upload your wardrobe"
                : "Your closet is ready"}
          </h1>
          <p
            style={{
              fontFamily: "var(--sans)",
              fontSize: "1.05rem",
              fontWeight: 300,
              lineHeight: 1.7,
              color: "var(--warm-gray)",
            }}
          >
            {isProcessing
              ? "Sit tight — we\u2019re processing your photos."
              : itemCount === 0
                ? "Drop all your clothing photos at once \u2014 we handle the rest."
                : "Everything is synced. Add more anytime or start generating outfits."}
          </p>
        </div>

        {/* ═══ Synced state: cloud summary card ═══ */}
        {itemCount > 0 && !isProcessing && (
          <div
            style={{
              background:
                "linear-gradient(165deg, var(--cream) 0%, #f5efe8 50%, #ede5db 100%)",
              borderRadius: 20,
              padding: "2.5rem 2rem",
              textAlign: "center",
              marginBottom: "2rem",
              border: "1px solid rgba(196,168,130,0.12)",
              animation: "fadeIn 0.4s ease",
            }}
          >
            {/* Cloud icon */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(196,168,130,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--tan)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9" />
                <polyline points="12 13 12 21" />
                <polyline points="9 18 12 21 15 18" />
              </svg>
            </div>

            <p
              style={{
                fontFamily: "var(--serif)",
                fontSize: "3.5rem",
                fontWeight: 400,
                color: "var(--charcoal)",
                lineHeight: 1,
                marginBottom: "0.3rem",
              }}
            >
              {itemCount}
            </p>
            <p
              style={{
                fontFamily: "var(--sans)",
                fontSize: "0.95rem",
                fontWeight: 300,
                color: "var(--warm-gray)",
                marginBottom: "0.3rem",
              }}
            >
              {itemCount === 1 ? "item" : "items"} in your closet
            </p>
            <p
              style={{
                fontFamily: "var(--sans)",
                fontSize: "0.75rem",
                fontWeight: 400,
                color: "var(--tan)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.3rem",
              }}
            >
              <span style={{ fontSize: "0.65rem" }}>&#10003;</span>
              Synced &amp; ready
            </p>
          </div>
        )}

        {/* ═══ Upload zone ═══ */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          style={{
            border: isDragging
              ? "2px solid var(--tan)"
              : itemCount > 0
                ? "1px solid rgba(196,168,130,0.12)"
                : "1px dashed var(--tan-light)",
            borderRadius: 16,
            padding: isProcessing
              ? "2.5rem 2rem"
              : itemCount > 0
                ? "1.5rem 2rem"
                : "3.5rem 2rem",
            textAlign: "center",
            background: isDragging
              ? "rgba(196,168,130,0.08)"
              : "var(--cream)",
            transition: "all 0.3s ease",
            cursor: isProcessing ? "default" : "pointer",
            marginBottom: "2rem",
            transform: isDragging ? "scale(1.01)" : "scale(1)",
          }}
        >
          {isProcessing ? (
            <>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  border: "2px solid var(--tan-light)",
                  borderTopColor: "var(--tan)",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 1.2rem",
                }}
              />
              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: "1.1rem",
                  color: "var(--charcoal)",
                  marginBottom: "0.4rem",
                }}
              >
                Analyzing your wardrobe...
              </p>
              <p
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: "0.75rem",
                  color: "var(--tan)",
                  marginBottom: "0.3rem",
                }}
              >
                AI is identifying each item (top, bottom, dress, shoes...)
              </p>
              <p
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: "0.85rem",
                  color: "var(--soft-gray)",
                }}
              >
                {processCount.done} of {processCount.total} items
              </p>
              {/* Progress bar */}
              <div
                style={{
                  maxWidth: 300,
                  margin: "1rem auto 0",
                  height: 3,
                  borderRadius: 2,
                  background: "var(--tan-light)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    background: "var(--tan)",
                    transition: "width 0.3s ease",
                    width: `${(processCount.done / processCount.total) * 100}%`,
                  }}
                />
              </div>
            </>
          ) : itemCount > 0 ? (
            /* Compact add-more state */
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.6rem",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--tan)"
                strokeWidth="1.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: "0.9rem",
                  fontWeight: 400,
                  color: "var(--charcoal)",
                }}
              >
                Add more items
              </span>
            </div>
          ) : (
            /* Empty state — large upload zone */
            <>
              <svg
                style={{
                  width: 48,
                  height: 48,
                  color: isDragging ? "var(--tan)" : "var(--tan-light)",
                  margin: "0 auto 1rem",
                  transition: "color 0.3s ease",
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "1.15rem",
                  fontWeight: 500,
                  color: "var(--charcoal)",
                  marginBottom: "0.5rem",
                }}
              >
                {isDragging
                  ? "Drop your photos here"
                  : "Drag & drop your clothing photos"}
              </p>
              <p
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: "0.85rem",
                  color: "var(--soft-gray)",
                  marginBottom: "1.2rem",
                }}
              >
                Or click to browse &mdash; select as many as you want
              </p>
              <div
                className="cta-btn"
                style={{
                  display: "inline-flex",
                  opacity: 1,
                  animation: "none",
                  fontSize: "0.85rem",
                  padding: "0.8rem 2rem",
                }}
              >
                Upload Your Wardrobe
              </div>
              <p
                style={{
                  marginTop: "1rem",
                  fontFamily: "var(--sans)",
                  fontSize: "0.75rem",
                  color: "var(--soft-gray)",
                }}
              >
                Tops, bottoms, shoes, accessories &mdash; anything you wear
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
            disabled={isProcessing}
          />
        </div>

        {/* ═══ Items Gallery ═══ */}
        {itemCount > 0 && !isProcessing && !isLoadingItems && closetItems.length > 0 && (
          <div style={{ marginBottom: "3rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1.5rem" }}>
              <h2
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "1.3rem",
                  fontWeight: 400,
                  color: "var(--charcoal)",
                  margin: 0,
                }}
              >
                Your Items
              </h2>
              <button
                onClick={() => setIsItemsCollapsed(!isItemsCollapsed)}
                style={{
                  background: "none",
                  border: "none",
                  fontFamily: "var(--sans)",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  color: "var(--tan)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  transition: "color 0.3s ease",
                  padding: "0.5rem 1rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--tan-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--tan)";
                }}
                title={isItemsCollapsed ? "Expand items" : "Collapse items"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.3s ease", transform: isItemsCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
            
            {!isItemsCollapsed && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: "1.2rem",
                  animation: "fadeIn 0.3s ease",
                }}
              >
              {closetItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    position: "relative",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--cream)",
                    border: "1px solid rgba(196,168,130,0.12)",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Item Image */}
                  <img
                    src={item.imageUrl}
                    alt={`Clothing item ${item.type || "unknown"}`}
                    style={{
                      width: "100%",
                      height: 160,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  
                  {/* Item Info */}
                  <div style={{ padding: "0.8rem" }}>
                    <p
                      style={{
                        fontFamily: "var(--sans)",
                        fontSize: "0.75rem",
                        color: "var(--tan)",
                        fontWeight: 500,
                        textTransform: "capitalize",
                        marginBottom: "0.4rem",
                      }}
                    >
                      {item.type || "Not classified"}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                      }}
                    >
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setEditingType(item.type || "");
                        }}
                        style={{
                          flex: 1,
                          padding: "0.5rem",
                          fontFamily: "var(--sans)",
                          fontSize: "0.7rem",
                          background: "var(--tan)",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          transition: "background 0.3s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--tan-dark)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--tan)";
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        style={{
                          flex: 1,
                          padding: "0.5rem",
                          fontFamily: "var(--sans)",
                          fontSize: "0.7rem",
                          background: "#f5e5e5",
                          color: "#c74545",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          transition: "background 0.3s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f0d0d0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#f5e5e5";
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Edit Item Modal ═══ */}
        {editingItem && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setEditingItem(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                borderRadius: 12,
                padding: "2rem",
                maxWidth: 400,
                width: "90%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "1.3rem",
                  fontWeight: 400,
                  color: "var(--charcoal)",
                  marginBottom: "1.5rem",
                }}
              >
                Edit Item
              </h3>
              
              <img
                src={editingItem.imageUrl}
                alt="Item"
                style={{
                  width: "100%",
                  height: 200,
                  objectFit: "cover",
                  borderRadius: 8,
                  marginBottom: "1.5rem",
                }}
              />
              
              <label
                style={{
                  display: "block",
                  fontFamily: "var(--sans)",
                  fontSize: "0.9rem",
                  color: "var(--charcoal)",
                  marginBottom: "0.5rem",
                  fontWeight: 500,
                }}
              >
                Item Type
              </label>
              <select
                value={editingType}
                onChange={(e) => setEditingType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  fontFamily: "var(--sans)",
                  fontSize: "0.95rem",
                  border: "1px solid rgba(196,168,130,0.3)",
                  borderRadius: 6,
                  marginBottom: "1.5rem",
                  boxSizing: "border-box",
                }}
              >
                <option value="">Not classified</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="dress">Dress</option>
                <option value="outerwear">Outerwear</option>
                <option value="shoes">Shoes</option>
                <option value="accessory">Accessory</option>
              </select>
              
              {/* Tags display */}
              {editingItem.tags && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "var(--sans)",
                      fontSize: "0.85rem",
                      color: "var(--charcoal)",
                      marginBottom: "0.8rem",
                      fontWeight: 500,
                    }}
                  >
                    Auto-Generated Tags
                  </label>
                  <div style={{ padding: "0.8rem", background: "rgba(196,168,130,0.05)", borderRadius: 6, fontSize: "0.8rem", lineHeight: "1.6", color: "var(--charcoal)" }}>
                    {editingItem.tags.color && (
                      <div><strong>Colors:</strong> {editingItem.tags.color.join(", ")}</div>
                    )}
                    {editingItem.tags.pattern && (
                      <div><strong>Pattern:</strong> {editingItem.tags.pattern.join(", ")}</div>
                    )}
                    {editingItem.tags.style && (
                      <div><strong>Style:</strong> {editingItem.tags.style.join(", ")}</div>
                    )}
                    {editingItem.tags.fit && (
                      <div><strong>Fit:</strong> {editingItem.tags.fit.join(", ")}</div>
                    )}
                    {editingItem.tags.material && (
                      <div><strong>Material:</strong> {editingItem.tags.material.join(", ")}</div>
                    )}
                    {editingItem.tags.occasion && (
                      <div><strong>Occasion:</strong> {editingItem.tags.occasion.join(", ")}</div>
                    )}
                    {editingItem.tags.description && (
                      <div style={{ marginTop: "0.6rem", paddingTop: "0.6rem", borderTop: "1px solid rgba(196,168,130,0.2)", fontSize: "0.75rem", fontStyle: "italic" }}>{editingItem.tags.description}</div>
                    )}
                  </div>
                  {editingItem.autoTagged && (
                    <p style={{ fontFamily: "var(--sans)", fontSize: "0.7rem", color: "var(--soft-gray)", marginTop: "0.4rem" }}>
                      ✓ Auto-tagged on upload {editingItem.manuallyRefined && " • Manually refined"}
                    </p>
                  )}
                </div>
              )}
              
              <div style={{ display: "flex", gap: "1rem" }}>
                <button
                  onClick={() => setEditingItem(null)}
                  style={{
                    flex: 1,
                    padding: "0.9rem",
                    fontFamily: "var(--sans)",
                    fontSize: "0.9rem",
                    background: "transparent",
                    color: "var(--tan)",
                    border: "1px solid var(--tan)",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(196,168,130,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateItem}
                  style={{
                    flex: 1,
                    padding: "0.9rem",
                    fontFamily: "var(--sans)",
                    fontSize: "0.9rem",
                    background: "var(--tan)",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "background 0.3s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--tan-dark)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--tan)";
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        {itemCount >= 4 && !isProcessing && (
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <button
              onClick={handleGenerateOutfits}
              className="cta-btn"
              style={{ opacity: 1, animation: "none", width: "100%", justifyContent: "center" }}
            >
              Generate My Outfits
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Style match link */}
        {itemCount >= 4 && !isProcessing && (
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <Link
              href="/style-match"
              style={{
                fontFamily: "var(--sans)",
                fontSize: "0.85rem",
                color: "var(--tan)",
                textDecoration: "none",
                transition: "color 0.3s",
              }}
            >
              Or match an outfit you saw on Instagram &rarr;
            </Link>
          </div>
        )}

        {/* Clear closet — small text link */}
        {itemCount > 0 && !isProcessing && (
          <div style={{ textAlign: "center" }}>
            <button
              onClick={handleClearCloset}
              style={{
                background: "none",
                border: "none",
                fontFamily: "var(--sans)",
                fontSize: "0.75rem",
                color: "var(--soft-gray)",
                cursor: "pointer",
                transition: "color 0.3s",
                opacity: 0.6,
              }}
            >
              Clear closet &amp; start over
            </button>
          </div>
        )}

        {/* Empty state message */}
        {itemCount === 0 && !isProcessing && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <p
              style={{
                fontFamily: "var(--sans)",
                fontSize: "0.85rem",
                fontWeight: 300,
                color: "var(--warm-gray)",
                lineHeight: 1.7,
              }}
            >
              Add at least 4 items to start generating outfits.
              <br />
              The more you add, the better the combinations.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
