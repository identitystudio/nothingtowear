# Nothing to Wear

**Your Clarity Engine for What to Wear**

Never stand in front of your closet stuck again. See outfits on your body instantly.

---

## 🎯 The Product

A daily clarity app that solves decision fatigue by showing you outfits from your own closet on your actual body using AI virtual try-on.

### Core Features (MVP)
1. **Upload your body photo** - One full-length mirror selfie
2. **Snap clothing items** - No organizing, AI detects types automatically
3. **Generate outfits** - See complete looks on YOUR body instantly
4. **Pick and wear** - Confidence in seconds, not minutes

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn
- OpenAI API key
- Replicate API token

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
- `OPENAI_API_KEY` - Get from [platform.openai.com](https://platform.openai.com)
- `REPLICATE_API_TOKEN` - Get from [replicate.com](https://replicate.com)

3. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## 📱 User Flow

### Landing Page (`/`)
Emotional, clarity-driven copy that captures the transformation from chaos to clarity.

**Key sections:**
- Hero: "Never stand in front of your closet stuck again"
- Problem: Visual uncertainty, decision fatigue
- Solution: 3-step process
- Transformation: Before/After states

### Onboarding (`/onboarding`)
**Step 1:** Upload body photo
- Full-length mirror selfie
- Fitted clothes or workout gear
- Good lighting

### Closet (`/closet`)
**Step 2:** Build your closet
- Snap photos of clothing items
- AI auto-detects types (coming soon)
- No manual categorization needed
- Add minimum 8-10 items to start

### Outfits (`/outfits`)
**Step 3:** Generate outfits
- Choose style (Work, Casual, Date Night, Comfy, Edgy, Elegant)
- Or describe custom mood
- See 3 outfit combinations
- Virtual try-on shows outfits on YOUR body (wiring up next)

---

## 🔧 Technical Architecture

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **State**: LocalStorage (MVP - will upgrade to database)

### Backend APIs
- **AI Vision**: OpenAI GPT-4o for item detection
- **Virtual Try-On**: Replicate IDM-VTON model
- **Storage**: LocalStorage (MVP - Supabase coming)

### API Routes
- `/api/detect-item` - Analyze clothing items with AI
- `/api/generate-outfit` - Create virtual try-on images

---

## 🎨 Design Philosophy

### UI/UX Principles
- **Minimal & Fast** - No decision fatigue in the app itself
- **Visual First** - Emotion above the fold, clarity throughout
- **No Sales Vibe** - Just start using it immediately
- **Daily Ritual** - Get back to your morning coffee quickly

### Copy Strategy
- **Against**: Outfit guessing, flat-lay inspiration, decision fatigue
- **For**: Instant visual clarity, seeing clothes on YOUR body
- **Promise**: Upload once, snap anytime, see instantly

---

## 🚧 Next Steps

### Immediate (to test yourself)
1. Add your API keys to `.env.local`
2. Run the app locally
3. Upload your body photo
4. Add 10-20 clothing items from your closet
5. Generate outfits and test the experience

### Phase 2 (after personal testing)
- [ ] Wire up AI item detection to auto-tag clothing types
- [ ] Complete virtual try-on integration
- [ ] Add outfit saving/favoriting
- [ ] Improve outfit generation logic (color matching, style coherence)
- [ ] Add database (Supabase) instead of localStorage

### Phase 3 (after MVP works)
- [ ] Sample closets for instant try (onboarding friction removal)
- [ ] "Missing piece" detection & affiliate links
- [ ] Daily outfit notifications/emails
- [ ] Silhouette profile (hip vs high-waisted) - your breakthrough discovery!
- [ ] Monetization (subscription after value proven)

---

## 💡 Product Insights

### What This Really Solves
Not fashion advice. **Mental load removal.**

**The transformation:**
- From: confused → **confident**
- From: overwhelmed → **calm**
- From: closet chaos → **clarity**
- From: invisible → **put together**

### Why This Works
1. **Daily pain point** - Happens every morning
2. **Emotional payoff** - Identity restoration, not just clothing
3. **Visual solution** - Solves the actual problem (can't see it on your body)
4. **Habit forming** - Becomes essential daily tool
5. **Natural upsell** - Affiliate links for "missing pieces"

### Market Position
**Not:** A closet app, styling app, or shopping app

**Is:** The Clarity Engine for What to Wear

**Category:** Daily Identity Utility (like productivity/wellness apps)

**Retention driver:** Removes daily mental friction = high LTV

---

## 📊 Business Model (Future)

### Monetization Strategy
1. **Free to build closet** - Remove friction, prove value
2. **Subscribe after addiction** - $9.99-14.99/month after X outfit generations
3. **Affiliate commerce** - "Missing piece" suggestions
4. **Your own products** - Later (lashes, accessories, etc.)

### Why Subscriptions Will Work
- Saves 30-90 hours/year
- Daily use = high retention
- Mental peace = easy justification
- Not "more clothes" - using what you own

---

## 🎬 Marketing Strategy (Future)

### Content Angles
- Clueless-style transformation videos
- Morning chaos → instant clarity
- Real closet, real person testimonials
- Before/After emotional states (not body changes)

### Ad Formula
1. **Hook**: Messy closet, stressed morning
2. **Pain**: "I kept buying clothes but nothing worked"
3. **Magic moment**: AI shows outfit on me
4. **Payoff**: Confident, put together, peaceful
5. **CTA**: "Start now" (not "try free")

### Platform Strategy
- TikTok & Instagram (visual storytelling)
- Short-form content (20-30 seconds)
- Memes & POV content
- User-generated transformations

---

## 🔐 Environment Variables

Create a `.env.local` file:

```env
# Required for AI features
OPENAI_API_KEY=your_key_here
REPLICATE_API_TOKEN=your_token_here

# Optional (for future database integration)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 🤝 Contributing

This is a personal project for now. Focus is on perfecting the core product experience.

---

## 📄 License

Private / All Rights Reserved (for now)

---

**Built with clarity, for clarity.**

✨ Nothing to Wear - Because you have everything to wear, you just need to see it.
