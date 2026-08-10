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
- YouTube API quota banner at 70% usage (P1)
- "Refresh channel data" button in ChannelDetailSheet (P2)
- Priority support system for Pro tier (P2)
- Dashboard.jsx refactoring (3800+ lines → break into smaller components) (P2)
- server.py modularisation (5900 lines → split into routers: auth, search, export, trial, pipeline, client_access) (P2)
- OutreachPipeline.jsx / ChannelDetailSheet.jsx refactor (>1400 / >900 lines each) (P3)
- Improve public link detection (bit.ly HEAD, TikTok/Facebook/LinkTree regex) (P3)
- SaaS Radar Phase 4: Productize for users (P3)
- Batch _assert_no_assignment_orphan into single $in aggregation for large bulk-project requests (P3, perf)
- Migrate react-helmet → react-helmet-async (P3, removes StrictMode warning)

## Completed (Aug 10, 2026): Client-Facing Read-Only Project View
Sell curated, vetted YouTube-affiliate lists to DTC brands and agencies. Client accounts have zero access to the admin dashboard, searches, or writes — they only see the projects assigned to them.

**Data model:**
- `users.role` accepts new value `client` (in addition to `user`, `admin`).
- New collection `project_assignments`: `{id, client_user_id, owner_user_id (admin), project_name, export_enabled, expires_at, created_at}`.

**Backend (`server.py`):**
- `get_client_user()` auth dependency (role must be `client`).
- `_assert_not_client()` gate used on all write endpoints that a client must not hit (project-name PATCH, DELETE pipeline, bulk-project).
- `_assert_no_assignment_orphan(owner_user_id, project_name, action)` — LOUD 400 guard called by (1) `PATCH /channels/{id}/project-name` when renaming out of the current project, (2) `DELETE /channels/{id}/pipeline` when removing a channel from an assigned project, (3) `POST /pipeline/bulk-project` when moving or clearing. Returns detailed error: `"Cannot {action}: project '{name}' has {n} active client assignment(s). Revoke assignments first..."`.
- Admin CRUD: `POST/GET/PATCH/DELETE /api/admin/assignments` — enforces: (a) target user must exist and have role=client, (b) project must exist in admin's pipeline, (c) no duplicate (client_user_id, owner_user_id, project_name).
- Client endpoints: `GET /api/client/assignments` (lists with per-assignment `expired` flag + live `channel_count`), `GET /api/client/assignments/{id}/channels` (410 if expired), `POST /api/client/assignments/{id}/export/csv` (403 if `export_enabled=false` or 410 if expired). CSV columns are a reduced 17-column set (no pipeline state like outreach_status/notes — those are stripped).
- `_sanitise_channel_for_client()` strips `notes`, `contact_log`, `outreach_status`, `follow_up_date`, `last_status_change`, `added_to_pipeline_at`, `business_email_manual`, `public_links_manual`, `user_id`, and any `_*` prefixed fields before returning to the client.

**Frontend:**
- `App.js`: new `<ClientRoute>` wrapper (redirects non-clients away from /client). `<ProtectedRoute>` and `<AdminRoute>` both redirect clients into /client. All auth-guarded routes are role-aware.
- `/pages/client/ClientLayout.jsx` — sticky header with "PREVIEW ACCESS" badge, email, logout.
- `/pages/client/ClientAssignments.jsx` — grid of assignment cards. Auto-redirects to /client/project/{id} when the client has exactly one active assignment. Expired assignments render disabled.
- `/pages/client/ClientProjectView.jsx` — read-only card list of vetted creators. Clicking any card opens `ChannelDetailSheet` on the right (same component as admin pipeline) with `readOnly={true}`. "Export CSV" button only renders when `assignment.export_enabled=true`.
- `components/ChannelDetailSheet.jsx` — new `readOnly` prop. When true: hides the entire Outreach Tracking section, Notes textarea, "In Pipeline" indicator, business-email edit pencil, and manual-add affordances on contact links; filters contact-link rows to only populated ones; auto-unlocks Brand Intelligence brands/promo codes (clients are paid buyers, not upsell targets); reads embedded `channel.sponsorship_data` instead of hitting `/channels/{id}/sponsorship-data` (which 404s for client tokens).
- `AdminPanel.jsx` — new "Client Access" tab with two cards:
  - Clients table (email · assigned projects · created)
  - Assignments table (client · project · export toggle chip · expiry · delete)
  - Actions: "+ Create client account" dialog, "+ Assign project" dialog (client dropdown + project dropdown from `/api/pipeline/projects` + export toggle + expiry with quick-preset buttons), "Copy client login URL" affordance.

