# Affilitube — YouTube Affiliate Prospect Finder PRD

## Original Problem Statement
Build a multi-niche web app that identifies YouTube channels likely to be good affiliates for any brand, marketer, or founder.

## Architecture
```
Frontend (React + Tailwind + Shadcn UI + Framer Motion)
  ├── Landing (/)
  ├── Pricing (/pricing) — 3-tier: Free/Starter/Pro
  ├── Auth (/login, /signup, /forgot-password)
  ├── Dashboard (/dashboard) — Prospect Finder with Niche Selector
  ├── Outreach Pipeline (/dashboard/pipeline) — CRM-like channel tracking with projects
  ├── Outreach Templates (/dashboard/outreach) — Email templates
  ├── Getting Started (/dashboard/getting-started) — Tutorials & guides
  ├── Admin Panel (/admin) — Revenue, quota, users, search logs
  ├── Checkout Success (/checkout/success)
  ├── Terms (/terms) & Privacy (/privacy)

Backend (FastAPI + Motor/MongoDB)
  ├── Auth (JWT, password reset)
  ├── 4-Tier System (free/starter/pro/appsumo with limits)
  ├── Stripe Checkout (Starter: $39.99/mo or $319.99/yr, Pro: $79/mo or $632/yr)
  ├── YouTube Search & Enrichment (24hr caching, backend API key)
  ├── Niche-based Scoring (14 niches with dynamic keyword configs)
  ├── Channel Health Indicators (upload consistency, engagement health, growth)
  ├── Outreach Status Tracking (status, follow-up dates, contact logs, projects)
  ├── Search Results Auto-save & Persistence
  ├── Pipeline Management (add/remove, project organization, tier gating)
  ├── History, Reports, Quota, Bug Reports, CSV Export
```

## Tier System (Updated Apr 3, 2026)
| Feature | Free | Starter ($39.99/mo) | Pro ($79/mo) | AppSumo |
|---|---|---|---|---|
| Searches/month | 3 | 20 | Unlimited | Unlimited |
| Results/search | 10 | No limit | No limit | No limit |
| CSV export | No | Yes | Yes | Yes |
| Saved searches | No | Yes | Yes | Yes |
| Saved reports | No | Yes | Yes | Yes |
| Pipeline access | No | Yes (3 projects) | Yes (unlimited) | Yes (unlimited) |
| Priority support | No | No | Yes | Yes |

## Stripe Price IDs (Placeholders)
- STARTER_MONTHLY_PRICE_ID ($39.99/month)
- STARTER_ANNUAL_PRICE_ID ($319.99/year)
- PRO_MONTHLY_PRICE_ID ($79/month)
- PRO_ANNUAL_PRICE_ID ($632/year)

## Completed Features
- 14-niche YouTube channel discovery & scoring
- Channel Health Indicators (upload consistency, engagement health, growth)
- Outreach Pipeline with project organization
- Add to Pipeline dialog, remove from pipeline, inline project editing
- Search results persistence (context + sessionStorage + backend auto-save)
- 3-tier pricing page (Free/Starter/Pro) with monthly/yearly toggle
- Tier-gated features (CSV, pipeline, saved reports/searches)
- Dashboard tier display (badge + usage card) for all tiers
- Admin panel with 4-tier user breakdown
- JWT auth, password reset, admin panel, bug reports

## Backlog
- P1: Replace placeholder Stripe Price IDs with real ones
