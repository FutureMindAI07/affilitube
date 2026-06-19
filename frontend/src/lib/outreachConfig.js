/**
 * Outreach status configuration (labels + badge colour classes).
 *
 * Extracted from Dashboard.jsx (Phase 1 refactor). Behaviour is unchanged.
 *
 * NOTE: components/ChannelDetailSheet.jsx currently holds its own duplicated
 * copy of this config. Deduplication is a separate future task — do not touch
 * that file from inside this refactor.
 */

export const OUTREACH_STATUS_CONFIG = {
  not_contacted: { label: "Not Contacted", color: "bg-slate-100 text-slate-700 border-slate-200" },
  contacted: { label: "Contacted", color: "bg-blue-100 text-blue-700 border-blue-200" },
  replied: { label: "Replied", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  in_negotiation: { label: "In Negotiation", color: "bg-orange-100 text-orange-700 border-orange-200" },
  agreed: { label: "Agreed", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  declined: { label: "Declined", color: "bg-red-100 text-red-700 border-red-200" },
  no_response: { label: "No Response", color: "bg-slate-200 text-slate-600 border-slate-300" },
};
