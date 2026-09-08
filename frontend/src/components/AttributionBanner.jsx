/**
 * Persistent small-print attribution banner for AffiliTube-derived metrics.
 * Complies with Google Developer Policy III.E.4.f (must clearly indicate
 * that scores/ratings shown are calculated by the API Client and are not
 * YouTube-provided).
 */
import { Info } from "lucide-react";

const DEFAULT_TEXT =
  "Scores and health indicators are independently calculated by AffiliTube and are not derived from the YouTube API.";

export function AttributionBanner({ text = DEFAULT_TEXT, className = "", testId }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 ${className}`}
      data-testid={testId || "attribution-banner"}
    >
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
      <span className="leading-snug">{text}</span>
    </div>
  );
}
