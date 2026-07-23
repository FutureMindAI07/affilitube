import { useState } from "react";
import { Zap, ChevronDown } from "lucide-react";
import PropTypes from "prop-types";
import SearchTemplatePicker from "@/components/SearchTemplatePicker";
import { SEARCH_TEMPLATES } from "@/lib/searchTemplates";

// Wraps SearchTemplatePicker in a slim, collapsed-by-default affordance.
// Auto-collapses after a template is picked (except reverse-search templates
// which need the inline input to stay visible until the user confirms).
// No cross-session persistence — always starts collapsed on mount.
export default function CollapsibleTemplatePicker({ onSelectTemplate, onSkip, niche }) {
  const [expanded, setExpanded] = useState(false);
  const templateCount = SEARCH_TEMPLATES.length;

  const handleSelect = (template) => {
    // Fire the parent's original handler
    onSelectTemplate?.(template);
    // Auto-collapse unless the user picked a reverse-search template — that
    // flow needs its inline product-name input to stay visible.
    if (template?.mode !== "reverse_search") {
      setExpanded(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
    setExpanded(false);
  };

  if (expanded) {
    return (
      <div className="space-y-2" data-testid="collapsible-template-expanded">
        {/* Slim bar header stays visible so users can collapse again */}
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50 transition-colors text-left"
          data-testid="collapsible-template-toggle"
          aria-expanded="true"
        >
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-indigo-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-indigo-900 leading-tight">
                Start from a template instead
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {templateCount} pre-configured shortcuts · click any card to prefill
              </p>
            </div>
          </div>
          <ChevronDown
            className="h-4 w-4 text-slate-500 transition-transform duration-200 rotate-180 shrink-0"
          />
        </button>

        <SearchTemplatePicker
          onSelectTemplate={handleSelect}
          onSkip={handleSkip}
          niche={niche}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-200 transition-colors text-left group"
      data-testid="collapsible-template-toggle"
      aria-expanded="false"
    >
      <div className="flex items-center gap-3">
        <Zap className="h-4 w-4 text-indigo-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-indigo-700 leading-tight">
            Start from a template instead
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {templateCount} pre-configured shortcuts for common search patterns · optional
          </p>
        </div>
      </div>
      <ChevronDown
        className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-all duration-200 shrink-0"
      />
    </button>
  );
}

CollapsibleTemplatePicker.propTypes = {
  onSelectTemplate: PropTypes.func.isRequired,
  onSkip: PropTypes.func,
  niche: PropTypes.string,
};