**Verified (iteration_32):**
- Backend: 28/28 pytest cases pass — role isolation, admin CRUD, all 4 loud guards return HTTP 400, expired-assignment returns 410, export gating returns 403, sanitisation strips pipeline fields.
- Frontend: 5/5 flows pass — client login auto-redirects to single project, /admin & /dashboard both redirect clients back to /client, Export CSV downloads a correctly-named CSV, admin Client Access tab renders cards with seeded client + assignment (no error toasts).

**Scope decision:** Same detail-sheet component as the admin pipeline (`ChannelDetailSheet`), driven by a new `readOnly` prop. Ensures visual and interaction parity between what the admin sees and what the client sees, so the depth-of-data pitch survives the handoff.

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

## Completed (Jul 22, 2026)
- **API Quota Admin UI — Per-Key Breakdown**: The "API Quota" tab in `/admin` now surfaces two side-by-side cards (Admin Key vs Regular User Key), each showing today's units, calls, % of the 10k daily YouTube limit, and 7-day totals. Added a stacked 7-day trend bar chart (indigo = Admin key, purple = Regular key) sourced from `/api/admin/quota-status?days=7`. Legacy `/api/admin/quota` per-user aggregation + hourly search chart retained as secondary sections. Answers the recurring "which key is this?" question — previously the tab combined both keys and only sliced by user_id. `AdminPanel.jsx` `loadQuota()` now fetches both endpoints in parallel.








## Completed (Aug 7, 2026): Manual Social/Public Link Editing from Info Card
Extends the manual-email pattern to Instagram, Twitter/X, LinkedIn, TikTok, and Website. Writes to the same `channel.public_links` dict auto-detection uses, so any consumer (info card contact areas, CSV exports, contactability score, AI Draft) picks up the manual values transparently.

