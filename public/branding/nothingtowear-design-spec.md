# NothingToWear.ai — Design & Copy Reference
# Drop this file into your project root. Tell Claude Code: "Use nothingtowear-design-spec.md as the design reference for all pages."

---

## DESIGN SYSTEM

### Color Palette (use as CSS variables or Tailwind config)
```
--cream: #F7F3EE          (section backgrounds, alt bg)
--warm-white: #FDFBF8     (primary background)
--tan: #C4A882            (accent, CTAs, highlights)
--tan-hover: #B8986E      (CTA hover state)
--tan-light: #E8DDD0      (subtle borders, dividers, step numbers)
--charcoal: #2A2520       (primary text, dark sections)
--warm-gray: #6B6058      (body copy)
--soft-gray: #9B9189      (meta text, muted labels)
--blush: #E8D5C4          (decorative)
--sage: #B5BFA8           (decorative accent)
```

### Typography
- **Headlines**: `Playfair Display` (serif) — weight 400-500, italic for emphasis
- **Body/UI**: `DM Sans` — weight 300-500
- **Google Fonts import**: `https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap`

### Typography Scale
- Eyebrow/labels: DM Sans, 0.7rem, weight 500, letter-spacing 0.2em, uppercase, color tan
- H1 (hero): Playfair Display, clamp(2.4rem, 5.5vw, 3.8rem), weight 400, line-height 1.15
- H2 (sections): Playfair Display, clamp(1.6rem, 3.5vw, 2.2rem), weight 400
- Statement (model section): Playfair Display italic, clamp(2.6rem, 6vw, 4.2rem)
- Body: DM Sans, 1.05-1.15rem, weight 300, line-height 1.7-1.8, color warm-gray
- Small/meta: DM Sans, 0.75-0.82rem, weight 400, color soft-gray

### Spacing
- Section padding: 6-7rem vertical, 2rem horizontal
- Max content width: 720-900px centered
- Card border-radius: 16px
- Button border-radius: 100px (pill shape)
- CTA padding: 1.1rem 2.8rem

### Backgrounds & Effects
- Subtle radial gradients on hero and dark sections (warm blush tones, very low opacity)
- Section dividers: 1px linear-gradient (transparent → tan-light → transparent)
- Nav: backdrop-filter blur(20px), semi-transparent warm-white
- Cards: 1px border rgba(196,168,130,0.15), hover translateY(-3px) + box-shadow
- Dark sections: charcoal bg with radial gradient overlays at ~0.1 opacity

### Animations
- Scroll reveal: translateY(30px) → 0, opacity 0 → 1, cubic-bezier(0.22, 1, 0.36, 1)
- Stagger delay: 80ms between siblings
- CTA hover: translateY(-2px), enhanced box-shadow
- No harsh or bouncy animations — everything smooth and calm

---

## BRAND RULES

### Tone
- Warm, editorial, premium — like a high-end magazine, not a tech app
- Conversational but confident — speaks to women 35+ who are smart and busy
- Never salesy ("Try Free", "Sign Up") — instead: "Start Now"
- Sell certainty and identity restoration, NOT fashion advice

### Category Language (non-negotiable)
- This is a "Daily Clarity Engine" — NOT a fashion app, NOT a closet organizer
- Core promise: visual certainty, decision fatigue removal, identity restoration
- Keywords: clarity, certainty, confidence, morning reset, see it on you, your body is the model

### What We Are NOT
- Not a fashion app
- Not a style quiz
- Not a subscription box
- Not Pinterest
- Not a closet organizer

---

## LANDING PAGE COPY (approved — use exactly)

### Hero (above the fold)
- Eyebrow: "Your daily clarity engine"
- H1: You Don't Have "Nothing to Wear." You Just Can't See It Yet.
- Subhead: Your closet is full. Your mornings are chaos. Not because you need more clothes — because you've never been able to see what works on **your body**.
- Accent line: Until now.
- CTA: Start Now →
- Trust line: Join women who finally see their wardrobe clearly.

