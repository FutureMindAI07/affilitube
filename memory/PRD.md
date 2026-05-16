# Affilitube — YouTube Affiliate Prospect Finder PRD

## Original Problem Statement
Build a multi-niche web app that identifies YouTube channels likely to be good affiliates for any brand, marketer, or founder.

## Architecture
```
Frontend (React + Tailwind + Shadcn UI + Framer Motion)
  ├── Landing (/)
  ├── Pricing (/pricing) — 3-tier: Free/Starter/Pro with Stripe checkout
  ├── Auth (/login, /signup, /forgot-password)
  ├── Dashboard (/dashboard) — Prospect Finder with Niche Selector
  ├── Outreach Pipeline (/dashboard/pipeline) — CRM-like channel tracking with Info button
  ├── Outreach Templates (/dashboard/outreach) — Email templates
  ├── Getting Started (/dashboard/getting-started) — Tutorials & guides
  ├── Admin Panel (/admin) — Revenue, quota, users, search logs
  ├── Checkout Success (/checkout/success)
  ├── Terms (/terms) & Privacy (/privacy)

Backend (FastAPI + Motor/MongoDB + Stripe SDK)
  ├── Auth (JWT, password reset)
  ├── 4-Tier System (free/starter/pro/appsumo)
  ├── Stripe Subscriptions (starter: $39.99/$319.99, pro: $79/$632)
  ├── Stripe Webhook (checkout, subscription lifecycle, payment events)
  ├── Stripe Customer Portal (subscription management)
  ├── YouTube Search & Enrichment (24hr caching, backend API key)
  ├── Niche-based Scoring (14 niches)
  ├── Channel Health Indicators
  ├── Outreach Pipeline (status tracking, projects, contact logs)
  ├── Sponsorship Detection with Background Auto-Caching
  ├── Search Results Auto-save & Persistence
  ├── CSV Export, Reports, History, Bug Reports
```

## Stripe Integration (Updated Apr 3, 2026)
- Real price IDs from environment variables (no hardcoded values)
- Subscription mode checkout (not payment mode)
- Webhook signature verification via STRIPE_WEBHOOK_SECRET
- Events handled: checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_succeeded/failed
- 3-day grace period on payment failure before downgrade
- Customer portal for subscription management
- "Manage Subscription" button in Dashboard for paid users

## Tier System
| Feature | Free | Starter ($39.99/mo) | Pro ($79/mo) |
|---|---|---|---|
| Searches/month | 3 | 20 | Unlimited |
| Results/search | 10 | No limit | No limit |
| CSV export | No | Yes | Yes |
| Saved searches | No | Yes | Yes |
| Saved reports | No | Yes | Yes |
| Pipeline access | No | Yes (3 projects) | Yes (unlimited) |
| AI Draft | No | Yes (credits) | Yes (credits) |
| Priority support | No | No | Yes |

## AI Draft Credits
- $9.99 = 500 draft credits (one-time Stripe purchase, payment mode)
- Credits never expire, never reset — pure wallet
- Admin has unlimited drafts (no credits needed)
- Stripe Price ID: price_1TNvfwBQhyjmku0lRxcunLPq

## Backlog
- Bulk actions in Pipeline view (P1)
- Priority support system for Pro tier (P2)
- Dashboard.jsx refactoring (3800+ lines → break into smaller components) (P2)

## Completed (Apr 17, 2026)
- Pipeline Info Button & Auto-Cache Brand Intelligence: Added "Info" button to each channel row in Outreach Pipeline that opens a full Channel Detail Sheet (ChannelDetailSheet.jsx) with Score Breakdown, Outreach Tracking, Affiliate Potential, Statistics, Channel Health, Tags, Brand Intelligence, Notes. Backend auto-caches sponsorship data via BackgroundTasks when a channel is first added to the pipeline.
- Pipeline Search & Sort: Added Min Affiliate Score filter, Sort by dropdown (Score high/low, Subscribers, Name), live channel count, and Clear button to the Pipeline filter bar.
- AI Outreach Drafter: Admin-only hardcoded "Raw Founder" template with unlimited drafts. Paid tiers (Starter/Pro) get dynamic template powered by user's Outreach Settings (product name, target audience, value prop, tone, closing, product URL, sender name). Credit system: $9.99 = 500 draft credits via Stripe one-time payment, never expire. Each non-admin draft deducts 1 credit. Pipeline header shows credit balance, Buy Credits button, and Settings gear. Onboarding flow: auto-opens Settings modal if config is empty. Free tier: no access.
- Admin Grant Credits: Purple sparkle button in Admin Panel → Users → Actions column. Opens dialog with quick-select presets (10/50/100/500) + custom input to grant AI draft credits to any user.
- English Language Filter: Two-layer approach — (1) `relevanceLanguage=en` on YouTube Search API calls biases results toward English, (2) character-set-based language detection during enrichment skips channels with >30% non-Latin video titles (covers CJK, Cyrillic, Arabic, Thai, Hindi, Korean, etc.)
- Super Search (Admin Only): Toggle in Advanced Settings that overrides standard enrichment with a premium pipeline: forces Brand Intelligence on every channel, applies 4 hard filters (affiliate activity required, min 3 links, 90-day recency, 3+/10 sponsored ratio), runs GPT-4o AI prospect grading (A/B/C/Reject), detects competitor brand overlap. Results table shows Grade badge, Sponsored Ratio, Affiliate Recency, and Competitor warning. Completely invisible to non-admin users. Uses admin's dedicated YouTube API key.

## Completed (Feb-Apr 2026)
- Graceful Tier Restrictions for Free Users
- Stripe Checkout Redirect Fix
- Dashboard Header Cleanup
- Cross-User Data Leakage Fix
- Checkout Success Page dynamic copy
- Notes Save Fix
- Pricing → Signup Flow
- /free Landing Page
- Saved Report Table Parity
- Sponsorship History / Brand Intelligence
- Enrichment Cache Bug Fix
- Stripe Live Switchover
- Free Tier Search Limit (raised to 50)
- Exclude Keywords & Exclude Channel features
