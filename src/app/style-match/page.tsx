"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface ClothingItem {
  id: string;
  image: string;
  type?: string;
  color?: string;
  style?: string;
}

interface InspoAnalysis {
  pieces: Array<{
    type: string;
    description: string;
    color: string;
    style: string;
    fit: string;
  }>;
  overall_style: string;
  color_palette: string[];
  vibe: string;
  styling_notes: string;
}

interface MatchResult {
  matched_outfit: {
    items: Array<{
      closet_item_index: number;
      matches_piece: string;
      match_quality: string;
    }>;
    match_score: number;
    styling_tip: string;
  };
  missing_pieces: Array<{
    type: string;
    description: string;
    search_query: string;
    impact: string;
  }>;
  upgraded_outfit: {
    description: string;
    confidence: string;
  };
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
  const [inspoImage, setInspoImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<InspoAnalysis | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [pinterestUrl, setPinterestUrl] = useState("");
  const [isLoadingPinterest, setIsLoadingPinterest] = useState(false);
  const [pinterestPins, setPinterestPins] = useState<string[]>([]);
  const [styleDna, setStyleDna] = useState<StyleDna | null>(null);
  const [activeTab, setActiveTab] = useState<"photo" | "pinterest">("photo");

  useEffect(() => {
    const savedItems = localStorage.getItem("closetItems");
    if (savedItems) {
      setClosetItems(JSON.parse(savedItems));
    }
  }, []);

  const handleInspoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setInspoImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAnalyzeInspo = async () => {
    if (!inspoImage) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    setMatchResult(null);
    try {
      const response = await fetch("/api/analyze-inspo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspoImage,
          closetItems: closetItems.length > 0 ? closetItems : null,
        }),
      });
      if (!response.ok) throw new Error("Failed to analyze");
      const data = await response.json();
      setAnalysis(data.analysis);
      if (data.match) setMatchResult(data.match);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsAnalyzing(false);
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
                        setAnalysis(null);
                        setMatchResult(null);
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