### Enemy Section
- Label: "You've tried everything"
- Headline: You don't have a *wardrobe* problem. You have a *visibility* problem.
- Enemy 1: **Buying more clothes didn't fix it.** You added pieces hoping they'd complete something. They didn't. Your closet got fuller. Your mornings got harder.
- Enemy 2: **Pinterest inspiration didn't fix it.** You pinned hundreds of outfits that looked incredible on other women. Then you stood in front of your closet and couldn't translate a single one to your body.
- Enemy 3: **Styling apps and subscription boxes didn't fix it.** Someone else picking clothes for you doesn't teach you anything. The decision fatigue stays. The uncertainty stays. The morning panic stays.
- Verdict (dark box): None of it worked because the real problem was never the clothes. **You couldn't see what works on your body.**

### "Your Body is the Model" Section
- Label: "The breakthrough"
- Statement: Your body is the **model**.
- Copy: Upload one mirror selfie. **Your body becomes the mannequin.** Every outfit the AI builds, you see on you — your shape, your proportions, your reality. Not a stranger in a magazine. You.

### How It Works
- Label: "How it works"
- Headline: Three steps to wardrobe clarity
- Step 01 — Upload You: One full-length mirror selfie. That's the anchor. The AI learns your proportions, your shape, your reality.
- Step 02 — Snap Your Clothes: Open your closet and start snapping. No sorting, no categories. The AI organizes everything in the background.
- Step 03 — See It On You: Tap generate. See AI-styled outfits rendered on your body. Discover combinations you never would have tried.

### Belief Shift (dark section)
- Label: "This isn't about fashion"
- Headline: It was never about needing *more*. It was about getting *yourself* back.
- Subtitle: The real cost of "nothing to wear" isn't the clothes. It's the confidence, the energy, and the identity you lose every morning before your day even starts.
- Before column ("The daily drain"): "I have nothing to wear" — again | Buy more, feel nothing different | Scrolling inspo that mocks your closet | Packing your whole life for a weekend trip | Starting the day already behind | Losing yourself in sweatpants
- After column ("Your morning reset"): "I see exactly what works on me" | Shop intentionally — if at all | Your own body is the inspiration | Pack a carry-on with total confidence | Dressed and certain in 30 seconds | Feeling like yourself again
- Bottom tag: Not fashion advice. Not style quizzes. Not another subscription box. Visual certainty. Identity restored. Before breakfast.

### Style Match Section
- Label: "Style Match"
- Headline: That girl's outfit? You already own *most of it*.
- Copy: See someone on Instagram looking incredible? Screenshot it. Upload it. The AI decodes every piece she's wearing and **matches it to your closet**. You'll see what you already own that gets you 80% there — and if one piece would complete the look, we'll show you exactly what to add. **Your closet is fuller than you think.**
- Flow steps: Screenshot an outfit → AI decodes every piece → Matched to your closet (78% match) → See the outfit on you → One piece away from the full look

### Final CTA
- Label: "Your morning reset starts here"
- Headline: You don't need *fashion advice*. You need visual certainty.
- Copy: Your body. Your clothes. Your clarity. 30 seconds to dressed and confident. No stylist needed. No new wardrobe required.
- CTA: Start Now →
- Trust: Join women who finally see their wardrobe clearly.

---

## TAILWIND CONFIG SUGGESTION (if using Tailwind)

```js
// tailwind.config.js extend
colors: {
  cream: '#F7F3EE',
  'warm-white': '#FDFBF8',
  tan: { DEFAULT: '#C4A882', hover: '#B8986E', light: '#E8DDD0' },
  charcoal: '#2A2520',
  'warm-gray': '#6B6058',
  'soft-gray': '#9B9189',
  blush: '#E8D5C4',
  sage: '#B5BFA8',
},
fontFamily: {
  serif: ['Playfair Display', 'Georgia', 'serif'],
  sans: ['DM Sans', '-apple-system', 'sans-serif'],
},
```
