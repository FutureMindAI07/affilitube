/**
 * HistoricalReportView — extracted from Dashboard.jsx (Phase 6 refactor).
 *
 * Fullscreen overlay (fixed inset-0 z-50) shown when the user opens a saved
 * historical report from the History dialog. Includes:
 *   • Back button + report header (name, created date, channel count)
 *   • Export CSV button (gated for Free users)
 *   • Report info card (totals, keywords, filters used)
 *   • Filter bar (separate `reportFilter*` state from the live results)
 *   • Sortable, paginated table with the saved channels
 *
 * Behaviour is unchanged. State and callbacks owned by Dashboard.jsx, passed via props.
 *
 * NOTE: This view shares ~50% of its table/filter markup with the live ResultsSection
 * but has its own chrome (header, export-only actions, no enrichment / save / shortlist
 * controls). A future polish pass could extract shared inner pieces (FilterBar,
 * TableRow) — see Phase 7 backlog. Not done here intentionally.
 */
import {
  ArrowLeft,
  Plus,
  Activity,
  Handshake,
  Gift,
  CheckCircle2,
  Filter,
  FileText,
  Download,
  Lock,
  Sparkles,
  Link as LinkIcon,
  ShoppingBag,
  Mail,
  Wrench,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getScoreClass, getAffiliateScoreClass, formatNumber } from "@/lib/formatters";
import { OUTREACH_STATUS_CONFIG } from "@/lib/outreachConfig";
import { ENGAGEMENT_HEALTH_CONFIG, UPLOAD_CONSISTENCY_ICONS, computeHealthIndicators } from "@/lib/healthIndicators";
import { selectVisiblePlatforms, platformLabelFor } from "@/lib/affiliatePlatformDisplay";

const Link = LinkIcon;

