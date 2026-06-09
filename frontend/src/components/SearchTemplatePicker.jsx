import { useState } from "react";
import {
  Star,
  Mail,
  Workflow,
  Sparkles,
  Rocket,
  Target,
  ArrowRight,
  PenLine,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEARCH_TEMPLATES, reverseSearchKeywordsFor } from "@/lib/searchTemplates";

// Icon name → lucide component. Lets us define templates in plain JS without JSX imports.
const ICONS = { Star, Mail, Workflow, Sparkles, Rocket, Target };

function TemplateCard({ template, selected, onSelect }) {
  const Icon = ICONS[template.icon] || Star;
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`template-card-${template.id}`}
      className={`group relative text-left rounded-2xl border bg-white px-5 py-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${
        selected
          ? "border-indigo-400 ring-2 ring-indigo-100 shadow-md"
          : "border-slate-200 hover:border-indigo-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
          selected ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
        }`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-heading font-semibold text-slate-900 text-sm leading-tight">{template.name}</p>
            {selected && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />}
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-3">
            {template.description}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function SearchTemplatePicker({ onSelectTemplate, onSkip }) {
  const [reverseProduct, setReverseProduct] = useState("");
  const [activeReverseId, setActiveReverseId] = useState(null);

  const handleSelect = (template) => {
    if (template.mode === "reverse_search") {
      // Open the inline product-name input for this template
      setActiveReverseId(template.id);
      setReverseProduct("");
      return;
    }
    onSelectTemplate(template);
  };

  const confirmReverseSearch = (template) => {
    const generated = reverseSearchKeywordsFor(reverseProduct);
    if (generated.length === 0) return;
    onSelectTemplate({ ...template, keywords: generated });
  };

  return (
    <div
      className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-6 sm:p-8"
      data-testid="search-template-picker"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-600 font-semibold mb-1">
            Step 1
          </p>
          <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 leading-tight">
            Start from a template
          </h2>
          <p className="text-sm text-slate-500 mt-1.5 max-w-xl">
            Pre-configured starting points tuned for SaaS affiliate prospecting. Pick one and edit any field before running the search — or skip and start from scratch.
          </p>
        </div>
      </div>

      {/* Template grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {SEARCH_TEMPLATES.map((t) => (
          <div key={t.id} className="flex flex-col">
            <TemplateCard
              template={t}
              selected={activeReverseId === t.id}
              onSelect={() => handleSelect(t)}
            />
            {/* Inline reverse-search input — only when this card is active */}
            {activeReverseId === t.id && t.mode === "reverse_search" && (
              <div
                className="mt-2 rounded-xl border border-indigo-200 bg-white p-3"
                data-testid="reverse-search-input-block"
              >
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                  Product name
                </label>
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={reverseProduct}
                    onChange={(e) => setReverseProduct(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmReverseSearch(t);
                      }
                    }}
                    placeholder={t.product_placeholder || "Product name"}
                    className="h-9 text-sm"
                    data-testid="reverse-search-product-input"
                  />
                  <Button
                    size="sm"
                    onClick={() => confirmReverseSearch(t)}
                    disabled={!reverseProduct.trim()}
                    className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white"
                    data-testid="reverse-search-confirm"
                  >
                    Use
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
                {reverseProduct.trim() && (
                  <p className="text-[11px] text-slate-500 mt-2 leading-snug">
                    Will generate keywords:{" "}
                    {reverseSearchKeywordsFor(reverseProduct).map((k) => (
                      <span key={k} className="inline-block bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 mr-1 mt-1 font-mono text-[10px]">{k}</span>
                    ))}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Custom / scratch card */}
        <button
          type="button"
          onClick={onSkip}
          className="group rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-300 hover:bg-indigo-50/40 text-left px-5 py-4 transition-colors"
          data-testid="template-skip-custom"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center">
              <PenLine className="h-5 w-5 text-slate-500 group-hover:text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-semibold text-slate-900 text-sm">
                Custom search
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Start from a blank form with no presets applied.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
