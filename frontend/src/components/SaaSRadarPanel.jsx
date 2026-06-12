import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  RefreshCw,
  ExternalLink,
  Mail,
  Twitter,
  AlertTriangle,
  Sparkles,
  Globe,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Send,
} from "lucide-react";

const API = `${import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL}/api`;

const BUCKET_COLORS = {
  yellow: "bg-amber-100 text-amber-800 border-amber-200",
  green: "bg-emerald-100 text-emerald-800 border-emerald-200",
  red: "bg-rose-100 text-rose-700 border-rose-200",
  unknown: "bg-slate-100 text-slate-600 border-slate-200",
};

const BUCKET_LABELS = {
  yellow: "Yellow · No aff. prog (best fit)",
  green: "Green · Has aff. prog",
  red: "Red · No paid pricing",
  unknown: "Unknown",
};

const VERDICT_META = {
  customer: { label: "Customer", icon: ThumbsUp, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  pass: { label: "Pass", icon: ThumbsDown, color: "text-rose-700 bg-rose-50 border-rose-200" },
  later: { label: "Later", icon: Bookmark, color: "text-amber-700 bg-amber-50 border-amber-200" },
  sent: { label: "Sent", icon: Send, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
};

export default function SaaSRadarPanel({ token }) {
  const api = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [bucketFilter, setBucketFilter] = useState("");
  const [hasEmail, setHasEmail] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score_desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Ingest form
  const [daysBack, setDaysBack] = useState(90);
  const [ingestRunning, setIngestRunning] = useState(false);
  const [enrichRunning, setEnrichRunning] = useState(false);
  const [enrichLimit, setEnrichLimit] = useState(100);
  const [useLlm, setUseLlm] = useState(false);
  const [usePlaywright, setUsePlaywright] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState("");
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState(null);
  const [liveIngestProgress, setLiveIngestProgress] = useState(null);
  const [liveEnrichProgress, setLiveEnrichProgress] = useState(null);
  const [ingestBaseline, setIngestBaseline] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const [statsRes, cfgRes] = await Promise.all([
        api.get("/admin/saas-radar/stats"),
        api.get("/admin/saas-radar/config"),
      ]);
      setStats(statsRes.data);
      setConfig(cfgRes.data);
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/saas-radar/products", {
        params: {
          bucket: bucketFilter || undefined,
          verdict: verdictFilter || undefined,
          has_email: hasEmail || undefined,
          search: search || undefined,
          sort: sortBy,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      });
      setProducts(res.data.products);
      setTotal(res.data.total);
    } catch (e) {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [bucketFilter, verdictFilter, hasEmail, search, sortBy, page, token]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadStats();
    loadProducts();
  }, [loadStats, loadProducts]);

  // Poll job status while a job is running
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ingestRunning && !enrichRunning) return undefined;
    const id = setInterval(async () => {
      try {
        const res = await api.get("/admin/saas-radar/jobs?limit=5");
        const jobs = res.data.jobs || [];
        const runningIngest = jobs.find((j) => j.kind === "ingest" && j.status === "running");
        const runningEnrich = jobs.find((j) => j.kind === "enrich" && j.status === "running");
        setLiveIngestProgress(runningIngest?.progress || null);
        setLiveEnrichProgress(runningEnrich?.progress || null);
        // Refresh stats every poll so the top counters tick up live as the job runs.
        loadStats();
        if (!runningIngest) setIngestRunning(false);
        if (!runningEnrich) setEnrichRunning(false);
        if (!runningIngest && !runningEnrich) {
          setLiveIngestProgress(null);
          setLiveEnrichProgress(null);
          loadProducts();
        }
      } catch (err) {
        console.warn("job poll failed", err);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [ingestRunning, enrichRunning, loadStats, loadProducts]);

  const runIngest = async () => {
    try {
      // Snapshot the current total so the user can see "started from X" while it runs.
      setIngestBaseline(stats?.total ?? 0);
      const res = await api.post("/admin/saas-radar/ingest", { days_back: Number(daysBack) });
      toast.success(`Ingest started · job ${res.data.job_id.slice(0, 8)}…`);
      setIngestRunning(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start ingest");
    }
  };

  const runEnrich = async () => {
    try {
      const res = await api.post("/admin/saas-radar/enrich", {
        limit: Number(enrichLimit),
        use_llm: useLlm,
        use_playwright: usePlaywright,
      });
      toast.success(`Enrichment started · ${enrichLimit} products${useLlm ? " · LLM ON" : ""}${usePlaywright ? " · Headless ON" : ""}`);
      setEnrichRunning(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start enrichment");
    }
  };

  const cancelStuck = async () => {
    if (!window.confirm("Force-cancel all running ingest/enrich jobs? Existing data is preserved; you can Run Ingest again to resume.")) return;
    try {
      const res = await api.post("/admin/saas-radar/cancel-stuck");
      toast.success(`Cancelled ${res.data.cancelled} stuck job(s)`);
      setIngestRunning(false);
      setEnrichRunning(false);
      setLiveIngestProgress(null);
      setLiveEnrichProgress(null);
      loadStats();
    } catch (e) {
      toast.error("Failed to cancel");
    }
  };

  const setVerdict = async (phId, verdict) => {
    try {
      await api.patch(`/admin/saas-radar/products/${phId}/verdict`, { verdict });
      // Optimistically update locally
      setProducts((prev) => prev.map((p) => (p.ph_id === phId ? { ...p, verdict } : p)));
      loadStats();
    } catch (e) {
      toast.error("Failed to save verdict");
    }
  };

  const runDiagnose = async () => {
    setDiagnosing(true);
    setDiagResult(null);
    try {
      const res = await api.get("/admin/saas-radar/diagnose");
      setDiagResult(res.data);
    } catch (e) {
      setDiagResult({ ok: false, stage: "client", error: e.message });
    } finally {
      setDiagnosing(false);
    }
  };

  const exportCsv = async () => {    try {
      const res = await api.get("/admin/saas-radar/products.csv", {
        params: {
          bucket: bucketFilter || undefined,
          has_email: hasEmail || undefined,
        },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `saas-radar-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Export failed");
    }
  };

  const deleteProduct = async (phId) => {
    if (!window.confirm("Delete this prospect?")) return;
    try {
      await api.delete(`/admin/saas-radar/products/${phId}`);
      toast.success("Deleted");
      loadProducts();
      loadStats();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : "—");

  return (
    <div className="space-y-6" data-testid="saas-radar-panel">
      {/* Header + Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                SaaS Radar
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Pre-validation
                </Badge>
              </CardTitle>
              <CardDescription>
                Discover potential AffiliTube customers from ProductHunt launches.
                Yellow = paid SaaS w/o affiliate program (best fit). Green = already runs one.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { loadStats(); loadProducts(); }} data-testid="radar-refresh">
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={runDiagnose} disabled={diagnosing} data-testid="radar-diagnose">
                <AlertTriangle className="h-4 w-4 mr-2" /> {diagnosing ? "Testing…" : "Diagnose"}
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} data-testid="radar-export">
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {config && config.token_configured === false && (
            <div className="flex items-start gap-2 text-sm text-rose-900 bg-rose-50 border border-rose-200 rounded-md px-3 py-2.5" data-testid="radar-token-missing">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-600" />
              <div>
                <div className="font-semibold mb-0.5">ProductHunt token not configured on this server.</div>
                <div className="text-xs">
                  Ingest will fail until the <code className="bg-rose-100 px-1 rounded">PRODUCTHUNT_TOKEN</code> environment variable is set
                  in the backend. On Emergent: open this app → <b>Settings → Environment Variables</b> → add
                  <code className="bg-rose-100 px-1 mx-1 rounded">PRODUCTHUNT_TOKEN</code> with the value from your
                  <a href="https://api.producthunt.com/v2/oauth/applications" target="_blank" rel="noreferrer" className="underline ml-1">PH developer dashboard</a>,
                  then redeploy.
                </div>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: "yellow", label: "Yellow", hint: "Paid, no aff. prog" },
              { key: "green", label: "Green", hint: "Has aff. prog" },
              { key: "red", label: "Red", hint: "No paid pricing" },
              { key: "unknown", label: "Unknown", hint: "Not yet checked" },
              { key: "with_emails", label: "With Email", hint: "Contact found" },
            ].map((s) => (
              <div
                key={s.key}
                className={`rounded-lg border px-3 py-2.5 ${
                  s.key === "with_emails"
                    ? "bg-indigo-50 border-indigo-200"
                    : BUCKET_COLORS[s.key] || "bg-slate-50"
                }`}
              >
                <div className="text-2xl font-bold leading-none">
                  {stats
                    ? s.key === "with_emails"
                      ? stats.with_emails
                      : stats.buckets?.[s.key] || 0
                    : "—"}
                </div>
                <div className="text-xs font-medium mt-1">{s.label}</div>
                <div className="text-[10px] opacity-70">{s.hint}</div>
              </div>
            ))}
          </div>

          {/* Verdict counts */}
          {stats?.verdicts && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="text-slate-500">Verdicts:</span>
              {Object.entries(VERDICT_META).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <button
                    type="button"
                    key={key}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${meta.color} hover:opacity-80`}
                    onClick={() => { setVerdictFilter(key); setPage(0); }}
                    data-testid={`radar-verdict-stat-${key}`}
                  >
                    <Icon className="h-3 w-3" />
                    <b>{stats.verdicts[key] || 0}</b> {meta.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Action row */}
          <div className="grid md:grid-cols-2 gap-3 pt-2">
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-indigo-600" />
                <div className="text-sm font-semibold">Ingest from ProductHunt</div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={daysBack}
                  onChange={(e) => setDaysBack(e.target.value)}
                  className="w-24 h-9"
                  data-testid="radar-days-input"
                />
                <span className="text-xs text-slate-500">days back</span>
                <Button
                  size="sm"
                  onClick={runIngest}
                  disabled={ingestRunning}
                  className="ml-auto"
                  data-testid="radar-ingest-btn"
                >
                  {ingestRunning ? "Running…" : "Run Ingest"}
                </Button>
              </div>
              {ingestRunning && liveIngestProgress && (
                <div className="text-[11px] text-indigo-700 mt-2 space-y-0.5">
                  {ingestBaseline !== null && (
                    <div className="text-slate-600">
                      Started from <b>{ingestBaseline.toLocaleString()}</b> existing products
                      {stats?.total !== undefined && stats.total !== ingestBaseline && (
                        <span> · now at <b className="text-indigo-700">{stats.total.toLocaleString()}</b> (+{(stats.total - ingestBaseline).toLocaleString()} new)</span>
                      )}
                    </div>
                  )}
                  {liveIngestProgress.stage && <div className="font-medium">{liveIngestProgress.stage}</div>}
                  <div>
                    This run: {liveIngestProgress.seen || 0} seen · {liveIngestProgress.new || 0} new (in this chunk)
                  </div>
                  {liveIngestProgress.stage && liveIngestProgress.stage.includes("paused") && (
                    <div className="text-amber-700 text-[10px]">
                      ⏸ PH rate-limit pause is normal — the job is healthy and will resume automatically.
                      <br />Progress is already saved; you can leave this page and come back later.
                    </div>
                  )}
                  <button
                    type="button"
                    className="text-rose-600 text-[10px] underline hover:text-rose-800 mt-1"
                    onClick={cancelStuck}
                    data-testid="radar-cancel-stuck"
                  >
                    force-cancel (use if stuck after a deploy)
                  </button>
                </div>
              )}
              {!ingestRunning && stats?.last_ingest && (
                <div className="text-[11px] mt-2">
                  {stats.last_ingest.error ? (
                    <span className="text-rose-700">
                      Last failed: {stats.last_ingest.error}
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      Last: {fmtDate(stats.last_ingest.updated_at)} ·{" "}
                      {stats.last_ingest.result?.new || 0} new ·{" "}
                      {stats.last_ingest.result?.seen || 0} seen
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-indigo-600" />
                <div className="text-sm font-semibold">Enrich websites (pricing + affiliate detection)</div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={enrichLimit}
                  onChange={(e) => setEnrichLimit(e.target.value)}
                  className="w-24 h-9"
                  data-testid="radar-enrich-input"
                />
                <span className="text-xs text-slate-500">products / batch</span>
                <Button
                  size="sm"
                  onClick={runEnrich}
                  disabled={enrichRunning}
                  className="ml-auto"
                  data-testid="radar-enrich-btn"
                >
                  {enrichRunning ? "Running…" : "Run Enrich"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-700">
                <label className="inline-flex items-center gap-1.5 cursor-pointer" data-testid="radar-llm-toggle">
                  <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} className="h-3 w-3" />
                  <span>GPT-4o-mini reclassify (~$0.0001/product)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer" data-testid="radar-pw-toggle">
                  <input type="checkbox" checked={usePlaywright} onChange={(e) => setUsePlaywright(e.target.checked)} className="h-3 w-3" />
                  <span>Headless browser redirect fallback <span className="text-amber-700">(slow, usually CF-blocked)</span></span>
                </label>
              </div>
              {enrichRunning && liveEnrichProgress && (
                <div className="text-[11px] text-indigo-700 mt-2">
                  Enriching… {JSON.stringify(liveEnrichProgress)}
                </div>
              )}
              {stats?.last_enrich && (
                <div className="text-[11px] mt-2">
                  {stats.last_enrich.error ? (
                    <span className="text-rose-700">
                      Last failed: {stats.last_enrich.error}
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      Last: {fmtDate(stats.last_enrich.updated_at)} ·{" "}
                      processed {stats.last_enrich.result?.processed || 0}
                      {stats.last_enrich.result?.use_llm ? " · LLM ON" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Diagnose result */}
          {diagResult && (
            <div
              className={`border rounded-md p-3 text-xs space-y-2 ${
                diagResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
              data-testid="radar-diag-result"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  Diagnose · {diagResult.ok ? "All layers OK" : "Issue detected"}
                </div>
                <button type="button" className="text-xs underline" onClick={() => setDiagResult(null)}>dismiss</button>
              </div>
              {diagResult.steps ? (
                <div className="space-y-1.5">
                  {diagResult.steps.map((s, i) => (
                    <div key={i} className="border-l-2 pl-2 py-0.5" style={{ borderColor: s.ok ? "#10b981" : "#e11d48" }}>
                      <div className="font-mono text-[11px]">
                        {s.ok ? "✓" : "✗"} <b>{s.step}</b>
                        {s.error && <span className="ml-2 text-rose-700">{s.error}</span>}
                      </div>
                      {s.detail && (
                        <details className="mt-0.5">
                          <summary className="cursor-pointer text-[10px] opacity-70">details</summary>
                          <pre className="bg-white/60 p-2 rounded mt-1 text-[10px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(s.detail, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  HTTP: <code>{diagResult.http_status || "—"}</code>{" "}
                  Stage: <code>{diagResult.stage}</code>{" "}
                  {diagResult.error && <span>Error: <code className="bg-white/50 px-1 rounded">{diagResult.error}</code></span>}
                </div>
              )}
            </div>
          )}

          {/* Heads-up note */}
          <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              ProductHunt wraps website links in tracking redirects that are often blocked
              from cloud server IPs. Products that can&apos;t be auto-resolved are marked
              <span className="font-semibold"> Unknown</span> with note{" "}
              <code className="bg-amber-100 px-1 rounded">ph_redirect_blocked</code>.
              Click the PH link to inspect them manually — they still surface valuable metadata
              (name, makers, topics, votes).
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Bucket</label>
              <Select value={bucketFilter || "_all"} onValueChange={(v) => { setBucketFilter(v === "_all" ? "" : v); setPage(0); }}>
                <SelectTrigger className="h-9" data-testid="radar-bucket-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All buckets</SelectItem>
                  <SelectItem value="yellow,green">Yellow + Green (best)</SelectItem>
                  <SelectItem value="yellow">Yellow only</SelectItem>
                  <SelectItem value="green">Green only</SelectItem>
                  <SelectItem value="red">Red only</SelectItem>
                  <SelectItem value="unknown">Unknown only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Verdict</label>
              <Select value={verdictFilter || "_all"} onValueChange={(v) => { setVerdictFilter(v === "_all" ? "" : v); setPage(0); }}>
                <SelectTrigger className="h-9" data-testid="radar-verdict-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All</SelectItem>
                  <SelectItem value="unset">Unjudged</SelectItem>
                  <SelectItem value="customer">👍 Customer</SelectItem>
                  <SelectItem value="pass">👎 Pass</SelectItem>
                  <SelectItem value="later">🔖 Later</SelectItem>
                  <SelectItem value="sent">📧 Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Sort by</label>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(0); }}>
                <SelectTrigger className="h-9" data-testid="radar-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score_desc">Score (high to low)</SelectItem>
                  <SelectItem value="posted_desc">Posted newest</SelectItem>
                  <SelectItem value="posted_asc">Posted oldest</SelectItem>
                  <SelectItem value="votes_desc">PH votes</SelectItem>
                  <SelectItem value="name_asc">Name A→Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Search</label>
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="name / tagline / domain…"
                className="h-9"
                data-testid="radar-search"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant={hasEmail ? "default" : "outline"}
                size="sm"
                onClick={() => { setHasEmail(!hasEmail); setPage(0); }}
                className="h-9 w-full"
                data-testid="radar-email-toggle"
              >
                <Mail className="h-4 w-4 mr-2" />
                {hasEmail ? "Email found ✓" : "Has email"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Prospects · {total.toLocaleString()} result{total === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500 space-y-2" data-testid="radar-empty">
              <div>No prospects match the current filter.</div>
              {(bucketFilter && bucketFilter !== "_all" && stats?.total > 0) && (
                <button
                  type="button"
                  className="text-indigo-600 hover:underline text-xs"
                  onClick={() => { setBucketFilter(""); setPage(0); }}
                >
                  Clear bucket filter to see all {stats.total.toLocaleString()} ingested products →
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto" data-testid="radar-products-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-right">Score</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Maker / Twitter</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="whitespace-nowrap">Posted</TableHead>
                    <TableHead className="text-right">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.ph_id} data-testid={`radar-row-${p.ph_id}`}>
                      <TableCell className="text-right font-semibold align-top pt-3">
                        <Badge
                          variant="outline"
                          className={`${BUCKET_COLORS[p.bucket] || ""} font-mono`}
                        >
                          {p.score || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top pt-3 max-w-xs">
                        <div className="font-medium text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {p.tagline}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(p.topics || []).slice(0, 3).map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 font-normal"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="align-top pt-3">
                        <div className="flex flex-col gap-1 text-xs">
                          <Badge
                            variant="outline"
                            className={`${BUCKET_COLORS[p.bucket] || ""} w-fit`}
                          >
                            {BUCKET_LABELS[p.bucket] || p.bucket}
                          </Badge>
                          <div className="text-[11px] text-slate-600 space-y-0.5 mt-1">
                            {p.has_pricing && <div>· Paid pricing detected</div>}
                            {p.multiple_paid_tiers && <div>· Multiple tiers</div>}
                            {p.has_affiliate_program && (
                              <div>
                                · Aff. prog
                                {p.affiliate_platform_detected
                                  ? ` (${p.affiliate_platform_detected})`
                                  : ""}
                              </div>
                            )}
                            {(p.notes || []).map((n) => (
                              <div key={n} className="text-amber-700">
                                ! {n}
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top pt-3">
                        {(p.makers || []).slice(0, 2).map((m, i) => (
                          <div key={i} className="text-xs">
                            <span className="text-slate-700">{m.name || m.username}</span>
                            {m.twitter_username && (
                              <a
                                href={`https://x.com/${m.twitter_username}`}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 text-sky-600 hover:underline inline-flex items-center gap-0.5"
                              >
                                <Twitter className="h-3 w-3" />@{m.twitter_username}
                              </a>
                            )}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="align-top pt-3">
                        {(p.emails_found || []).length > 0 ? (
                          <a
                            href={`mailto:${p.emails_found[0]}`}
                            className="text-xs text-indigo-600 hover:underline break-all"
                          >
                            {p.emails_found[0]}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top pt-3 whitespace-nowrap text-xs text-slate-600">
                        {fmtDate(p.posted_at)}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          ▲ {p.votes_count || 0}
                        </div>
                      </TableCell>
                      <TableCell className="align-top pt-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {p.ph_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              asChild
                              data-testid={`radar-ph-${p.ph_id}`}
                            >
                              <a href={p.ph_url} target="_blank" rel="noreferrer" title="Open on ProductHunt">
                                PH <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          )}
                          {p.website_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              asChild
                              data-testid={`radar-site-${p.ph_id}`}
                            >
                              <a href={p.website_url} target="_blank" rel="noreferrer" title="Open website">
                                Site <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          )}
                          {p.affiliate_program_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-emerald-700"
                              asChild
                              data-testid={`radar-aff-${p.ph_id}`}
                            >
                              <a href={p.affiliate_program_url} target="_blank" rel="noreferrer" title="Open affiliate page">
                                Aff <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-rose-600 hover:bg-rose-50"
                            onClick={() => deleteProduct(p.ph_id)}
                            data-testid={`radar-del-${p.ph_id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {/* Verdict row */}
                        <div className="flex items-center justify-end gap-1 mt-1">
                          {Object.entries(VERDICT_META).map(([key, meta]) => {
                            const Icon = meta.icon;
                            const active = p.verdict === key;
                            return (
                              <Button
                                key={key}
                                size="sm"
                                variant="ghost"
                                className={`h-6 px-1.5 text-[10px] ${active ? meta.color + " border" : "text-slate-400 hover:text-slate-700"}`}
                                onClick={() => setVerdict(p.ph_id, active ? null : key)}
                                title={meta.label}
                                data-testid={`radar-verdict-${key}-${p.ph_id}`}
                              >
                                <Icon className="h-3 w-3" />
                              </Button>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="text-xs text-slate-500">
                Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  data-testid="radar-prev"
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  onClick={() => setPage((p) => p + 1)}
                  data-testid="radar-next"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