export default function HistoricalReportView(props) {
  const {
    viewingReport,
    closeReportView,
    isFreeUser,
    setUpgradeDialogOpen,
    exportCSV,
    reportFilterMinScore, setReportFilterMinScore,
    reportFilterHighAffiliate, setReportFilterHighAffiliate,
    reportFilterHasPlatformLinks, setReportFilterHasPlatformLinks,
    reportFilterOutreachStatus, setReportFilterOutreachStatus,
    reportFilterEngagementHealth, setReportFilterEngagementHealth,
    reportSortBy, setReportSortBy,
    reportSortOrder, setReportSortOrder,
    reportPage, setReportPage,
    pageSize,
    openPipelineDialog,
    openChannelDetail,
    user, superSearch,
  } = props;

  return (
        <div className="fixed inset-0 z-50 bg-background" data-testid="report-view">
          {/* Report Header */}
          <header className="h-16 border-b border-slate-100/50 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl sticky top-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={closeReportView}
                data-testid="close-report-btn"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-lg font-heading font-semibold">{viewingReport.name}</h1>
                <p className="text-xs text-muted-foreground">
                  Saved {new Date(viewingReport.created_at).toLocaleDateString()} • {viewingReport.channels_count} channels
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Historical Report
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isFreeUser) {
                    setUpgradeDialogOpen(true);
                  } else {
                    exportCSV(false, viewingReport.channels);
                  }
                }}
                className={isFreeUser ? "opacity-50" : ""}
                data-testid="export-report-btn"
              >
                {isFreeUser ? <Lock className="h-4 w-4 mr-2 text-muted-foreground" /> : <Download className="h-4 w-4 mr-2" />}
                Export CSV
              </Button>
            </div>
          </header>

          {/* Report Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Report Info */}
            <Card className="mb-6 glass-card">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Channels</p>
                    <p className="text-2xl font-bold">{viewingReport.channels_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Keywords Used</p>
                    <p className="text-2xl font-bold">{viewingReport.keywords?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subscriber Range</p>
                    <p className="text-lg font-semibold">
                      {viewingReport.filters?.min_subscribers?.toLocaleString()} - {viewingReport.filters?.max_subscribers?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Shortlisted</p>
                    <p className="text-2xl font-bold">{viewingReport.shortlisted_ids?.length || 0}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Keywords:</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingReport.keywords?.map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Results Table — Full Parity with Live Table */}
            {(() => {
              const reportChannels = (viewingReport.channels || [])
                .map(computeHealthIndicators)
                .filter((ch) => ch.score_total >= reportFilterMinScore)
                .filter((ch) => !reportFilterHighAffiliate || (ch.affiliate_score >= 60))
                .filter((ch) => !reportFilterHasPlatformLinks || (ch.affiliate_platforms_found?.length > 0))
                .filter((ch) => reportFilterOutreachStatus === "all" || (ch.outreach_status || "not_contacted") === reportFilterOutreachStatus)
                .filter((ch) => reportFilterEngagementHealth === "all" || (ch.engagement_health || "") === reportFilterEngagementHealth)
                .sort((a, b) => {
                  const aVal = a[reportSortBy] || 0;
                  const bVal = b[reportSortBy] || 0;
                  return reportSortOrder === "desc" ? bVal - aVal : aVal - bVal;
                });
              const reportTotalPages = Math.ceil(reportChannels.length / pageSize);
              const reportPaginated = reportChannels.slice((reportPage - 1) * pageSize, reportPage * pageSize);

              return (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-heading">Channels</CardTitle>
                        <CardDescription>
                          {reportChannels.length} channels
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Filter Bar */}
                  <div className="filter-bar">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Filters:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="report-filter-score" className="text-sm">Min Score:</Label>
                      <Input
                        id="report-filter-score"
                        type="number"
                        value={reportFilterMinScore}
                        onChange={(e) => { setReportFilterMinScore(Number(e.target.value)); setReportPage(1); }}
                        className="w-20 h-8"
                        min={0}
                        max={100}
                        data-testid="report-filter-score-input"
                      />
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="report-filter-affiliate"
                        checked={reportFilterHighAffiliate}
                        onCheckedChange={(v) => { setReportFilterHighAffiliate(v); setReportPage(1); }}
                        data-testid="report-filter-affiliate-checkbox"
                      />
                      <Label htmlFor="report-filter-affiliate" className="text-sm cursor-pointer flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        High Affiliate Potential
                      </Label>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="report-filter-platform-links"
                        checked={reportFilterHasPlatformLinks}
                        onCheckedChange={(v) => { setReportFilterHasPlatformLinks(v); setReportPage(1); }}
                        data-testid="report-filter-platform-links-checkbox"
                      />
                      <Label htmlFor="report-filter-platform-links" className="text-sm cursor-pointer flex items-center gap-1.5">
                        <Link className="h-3.5 w-3.5 text-teal-500" />
                        Has Platform Links
                      </Label>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <div className="flex items-center gap-2">
                      <Label htmlFor="report-filter-outreach" className="text-sm">Status:</Label>
                      <Select value={reportFilterOutreachStatus} onValueChange={(v) => { setReportFilterOutreachStatus(v); setReportPage(1); }}>
                        <SelectTrigger id="report-filter-outreach" className="w-40 h-8" data-testid="report-filter-outreach-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {Object.entries(OUTREACH_STATUS_CONFIG).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <div className="flex items-center gap-2">
                      <Label htmlFor="report-filter-engagement" className="text-sm">Engagement:</Label>
                      <Select value={reportFilterEngagementHealth} onValueChange={(v) => { setReportFilterEngagementHealth(v); setReportPage(1); }}>
                        <SelectTrigger id="report-filter-engagement" className="w-32 h-8" data-testid="report-filter-engagement-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="Healthy">Healthy</SelectItem>
                          <SelectItem value="Average">Average</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Very Low">Very Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <div className="flex items-center gap-2">
                      <Label htmlFor="report-sort-by" className="text-sm">Sort by:</Label>
                      <Select value={reportSortBy} onValueChange={(v) => { setReportSortBy(v); setReportPage(1); }}>
                        <SelectTrigger id="report-sort-by" className="w-44 h-8" data-testid="report-sort-by-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score_total">Total Score</SelectItem>
                          <SelectItem value="affiliate_score">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                              Affiliate Score
                            </span>
                          </SelectItem>
                          <SelectItem value="subscriber_count">Subscribers</SelectItem>
                          <SelectItem value="avg_views_recent">Avg Views</SelectItem>
                          <SelectItem value="days_since_upload">Days Since Upload</SelectItem>
                          <SelectItem value="score_engagement">Engagement</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={reportSortOrder} onValueChange={(v) => { setReportSortOrder(v); setReportPage(1); }}>
                        <SelectTrigger className="w-28 h-8" data-testid="report-sort-order-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">Descending</SelectItem>
                          <SelectItem value="asc">Ascending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      <Table data-testid="report-results-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Score</TableHead>
                            <TableHead className="w-20">
                              <span className="flex items-center gap-1">
                                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                                Aff
                              </span>
                            </TableHead>
                            <TableHead>Channel</TableHead>
                            <TableHead className="text-right">Subscribers</TableHead>
                            <TableHead className="text-right">Avg Views</TableHead>
                            <TableHead className="text-right">Last Upload</TableHead>
                            <TableHead>Topics</TableHead>
                            <TableHead>Signals</TableHead>
                            <TableHead className="w-20">Health</TableHead>
                            <TableHead className="w-28">Status</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportPaginated.map((channel) => (
                            <TableRow
                              key={channel.channel_id}
                              className={`table-row-hover ${viewingReport.shortlisted_ids?.includes(channel.channel_id) ? 'bg-primary/5' : ''}`}
                              onClick={() => {
                                openChannelDetail(channel);
                              }}
                              data-testid={`report-row-${channel.channel_id}`}
                            >
                              <TableCell>
                                <Badge className={`${getScoreClass(channel.score_total)} font-mono`}>
                                  {channel.score_total}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={`${getAffiliateScoreClass(channel.affiliate_score || 0)} font-mono`}>
                                  {channel.affiliate_score || 0}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium truncate max-w-[180px]">
                                      {channel.channel_name}
                                    </span>
                                    {viewingReport.shortlisted_ids?.includes(channel.channel_id) && (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                    )}
                                    {channel.has_affiliate_language && (
                                      <Link className="h-3 w-3 text-purple-500" />
                                    )}
                                    {channel.product_monetization && (
                                      <ShoppingBag className="h-3 w-3 text-amber-500" />
                                    )}
                                    {(channel.brand_contact_signals_count > 0 || channel.has_business_email) && (
                                      <Handshake className="h-3 w-3 text-emerald-500" />
                                    )}
                                    {channel.has_business_email && (
                                      <Mail className="h-3 w-3 text-blue-500" />
                                    )}
                                    {channel.tools_section_detected && (
                                      <Wrench className="h-3 w-3 text-orange-500" />
                                    )}
                                    {channel.sponsorship_data?.is_sponsored_active && (
                                      <Gift className="h-3 w-3 text-pink-500" title="Sponsorships detected" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                      {channel.keywords_found_by?.join(", ")}
                                    </span>
                                    {channel.tools_section_detected && (
                                      <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap">
                                        Likely Affiliate
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {channel.hidden_subscriber_count
                                  ? "Hidden"
                                  : formatNumber(channel.subscriber_count)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatNumber(channel.avg_views_recent)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {channel.days_since_upload !== null
                                  ? `${channel.days_since_upload}d ago`
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {channel.topic_tags?.slice(0, 2).map((tag) => (
                                    <span key={tag} className="tag tag-topic">
                                      {tag}
                                    </span>
                                  ))}
                                  {channel.topic_tags?.length > 2 && (
                                    <span className="tag tag-topic">
                                      +{channel.topic_tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1" data-testid={`report-affiliate-platforms-cell-${channel.channel_id}`}>
                                  {(() => {
                                    const { visible, hiddenCount, hiddenLabels } = selectVisiblePlatforms(
                                      channel.affiliate_platforms_found, 2
                                    );
                                    if (visible.length > 0) {
                                      return (
                                        <>
                                          {visible.map((platform) => (
                                            <span
                                              key={platform}
                                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700 border border-teal-200"
                                              title={platformLabelFor(platform)}
                                            >
                                              <Link className="h-2.5 w-2.5" />
                                              {platformLabelFor(platform)}
                                            </span>
                                          ))}
                                          {hiddenCount > 0 && (
                                            <span
                                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 cursor-default"
                                              title={hiddenLabels}
                                            >
                                              +{hiddenCount}
                                            </span>
                                          )}
                                        </>
                                      );
                                    }
                                    if ((channel.affiliate_links_total || 0) > 0) {
                                      return (
                                        <span
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                                          title="Affiliate links detected but no named network matched. Open channel for details."
                                        >
                                          <Link className="h-2.5 w-2.5" />
                                          {channel.affiliate_links_total} aff link{channel.affiliate_links_total === 1 ? "" : "s"}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {channel.affiliate_signals?.slice(0, 2).map((sig) => (
                                    <span key={sig} className="tag tag-signal">
                                      {sig}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {channel.engagement_health && (
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${ENGAGEMENT_HEALTH_CONFIG[channel.engagement_health]?.dot || "bg-slate-300"}`} title={`Engagement: ${channel.engagement_health}`}></span>
                                  )}
                                  {["Daily", "Very Active", "Active"].includes(channel.upload_consistency) && (
                                    <Activity className={`h-3 w-3 shrink-0 ${UPLOAD_CONSISTENCY_ICONS[channel.upload_consistency]}`} title={channel.upload_consistency} />
                                  )}
                                  {channel.growth_indicator === "Growing" && <ArrowUp className="h-3 w-3 text-emerald-500 shrink-0" title="Growing" />}
                                  {channel.growth_indicator === "Declining" && <ArrowDown className="h-3 w-3 text-red-500 shrink-0" title="Declining" />}
                                  {channel.growth_indicator === "Stable" && <Minus className="h-3 w-3 text-slate-400 shrink-0" title="Stable" />}
                                </div>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                {(() => {
                                  const st = channel.outreach_status || "not_contacted";
                                  const inPipeline = st !== "not_contacted";
                                  const cfg = OUTREACH_STATUS_CONFIG[st] || OUTREACH_STATUS_CONFIG.not_contacted;
                                  if (inPipeline) {
                                    return (
                                      <Badge className={`${cfg.color} text-[10px] px-1.5 py-0.5 whitespace-nowrap cursor-default`} data-testid={`report-status-badge-${channel.channel_id}`}>
                                        {cfg.label}
                                      </Badge>
                                    );
                                  }
                                  return (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={`h-7 text-xs gap-1 ${isFreeUser ? "opacity-50 text-muted-foreground border-muted" : "text-indigo-600 border-indigo-200 hover:bg-indigo-50"}`}
                                      onClick={() => isFreeUser ? setUpgradeDialogOpen(true) : openPipelineDialog(channel)}
                                      data-testid={`report-add-pipeline-btn-${channel.channel_id}`}
                                    >
                                      {isFreeUser ? <Lock className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                      Pipeline
                                    </Button>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    {/* Pagination */}
                    {reportTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-muted-foreground">
                          Page {reportPage} of {reportTotalPages} ({reportChannels.length} channels)
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={reportPage <= 1} onClick={() => setReportPage(reportPage - 1)}>
                            Previous
                          </Button>
                          <Button variant="outline" size="sm" disabled={reportPage >= reportTotalPages} onClick={() => setReportPage(reportPage + 1)}>
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </main>
        </div>
  );
}
