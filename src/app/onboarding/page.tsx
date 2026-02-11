"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Normalize image: auto-correct EXIF rotation and resize
  const normalizeImage = (dataUrl: string, maxSize = 1200): Promise<string> => {
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
      img.src = dataUrl;
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const raw = reader.result as string;
        const normalized = await normalizeImage(raw);
        setSelectedImage(normalized);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleContinue = async () => {
    if (!selectedImage) return;
    setUploading(true);
    localStorage.setItem("bodyPhoto", selectedImage);
    router.push("/closet");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--warm-white)",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
          Step 1 of 3
        </div>
      </nav>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 2rem",
        }}
      >
        <div style={{ maxWidth: "640px", width: "100%" }}>
          {/* Progress */}
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
            <div
              style={{
                width: 48,
                height: 1,
                background: "var(--tan-light)",
              }}
            />
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--tan-light)",
              }}
            />
            <div
              style={{
                width: 48,
                height: 1,
                background: "var(--tan-light)",
              }}
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
            <div className="section-label">Your body becomes the model</div>
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
              Upload your photo
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
              One full-length mirror selfie in fitted clothes.
              <br />
              <span style={{ fontSize: "0.9rem", color: "var(--soft-gray)" }}>
                This becomes your personal mannequin &mdash; outfits will be
                shown on you.
              </span>
            </p>
          </div>

          {/* Upload Area */}
          <div style={{ marginBottom: "2rem" }}>
            {!selectedImage ? (
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
                  <svg
                    style={{
                      width: 48,
                      height: 48,
                      color: "var(--tan)",
                      margin: "0 auto 1rem",
                    }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
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
                    Take or upload a photo
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: "0.85rem",
                      color: "var(--soft-gray)",
                    }}
                  >
                    Full body, front-facing, fitted clothes
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </label>
            ) : (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "3/4",
                    maxHeight: 600,
                    margin: "0 auto",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "var(--cream)",
                  }}
                >
                  <Image
                    src={selectedImage}
                    alt="Your photo"
                    fill
                    className="object-contain"
                  />
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    background: "var(--warm-white)",
                    border: "1px solid rgba(196,168,130,0.15)",
                    borderRadius: "50%",
                    width: 40,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(42,37,32,0.08)",
                  }}
                >
                  <svg
                    style={{ width: 18, height: 18, color: "var(--charcoal)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Tips */}
          {!selectedImage && (
            <div
              style={{
                background: "var(--warm-white)",
                border: "1px solid rgba(196,168,130,0.12)",
                borderRadius: 16,
                padding: "1.5rem 2rem",
                marginBottom: "2rem",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "var(--charcoal)",
                  marginBottom: "0.8rem",
                }}
              >
                For best results:
              </p>
              <ul
                style={{
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {[
                  "Stand straight, full body visible",
                  "Wear fitted clothes or workout gear",
                  "Good lighting, plain background if possible",
                ].map((tip) => (
                  <li
                    key={tip}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.6rem",
                      fontFamily: "var(--sans)",
                      fontSize: "0.85rem",
                      fontWeight: 300,
                      color: "var(--warm-gray)",
                    }}
                  >
                    <span style={{ color: "var(--tan)", marginTop: 1 }}>
                      &#10003;
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Continue Button */}
          {selectedImage && (
            <button
              onClick={handleContinue}
              disabled={uploading}
              className="cta-btn"
              style={{
                width: "100%",
                justifyContent: "center",
                opacity: uploading ? 0.6 : 1,
                animation: "none",
              }}
            >
              {uploading ? "Saving..." : "Continue"}
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
          )}
        </div>
      </div>
    </div>
  );
}
