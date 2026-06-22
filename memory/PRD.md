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
- server.py modularisation (4258 lines → split into routers: auth, search, export, trial, pipeline) (P2)
- Migrate react-helmet → react-helmet-async (P3, removes StrictMode warning)

## Completed (Feb 26, 2026)
- **Super Search credit gating + admin gate removed + cached AI grades**: Super Search is now available to all users (admin gate removed). Each run costs **12 credits flat** (deducted atomically before grading). **Soft cap** of 80 channels sent to GPT-4o per run. **Cached AI grades** persist on the channel cache doc for 24h → re-runs charge 0 for previously-graded channels. **Auto-refund** of 12 credits if every AI call fails. **Don't charge** when zero channels reach grading. Response includes `super_search` meta block (`credits_charged`, `cached_grades_used`, `graded_now`, `grading_failed`, `soft_capped`, `refunded`) so the frontend shows clean toasts and refreshes the user credit balance. Insufficient credits returns `402` with structured error payload. Verified end-to-end via curl: 12 credits charged on fresh run (100→88), 0 credits on cached re-run, 402 on insufficient balance.

- **Partner Program Auto-Reply**: When someone submits the Partner Program form, the backend now sends a best-effort auto-reply to the applicant from `Adrian at AffiliTube` (Reply-To: `adrian@affilitube.com`), confirming receipt, setting the 1–2 business-day expectation, summarising commission terms (30% → 40%, 90-day cookie), and inviting them to reply with anything they want Adrian to look at before the personal reply lands. Failures don't block the submission.
- **Partner Program Discoverability**: Added "Partner Program" footer link to Landing, Pricing, SaaS Founders, Affiliates, and Free landing pages so warm visitors discover `/affilitube-affiliate-program` organically.
- **Admin: Partner Applications Tab**: New "Partner Apps" tab in `/admin` (icon: Handshake) backed by `GET /api/admin/partner-applications` (and `DELETE /api/admin/partner-applications/{id}`). Lists every inbound application from the public form with name, email (mailto), submitted-at, full experience text, "Reply" (opens prefilled mailto draft), and Delete. Sorted newest first. Limit 200 per page.

- **Partner Program Landing Page (`/affilitube-affiliate-program`)**: Full conversion page with Hero (pulsing green "Now Open" badge, gradient "40%" headline, two anchor CTAs), 4-stat market bar, Product section (feature checklist + mock UI search-results card), Opportunity section with accent stats card, 30%/40% commission tier cards (Star Partners has gradient border), Tracking & Payments grid, Creative Resources (asset tag cloud + ideal-audience boxes), 3 founder-attributed philosophy quotes, numbered "How It Works" stepper (`#how-it-works`), and Apply form (`#apply`) on dark gradient background with Full Name / Email / Experience fields. Form posts to `POST /api/partner-program/apply` which validates and emails the submission to `adrian@affilitube.com` via existing SMTP and persists to `partner_applications` collection. Recipient email is NOT exposed anywhere in the rendered HTML. Verified end-to-end.

- **Soft Trial Expiry Banner** (`/app/frontend/src/components/TrialBanner.jsx`): 3-state banner shown on Dashboard & Pipeline. Active normal (indigo, sparkles, "X days left in your Starter trial", dismissible per session). Urgent ≤3 days (amber/orange, clock, "Only X day(s) left", non-dismissible). Expired (red, alert, "Your Starter trial has ended", non-dismissible). All states route to `/pricing`. Auto-fetches `/api/user/usage` so any tier-aware page can drop in one component. Verified across all 3 states via DB-driven state simulation.

- **SaaS Founders Landing Page (/for-saas-founders) + 14-Day Starter Trial**: New conversion-focused landing for Reddit paid ad traffic. Sections: Hero ("Building was the easy part"), Pain (Reddit-styled cards), Solution, Features (8-card grid), Social Proof, Pricing Teaser (3-card), Final CTA. All 4 CTAs route to /signup?trial=starter_14. Backend `/api/auth/register` accepts `trial` param, creates user with tier=starter, is_trial=true, access_expires_at=+14 days. `get_current_user` auto-downgrades expired trials to tier=free and sets trial_expired=true. CSV export endpoint returns 403 `upgrade_required` for trial users. `/api/user/usage` returns trial_days_remaining + csv_export=false. Signup subtitle now reflects trial context. Tested via testing_agent (7/7 backend pytest + full UI flow).

