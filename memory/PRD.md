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
  ├── Outreach Pipeline (/dashboard/pipeline) — CRM-like channel tracking with project org
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
  ├── Outreach Status Tracking (status, follow-up dates, contact logs, projects)
  ├── Search Results Auto-save & Persistence
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
- PATCH /api/channels/{id}/outreach-status — Update status + contact log + project_name
- PATCH /api/channels/{id}/follow-up-date — Set/clear follow-up date
- GET /api/channels/follow-ups/due — Overdue follow-ups
- GET /api/channels/by-outreach-status — Channels grouped by status (with project filter)
- GET /api/channels/outreach-statuses — Valid status list

Frontend:
- Route /dashboard/pipeline with full OutreachPipeline page
- Pipeline nav link in Dashboard header (desktop + mobile)
- Color-coded status badges in results table (7 statuses)
- Outreach status filter dropdown in filter bar
- Channel Detail Panel: status dropdown, follow-up date picker, contact note input, contact log
- Follow Ups Due indicator card on Dashboard (navigates to pipeline)

### UX Fix 1: Add to Pipeline from Search Results (Completed Apr 2, 2026)
- "Add to Pipeline" button on each enriched channel row in results table
- "Add to Pipeline" prominent button in channel detail panel
- Dialog with project/campaign name input (with autocomplete from existing projects)
- Initial outreach status dropdown (defaults to "not_contacted")
- Shows "In Pipeline" badge with status when already added

### UX Fix 2: Project Organisation in Pipeline (Completed Apr 2, 2026)
Backend:
- project_name field on outreach status data per channel
- GET /api/pipeline/projects — unique project names for user
- PATCH /api/channels/{id}/project-name — update project name

Frontend:
- Project filter dropdown in Pipeline view
- Project name label on each channel card
- Inline project name editing from pipeline view

### UX Fix 3: Persist Search Results Across Navigation (Completed Apr 2, 2026)
Frontend:
- SearchResultsContext — React context persisting channels across tab navigation
- sessionStorage backup for fast restore
- Results loaded indicator ("X channels loaded from last search") with clear button
- Results persist until new search, logout, or explicit clear

Backend:
- POST /api/search-results/autosave — auto-save results (upserts per user)
- GET /api/search-results/autosave — restore auto-saved results
- DELETE /api/search-results/autosave — clear auto-saved results

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

## Key DB Collections
- `users`: {email, role, tier, monthly_search_count, search_count_reset_date, has_paid}
- `channels`: {channel_id, user_id, channel_data, outreach_status, follow_up_date, project_name, contact_log}
- `autosaved_results`: {user_id, channels, raw_search_results, search_metadata, saved_at, is_autosave}

## Environment Variables
- YOUTUBE_API_KEY — Backend YouTube Data API v3 key
- MONGO_URL — MongoDB connection
- DB_NAME — Database name (affilitube_db)
- STRIPE_API_KEY — Stripe API key for payments

## Backlog
- P1: Integrate real Stripe Price IDs (waiting on user-provided keys)
