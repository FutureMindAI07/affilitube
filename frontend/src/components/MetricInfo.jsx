import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DEFAULT_TEXT = "This metric is independently calculated by AffiliTube and is not derived from YouTube.";

/**
 * Small ⓘ icon that reveals a Google-Developer-Policy III.E.4.f compliant
 * attribution disclaimer on hover or tap. Use next to any AffiliTube-derived
 * metric (score, health classification, sponsorship confidence, etc.).
 * DO NOT use next to raw YouTube data (subscriber count, video title, etc.).
 */
export function MetricInfo({ text = DEFAULT_TEXT, className = "", testId }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-full ${className}`}
            aria-label="About this metric"
            data-testid={testId || "metric-info-icon"}
            onClick={(e) => e.stopPropagation()}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
