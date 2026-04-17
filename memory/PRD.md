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
- Bulk actions in Pipeline view (P1)
- Priority support system for Pro tier (P2)
- Dashboard.jsx refactoring (3800+ lines → break into smaller components) (P2)

## Completed (Apr 17, 2026)
- Pipeline Info Button & Auto-Cache Brand Intelligence: Added "Info" button to each channel row in Outreach Pipeline that opens a full Channel Detail Sheet (ChannelDetailSheet.jsx) with Score Breakdown, Outreach Tracking, Affiliate Potential, Statistics, Channel Health, Tags, Brand Intelligence, Notes. Backend auto-caches sponsorship data via BackgroundTasks when a channel is first added to the pipeline.
- Pipeline Search & Sort: Added Min Affiliate Score filter, Sort by dropdown (Score high/low, Subscribers, Name), live channel count, and Clear button to the Pipeline filter bar.
- AI Outreach Drafter: Admin-only "AI Draft" button on each Pipeline card (between Info and Update Status). Uses OpenAI GPT-4o to generate personalized outreach emails based on channel_name, recent_videos, topic_tags, affiliate_score. Slide-down panel shows business email (copy icon), subject line, message body, Copy All, Regenerate buttons. Session-level caching avoids re-triggering paid API calls. Loading spinner during generation.

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
