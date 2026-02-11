"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Nav scroll effect
    const nav = document.getElementById("nav");
    const handleScroll = () => {
      nav?.classList.toggle("scrolled", window.scrollY > 60);
    };
    window.addEventListener("scroll", handleScroll);

    // Scroll reveal
    const reveals = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(
              () => entry.target.classList.add("visible"),
              i * 80
            );
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
    );
    reveals.forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* NAV */}
      <nav id="nav">
        <div className="nav-logo">
          NothingToWear<span>.ai</span>
        </div>
        <Link href="/onboarding" className="cta-outline">
          Get Started
        </Link>
      </nav>

      {/* HERO */}
      <section className="hero" id="top">
        <div className="hero-content">
          <div className="hero-eyebrow">Your daily clarity engine</div>
          <h1>
            You Don&rsquo;t Have <em>&ldquo;Nothing to Wear.&rdquo;</em>
            <br />
            You Just Can&rsquo;t See It Yet.
          </h1>
          <p className="hero-sub">
            Your closet is full. Your mornings are chaos. Not because you need
            more clothes &mdash; because you&rsquo;ve never been able to see
            what works on <strong>your body</strong>.
          </p>
          <p className="hero-until">Until now.</p>
          <Link href="/onboarding" className="cta-btn">
            Start Now{" "}
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
          </Link>
          <p className="trust-line">
            Join women who finally see their wardrobe clearly.
          </p>
        </div>
        <div className="scroll-indicator">
          <span>Discover</span>
          <div className="scroll-line"></div>
        </div>
      </section>

      {/* ENEMY SECTION */}
      <section className="enemy-section">
        <div className="enemy-inner reveal">
          <div className="section-label">You&rsquo;ve tried everything</div>
          <h2 className="enemy-headline">
            You don&rsquo;t have a <em>wardrobe</em> problem.
            <br />
            You have a <em>visibility</em> problem.
          </h2>
          <div className="enemy-list">
            <div className="enemy-item reveal reveal-d1">
              <div className="enemy-x">&#10005;</div>
              <div className="enemy-text">
                <strong>Buying more clothes didn&rsquo;t fix it.</strong> You
                added pieces hoping they&rsquo;d complete something. They
                didn&rsquo;t. Your closet got fuller. Your mornings got harder.
              </div>
            </div>
            <div className="enemy-item reveal reveal-d2">
              <div className="enemy-x">&#10005;</div>
              <div className="enemy-text">
                <strong>Pinterest inspiration didn&rsquo;t fix it.</strong> You
                pinned hundreds of outfits that looked incredible on other
                women. Then you stood in front of your closet and
                couldn&rsquo;t translate a single one to your body.
              </div>
            </div>
            <div className="enemy-item reveal reveal-d3">
              <div className="enemy-x">&#10005;</div>
              <div className="enemy-text">
                <strong>
                  Styling apps and subscription boxes didn&rsquo;t fix it.
                </strong>{" "}
                Someone else picking clothes for you doesn&rsquo;t teach you
                anything. The decision fatigue stays. The uncertainty stays.
                The morning panic stays.
              </div>
            </div>
          </div>
          <div className="enemy-verdict reveal">
            <p>
              None of it worked because the real problem was never the clothes.
            </p>
            <strong>
              You couldn&rsquo;t see what works on your body.
            </strong>
          </div>
        </div>
      </section>

      {/* YOUR BODY IS THE MODEL */}
      <section className="model-section">
        <div className="model-inner reveal">
          <div className="section-label">The breakthrough</div>
          <div className="model-statement">
            Your body is
            <br />
            the <span className="highlight">model</span>.
          </div>
          <div className="model-divider"></div>
          <p className="model-desc">
            Upload one mirror selfie.{" "}
            <strong>Your body becomes the mannequin.</strong> Every outfit the
            AI builds, you see on you &mdash; your shape, your proportions,
            your reality. Not a stranger in a magazine. You.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section" id="how">
        <div className="how-inner">
          <div className="how-header reveal">
            <div className="section-label">How it works</div>
            <h2>Three steps to wardrobe clarity</h2>
          </div>
          <div className="steps">
            <div className="step reveal">
              <div className="step-num">01</div>
              <h3>Upload You</h3>
              <p>
                One full-length mirror selfie. That&rsquo;s the anchor. The AI
                learns your proportions, your shape, your reality.
              </p>
            </div>
            <div className="step reveal">
              <div className="step-num">02</div>
              <h3>Snap Your Clothes</h3>
              <p>
                Open your closet and start snapping. No sorting, no categories.
                The AI organizes everything in the background.
              </p>
            </div>
            <div className="step reveal">
              <div className="step-num">03</div>
              <h3>See It On You</h3>
              <p>
                Tap generate. See AI-styled outfits rendered on your body.
                Discover combinations you never would have tried.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BELIEF SHIFT */}
      <section className="belief-section">
        <div className="belief-inner reveal">
          <div className="section-label">This isn&rsquo;t about fashion</div>
          <h2>
            It was never about needing <em>more</em>.
            <br />
            It was about getting <em>yourself</em> back.
          </h2>
          <p className="belief-subtitle">
            The real cost of &ldquo;nothing to wear&rdquo; isn&rsquo;t the
            clothes. It&rsquo;s the confidence, the energy, and the identity
            you lose every morning before your day even starts.
          </p>
          <div className="belief-grid">
            <div className="belief-col">
              <h4>The daily drain</h4>
              <ul>
                <li>&ldquo;I have nothing to wear&rdquo; &mdash; again</li>
                <li>Buy more, feel nothing different</li>
                <li>Scrolling inspo that mocks your closet</li>
                <li>Packing your whole life for a weekend trip</li>
                <li>Starting the day already behind</li>
                <li>Losing yourself in sweatpants</li>
              </ul>
            </div>
            <div className="belief-divider-line"></div>
            <div className="belief-col">
              <h4>Your morning reset</h4>
              <ul>
                <li>&ldquo;I see exactly what works on me&rdquo;</li>
                <li>Shop intentionally &mdash; if at all</li>
                <li>Your own body is the inspiration</li>
                <li>Pack a carry-on with total confidence</li>
                <li>Dressed and certain in 30 seconds</li>
                <li>Feeling like yourself again</li>
              </ul>
            </div>
          </div>
          <div className="belief-bottom">
            <p>
              Not fashion advice. Not style quizzes. Not another subscription
              box.
              <br />
              Visual certainty. Identity restored. Before breakfast.
            </p>
          </div>
        </div>
      </section>

      {/* STYLE MATCH */}
      <section className="stylematch-section">
        <div className="stylematch-inner">
          <div className="stylematch-copy reveal">
            <div className="section-label">Style Match</div>
            <h2>
              That girl&rsquo;s outfit?
              <br />
              You already own <em>most of it</em>.
            </h2>
            <p>
              See someone on Instagram looking incredible? Screenshot it. Upload
              it. The AI decodes every piece she&rsquo;s wearing and{" "}
              <strong>matches it to your closet</strong>.
            </p>
            <p>
              You&rsquo;ll see what you already own that gets you 80% there
              &mdash; and if one piece would complete the look, we&rsquo;ll
              show you exactly what to add.
            </p>
            <p>
              <strong>Your closet is fuller than you think.</strong>
            </p>
          </div>
          <div className="stylematch-visual reveal">
            <div className="stylematch-flow">
              <div className="sm-step">
                <div className="sm-icon">&#128248;</div>
                <div className="sm-text">
                  Screenshot an outfit you love
                  <span>From Instagram, Pinterest, anywhere</span>
                </div>
              </div>
              <div className="sm-connector"></div>
              <div className="sm-step">
                <div className="sm-icon">&#128269;</div>
                <div className="sm-text">
                  AI decodes every piece
                  <span>
                    Blazer, white tank, low-rise jeans, pointed heels
                  </span>
                </div>
              </div>
              <div className="sm-connector"></div>
              <div className="sm-step">
                <div className="sm-icon">&#128087;</div>
                <div className="sm-text">
                  Matched to your closet
                  <span>
                    &ldquo;You own 3 of 4 pieces &mdash; 78% match&rdquo;
                  </span>
                </div>
              </div>
              <div className="sm-connector"></div>
              <div className="sm-step">
                <div className="sm-icon">&#127919;</div>
                <div className="sm-text">
                  See the outfit on you
                  <span>Your version, on your body, right now</span>
                </div>
              </div>
              <div className="sm-result">
                <div className="sm-result-icon">&#10024;</div>
                <div className="sm-result-text">
                  One piece away from the full look
                  <span>
                    We&rsquo;ll show you exactly what to add
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="proof-section">
        <div className="proof-inner">
          <div className="reveal">
            <div className="section-label">What women are saying</div>
            <h2>Wardrobe clarity changes everything</h2>
          </div>
          <div className="testimonials">
            <div className="testimonial reveal">
              <div className="testimonial-stars">
                &#9733;&#9733;&#9733;&#9733;&#9733;
              </div>
              <p>
                &ldquo;I literally wore the same 5 outfits on rotation. Now I
                have combinations I never would have put together &mdash; and
                they actually look amazing on me.&rdquo;
              </p>
              <div className="testimonial-author">Sarah M.</div>
              <div className="testimonial-meta">Working mom, 38</div>
            </div>
            <div className="testimonial reveal">
              <div className="testimonial-stars">
                &#9733;&#9733;&#9733;&#9733;&#9733;
              </div>
              <p>
                &ldquo;I was about to do a massive closet purge. Turns out I
                had incredible outfits hiding in there. I just couldn&rsquo;t
                see them.&rdquo;
              </p>
              <div className="testimonial-author">Rachel T.</div>
              <div className="testimonial-meta">Entrepreneur, 42</div>
            </div>
            <div className="testimonial reveal">
              <div className="testimonial-stars">
                &#9733;&#9733;&#9733;&#9733;&#9733;
              </div>
              <p>
                &ldquo;Packed for a 2-week Europe trip with a carry-on. Looked
                put together every single day. This replaced my
                stylist.&rdquo;
              </p>
              <div className="testimonial-author">Danielle K.</div>
              <div className="testimonial-meta">Frequent traveler, 36</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta" id="start">
        <div className="final-inner reveal">
          <div className="section-label">
            Your morning reset starts here
          </div>
          <h2>
            You don&rsquo;t need <em>fashion advice</em>.
            <br />
            You need visual certainty.
          </h2>
          <p className="hero-sub">
            Your body. Your clothes. Your clarity. 30 seconds to dressed and
            confident. No stylist needed. No new wardrobe required.
          </p>
          <Link href="/onboarding" className="cta-btn">
            Start Now{" "}
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
          </Link>
          <p className="trust-line">
            Join women who finally see their wardrobe clearly.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <p>&copy; 2026 NothingToWear.ai &mdash; All rights reserved.</p>
        <p>
          <a href="#">Privacy</a> &nbsp;&middot;&nbsp; <a href="#">Terms</a>
        </p>
      </footer>
    </>
  );
}
