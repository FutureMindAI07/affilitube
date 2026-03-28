# Tubiate — YouTube Affiliate Prospect Finder PRD

## Original Problem Statement
Build a web app that identifies YouTube channels likely to be good affiliates for an automation/AI workflow product.

## Architecture
```
Frontend (React + Tailwind + Shadcn UI + Framer Motion)
  ├── Landing (/)
  ├── Pricing (/pricing) — Stripe checkout
  ├── Auth (/login, /signup, /forgot-password)
  ├── Dashboard (/dashboard) — Prospect Finder tool
  ├── Outreach (/dashboard/outreach) — Email templates
  ├── Getting Started (/dashboard/getting-started) — Tutorials & guides
  ├── Checkout Success (/checkout/success)
  ├── Terms (/terms) & Privacy (/privacy)

Backend (FastAPI + Motor/MongoDB)
  ├── Auth (JWT, password reset)
  ├── Stripe Checkout
  ├── YouTube Search & Enrichment (24hr caching)
  ├── Scoring, History, Reports, Quota, Bug Reports, CSV Export
```

## What's Been Implemented

### Getting Started Page (March 15, 2026)
- Quick Start guide (4 steps)
- Tutorial Videos section (5 video placeholders ready for YouTube embeds)
- Tips & FAQ section

### Outreach Templates (March 15, 2026)
- 5 email templates: Initial Introduction, Affiliate Pitch, Product Review, Follow-Up, Video Collaboration
- Variable filling ({{CHANNEL_NAME}}, {{YOUR_PRODUCT}}, etc.) with live preview
- Copy Subject / Body / Full Email to clipboard
- Template gallery with category badges

### Dashboard Navigation (March 15, 2026)
- 3-tab nav: Prospect Finder, Outreach, Getting Started
- Consistent header with bug report + logout across all tabs
- Mobile responsive tab bar

### Earlier Features
- P1: Password reset, pagination (25/page), result caching (24hr)
- Stripe: Checkout flow with user's sandbox key, payment gating
- Crystal Prism UI: Glassmorphism, gradient buttons, Outfit/Manrope fonts
- Core: Search, enrichment, scoring, shortlisting, CSV export, API key encryption

## Testing
- Iteration 2: Auth (9/9), 3: UI (33/33), 4: Stripe (18/18), 5: P1 (12/12), 6: Getting Started + Outreach (20/20)

## Credentials
- Admin: admin@tubiate.com / admin123!
- Stripe price ID: price_1TBCOiPnblls1SrQj1rGEBJP

## Backlog
- P2: Channel comparison view, engagement trend analysis
- Google Sheets export (deferred — needs OAuth)
- Refactor server.py + Dashboard.jsx into smaller modules
- Add actual YouTube video IDs to Getting Started tutorials
