/**
 * Channel health indicator configs + client-side computation.
 *
 * Extracted from Dashboard.jsx (Phase 1 refactor). Behaviour is unchanged.
 */

export const ENGAGEMENT_HEALTH_CONFIG = {
  Healthy: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Average: { color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  Low: { color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  "Very Low": { color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
};

export const UPLOAD_CONSISTENCY_ICONS = {
  Daily: "text-emerald-500",
  "Very Active": "text-emerald-500",
  Active: "text-blue-500",
  Occasional: "text-yellow-500",
  Infrequent: "text-slate-400",
};

/**
 * Client-side health indicator calculation for channels loaded from cache/autosave.
 * Returns the channel unchanged if all three indicators are already set.
 */
export function computeHealthIndicators(channel) {
  if (channel.engagement_health && channel.upload_consistency && channel.growth_indicator) return channel;
  const ch = { ...channel };
  // Engagement health
  if (!ch.engagement_health && ch.subscriber_count > 0) {
    const rate = (ch.avg_views_recent / ch.subscriber_count) * 100;
    ch.engagement_rate = Math.round(rate * 100) / 100;
    if (rate >= 5) ch.engagement_health = "Healthy";
    else if (rate >= 2) ch.engagement_health = "Average";
    else if (rate >= 0.5) ch.engagement_health = "Low";
    else ch.engagement_health = "Very Low";
  }
  // Growth indicator
  if (!ch.growth_indicator && ch.video_count > 0 && ch.view_count > 0) {
    const lifetimeAvg = ch.view_count / ch.video_count;
    const ratio = lifetimeAvg > 0 ? ch.avg_views_recent / lifetimeAvg : 1;
    if (ratio > 1.5) ch.growth_indicator = "Growing";
    else if (ratio < 0.5) ch.growth_indicator = "Declining";
    else ch.growth_indicator = "Stable";
  }
  // Upload consistency from recent_videos
  if (!ch.upload_consistency && ch.recent_videos?.length >= 2) {
    const dates = ch.recent_videos
      .map(v => v.published_at ? new Date(v.published_at) : null)
      .filter(Boolean)
      .sort((a, b) => b - a);
    if (dates.length >= 2) {
      const gaps = [];
      for (let i = 0; i < dates.length - 1; i++) gaps.push((dates[i] - dates[i+1]) / 86400000);
      const avg = gaps.reduce((a,b) => a+b, 0) / gaps.length;
      ch.upload_avg_days = Math.round(avg * 10) / 10;
      if (avg <= 2) ch.upload_consistency = "Daily";
      else if (avg <= 7) ch.upload_consistency = "Very Active";
      else if (avg <= 14) ch.upload_consistency = "Active";
      else if (avg <= 30) ch.upload_consistency = "Occasional";
      else ch.upload_consistency = "Infrequent";
    }
  }
  return ch;
}