**Backend:**
- New `public_links_manual: List[str] = []` field on `ChannelData` — list of platform keys with manual overrides.
- New `UpdatePublicLinkInput` Pydantic model + `PATCH /api/channels/{channel_id}/public-link` endpoint. Takes `{platform, url}`. Platform whitelist: `instagram | twitter | linkedin | tiktok | website`. Bare domains get `https://` auto-prepended. Empty url clears both the link entry and the manual flag. **Recomputes `score_contactability` on every write** so manual additions get credit immediately.
- Enrichment write-time preservation extended: for any platform in the existing row's `public_links_manual`, keep the persisted value regardless of what the fresh description scan produced. Manual overrides survive 24h cache-miss re-enrichment. Contactability score recomputed against the merged links.
- TikTok is manual-only (auto-detection still doesn't parse tiktok.com URLs — separate backlog item to add).

**Frontend (`components/ChannelDetailSheet.jsx`):**
- Contact Links block reworked to always render all 5 platforms in a fixed order (Instagram, Twitter/X, LinkedIn, TikTok, Website), regardless of which have values.
- Per-platform states:
  - **Empty:** grey "+ Add manually" ghost affordance
  - **Populated (auto):** ExternalLink icon + truncated URL + pencil edit affordance
  - **Populated (manual):** same + small blue "MANUAL" pill for provenance
  - **Editing:** Input (autofocus, Enter=save, Escape=cancel) + green Save check + gray Cancel X
- New state: `editingLink` (platform key or null), `linkDraft`, `linkSaving`.
- Handlers: `startEditLink`, `cancelEditLink`, `saveManualLink` — patches endpoint, mutates channel prop in place, fires `onStatusUpdate` for parent re-sync.
- Test-ids: `contact-links-block`, `contact-link-row-{platform}`, `contact-link-add-{platform}`, `contact-link-edit-{platform}`, `contact-link-value-{platform}`, `contact-link-input-{platform}`, `contact-link-save-{platform}`, `contact-link-cancel-{platform}`.

**Verified:**
- 6 backend edge cases: invalid platform → 400; bare domain → https:// auto-prepend + saved; TikTok add → added to `public_links_manual`; clear → removed from both places; URL with spaces → 400; no auth → 403.
- UI screenshot: contact links block renders all 5 rows with mixed states (empty, editing, manual-pilled, auto-detected). Blue MANUAL pill visible on manually-entered TikTok row while auto-detected Website has no pill.
- Contactability score (0-10 scale, not 0-100 as previously miscited) recomputes correctly: website+instagram = 3+2 = 5.
- Lint clean.

**Scope decision:** Same as manual email — only the Pipeline variant of the info card. Search-results Dashboard variant unchanged.

## Completed (Aug 7, 2026): Manual Business Email Entry from Info Card
Adds an inline email editor to the Pipeline info card (`components/ChannelDetailSheet.jsx`). Manually-entered emails write to the exact same `business_email` field auto-detection uses, so they surface in pipeline card contact area, CSV exports, contactability score, AI Draft — everywhere. Confirmed edge cases with user upfront: manual overwrites auto-detected; manual entries survive re-enrichment via a preservation flag.

**Backend (`server.py`):**
- New `business_email_manual: bool = False` field on `ChannelData` model.
- New `UpdateBusinessEmailInput` Pydantic model + `PATCH /api/channels/{channel_id}/business-email` endpoint. Format validated with a compiled regex (`_EMAIL_RX`). Empty payload clears `business_email`, `has_business_email`, AND resets the manual flag so future auto-detection is free to repopulate.
- Enrichment write-time preservation (`server.py:2806+`): before `update_one($set=doc, upsert=True)`, look up any existing row and check `business_email_manual`. If True, override `doc.business_email` / `has_business_email` / `business_email_manual` with the persisted values. Prevents 24h cache-miss re-enrichment from silently wiping manual entries.

**Frontend (`components/ChannelDetailSheet.jsx`):**
- Added `toast` from sonner (previously silent-fail component).
- New state: `editingEmail`, `emailDraft`, `emailSaving`.
- Handlers: `startEditEmail`, `cancelEditEmail`, `saveManualEmail` (PATCH the endpoint, mutate `channel` prop in place for instant UI update, fire `onStatusUpdate` so parent refetches, toast success/error).
- Email block reworked in-place:
  - **No email:** shows "Add manually" affordance with Plus icon + italic hint "No email detected — add one manually to include in outreach and exports."
  - **Auto-detected email:** shows mailto link with Mail icon + "Edit" pencil affordance.
  - **Manually-entered email:** same as above + small "MANUAL" pill inline with the "Business Email" label so origin is transparent.
  - **Editing state:** Input (autofocus, Enter=save, Escape=cancel) + green Save check + gray Cancel X.
- Test-ids: `business-email-block`, `business-email-edit-btn`, `business-email-input`, `business-email-save-btn`, `business-email-cancel-btn`, `business-email-value`.

**Scope decision:** Only the Pipeline variant of the info card (`components/ChannelDetailSheet.jsx`) got this. The search-results variant (`pages/dashboard/ChannelDetailSheet.jsx`) is pre-pipeline discovery — the UX moment for a manual email is when you're preparing outreach, which is post-add-to-pipeline. Adding it to that variant would require cross-Dashboard prop-drill for questionable benefit.

**Verified:** 6 backend edge cases pass (invalid format 400 / missing channel 404 / no auth 403 / valid set 200 / GET verification / empty-string clear resets all 3 fields). Screenshots confirm both display and edit states render correctly in the Pipeline info card sheet. Lint clean on all files.

## Completed (Jul 29, 2026): Pipeline Bulk Actions — Delete, Change Status, Move to Project
Selection + bulk actions on the Outreach Pipeline for users with 20+ prospects. Matches user's exact ask: "sort by not contacted → delete the sorted results without doing individually."

**Backend (server.py):**
- Three new endpoints, all user-scoped + capped at 500 IDs per request via `_validate_bulk_ids()`:
  - `POST /api/pipeline/bulk-delete` — single `update_many` reset of `outreach_status`/`project_name`/`follow_up_date`/`contact_log`. Soft-delete (preserves enrichment).
  - `POST /api/pipeline/bulk-status` — validates against `OUTREACH_STATUSES`, `$set`s status + `$push`es a contact_log entry per row noting the bulk change.
  - `POST /api/pipeline/bulk-project` — sets or clears `project_name` (empty string / null both remove).
- New Pydantic models: `BulkDeleteInput`, `BulkStatusInput`, `BulkProjectInput`. Each takes `channel_ids: List[str]`.
- Same auth level as single-row endpoints (`get_current_user`) — no admin gate, no tier gate. Parity with the free single-row delete.

**Frontend (OutreachPipeline.jsx):**
- `selectedIds: Set<string>` state + `useEffect` clearing it whenever any of `statusFilter, showOverdueOnly, projectFilter, searchQuery, minScore, sortBy, pipelineCountries, pipelineIncludeUnknown` change. Matches "select what I can see" mental model.
- Sticky bulk-action bar rendered above the card list (`sticky top-2 z-20`). Two states:
  - **Idle (0 selected):** shows header checkbox + "N prospects" count. No action buttons.
  - **Active (>0 selected):** shows filled header checkbox + "N selected" + `[Change Status] [Move to Project] [Delete] [Clear]` buttons. Delete is red-outlined for visual differentiation.
- Row-level `<Checkbox>` on each Card (leftmost, before channel info). Wrapped in `onClick={e => e.stopPropagation()}` so it doesn't trigger row-open handlers.
- Header checkbox uses `filteredChannels.every(...)` → binary state (all/none). Click when all-selected clears.
- Three dialogs:
  - **Bulk Delete:** `AlertDialog` with red confirm button. Copy explicitly notes soft-remove (enrichment preserved, can be re-added).
  - **Bulk Change Status:** `Dialog` with a `Select` populated from `STATUS_CONFIG`. Note that a contact-log entry will be added.
  - **Bulk Move to Project:** `Dialog` with a `Select` including `— Remove from project —`, `+ Create new project…`, and existing projects. New project shows an inline `Input`. Uses the same 85vh + `flex-col` scroll pattern as the single-row Move dialog.
- Handler `runBulk(label, apiCall)` centralises loading state, toast messaging, selection clear, and pipeline refresh.
- Test-ids: `pipeline-bulk-bar`, `pipeline-header-checkbox`, `pipeline-selection-count`, `pipeline-row-checkbox-{id}`, `pipeline-bulk-status-btn`, `pipeline-bulk-project-btn`, `pipeline-bulk-delete-btn`, `pipeline-bulk-clear-btn`, three `-dialog` and three `-confirm` variants.

**Verified:**
- Backend edge cases: empty ids → 400, invalid status → 400, 501 ids → 400 with cap message, no auth → 403, valid call with no matching IDs → 200 with `{updated: 0}`.
- Screenshots: idle state (bulk bar with "1 prospect", no action buttons) + active state (filled checkbox on Stacia Loo card, "1 selected", full 4-button action bar).
- Lint: 0 backend errors. 2 pre-existing frontend errors at line 1099 (unrelated).

**Not-in-scope (deferred per proposal):**
- Hard delete of channel records (would nuke enrichment cache).
- Undo/restore flow.
- Bulk export (already achievable via filter-scoped CSV export button — no per-row selection needed).
- Keyboard shift+click multi-select.
- "Select all N matching this filter" affordance (not needed today since the pipeline has no pagination; will re-visit if pagination lands).

## Completed (Jul 28, 2026): Admin-Only Pipeline CSV Export with Brand Intelligence
Adds a full-featured export for the Outreach Pipeline that includes pipeline state + Brand Intelligence data, unlike the existing `/api/export/csv` which only covers search-time enrichment.

**Backend:**
- New endpoint `POST /api/pipeline/export/csv` (positioned right after `get_admin_user` definition to satisfy Python forward-reference constraints for `Depends(get_admin_user)`).
- Gated with `get_admin_user` — non-admins get 403 "Admin access required".
- Accepts `channel_ids: List[str]` — frontend sends the currently-filtered channel IDs so client-side filters (country, score, etc.) are honoured without adding new server-side filter params.
- Returns CSV via `StreamingResponse` with 43 columns organised into 8 groups: Identity (7), Pipeline state (6), Scores (7), Contact (5), Affiliate signals (4), Brand Intelligence (7), Video titles (2), Health (4), Competitor overlap (2).
- New columns: `outreach_status`, `project_name`, `notes`, `added_to_pipeline_at`, `last_status_change`, `follow_up_at`, all 7 `bi_*` Brand Intelligence fields, `bi_sponsored_video_titles` (pipe-separated titles of videos where BI detected any signal).
- Missing-BI handling: rows without `sponsorship_data` get empty cells (not 0) for BI columns, avoiding false negatives.
- Response includes custom headers `X-Missing-BI-Count` and `X-Total-Rows` + `Access-Control-Expose-Headers` so frontend JS can read them via `res.headers`.

**Frontend (`OutreachPipeline.jsx`):**
- New "Export CSV" button in the filter bar, right of "Overdue Follow-ups". Only rendered when `isAdmin === true`. Indigo palette + Download icon + live count badge showing filtered channel count. Loader spinner during export.
- `handleExportPipelineCsv` handler: sends `filteredChannels.map(ch => ch.channel_id)` (respects ALL client-side filters), receives blob, triggers browser download, revokes URL, reads custom headers to warn if any exported prospects lack Brand Intelligence.
- Filename convention: `affilitube-pipeline-{project|all-prospects}-{YYYY-MM-DD}.csv`.
- Toast messaging:
  - Success: "Exported N prospects with full Brand Intelligence data"
  - Warning: "Exported N prospects. K rows had no Brand Intelligence data — open the Detail Sheet or re-run Super Search to populate."
- Test-id `pipeline-export-csv-btn`.

**Verified:**
- 403 for non-admin (Free user), 403 for unauth, 404 for admin with no matching channel_ids, 200 with valid CSV blob + custom headers for real admin request.
- CSV header row confirmed to include all 43 columns in the specified order.
- Screenshot: button renders at filter-bar (1209, 286) with correct count badge; UI shows "Export CSV [1]" for the live 1-channel pipeline.
- Lint: 0 new backend errors. Frontend lint has 2 pre-existing errors at line 920 (unrelated to this change).
- Not-in-scope (deferred): auto-enrich missing-BI rows during export, per-status export presets, scheduling recurring exports.

## Completed (Jul 23, 2026): Dashboard Layout — Niche Reorder + Collapsible Template Bar
Two frontend-only UX changes to the dashboard Search Configuration page. No backend logic changes.

**Niche reorder (SearchPanel.jsx):**
- Added `NICHE_DISPLAY_ORDER` const (18 entries, top-to-bottom) that reverses the previous SaaS-first ordering. Creator/lifestyle niches (Fashion → Lifestyle → Parenting → Home & Decor) now lead; SaaS/tech (Marketing Tools, SaaS & Software) closes the grid.
- `sortNichesForDisplay(niches)` helper applies the ordering and falls back to alpha for any niche not explicitly mapped (so newly added backend niches never disappear from the UI — they land at the tail).
- No changes to `/api/niches`, `NICHE_CONFIGS`, or the card design (icon + title + description unchanged).

**Collapsible Template Bar (`CollapsibleTemplatePicker.jsx` — new component):**
- Wraps the existing `SearchTemplatePicker` in a slim, collapsed-by-default affordance so the template shortcut no longer visually competes with the niche grid.
- Collapsed state: 44px slate-50 bar with subtle slate-200 border, ⚡ Zap icon (indigo-500), primary line "Start from a template instead" (indigo-700), secondary caption `"{n} pre-configured shortcuts for common search patterns · optional"` where `n = SEARCH_TEMPLATES.length` (dynamic — currently 7). Chevron on right rotates 180° on toggle (200ms).
- Expanded state: same bar (chevron flipped) sits on top; existing template picker card renders below. STEP 1 pill removed from the picker header per proposal.
- Auto-collapse on template select **except** for reverse-search templates, which need their inline product-name input to stay visible until the user confirms.
- No cross-session persistence — always starts collapsed on mount. Local `useState` only.
- `data-testid="collapsible-template-toggle"` for automated flows.

**Cleanup:**
- Dashboard.jsx now imports `CollapsibleTemplatePicker` (no aliasing of the old symbol carried forward).
- The pre-existing `SearchTemplatePicker.jsx` remains as an internal-only component that `CollapsibleTemplatePicker` composes — not dead code, still the source of the grid rendering + reverse-search input UX.

**Verified:**
- Screenshot of collapsed bar (approved by user before shipping).
- Screenshot of expanded state — chevron rotates, all 7 templates visible + Custom Search skip card.
- Screenshot of reordered niche grid — Fashion & Style top-left, SaaS & Software bottom-right, all 18 present.
- 31 backend pytest cases still green.
- Lint clean on all files touched (existing pre-existing errors unrelated).

## Completed (Jul 22, 2026 — cont. 4): Video-Description Scan Now Unconditional + "Scan Video Descriptions" Toggle Removed
Follow-up fix on the Option A badging work. Ziba Shops Style (fashion vlogger) rendered empty in the results column despite Brand Intelligence showing 340 affiliate links, because her affiliate URLs live in *video descriptions* rather than her channel bio — and the enrichment gate at `server.py:2588` only fetched video snippets when either the "Scan Video Descriptions" toggle was ticked OR the affiliate-platforms picker had entries. Under Option A defaults, both were empty → video snippets skipped → `affiliate_links_total = 0` → fallback pill couldn't fire.

**Backend (server.py):**
- Line 2588: `needs_descriptions = True` unconditionally. Video snippets are now always fetched during enrichment (part=`statistics,snippet` on `videos.list`).
- Line 2155-2158: `video_description_calls = 0` unconditionally. `videos.list` costs 1 YouTube unit regardless of which parts are requested — the previous code was double-counting when the toggle was on.
- `scan_video_descriptions` field kept in the `SearchFilters` and `QuotaEstimateRequest` Pydantic models so legacy clients that still send it don't 400. Field is silently ignored.

**Frontend cleanup:**
- Removed the "Scan Video Descriptions" toggle from Advanced Settings (`SearchPanel.jsx`). The `+quota` sublabel was actively misleading — post-fix the toggle would have both done nothing and falsely implied a quota cost.
- Removed `scanVideoDescriptions` state, setter, prop-drill, and PropType from `SearchPanel.jsx` (`Dashboard.jsx` state + 2 request payloads + 1 preset-loader line + 1 dep-array entry).
- Removed the `scan_video_descriptions` field from all 3 presets in `searchPresets.js` (fast / balanced / deep).
- Updated `BlogAffiliateSaaS.jsx` onboarding step 2 copy: "…turn on Scan Video Descriptions to find affiliate signals…" → "…let Affilitube automatically scan video descriptions for affiliate signals — no toggles required."

**Verified:**
- 31 pytest cases still pass.
- `/api/quota/estimate` returns identical output for default clients and legacy clients that still send `scan_video_descriptions: true` (both `video_description_calls: 0`).
- Lint clean on all 5 changed files (existing pre-existing errors unrelated).
- Ziba-style channels should now badge correctly on next re-enrichment (cache is 7 days per channel; older results may need to be searched again).

## Completed (Jul 22, 2026 — cont. 3): Affiliate Platform Badging Fix (Option A)
Fix for the two-list drift blocker: fashion channels with 340+ affiliate URLs (via rstyle.me / ShopMy / MagicLinks / etc.) were badging as empty in the results column because those creator networks were counted in `MASTER_AFFILIATE_LINK_PATTERNS` but not named in `AFFILIATE_PLATFORMS`. Plus a third invisible gate: `detect_affiliate_platform_links` only ran on platforms the user explicitly ticked in the "Detect Affiliate Platform Links" picker.

**Backend changes (server.py):**
- Expanded `AFFILIATE_PLATFORMS` from 11 → 20 named entries. Added: `shopmy`, `magiclinks`, `mavely`, `howl`, `collabs`, `skimlinks`, `sovrn` (VigLink), `partnerize`, `flexoffers`. Folded `rstyle.me` into the LTK entry; folded `shrsl.com` into the ShareASale entry; added `amazon.[tld]/shop/` (Influencer storefronts) to the Amazon entry.
- **Semantic flip (Option A):** enrichment now ALWAYS scans every named platform (`list(AFFILIATE_PLATFORMS.keys())`), regardless of the user's picker state. Detection is no longer gated by the request `affiliate_platforms` param.
- New `affiliate_links_total` field on `ChannelData` — count of ALL URL matches across `MASTER_AFFILIATE_LINK_PATTERNS` (named + unnamed networks). Populates the "N aff links" fallback pill.
- Field exposed in CSV export whitelist.

**Frontend changes:**
- New display helper `frontend/src/lib/affiliatePlatformDisplay.js` with `PLATFORM_BADGE_PRIORITY` (Amazon → LTK → PartnerStack → Impact → ShopMy → MagicLinks → ShareASale → …), `PLATFORM_LABEL` map, and `selectVisiblePlatforms(cap=2)` helper.
- Results column (`ResultsSection.jsx` + `HistoricalReportView.jsx`): cap badges at 2, overflow collapses to `+N` slate chip with tooltip listing hidden ones. If `affiliate_platforms_found` is empty but `affiliate_links_total > 0` → neutral "N aff link(s)" fallback pill. Empty means genuinely empty. Test-IDs: `affiliate-platforms-cell-*`, `affiliate-platforms-more-*`, `affiliate-links-fallback-*`.
- Picker reframed in `SearchPanel.jsx`: renamed from "Detect Affiliate Platform Links" → "Filter by Affiliate Platform". Helper text now says "Every named affiliate network is scanned automatically… tick to filter results to specific networks. Leave empty to see all." When any are ticked, an amber warning explains the filter is active.
- `Dashboard.jsx` `sortedChannels` now applies picker-as-filter locally: if `affiliatePlatforms.length > 0`, only channels whose `affiliate_platforms_found` intersects the picker selection stay.

**Backwards compatibility audit (safe):**
- `searchTemplates.js`: no template sets `affiliate_platforms`. Zero impact.
- `search_reports` (saved reports): the persisted `filters` blob at Dashboard.jsx:851-858 doesn't include `affiliate_platforms`. Zero impact.
- `autosaved_results` (autosave): stores enriched channel data + search metadata, not filter state. Zero impact.
- Only in-memory session state carries the picker selection — no silent behaviour flip on load.

**Test coverage:**
- `tests/test_option_a_platform_semantics.py` — 13 new pytest cases (all 20 named platforms registered; ShopMy / MagicLinks / rstyle-via-LTK / VigLink detection; multi-platform matching; `affiliate_links_total` formula counts both named and unnamed networks like `geni.us`). All pass. Combined with previous 18 cases → 31 green.
- `/api/affiliate-platforms` verified live: returns 20 platforms in the expected order.

## Completed (Jul 22, 2026 — cont.)
- **Four New Niches + Affiliate Platform Coverage + Promo-Code Surfacing**:
  - Added `fashion`, `lifestyle`, `parenting`, `home_decor` to `NICHE_CONFIGS` (server.py:657+) with full 6-key config; user-approved keyword sets after review (bare `pr` cut from lifestyle → `pr package`; bare `code` cut from all four to avoid "dress code"/"zip code" collisions — Item 4 regex handles short-form).
  - Added all four to `PHYSICAL_PRODUCT_NICHES` (server.py:2864) so Super Search AI grading uses the physical-product rubric (audience = shoppers) instead of the SaaS rubric.
  - Extended `MASTER_AFFILIATE_LINK_PATTERNS` (server.py:814) with: `liketoknow.it`, `rewardstyle.com`, `shopltk.com`, `amazon.[tld]/shop/` (Amazon Influencer storefronts), `walmart.com/*?adid=` (Walmart Creator), `viglink.com` (Sovrn). LTK gets a named badge entry in `AFFILIATE_PLATFORMS` ("LTK"); the other three count silently.
  - `detect_sponsorships()` now surfaces `detected_promo_codes` list (deduped, uppercased, stopword-filtered against FREE/SALE/SHIP/etc, capped at 10) in `sponsorship_data`. Previously only `promo_code_count` was stored.
  - New "CODE at checkout" regex catches bare `SAVE20 at checkout` / `MEG15 at the checkout` phrasing without a `use`/`code` label — common in fashion/lifestyle sponsored posts.
  - **"Active Codes" chip row** added to `ChannelDetailSheet.jsx` (Brand Intelligence section), below Detected Past Partners. Amber palette + font-mono to visually differentiate from brand chips. Pro-gated with blurred preview + "N Codes — Upgrade to Pro" CTA, matching the existing brand-list gate pattern (competitive intel parity).
  - Coverage: 18 pytest cases in `tests/test_niches_and_affiliate_patterns.py` — all pass. `/api/niches` verified to return 18 niches end-to-end.
  - Explicitly OUT of scope for this pass (noted for later): confidence formula tuning, 10-video cap, brand capitalisation, affiliate link de-dup, seeded search templates for the new niches.


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
