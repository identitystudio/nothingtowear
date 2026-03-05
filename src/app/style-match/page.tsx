"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

interface ClothingItem {
  id: string;
  image: string;
  type?: string;
  color?: string;
  style?: string;
}


interface StyleDna {
  style_dna: {
    primary_aesthetic: string;
    secondary_aesthetic: string;
    color_palette: string[];
    silhouettes: string[];
    mood: string;
  };
  outfit_formulas: string[];
  styling_rules: string[];
  key_pieces: string[];
}

export default function StyleMatchPage() {
  const [closetItems, setClosetItems] = useState<ClothingItem[]>([]);
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [inspoImage, setInspoImage] = useState<string | null>(null);
  const [pinterestUrl, setPinterestUrl] = useState("");
  const [isLoadingPinterest, setIsLoadingPinterest] = useState(false);
  const [pinterestPins, setPinterestPins] = useState<string[]>([]);
  const [styleDna, setStyleDna] = useState<StyleDna | null>(null);
  const [activeTab, setActiveTab] = useState<"photo" | "pinterest">("photo");
  const [transformImageUrl, setTransformImageUrl] = useState<string | null>(null);
  const [isTransformLoading, setIsTransformLoading] = useState(false);

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
    if (!isTransformLoading) return;
    const interval = setInterval(() => {
      setQuoteVisible(false);
      setTimeout(() => {
        setLoadingQuoteIndex((i) => (i + 1) % loadingQuotes.length);
        setQuoteVisible(true);
      }, 400);
    }, 3200);
    return () => clearInterval(interval);
  }, [isTransformLoading]);

  useEffect(() => {
    const savedItems = localStorage.getItem("closetItems");
    if (savedItems) {
      setClosetItems(JSON.parse(savedItems));
    }
    const savedFace = localStorage.getItem("facePhoto");
    if (savedFace) {
      setFaceImage(savedFace);
    }
  }, []);

  const handleInspoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setInspoImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleTransformThis = async () => {
    if (!inspoImage) return;
    setIsTransformLoading(true);
    setTransformImageUrl(null);

    try {
      const formData = new FormData();

      // Attach Compiled_Clothes (the inspiration outfit image)
      const arr = inspoImage.split(",");
      const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const bstr = atob(arr[1]);
      const u8arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      formData.append("Compiled_Clothes", new Blob([u8arr], { type: mime }), "outfit.jpg");

      // Attach Personal_Manequin (face/body photo)
      const currentFacePhoto = faceImage || localStorage.getItem("facePhoto") || localStorage.getItem("bodyPhoto");
      if (currentFacePhoto && currentFacePhoto.startsWith("data:")) {
        const fArr = currentFacePhoto.split(",");
        const fMime = fArr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const fBstr = atob(fArr[1]);
        const fU8arr = new Uint8Array(fBstr.length);
        for (let i = 0; i < fBstr.length; i++) {
          fU8arr[i] = fBstr.charCodeAt(i);
        }
        formData.append("Personal_Manequin", new Blob([fU8arr], { type: fMime }), "mannequin.jpg");
      }

      const res = await fetch(
        "https://themacularprogram.app.n8n.cloud/webhook/analyze-clothes2",
        { method: "POST", body: formData }
      );

      if (!res.ok) throw new Error(`Webhook failed: ${res.status}`);

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].secure_url) {
        setTransformImageUrl(data[0].secure_url);
      } else {
        toast.error("No image returned from webhook");
      }
    } catch (err) {
      console.warn("Transform webhook failed:", err);
      toast.error("Transform failed. Please try again.");
    } finally {
      setIsTransformLoading(false);
    }
  };

  const handlePinterestImport = async () => {
    if (!pinterestUrl) return;
    setIsLoadingPinterest(true);
    setPinterestPins([]);
    setStyleDna(null);
    try {
      const response = await fetch("/api/pinterest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardUrl: pinterestUrl }),
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.error || "Could not load Pinterest board");
        return;
      }
      const data = await response.json();
      setPinterestPins(data.images || []);
      setStyleDna(data.styleDna || null);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoadingPinterest(false);
    }
  };

  const handlePinClick = (pinUrl: string) => {
    setInspoImage(pinUrl);
    setActiveTab("photo");
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
        <Link href="/closet" className="cta-outline" style={{ fontSize: "0.75rem" }}>
          My Closet
        </Link>
      </nav>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 2rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div className="section-label">Style Match</div>
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
            See an outfit you love?
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
            Upload it and we&rsquo;ll recreate it from{" "}
            <strong style={{ fontWeight: 500, color: "var(--charcoal)" }}>
              your own closet
            </strong>
          </p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.5rem",
            marginBottom: "3rem",
          }}
        >
          <button
            onClick={() => setActiveTab("photo")}
            className={activeTab === "photo" ? "cta-btn" : "cta-outline"}
            style={{
              padding: "0.7rem 2rem",
              fontSize: "0.8rem",
              opacity: 1,
              animation: "none",
            }}
          >
            Upload Photo
          </button>
          <button
            onClick={() => setActiveTab("pinterest")}
            className={activeTab === "pinterest" ? "cta-btn" : "cta-outline"}
            style={{
              padding: "0.7rem 2rem",
              fontSize: "0.8rem",
              opacity: 1,
              animation: "none",
            }}
          >
            Pinterest Board
          </button>
        </div>

        {/* PHOTO TAB */}
        {activeTab === "photo" && (
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {!inspoImage ? (
              <label style={{ display: "block", cursor: "pointer" }}>
                <div
                  style={{
                    border: "1px dashed var(--tan-light)",
                    borderRadius: 16,
                    padding: "5rem 2rem",
                    textAlign: "center",
                    background: "var(--cream)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: "1.15rem",
                      fontWeight: 500,
                      color: "var(--charcoal)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Upload an outfit photo
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: "0.85rem",
                      color: "var(--soft-gray)",
                    }}
                  >
                    From Instagram, TikTok, Pinterest, or your camera roll
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInspoUpload}
                />
              </label>
            ) : (
              <div>
                {/* Side by side: inspo + analysis */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "2.5rem",
                    marginBottom: "2.5rem",
                  }}
                >
                  {/* Inspo image */}
                  <div>
                    <p className="section-label" style={{ marginBottom: "1rem" }}>
                      Inspiration
                    </p>
                    <div
                      style={{
                        aspectRatio: "3/4",
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: 16,
                        background: "var(--cream)",
                      }}
                    >
                      <Image
                        src={inspoImage}
                        alt="Inspiration outfit"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setInspoImage(null);
                        setTransformImageUrl(null);
                      }}
                      style={{
                        marginTop: "1rem",
                        fontFamily: "var(--sans)",
                        fontSize: "0.85rem",
                        color: "var(--soft-gray)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      &larr; Choose different photo
                    </button>
                  </div>

                  {/* Transform */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                      }}
                    >
                        {!isTransformLoading && !transformImageUrl && (
                          <button
                            onClick={handleTransformThis}
                            className="cta-btn"
                            style={{ animation: "none" }}
                          >
                            See It On Me
                          </button>
                        )}
                        {/* Result */}
                        {(isTransformLoading || transformImageUrl) && (
                          <div style={{ width: "100%", marginTop: "2rem" }}>
                            {isTransformLoading && (
                              <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                                {/* Animated dots */}
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
                                <div style={{ width: 32, height: 1, background: "rgba(196,168,130,0.4)", margin: "0 auto 1.4rem" }} />
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
                            )}
                            {transformImageUrl && (
                              <div style={{ animation: "fadeInUp 0.35s ease" }}>
                                <img
                                  src={transformImageUrl}
                                  alt="Transformed outfit"
                                  style={{
                                    width: "100%",
                                    borderRadius: 12,
                                    border: "1px solid rgba(196,168,130,0.25)",
                                    display: "block",
                                  }}
                                />
                                <a
                                  href={transformImageUrl}
                                  download="transformed-outfit.png"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: "inline-block",
                                    marginTop: "0.6rem",
                                    fontFamily: "var(--sans)",
                                    fontSize: "0.75rem",
                                    color: "var(--charcoal)",
                                    background: "var(--cream)",
                                    border: "1px solid rgba(196,168,130,0.4)",
                                    borderRadius: 999,
                                    padding: "0.4rem 0.9rem",
                                    textDecoration: "none",
                                    cursor: "pointer",
                                  }}
                                >
                                  Download image
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {closetItems.length === 0 && (
                          <p
                            style={{
                              marginTop: "1rem",
                              fontFamily: "var(--sans)",
                              fontSize: "0.82rem",
                              color: "var(--soft-gray)",
                              textAlign: "center",
                            }}
                          >
                            <Link
                              href="/closet"
                              style={{ color: "var(--tan)", textDecoration: "none" }}
                            >
                              Add items to your closet
                            </Link>{" "}
                            to get matched outfits
                          </p>
                        )}
                      </div>

                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* PINTEREST TAB */}
        {activeTab === "pinterest" && (
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ marginBottom: "2.5rem" }}>
              <p
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: "0.85rem",
                  color: "var(--soft-gray)",
                  marginBottom: "0.8rem",
                }}
              >
                Paste your Pinterest board URL
              </p>
              <div style={{ display: "flex", gap: "0.8rem" }}>
                <input
                  type="text"
                  placeholder="https://pinterest.com/username/board-name"
                  value={pinterestUrl}
                  onChange={(e) => setPinterestUrl(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "1rem 1.5rem",
                    borderRadius: 100,
                    border: "1px solid rgba(196,168,130,0.2)",
                    background: "var(--warm-white)",
                    fontFamily: "var(--sans)",
                    fontSize: "0.9rem",
                    fontWeight: 300,
                    color: "var(--charcoal)",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handlePinterestImport}
                  disabled={!pinterestUrl || isLoadingPinterest}
                  className="cta-btn"
                  style={{
                    opacity: !pinterestUrl || isLoadingPinterest ? 0.5 : 1,
                    animation: "none",
                    padding: "0.8rem 2rem",
                    fontSize: "0.85rem",
                  }}
                >
                  {isLoadingPinterest ? "Importing..." : "Import"}
                </button>
              </div>
            </div>

            {/* Loading */}
            {isLoadingPinterest && (
              <div style={{ textAlign: "center", padding: "3rem 0" }}>
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
                    color: "var(--soft-gray)",
                  }}
                >
                  Reading your style DNA...
                </p>
              </div>
            )}

            {/* Style DNA */}
            {styleDna && (
              <div style={{ marginBottom: "3rem" }}>
                <div
                  style={{ textAlign: "center", marginBottom: "2.5rem" }}
                >
                  <p className="section-label" style={{ marginBottom: "1rem" }}>
                    Your Style DNA
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: "clamp(1.5rem, 3vw, 2rem)",
                      fontWeight: 400,
                      color: "var(--charcoal)",
                      marginBottom: "0.3rem",
                    }}
                  >
                    {styleDna.style_dna?.primary_aesthetic}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: "1.05rem",
                      color: "var(--tan)",
                    }}
                  >
                    with {styleDna.style_dna?.secondary_aesthetic} influence
                  </p>
                  <p
                    style={{
                      marginTop: "1rem",
                      fontFamily: "var(--sans)",
                      fontSize: "0.9rem",
                      fontWeight: 300,
                      color: "var(--warm-gray)",
                      maxWidth: 500,
                      margin: "1rem auto 0",
                      lineHeight: 1.6,
                    }}
                  >
                    {styleDna.style_dna?.mood}
                  </p>
                </div>

                {/* Outfit Formulas */}
                {styleDna.outfit_formulas?.length > 0 && (
                  <div style={{ marginBottom: "2rem" }}>
                    <p className="section-label" style={{ marginBottom: "1rem" }}>
                      Your Outfit Formulas
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.6rem",
                      }}
                    >
                      {styleDna.outfit_formulas.map((formula, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "1rem 1.2rem",
                            background: "var(--cream)",
                            borderLeft: "2px solid var(--tan)",
                            borderRadius: "0 12px 12px 0",
                            fontFamily: "var(--sans)",
                            fontSize: "0.9rem",
                            fontWeight: 300,
                            color: "var(--charcoal)",
                          }}
                        >
                          {formula}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Pieces */}
                {styleDna.key_pieces?.length > 0 && (
                  <div
                    style={{
                      padding: "1.5rem",
                      background: "var(--cream)",
                      borderRadius: 16,
                    }}
                  >
                    <p className="section-label" style={{ marginBottom: "0.8rem" }}>
                      Key Pieces for Your Style
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {styleDna.key_pieces.map((piece, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "var(--warm-white)",
                            borderRadius: 100,
                            fontFamily: "var(--sans)",
                            fontSize: "0.82rem",
                            fontWeight: 400,
                            color: "var(--charcoal)",
                            border: "1px solid rgba(196,168,130,0.12)",
                          }}
                        >
                          {piece}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pin Grid */}
            {pinterestPins.length > 0 && (
              <div>
                <p className="section-label" style={{ marginBottom: "1rem" }}>
                  Click a pin to style-match it to your closet
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: "0.8rem",
                  }}
                >
                  {pinterestPins.map((pin, i) => (
                    <button
                      key={i}
                      onClick={() => handlePinClick(pin)}
                      style={{
                        aspectRatio: "1",
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: 12,
                        border: "1px solid rgba(196,168,130,0.12)",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        background: "var(--cream)",
                        padding: 0,
                      }}
                    >
                      <Image
                        src={pin}
                        alt={`Pin ${i + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom nav */}
        <div
          style={{
            marginTop: "4rem",
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
          }}
        >
          <Link href="/closet" className="cta-outline" style={{ fontSize: "0.8rem" }}>
            &larr; My Closet
          </Link>
          <Link href="/outfits" className="cta-outline" style={{ fontSize: "0.8rem" }}>
            Generate Outfits &rarr;
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ntw-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-8px); opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ellipsis {
          0% { opacity: 0.2; }
          50% { opacity: 1; }
          100% { opacity: 0.2; }
        }
        @keyframes fadePulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
