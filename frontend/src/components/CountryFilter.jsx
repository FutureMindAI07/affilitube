import { useMemo, useState } from "react";
import { ChevronDown, X, Globe, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ALL_COUNTRIES,
  COUNTRY_PRESETS,
  countryName,
  flagEmoji,
} from "@/lib/countries";

/**
 * Reusable multi-select country/region filter.
 *
 * Props:
 *  - value: string[] of ISO codes ("US", "GB", ...)
 *  - onChange: (codes: string[]) => void
 *  - includeUnknown: bool
 *  - onIncludeUnknownChange: (b: bool) => void   (optional — hides the toggle if omitted)
 *  - compact: bool                                (smaller pill trigger, used above results)
 *  - label: string                                (trigger label, default "Country")
 *  - testId: string                               (root data-testid)
 */
export default function CountryFilter({
  value = [],
  onChange,
  includeUnknown = true,
  onIncludeUnknownChange,
  compact = false,
  label = "Country",
  testId = "country-filter",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(value.map((c) => c.toUpperCase())), [value]);

  const toggleCode = (code) => {
    const next = new Set(selectedSet);
    if (next.has(code)) next.delete(code); else next.add(code);
    onChange(Array.from(next));
  };

  const applyPreset = (codes) => {
    onChange(Array.from(new Set([...selectedSet, ...codes])));
  };

  const clearAll = () => onChange([]);

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_COUNTRIES;
    const q = query.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query]);

  const triggerText = () => {
    if (value.length === 0) return `Any ${label.toLowerCase()}`;
    if (value.length === 1) return `${flagEmoji(value[0])} ${countryName(value[0])}`;
    return `${value.length} countries`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`justify-between gap-2 ${compact ? "h-9 rounded-full text-sm" : "h-10 w-full"}`}
          data-testid={`${testId}-trigger`}
        >
          <span className="flex items-center gap-2 truncate">
            <Globe className="h-4 w-4 text-slate-500 shrink-0" />
            <span className="truncate">{triggerText()}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0" data-testid={`${testId}-panel`}>
        {/* Presets */}
        <div className="p-3 border-b border-slate-100">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">Quick presets</p>
          <div className="flex flex-wrap gap-1.5">
            {COUNTRY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.codes)}
                className="inline-flex items-center gap-1.5 text-xs rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 px-3 py-1.5 transition-colors"
                data-testid={`${testId}-preset-${p.id}`}
              >
                <span>{p.flag}</span>
                <span>{p.label}</span>
              </button>
            ))}
            {value.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-xs rounded-full text-slate-500 hover:text-red-600 px-3 py-1.5"
                data-testid={`${testId}-clear`}
              >
                <X className="h-3 w-3" />
                Clear ({value.length})
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries..."
              className="h-8 pl-8 text-sm"
              data-testid={`${testId}-search`}
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-60 overflow-y-auto py-1" data-testid={`${testId}-list`}>
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400">No matches.</div>
          ) : (
            filtered.map((c) => {
              const checked = selectedSet.has(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => toggleCode(c.code)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:bg-slate-50 ${checked ? "bg-indigo-50/50" : ""}`}
                  data-testid={`${testId}-option-${c.code}`}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleCode(c.code)} className="pointer-events-none" />
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate text-slate-700">{c.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{c.code}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Include unknown toggle */}
        {onIncludeUnknownChange && (
          <div className="border-t border-slate-100 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 leading-snug">
              <Checkbox
                checked={includeUnknown}
                onCheckedChange={onIncludeUnknownChange}
                className="mt-0.5"
                data-testid={`${testId}-include-unknown`}
              />
              <span>
                <span className="font-medium text-slate-700">Include channels with no declared country</span>
                <span className="block text-slate-400 mt-0.5">
                  Around 20–40% of creators don't fill in their country on YouTube.
                </span>
              </span>
            </label>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
