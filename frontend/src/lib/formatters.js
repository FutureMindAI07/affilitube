/**
 * Pure formatting helpers for the Dashboard.
 *
 * Extracted from Dashboard.jsx (Phase 4 refactor). Behaviour is unchanged.
 */

export function getScoreClass(score) {
  if (score >= 60) return "score-high";
  if (score >= 40) return "score-medium";
  return "score-low";
}

export function getAffiliateScoreClass(score) {
  if (score >= 60) return "bg-purple-100 text-purple-700 border-purple-200";
  if (score >= 40) return "bg-violet-100 text-violet-700 border-violet-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export function formatNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || "0";
}