                  {/* Analysis */}
                  <div>
                    {!analysis && !isAnalyzing && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                        }}
                      >
                        <button
                          onClick={handleAnalyzeInspo}
                          className="cta-btn"
                          style={{ opacity: 1, animation: "none" }}
                        >
                          {closetItems.length > 0
                            ? "Match to My Closet"
                            : "Analyze This Outfit"}
                        </button>
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
                    )}

                    {/* Loading */}
                    {isAnalyzing && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                        }}
                      >
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            border: "2px solid var(--tan-light)",
                            borderTopColor: "var(--tan)",
                            animation: "spin 1s linear infinite",
                            marginBottom: "1.2rem",
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
                          Decoding this look...
                        </p>
                      </div>
                    )}

                    {/* Results */}
                    {analysis && (
                      <div>
                        <p className="section-label" style={{ marginBottom: "1rem" }}>
                          Outfit Breakdown
                        </p>
                        <div style={{ marginBottom: "1.5rem" }}>
                          <p
                            style={{
                              fontFamily: "var(--serif)",
                              fontSize: "1.3rem",
                              fontWeight: 400,
                              color: "var(--charcoal)",
                              marginBottom: "0.3rem",
                            }}
                          >
                            {analysis.overall_style}
                          </p>
                          <p
                            style={{
                              fontFamily: "var(--serif)",
                              fontStyle: "italic",
                              fontSize: "0.9rem",
                              color: "var(--tan)",
                            }}
                          >
                            {analysis.vibe}
                          </p>
                        </div>

                        {/* Pieces */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.6rem",
                            marginBottom: "1.5rem",
                          }}
                        >
                          {analysis.pieces?.map((piece, i) => (
                            <div
                              key={i}
                              style={{
                                padding: "1rem 1.2rem",
                                background: "var(--cream)",
                                borderLeft: "2px solid var(--tan)",
                                borderRadius: "0 12px 12px 0",
                              }}
                            >
                              <p
                                style={{
                                  fontFamily: "var(--sans)",
                                  fontSize: "0.9rem",
                                  fontWeight: 400,
                                  color: "var(--charcoal)",
                                }}
                              >
                                {piece.description}
                              </p>
                              <p
                                style={{
                                  fontFamily: "var(--sans)",
                                  fontSize: "0.75rem",
                                  color: "var(--soft-gray)",
                                  marginTop: "0.2rem",
                                }}
                              >
                                {piece.color} &middot; {piece.fit} &middot;{" "}
                                {piece.style}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Styling notes */}
                        {analysis.styling_notes && (
                          <div
                            style={{
                              padding: "1.2rem 1.4rem",
                              background: "var(--warm-white)",
                              border: "1px solid rgba(196,168,130,0.12)",
                              borderRadius: 12,
                            }}
                          >
                            <p className="section-label" style={{ marginBottom: "0.6rem" }}>
                              Why This Works
                            </p>
                            <p
                              style={{
                                fontFamily: "var(--sans)",
                                fontSize: "0.9rem",
                                fontWeight: 300,
                                lineHeight: 1.7,
                                color: "var(--warm-gray)",
                              }}
                            >
                              {analysis.styling_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Match Results */}
                {matchResult && (
                  <div style={{ marginTop: "2rem" }}>
                    {/* Score */}
                    <div
                      style={{ textAlign: "center", marginBottom: "2.5rem" }}
                    >
                      <p className="section-label" style={{ marginBottom: "0.5rem" }}>
                        Closet Match Score
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: "3.5rem",
                          fontWeight: 400,
                          color: "var(--tan)",
                        }}
                      >
                        {matchResult.matched_outfit?.match_score || 0}%
                      </p>
                    </div>

                    {/* Matched items */}
                    {matchResult.matched_outfit?.items?.length > 0 && (
                      <div style={{ marginBottom: "2.5rem" }}>
                        <p className="section-label" style={{ marginBottom: "1rem" }}>
                          From Your Closet
                        </p>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "1rem",
                          }}
                        >
                          {matchResult.matched_outfit.items.map((match, i) => {
                            const item = closetItems[match.closet_item_index];
                            if (!item) return null;
                            return (
                              <div key={i}>
                                <div
                                  style={{
                                    aspectRatio: "1",
                                    position: "relative",
                                    overflow: "hidden",
                                    borderRadius: 16,
                                    background: "var(--cream)",
                                    marginBottom: "0.5rem",
                                    border: "1px solid rgba(196,168,130,0.12)",
                                  }}
                                >
                                  <Image
                                    src={item.image}
                                    alt="Matched item"
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <p
                                  style={{
                                    fontFamily: "var(--sans)",
                                    fontSize: "0.75rem",
                                    color: "var(--soft-gray)",
                                  }}
                                >
                                  {match.matches_piece}
                                </p>
                                <p
                                  style={{
                                    fontFamily: "var(--sans)",
                                    fontSize: "0.72rem",
                                    fontWeight: 500,
                                    marginTop: "0.15rem",
                                    color:
                                      match.match_quality === "perfect"
                                        ? "var(--sage)"
                                        : match.match_quality === "close"
                                        ? "var(--tan)"
                                        : "var(--soft-gray)",
                                  }}
                                >
                                  {match.match_quality} match
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        {matchResult.matched_outfit.styling_tip && (
                          <div
                            style={{
                              marginTop: "1.5rem",
                              padding: "1.5rem",
                              background: "var(--cream)",
                              borderRadius: 16,
                            }}
                          >
                            <p className="section-label" style={{ marginBottom: "0.5rem" }}>
                              Styling Tip
                            </p>
                            <p
                              style={{
                                fontFamily: "var(--serif)",
                                fontStyle: "italic",
                                fontSize: "0.95rem",
                                color: "var(--charcoal)",
                                lineHeight: 1.7,
                              }}
                            >
                              {matchResult.matched_outfit.styling_tip}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Missing pieces */}
                    {matchResult.missing_pieces?.length > 0 && (
                      <div
                        style={{
                          padding: "2rem",
                          background: "var(--cream)",
                          borderRadius: 16,
                          borderLeft: "3px solid var(--tan)",
                        }}
                      >
                        <p className="section-label" style={{ marginBottom: "1.2rem" }}>
                          One Piece Away
                        </p>
                        {matchResult.missing_pieces.map((piece, i) => (
                          <div
                            key={i}
                            style={{ marginBottom: i < matchResult.missing_pieces.length - 1 ? "1.5rem" : 0 }}
                          >
                            <p
                              style={{
                                fontFamily: "var(--serif)",
                                fontSize: "1.1rem",
                                fontWeight: 400,
                                color: "var(--charcoal)",
                                marginBottom: "0.3rem",
                              }}
                            >
                              {piece.description}
                            </p>
                            <p
                              style={{
                                fontFamily: "var(--sans)",
                                fontSize: "0.85rem",
                                fontWeight: 300,
                                color: "var(--warm-gray)",
                                marginBottom: "0.8rem",
                              }}
                            >
                              {piece.impact}
                            </p>
                            <a
                              href={`https://www.amazon.com/s?k=${encodeURIComponent(piece.search_query)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cta-btn"
                              style={{
                                opacity: 1,
                                animation: "none",
                                fontSize: "0.82rem",
                                padding: "0.7rem 1.8rem",
                              }}
                            >
                              Find on Amazon &rarr;
                            </a>
                          </div>
                        ))}

                        {matchResult.upgraded_outfit && (
                          <div
                            style={{
                              marginTop: "1.5rem",
                              padding: "1.2rem",
                              background: "var(--warm-white)",
                              borderRadius: 12,
                            }}
                          >
                            <p
                              style={{
                                fontFamily: "var(--serif)",
                                fontStyle: "italic",
                                fontSize: "0.92rem",
                                color: "var(--charcoal)",
                                lineHeight: 1.7,
                              }}
                            >
                              With this piece:{" "}
                              {matchResult.upgraded_outfit.description}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
      `}</style>
    </div>
  );
}
