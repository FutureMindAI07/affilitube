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
  ├── Outreach Pipeline (/dashboard/pipeline) — CRM-like channel tracking
  ├── Outreach Templates (/dashboard/outreach) — Email templates
  ├── Getting Started (/dashboard/getting-started) — Tutorials & guides
  ├── Admin Panel (/admin) — Revenue, quota, users, search logs
  ├── Checkout Success (/checkout/success)
  ├── Terms (/terms) & Privacy (/privacy)

Backend (FastAPI + Motor/MongoDB)
  ├── Auth (JWT, password reset)
  ├── Tier System (free/pro/appsumo with limits)
  ├── Stripe Checkout (Pro subscription: $39/mo or $299/yr)
  ├── YouTube Search & Enrichment (24hr caching, backend API key)
  ├── Niche-based Scoring (14 niches with dynamic keyword configs)
  ├── Outreach Status Tracking (status, follow-up dates, contact logs)
  ├── History, Reports, Quota, Bug Reports, CSV Export
```

## Completed Features

### Core Platform
- Tubiate to Affilitube rebrand (complete)
- Backend YouTube API key (removed per-user keys)
- 14-niche keyword configuration system
- 3-tier subscription: Free (3 searches/mo, 10 results) / Pro (unlimited) / AppSumo
- Pricing: $39/mo or $299/yr subscription
- Admin Panel at /admin (revenue, quota, users, search logs)
- JWT authentication, password reset, bug reports
- Search presets (Quick/Balanced/Deep/Custom)
- Shortlist, saved searches/reports, CSV export

### Outreach Status Tracking (Completed Apr 2, 2026)
Backend:
- PATCH /api/channels/{id}/outreach-status — Update status + contact log
- PATCH /api/channels/{id}/follow-up-date — Set/clear follow-up date
- GET /api/channels/follow-ups/due — Overdue follow-ups
- GET /api/channels/by-outreach-status — Channels grouped by status
- GET /api/channels/outreach-statuses — Valid status list

Frontend:
- Route /dashboard/pipeline with full OutreachPipeline page
- Pipeline nav link in Dashboard header (desktop + mobile)
- Color-coded status badges in results table (7 statuses)
- Outreach status filter dropdown in filter bar
- Channel Detail Panel: status dropdown, follow-up date picker, contact note input, contact log
- Follow Ups Due indicator card on Dashboard (navigates to pipeline)

## Supported Niches (14)
1. SaaS & Software
2. Fitness & Health
3. Finance & Investing
4. Ecommerce & Amazon
5. Online Courses & Education
6. Marketing Tools
7. Beauty & Skincare
8. Travel
9. Gaming
10. Home & DIY
11. Pet Care
12. Personal Development
13. Food & Cooking
14. Tech & Gadgets

## Credentials
- Admin: admin@affilitube.com / admin123!
- Stripe Price IDs (placeholders):
  - Pro Monthly: price_PLACEHOLDER_PRO_MONTHLY_39
  - Pro Yearly: price_PLACEHOLDER_PRO_YEARLY_299

## Environment Variables
- YOUTUBE_API_KEY — Backend YouTube Data API v3 key
- MONGO_URL — MongoDB connection
- DB_NAME — Database name (affilitube_db)
- STRIPE_API_KEY — Stripe API key for payments

## Backlog
- P1: Integrate real Stripe Price IDs (waiting on user-provided keys)
