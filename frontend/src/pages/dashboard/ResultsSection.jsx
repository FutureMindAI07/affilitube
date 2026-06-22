/**
 * ResultsSection — extracted from Dashboard.jsx (Phase 6 refactor).
 *
 * Renders the live results card:
 *   • Card header with title, Re-Enrich, Save Report, Export Shortlist/All, Shortlist counter
 *   • Drop Log (admin only)
 *   • Filter Bar (Min Score, Country, Show Rejected, High Affiliate, Has Platform Links,
 *     Status, Engagement, Sort by, Sort order)
 *   • Results Table (scrollable, sortable, with per-row shortlist checkbox and row click → detail)
 *   • Pagination
 *   • In-progress enrichment indicator inside the card
 *
 * Behaviour is unchanged. State and callbacks owned by Dashboard.jsx, passed via props.
 *
 * Component receives a single `props` bag to keep the surface small; destructured inside.
 */
import {
  Filter,
  ListChecks,
  RefreshCw,
  Loader2,
  CheckCircle2,
  FileText,
  Download,
  Lock,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Link as LinkIcon,
  ShoppingBag,
  Mail,
  Wrench,
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  Activity,
  Handshake,
  Gift,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CountryFilter from "@/components/CountryFilter";
import SaveReportDialog from "@/pages/dashboard/dialogs/SaveReportDialog";
import DropLogPanel from "@/components/DropLogPanel";
import { getScoreClass, getAffiliateScoreClass, formatNumber } from "@/lib/formatters";
import { OUTREACH_STATUS_CONFIG } from "@/lib/outreachConfig";
import { ENGAGEMENT_HEALTH_CONFIG, UPLOAD_CONSISTENCY_ICONS } from "@/lib/healthIndicators";
import { flagEmoji, countryName } from "@/lib/countries";

// Link alias preserved for code inside that uses `<Link …>` from lucide
const Link = LinkIcon;

export default function ResultsSection(props) {
  const {
    // data
    channels, isSearching, isEnriching, sortedChannels, paginatedChannels, rawSearchResults,
    shortlist, isFreeUser, user, dropLog,
    // dialog state
    saveReportOpen, setSaveReportOpen, reportName, setReportName,
    setUpgradeDialogOpen,
    // search context (for save report dialog)
    keywords, minSubs, maxSubs,
    // filter state
    filterMinScore, setFilterMinScore,
    filterHighAffiliate, setFilterHighAffiliate,
    filterHasPlatformLinks, setFilterHasPlatformLinks,
    filterOutreachStatus, setFilterOutreachStatus,
    filterEngagementHealth, setFilterEngagementHealth,
    resultsCountries, setResultsCountries,
    resultsIncludeUnknown, setResultsIncludeUnknown,
    sortBy, setSortBy, sortOrder, setSortOrder,
    showRejected, setShowRejected,
    rejectedCount, hasAnyAIGrade,
    superSearch,
    // pagination
    currentPage, setCurrentPage, totalPages, pageSize,
    // callbacks
    runEnrichment, exportCSV, saveReport,
    openChannelDetail, openPipelineDialog, toggleShortlist,
  } = props;

  return (
    <>
        {/* Results Section */}
        {(channels.length > 0 || isSearching || isEnriching) && (
          <Card className="glass-card" data-testid="results-section">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-heading">
                    <ListChecks className="h-5 w-5 text-indigo-500" />
                    Results
                    {channels.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {sortedChannels.length} channels
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Click a row to view details. Check to add to shortlist.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {/* Re-Enrich Button */}
                  {rawSearchResults && channels.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={runEnrichment}
                            disabled={isEnriching}
                            data-testid="re-enrich-btn"
                          >
                            {isEnriching ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Re-Enrich
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Re-enrich with different Advanced Settings (no new search needed)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="gap-1.5 cursor-default rounded-full border-indigo-200 bg-indigo-50/50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          Shortlist: {shortlist.size}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Selected channels for export
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {/* Save Report Dialog */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!isFreeUser && sortedChannels.length === 0}
                    onClick={() => {
                      if (isFreeUser) {
                        setUpgradeDialogOpen(true);
                      } else {
                        setSaveReportOpen(true);
                      }
                    }}
                    className={isFreeUser ? "opacity-50" : ""}
                    data-testid="save-report-btn"
                  >
                    {isFreeUser ? <Lock className="h-4 w-4 mr-2 text-muted-foreground" /> : <FileText className="h-4 w-4 mr-2" />}
                    Save Report
                  </Button>
                  <SaveReportDialog
                    open={saveReportOpen}
                    onOpenChange={setSaveReportOpen}
                    reportName={reportName}
                    setReportName={setReportName}
                    channelsCount={sortedChannels.length}
                    shortlistCount={shortlist.size}
                    keywords={keywords}
                    minSubs={minSubs}
                    maxSubs={maxSubs}
                    onSave={saveReport}
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isFreeUser) {
                        setUpgradeDialogOpen(true);
                      } else {
                        exportCSV(true);
                      }
                    }}
                    disabled={!isFreeUser && shortlist.size === 0}
                    className={isFreeUser ? "opacity-50" : ""}
                    data-testid="export-shortlist-btn"
                  >
                    {isFreeUser ? <Lock className="h-4 w-4 mr-2 text-muted-foreground" /> : <Download className="h-4 w-4 mr-2" />}
                    Export Shortlist
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isFreeUser) {
                        setUpgradeDialogOpen(true);
                      } else {
                        exportCSV(false);
                      }
                    }}
                    disabled={!isFreeUser && sortedChannels.length === 0}
                    className={isFreeUser ? "opacity-50" : ""}
                    data-testid="export-all-btn"
                  >
                    {isFreeUser ? <Lock className="h-4 w-4 mr-2 text-muted-foreground" /> : <Download className="h-4 w-4 mr-2" />}
                    Export All
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Drop Log (admin only) */}
            {user?.role === "admin" && <DropLogPanel drops={dropLog} />}

            {/* Filter Bar */}
            <div className="filter-bar">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="filter-score" className="text-sm">
                  Min Score:
                </Label>
                <Input
                  id="filter-score"
                  type="number"
                  value={filterMinScore}
                  onChange={(e) => setFilterMinScore(Number(e.target.value))}
                  className="w-20 h-8"
                  min={0}
                  max={100}
                  data-testid="filter-score-input"
                />
              </div>
              <Separator orientation="vertical" className="h-6" />
              {/* Country filter */}
              <CountryFilter
                value={resultsCountries}
                onChange={setResultsCountries}
                includeUnknown={resultsIncludeUnknown}
                onIncludeUnknownChange={setResultsIncludeUnknown}
                compact
                testId="results-country-filter"
              />
              <Separator orientation="vertical" className="h-6" />
              {/* Show Rejected (AI grade) toggle — admin + Super Search only */}
              {hasAnyAIGrade && rejectedCount > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show-rejected"
                      checked={showRejected}
                      onCheckedChange={setShowRejected}
                      data-testid="show-rejected-checkbox"
                    />
                    <Label htmlFor="show-rejected" className="text-sm cursor-pointer">
                      Show rejected ({rejectedCount})
                    </Label>
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                </>
              )}
              {/* High Affiliate Potential Filter */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-affiliate"
                  checked={filterHighAffiliate}
                  onCheckedChange={setFilterHighAffiliate}
                  data-testid="filter-affiliate-checkbox"
                />
                <Label htmlFor="filter-affiliate" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  High Affiliate Potential
                </Label>
              </div>
              <Separator orientation="vertical" className="h-6" />
              {/* Has Platform Links Filter */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-platform-links"
                  checked={filterHasPlatformLinks}
                  onCheckedChange={setFilterHasPlatformLinks}
                  data-testid="filter-platform-links-checkbox"
                />
                <Label htmlFor="filter-platform-links" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Link className="h-3.5 w-3.5 text-teal-500" />
                  Has Platform Links
                </Label>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <Label htmlFor="filter-outreach" className="text-sm">
                  Status:
                </Label>
                <Select value={filterOutreachStatus} onValueChange={setFilterOutreachStatus}>
                  <SelectTrigger id="filter-outreach" className="w-40 h-8" data-testid="filter-outreach-select">
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
                <Label htmlFor="filter-engagement" className="text-sm">
                  Engagement:
                </Label>
                <Select value={filterEngagementHealth} onValueChange={setFilterEngagementHealth}>
                  <SelectTrigger id="filter-engagement" className="w-32 h-8" data-testid="filter-engagement-select">
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
                <Label htmlFor="sort-by" className="text-sm">
                  Sort by:
                </Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger
                    id="sort-by"
                    className="w-44 h-8"
                    data-testid="sort-by-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai_grade">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        AI Grade (Super Search)
                      </span>
                    </SelectItem>
                    <SelectItem value="score_total">Total Score</SelectItem>
                    <SelectItem value="affiliate_score">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        Affiliate Score
                      </span>
                    </SelectItem>
                    <SelectItem value="subscriber_count">Subscribers</SelectItem>
                    <SelectItem value="avg_views_recent">Avg Views</SelectItem>
                    <SelectItem value="days_since_upload">
                      Days Since Upload
                    </SelectItem>
                    <SelectItem value="score_engagement">Engagement</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger
                    className="w-28 h-8"
                    data-testid="sort-order-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Table */}
            <CardContent className="p-0">
              {isSearching && channels.length === 0 ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                <ScrollArea className="h-[500px]">
                  <Table data-testid="results-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
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
                        {superSearch && user?.role === "admin" && (
                          <>
                            <TableHead className="w-16">Grade</TableHead>
                            <TableHead className="w-24">Sp. Ratio</TableHead>
                            <TableHead className="w-24">Last Aff</TableHead>
                          </>
                        )}
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedChannels.map((channel) => (
                        <TableRow
                          key={channel.channel_id}
                          className="table-row-hover"
                          onClick={() => openChannelDetail(channel)}
                          data-testid={`channel-row-${channel.channel_id}`}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={shortlist.has(channel.channel_id)}
                              onCheckedChange={() =>
                                toggleShortlist(channel.channel_id)
                              }
                              data-testid={`shortlist-checkbox-${channel.channel_id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${getScoreClass(
                                channel.score_total
                              )} font-mono`}
                            >
                              {channel.score_total}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${getAffiliateScoreClass(
                                channel.affiliate_score || 0
                              )} font-mono`}
                            >
                              {channel.affiliate_score || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                {channel.ai_assessment?.grade && (
                                  <Badge
                                    className={`font-mono font-bold text-[10px] px-1.5 py-0 ${
                                      channel.ai_assessment.grade === "A" ? "bg-emerald-500 text-white border-0"
                                      : channel.ai_assessment.grade === "B" ? "bg-indigo-500 text-white border-0"
                                      : channel.ai_assessment.grade === "C" ? "bg-amber-400 text-amber-950 border-0"
                                      : channel.ai_assessment.grade === "Reject" ? "bg-red-100 text-red-700 border border-red-200"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                                    }`}
                                    title={channel.ai_assessment.reason || channel.ai_assessment.grade}
                                  >
                                    {channel.ai_assessment.grade === "Ungraded" ? "—" : channel.ai_assessment.grade}
                                  </Badge>
                                )}
                                <span className="font-medium truncate max-w-[180px]">
                                  {channel.channel_name}
                                </span>
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
                                {channel.country && (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-[10px] text-slate-500"
                                    title={countryName(channel.country)}
                                  >
                                    <span className="text-xs leading-none">{flagEmoji(channel.country)}</span>
                                    <span className="font-mono">{channel.country}</span>
                                  </span>
                                )}
                                {channel.tools_section_detected && (
                                  <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap">
                                    Likely Affiliate
                                  </span>
                                )}
                              </div>
                              {superSearch && channel.ai_assessment?.reason && (
                                <p className="text-[10px] text-indigo-500 truncate max-w-[200px]" title={channel.ai_assessment.reason}>
                                  {channel.ai_assessment.reason}
                                </p>
                              )}
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
                            <div className="flex flex-wrap gap-1">
                              {channel.affiliate_platforms_found?.map(
                                (platform) => (
                                  <span key={platform} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700 border border-teal-200">
                                    <Link className="h-2.5 w-2.5" />
                                    {platform}
                                  </span>
                                )
                              )}
                              {channel.affiliate_signals?.slice(0, 2).map(
                                (sig) => (
                                  <span key={sig} className="tag tag-signal">
                                    {sig}
                                  </span>
                                )
                              )}
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
                                  <Badge className={`${cfg.color} text-[10px] px-1.5 py-0.5 whitespace-nowrap cursor-default`} data-testid={`status-badge-${channel.channel_id}`}>
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
                                  data-testid={`add-pipeline-btn-${channel.channel_id}`}
                                >
                                  {isFreeUser ? <Lock className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                  Pipeline
                                </Button>
                              );
                            })()}
                          </TableCell>
                          {superSearch && user?.role === "admin" && (
                            <>
                              <TableCell>
                                {channel.ai_assessment ? (
                                  <div className="flex flex-col items-start gap-0.5">
                                    <Badge className={`text-[10px] px-1.5 py-0 font-bold ${
                                      channel.ai_assessment.grade === "A" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                      channel.ai_assessment.grade === "B" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                      channel.ai_assessment.grade === "C" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                      "bg-slate-100 text-slate-500 border-slate-200"
                                    }`} data-testid={`ai-grade-${channel.channel_id}`} title={channel.ai_assessment.reason || ""}>
                                      {channel.ai_assessment.grade}
                                    </Badge>
                                    {channel.competitor_brand_overlap && (
                                      <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] px-1 py-0" title={`Competitors: ${(channel.competitor_brands_found || []).join(", ")}`}>
                                        Competitor
                                      </Badge>
                                    )}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-center">
                                {channel.sponsored_video_ratio || "-"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {channel.affiliate_recency_label || "-"}
                              </TableCell>
                            </>
                          )}
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t bg-slate-50/60" data-testid="pagination-controls">
                    <p className="text-sm text-slate-500">
                      Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedChannels.length)} of {sortedChannels.length}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="rounded-full h-8 w-8 p-0" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} data-testid="page-first">
                        <ChevronRight className="h-4 w-4 rotate-180" /><ChevronRight className="h-4 w-4 rotate-180 -ml-2.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full h-8 w-8 p-0" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} data-testid="page-prev">
                        <ChevronRight className="h-4 w-4 rotate-180" />
                      </Button>
                      <span className="text-sm font-medium px-3 text-slate-700">
                        {currentPage} / {totalPages}
                      </span>
                      <Button variant="outline" size="sm" className="rounded-full h-8 w-8 p-0" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} data-testid="page-next">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full h-8 w-8 p-0" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} data-testid="page-last">
                        <ChevronRight className="h-4 w-4" /><ChevronRight className="h-4 w-4 -ml-2.5" />
                      </Button>
                    </div>
                  </div>
                )}
                </>
              )}
            </CardContent>
          </Card>
        )}
    </>
  );
}
