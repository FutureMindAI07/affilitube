import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  Search as SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const REASON_LABELS = {
  excluded_list: "User-excluded channels",
  exclude_keyword: "Exclude keyword match",
  tier_max_results_cap: "Tier max-results cap",
  subscriber_range: "Subscriber range out of bounds",
  stale_upload: "Stale upload (recency filter)",
  language_heuristic: "Non-English (language heuristic)",
  country_filter: "Country / region filter",
  super_no_affiliate: "Super Search · no affiliate activity",
  super_too_few_links: "Super Search · fewer than 3 affiliate links",
  super_no_recent_affiliate: "Super Search · no recent affiliate (90d)",
  super_too_few_sponsored_videos: "Super Search · fewer than 3 sponsored videos",
  super_ai_reject: "Super Search · AI graded Reject",
};

const STAGE_TONE = {
  pre_enrichment: "bg-slate-100 text-slate-700 border-slate-200",
  enrichment: "bg-indigo-50 text-indigo-700 border-indigo-100",
  post_enrichment: "bg-amber-50 text-amber-700 border-amber-100",
  super_search: "bg-rose-50 text-rose-700 border-rose-100",
};

function toCSV(drops) {
  const headers = ["channel_id", "channel_name", "reason", "reason_label", "stage", "detail"];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = [
    headers.join(","),
    ...drops.map((d) =>
      [
        d.channel_id || "",
        d.channel_name || "",
        d.reason || "",
        REASON_LABELS[d.reason] || d.reason || "",
        d.stage || "",
        d.detail || "",
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return rows.join("\n");
}

export default function DropLogPanel({ drops = [] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Sort reasons by frequency for display
  const summary = useMemo(() => {
    const map = new Map();
    drops.forEach((d) => {
      const key = d.reason || "unknown";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [drops]);

  const filteredDrops = useMemo(() => {
    if (!search.trim()) return drops;
    const q = search.toLowerCase();
    return drops.filter(
      (d) =>
        (d.channel_name || "").toLowerCase().includes(q) ||
        (d.channel_id || "").toLowerCase().includes(q) ||
        (REASON_LABELS[d.reason] || d.reason || "").toLowerCase().includes(q) ||
        (d.detail || "").toLowerCase().includes(q)
    );
  }, [drops, search]);

  const downloadCSV = () => {
    const csv = toCSV(drops);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affilitube-dropped-channels-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!drops || drops.length === 0) return null;

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white"
      data-testid="drop-log-panel"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors rounded-2xl"
        data-testid="drop-log-toggle"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">
              {drops.length} channel{drops.length === 1 ? "" : "s"} dropped during this search
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {summary
                .slice(0, 3)
                .map(([reason, count]) => `${count} ${REASON_LABELS[reason] || reason}`)
                .join(" · ")}
              {summary.length > 3 ? ` · +${summary.length - 3} more` : ""}
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {/* Summary chips */}
          <div className="px-5 py-4 flex flex-wrap items-center gap-2">
            {summary.map(([reason, count]) => (
              <Badge
                key={reason}
                className="bg-slate-100 text-slate-700 border-slate-200 rounded-full px-3 py-1 text-xs font-medium hover:bg-slate-200"
                data-testid={`drop-summary-${reason}`}
              >
                <span className="font-mono font-bold text-slate-900 mr-1.5">{count}</span>
                {REASON_LABELS[reason] || reason}
              </Badge>
            ))}
            <div className="ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={downloadCSV}
                className="gap-1.5 rounded-full h-8 text-xs"
                data-testid="drop-log-csv-btn"
              >
                <Download className="h-3.5 w-3.5" />
                Download dropped (CSV)
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 pb-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dropped channels by name, ID, reason or detail..."
                className="pl-9 h-9 text-sm"
                data-testid="drop-log-search"
              />
            </div>
          </div>

          {/* Table */}
          <div className="max-h-80 overflow-y-auto border-t border-slate-100">
            {filteredDrops.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                No drops match your search.
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="drop-log-table">
                <thead className="sticky top-0 bg-white border-b border-slate-100">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2 font-semibold">Channel</th>
                    <th className="px-3 py-2 font-semibold">Stage</th>
                    <th className="px-3 py-2 font-semibold">Reason</th>
                    <th className="px-5 py-2 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrops.slice(0, 500).map((d, idx) => (
                    <tr
                      key={`${d.channel_id || "noid"}-${idx}`}
                      className="border-b border-slate-50 hover:bg-slate-50/50"
                    >
                      <td className="px-5 py-2.5 align-top">
                        <div className="font-medium text-slate-800">
                          {d.channel_name || <span className="italic text-slate-400">(no name)</span>}
                        </div>
                        {d.channel_id && (
                          <a
                            href={`https://www.youtube.com/channel/${d.channel_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-mono text-indigo-600 hover:underline"
                          >
                            {d.channel_id}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span
                          className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${STAGE_TONE[d.stage] || "bg-slate-100 border-slate-200 text-slate-700"}`}
                        >
                          {(d.stage || "").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top text-slate-700 text-xs">
                        {REASON_LABELS[d.reason] || d.reason}
                      </td>
                      <td className="px-5 py-2.5 align-top text-slate-500 text-xs">
                        {d.detail || <span className="italic text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {filteredDrops.length > 500 && (
              <p className="text-[11px] text-slate-400 text-center py-2">
                Showing first 500 — use the CSV download for the full list.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
