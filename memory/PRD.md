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
- Graceful Tier Restrictions for Free Users: Grey out + lock icon on Export All, Save Report, Save Search, Export Shortlist buttons for free tier; reusable UpgradeDialog component at `/app/frontend/src/components/UpgradeDialog.jsx`; backend returns clean 403 JSON with `{error, message, upgrade_url}`; buttons remain clickable for free users (open upgrade dialog) while normally disabled conditions only apply to paid users