## Completed (Jun 22, 2026) — SaaS Founder Outreach Tracking (Option D)
- Admin-only outreach tracker built into SaaS Radar (`FounderDetailSheet.jsx`)
- Backend: 3 new PATCH endpoints on `saas_radar.py` + `outreach_status` query filter on /products. Schema additions to `saas_radar_products`: `outreach_status`, `follow_up_date`, `outreach_notes`, `contact_log` (array of `{timestamp, status, note}` entries appended on every status change). Pre-existing `notes` array (enrichment diagnostic) preserved unchanged.
- Frontend: row-click opens side sheet. Status dropdown (shared `OUTREACH_STATUS_CONFIG`), follow-up date with clear-X, contact note input, auto-logged contact log timeline (status-change events + manual notes interleaved), auto-saving notes textarea, makers list with mailto + Twitter links. Outreach filter dropdown added to filter row.
- Existing `verdict` system (Customer/Pass/Later/Sent) left intact — they layer cleanly.

## Completed (Jun 22, 2026) — Dashboard.jsx 6-Phase Refactor
- **Dashboard.jsx reduced from 4,306 → 1,485 lines** (-65%)
- 11 new files created in `/lib/` and `/pages/dashboard/` directories
- Per-phase regression-tested with `testing_agent_v3_fork` after Phases 4 and 6; manual interactive verification after each smaller phase
- Side-pass regression for AI Outreach Draft on OutreachPipeline.jsx (~90% pass, pre-existing UX issues only — not regressions)
- No backend changes, no styling/copy changes, no Context/Redux introduced
- New structure:
  - `lib/formatters.js`, `lib/healthIndicators.js`, `lib/searchPresets.js`, `lib/outreachConfig.js`
  - `pages/dashboard/DashboardHeader.jsx` (448 lines)
  - `pages/dashboard/SearchPanel.jsx` (661 lines)
  - `pages/dashboard/ResultsSection.jsx` (686 lines)
  - `pages/dashboard/HistoricalReportView.jsx` (497 lines)
  - `pages/dashboard/ChannelDetailSheet.jsx` (828 lines)
  - `pages/dashboard/dialogs/{BugReport,AddToPipeline,SaveSearch,SaveReport}Dialog.jsx`

## Completed (Jun 19, 2026)
- **`/for-saas-founders` Showcase Redesign Complete**: Replaced the legacy 8-card grid with 4 full-width alternating `ShowcaseRow` components (L/R/L/R): (1) Templates built for SaaS affiliate prospecting, (2) Every result, pre-scored for affiliate fit, (3) Every score, fully explained (tall info card with custom scrollable lightbox + "Click to see the full card" prompt — uses patched info_card_1.5x_patched.png with full Score Breakdown visible), (4) Outreach emails that don't sound like outreach emails (AI Draft screenshot). Removed unused icon imports (Search, BarChart3, Gift, Mail, Zap). Export disclaimer ("Note: Export is not included during the trial...") retained directly below the showcase rows. Wide rows use react-medium-image-zoom; tall row uses custom `TallLightbox` modal with `overflow-y-auto` so users can scroll the full portrait image at min(90vw, 1100px). Verified via screenshot tool.

## Completed (Jun 10, 2026)
- **SaaS Radar (Admin-only ProductHunt Prospect Tool, Pre-Validation Phase)**: New `/admin` tab to discover potential AffiliTube customers from ProductHunt launches. Self-contained module `backend/saas_radar.py` + `frontend/src/components/SaaSRadarPanel.jsx`. Uses official PH GraphQL API v2 with developer token (PRODUCTHUNT_TOKEN in .env). Single-stream ingest (no per-topic looping) with local topic filtering to conserve PH's 6250-pts/15min complexity budget. Stores prospects in `saas_radar_products` with PH id, name, tagline, slug, ph_url, website_url, posted_at, votes_count, topics, makers (incl. twitter handle). Background website enrichment: alive check, affiliate-platform footprint detection (Rewardful, FirstPromoter, PartnerStack, Tapfiliate, Impact, Refersion, LeadDyno, etc.), affiliate-program link/keyword scan, paid pricing detection + tier counting, on-site email extraction (filters noise like sentry.io / image filenames). Bucketing: 🟡 Yellow=paid SaaS, no affiliate program (score 100, top priority — they're the sales pitch); 🟢 Green=has affiliate program (80); 🔴 Red=no paid pricing (10); ⚪ Unknown (0). Bonuses: +5 recent launch, +5 multiple paid tiers, +10 email found. Admin panel UI: 5 stat cards, ingest + enrich actions with live job polling, bucket/sort/search/has-email filters, table with PH/Site/Aff links, Twitter handles clickable to x.com, CSV export. PH redirect URLs are Cloudflare-blocked from cloud IPs → marked `unknown` + `ph_redirect_blocked` note; user clicks through PH link to inspect manually (PH metadata is still valuable: name/tagline/makers/topics/votes). 14 pytest unit tests passing. **Status: pre-validation phase — admin uses it to spot-check whether PH SaaS launches are a viable acquisition channel before promoting to a user-facing tier feature.**

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
