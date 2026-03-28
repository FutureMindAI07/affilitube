# Affilitube — YouTube Affiliate Prospect Finder PRD

## Original Problem Statement
Build a multi-niche web app that identifies YouTube channels likely to be good affiliates for any brand, marketer, or founder.

## Architecture
```
Frontend (React + Tailwind + Shadcn UI + Framer Motion)
  ├── Landing (/)
  ├── Pricing (/pricing) — Stripe checkout (Free/Pro tiers)
  ├── Auth (/login, /signup, /forgot-password)
  ├── Dashboard (/dashboard) — Prospect Finder tool with Niche Selector
  ├── Outreach (/dashboard/outreach) — Email templates
  ├── Getting Started (/dashboard/getting-started) — Tutorials & guides
  ├── Checkout Success (/checkout/success)
  ├── Terms (/terms) & Privacy (/privacy)

Backend (FastAPI + Motor/MongoDB)
  ├── Auth (JWT, password reset)
  ├── Tier System (free/pro/appsumo with limits)
  ├── Stripe Checkout (Pro subscription: $39/mo or $299/yr)
  ├── YouTube Search & Enrichment (24hr caching, backend API key)
  ├── Niche-based Scoring (6 niches with dynamic keyword configs)
  ├── History, Reports, Quota, Bug Reports, CSV Export
```

## Transformation from Tubiate
This app was transformed from Tubiate (SaaS-focused) to Affilitube (multi-niche).

### Key Changes Made
1. **Branding**: Tubiate → Affilitube throughout
2. **API Key**: Removed per-user API key system; now uses backend YOUTUBE_API_KEY
3. **Niche System**: 6 niches with dynamic keyword configurations
4. **Tier System**: Free (3 searches/mo, 10 results) / Pro (unlimited) / AppSumo
5. **Pricing**: Changed from $99 lifetime to $39/mo or $299/yr subscription

### Supported Niches
1. SaaS & Software — automation, no-code, integrations
2. Fitness & Health — workouts, supplements, gear
3. Finance & Investing — stocks, crypto, budgeting
4. Ecommerce & Amazon — product reviews, dropshipping
5. Online Courses & Education — learning platforms, tutorials
6. Marketing Tools — SEO, email marketing, social media

## Current Status

### Phase 1 Complete (Backend)
- ✅ Niche configuration system with 6 niches
- ✅ Dynamic keyword scoring per niche
- ✅ Tier system (free/pro/appsumo)
- ✅ Search limits enforcement (3/month free, 10 results cap)
- ✅ Feature gating (CSV, saved searches/reports)
- ✅ Backend YouTube API key (YOUTUBE_API_KEY env var)
- ✅ Updated Stripe for subscription model
- ✅ New endpoints: /api/niches, /api/user/usage
- ✅ Updated admin email: admin@affilitube.com
- ✅ Database renamed to affilitube_db

### Phase 2 Pending (Frontend)
- [ ] Global Tubiate → Affilitube branding
- [ ] Remove API Key button/dialog
- [ ] Add Niche Selector UI in Dashboard
- [ ] Update keyword placeholder per niche
- [ ] Update usage display (tier-based, not quota-based)
- [ ] Update Getting Started page
- [ ] Update Pricing page (Free vs Pro)
- [ ] Update Landing page copy
- [ ] Update App.js routing (allow free tier access)

## Credentials
- Admin: admin@affilitube.com / admin123!
- Stripe Price IDs (placeholders):
  - Pro Monthly: price_PLACEHOLDER_PRO_MONTHLY_39
  - Pro Yearly: price_PLACEHOLDER_PRO_YEARLY_299

## API Endpoints (New/Changed)
- GET /api/niches — List all niches with configs
- GET /api/user/usage — Get tier and usage info
- POST /api/search — Now requires niche parameter
- POST /api/channels/enrich — Now requires niche parameter

## Environment Variables
- YOUTUBE_API_KEY — Backend YouTube Data API v3 key (required)
- MONGO_URL — MongoDB connection
- DB_NAME — Database name (affilitube_db)
- STRIPE_API_KEY — Stripe API key for payments

## Unchanged Features
- Core scoring engine (score_total, affiliate_score)
- Two-step search → enrich flow
- Shortlist functionality
- Saved searches/reports (Pro only)
- JWT authentication
- Password reset flow
- Bug report functionality
- Affiliate platform link detection
- Search presets (Quick/Balanced/Deep/Custom)
