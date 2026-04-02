# Affilitube — YouTube Affiliate Prospect Finder PRD

## Original Problem Statement
Build a multi-niche web app that identifies YouTube channels likely to be good affiliates for any brand, marketer, or founder.

## Architecture
```
Frontend (React + Tailwind + Shadcn UI + Framer Motion)
  ├── Landing (/)
  ├── Pricing (/pricing) — Stripe checkout (Free/Pro tiers)
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
  ├── Tier System (free/pro/appsumo with limits)
  ├── Stripe Checkout (Pro subscription: $39/mo or $299/yr)
  ├── YouTube Search & Enrichment (24hr caching, backend API key)
  ├── Niche-based Scoring (14 niches with dynamic keyword configs)
  ├── Channel Health Indicators (upload consistency, engagement health, growth)
  ├── Outreach Status Tracking (status, follow-up dates, contact logs, projects)
  ├── Search Results Auto-save & Persistence
  ├── Pipeline Management (add/remove, project organization)
  ├── History, Reports, Quota, Bug Reports, CSV Export
```

## Completed Features

### Core Platform
- Tubiate to Affilitube rebrand
- Backend YouTube API key (removed per-user keys)
- 14-niche keyword configuration system
- 3-tier subscription: Free (3 searches/mo, 10 results) / Pro (unlimited) / AppSumo
- Admin Panel at /admin
- JWT authentication, password reset, bug reports
- Search presets, shortlist, saved searches/reports, CSV export

### Channel Health Indicators (Completed Apr 2, 2026)
Backend:
- 3 calculation functions: upload_consistency, engagement_health, growth_indicator
- 5 new fields on ChannelData model
- Computed during enrichment, backfilled for cached channels
- Included in CSV exports

Frontend:
- Health column in results table (colored engagement dot + upload activity icon + growth arrow)
- Engagement health filter dropdown (All/Healthy/Average/Low/Very Low)
- Channel Health section in detail panel (Upload Frequency, Engagement Health badge, Growth Trend)
- Client-side computeHealthIndicators for cached/autosaved channels

### Outreach Pipeline & Projects (Completed Apr 2, 2026)
- Add to Pipeline dialog (project name autocomplete + status dropdown)
- Pipeline nav in dashboard header
- Pipeline view with project filter, inline project editing, remove button
- Follow Ups Due indicator card
- Search results persistence (React context + sessionStorage + backend auto-save)

## Key DB Collections
- `users`: {email, role, tier, monthly_search_count, search_count_reset_date, has_paid}
- `channels`: {channel_id, user_id, channel_data, outreach_status, follow_up_date, project_name, contact_log, upload_consistency, engagement_health, engagement_rate, growth_indicator, upload_avg_days}
- `autosaved_results`: {user_id, channels, raw_search_results, search_metadata, saved_at, is_autosave}

## Key API Endpoints
- PATCH /api/channels/{id}/outreach-status (accepts project_name)
- PATCH /api/channels/{id}/follow-up-date
- PATCH /api/channels/{id}/project-name
- DELETE /api/channels/{id}/pipeline
- GET /api/channels/by-outreach-status (with project filter)
- GET /api/pipeline/projects
- POST/GET/DELETE /api/search-results/autosave
- GET /api/channels/follow-ups/due

## Backlog
- P1: Integrate real Stripe Price IDs (waiting on user-provided keys)
