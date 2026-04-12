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
  ├── Outreach Pipeline (/dashboard/pipeline) — CRM-like channel tracking
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
| Feature | Free | Starter ($39.99/mo) | Pro ($79/mo) | AppSumo |
|---|---|---|---|---|
| Searches/month | 3 | 20 | Unlimited | Unlimited |
| Results/search | 10 | No limit | No limit | No limit |
| CSV export | No | Yes | Yes | Yes |
| Saved searches | No | Yes | Yes | Yes |
| Saved reports | No | Yes | Yes | Yes |
| Pipeline access | No | Yes (3 projects) | Yes (unlimited) | Yes (unlimited) |
| Priority support | No | No | Yes | Yes |

## Backlog
- Bulk actions in Pipeline view
- Priority support system for Pro tier
- Dashboard.jsx refactoring (3400+ lines → break into smaller components)

## Completed (Feb 2026)
- Graceful Tier Restrictions for Free Users: Grey out + lock icon on Export All, Save Report, Save Search, Export Shortlist, Pipeline buttons for free tier; reusable UpgradeDialog component at `/app/frontend/src/components/UpgradeDialog.jsx`; backend returns clean 403 JSON with `{error, message, upgrade_url}`
- Stripe Checkout Redirect Fix: Fixed success_url using internal cluster URL instead of public URL; now uses x-forwarded-proto/host headers
- Dashboard Header Cleanup: Removed redundant quota banner, moved Manage Subscription/Bug Report/Logout into user dropdown menu, slimmed auto-save indicator into compact chip
- Cross-User Data Leakage Fix: SessionStorage + React context cleared on login/logout/register to prevent stale search results showing for different users
- Checkout Success Page: Shows correct tier name (Starter vs Pro) from backend response
- Notes Save Fix: Changed axios.put to api.put (auth), onChange to onBlur (debounce)
- Pricing → Signup Flow: Selected plan preserved through registration via URL param, auto-triggers Stripe checkout
- /free Landing Page: Dedicated conversion page for YouTube traffic (no nav, hero, how it works, benefits, pricing snapshot, minimal footer)
- Saved Report Table Parity: Full parity with live results table (Aff Score, Health, Pipeline columns, sorting, filtering, pagination)
- Sponsorship History / Brand Intelligence: On-demand analysis of last 10 videos via YouTube API with regex-based detection; 7-day cache; Gift icon in table; Brand Intelligence section in detail panel; tier gating (Pro sees brand names, others see blurred + upgrade CTA)
