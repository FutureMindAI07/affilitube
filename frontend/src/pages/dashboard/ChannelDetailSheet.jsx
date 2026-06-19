/**
 * ChannelDetailSheet — extracted from Dashboard.jsx (Phase 4 refactor).
 *
 * Renders the side sheet that opens when a user clicks a channel in the
 * results table. Includes all sub-sections:
 *   • Score Breakdown
 *   • Outreach Tracking (status, follow-up date, contact note, contact log)
 *   • Affiliate Potential (signals, badges, business email, platform links)
 *   • Statistics
 *   • Channel Health (upload frequency, engagement, growth)
 *   • Tags & Signals
 *   • Contact Links
 *   • Recent Videos
 *   • Description
 *   • Brand Intelligence (sponsorship confidence, brands, disclosure videos)
 *   • Notes
 *   • Action footer (Add to Pipeline, Shortlist, View Channel, Exclude)
 *
 * Behaviour is unchanged. All state and write actions live in the parent
 * (Dashboard) and are passed via props — no Context, no global store.
 *
 * NOTE: A separate ChannelDetailSheet exists under /components/ for the
 * Pipeline page. Unifying them is a future task — this refactor does not
 * touch that file.
 */
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  ExternalLink,
  Handshake,
  Sparkles,
  Plus,
  Lock,
  CheckCircle2,
  ListChecks,
  Youtube,
  XCircle,
  MessageSquare,
  Activity,
  Gift,
  ArrowUp,
  ArrowDown,
  Minus,
  Link as LinkIcon,
  ShoppingBag,
  Mail,
  Wrench,
  Loader2,
  ExternalLink as ExternalLinkIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OUTREACH_STATUS_CONFIG } from "@/lib/outreachConfig";
import { ENGAGEMENT_HEALTH_CONFIG } from "@/lib/healthIndicators";
import { getScoreClass, getAffiliateScoreClass, formatNumber } from "@/lib/formatters";

export default function ChannelDetailSheet({
  open,
  onOpenChange,
  channel,
  outreachStatusUpdating,
  followUpDateUpdating,
  contactNoteText,
  setContactNoteText,
  shortlist,
  isFreeUser,
  onUpgradePrompt,
  sponsorshipLoading,
  sponsorshipData,
  userUsage,
  onUpdateOutreachStatus,
  onUpdateFollowUpDate,
  onUpdateNotes,
  onOpenPipelineDialog,
  onToggleShortlist,
  onExcludeChannel,
}) {
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-lg overflow-y-auto"
        data-testid="channel-detail-sheet"
      >
        {channel && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {channel.channel_name}
                <a
                  href={channel.channel_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </SheetTitle>
              <SheetDescription>
                {channel.search_source === "both"
                  ? "Found via channel & video search"
                  : `Found via ${channel.search_source?.replace("_", " ")}`}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              {/* Score Summary */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Score Breakdown</h4>
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={`${getScoreClass(channel.score_total)} text-lg px-3 py-1`}>
                    {channel.score_total}/100
                  </Badge>
                  <span className="text-sm text-muted-foreground">Total Score</span>
                  <Badge className={`${getAffiliateScoreClass(channel.affiliate_score || 0)} text-lg px-3 py-1`}>
                    {channel.affiliate_score || 0}/100
                  </Badge>
                  <span className="text-sm text-muted-foreground">Affiliate Score</span>
                </div>
                <div className="score-breakdown">
                  <div className="score-item">
                    <span className="text-xs">Topic Relevance</span>
                    <span className="font-mono text-sm">{channel.score_topic}/30</span>
                  </div>
                  <div className="score-item">
                    <span className="text-xs">Tutorial Intent</span>
                    <span className="font-mono text-sm">{channel.score_tutorial}/20</span>
                  </div>
                  <div className="score-item">
                    <span className="text-xs">Activity</span>
                    <span className="font-mono text-sm">{channel.score_activity}/15</span>
                  </div>
                  <div className="score-item">
                    <span className="text-xs">Subscriber Fit</span>
                    <span className="font-mono text-sm">{channel.score_subscriber}/15</span>
                  </div>
                  <div className="score-item">
                    <span className="text-xs">Engagement</span>
                    <span className="font-mono text-sm">{channel.score_engagement}/10</span>
                  </div>
                  <div className="score-item">
                    <span className="text-xs">Contactability</span>
                    <span className="font-mono text-sm">{channel.score_contactability}/10</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Outreach Tracking */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-indigo-500" />
                  Outreach Tracking
                </h4>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
                    <Select
                      value={channel.outreach_status || "not_contacted"}
                      onValueChange={(val) => onUpdateOutreachStatus(channel.channel_id, val, null)}
                      disabled={outreachStatusUpdating}
                    >
                      <SelectTrigger className="h-9" data-testid="detail-outreach-status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(OUTREACH_STATUS_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${cfg.color.split(" ")[0]}`}></span>
                              {cfg.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Follow-Up Date</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={channel.follow_up_date || ""}
                        onChange={(e) => onUpdateFollowUpDate(channel.channel_id, e.target.value ? new Date(e.target.value + "T00:00:00") : null)}
                        disabled={followUpDateUpdating}
                        className="h-9 flex-1"
                        data-testid="detail-follow-up-date"
                      />
                      {channel.follow_up_date && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onUpdateFollowUpDate(channel.channel_id, null)}
                          className="h-9 px-2 text-slate-400 hover:text-red-500"
                          data-testid="clear-follow-up-date"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Add Contact Note</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a note about this contact..."
                        value={contactNoteText}
                        onChange={(e) => setContactNoteText(e.target.value)}
                        className="h-9 flex-1"
                        data-testid="detail-contact-note-input"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && contactNoteText.trim()) {
                            onUpdateOutreachStatus(channel.channel_id, channel.outreach_status || "contacted", contactNoteText.trim());
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-9"
                        disabled={!contactNoteText.trim() || outreachStatusUpdating}
                        onClick={() => onUpdateOutreachStatus(channel.channel_id, channel.outreach_status || "contacted", contactNoteText.trim())}
                        data-testid="detail-add-note-btn"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {channel.contact_log?.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Contact Log</Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {[...channel.contact_log].reverse().map((entry, i) => {
                          const entryCfg = OUTREACH_STATUS_CONFIG[entry.status] || OUTREACH_STATUS_CONFIG.not_contacted;
                          return (
                            <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-md bg-slate-50 border border-slate-100">
                              <Badge className={`${entryCfg.color} text-[9px] px-1.5 py-0 shrink-0 mt-0.5`}>{entryCfg.label}</Badge>
                              <div className="flex-1 min-w-0">
                                {entry.note && <p className="text-slate-700 break-words">{entry.note}</p>}
                                <p className="text-slate-400 mt-0.5">
                                  {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Affiliate Signals */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Affiliate Potential
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-3 rounded-md bg-purple-50 border border-purple-100">
                    <p className="text-xs text-purple-600">Affiliate Signals</p>
                    <p className="font-mono text-lg font-semibold text-purple-700">
                      {channel.affiliate_signals_count || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-amber-50 border border-amber-100">
                    <p className="text-xs text-amber-600">Commercial Signals</p>
                    <p className="font-mono text-lg font-semibold text-amber-700">
                      {channel.commercial_signals_count || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-emerald-50 border border-emerald-100">
                    <p className="text-xs text-emerald-600">Brand Contact Signals</p>
                    <p className="font-mono text-lg font-semibold text-emerald-700">
                      {channel.brand_contact_signals_count || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-blue-50 border border-blue-100">
                    <p className="text-xs text-blue-600">Business Email</p>
                    <p className="font-mono text-sm font-semibold text-blue-700">
                      {channel.has_business_email ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Yes
                        </span>
                      ) : "No"}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-orange-50 border border-orange-100">
                    <p className="text-xs text-orange-600">Tools Stack Score</p>
                    <p className="font-mono text-lg font-semibold text-orange-700">
                      {channel.tools_stack_signal_score || 0}/30
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {channel.has_affiliate_language && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      <LinkIcon className="h-3 w-3 mr-1" />
                      Has Affiliate Links
                    </Badge>
                  )}
                  {channel.does_reviews && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Does Reviews
                    </Badge>
                  )}
                  {channel.has_link_in_bio && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Link in Bio
                    </Badge>
                  )}
                  {channel.product_monetization && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      <ShoppingBag className="h-3 w-3 mr-1" />
                      Sells Products
                    </Badge>
                  )}
                  {(channel.brand_contact_signals_count > 0 || channel.has_business_email) && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <Handshake className="h-3 w-3 mr-1" />
                      Open to Brand Deals
                    </Badge>
                  )}
                  {channel.tools_section_detected && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      <Wrench className="h-3 w-3 mr-1" />
                      Likely Affiliate Creator
                    </Badge>
                  )}
                </div>

                {channel.business_email && (
                  <div className="p-3 rounded-md bg-blue-50 border border-blue-100 mb-3">
                    <p className="text-xs text-blue-600 mb-1">Business Email</p>
                    <a
                      href={`mailto:${channel.business_email}`}
                      className="text-sm text-blue-700 font-medium hover:underline flex items-center gap-1"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {channel.business_email}
                    </a>
                  </div>
                )}

                {channel.brand_contact_signals?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-2">Brand contact phrases found:</p>
                    <div className="flex flex-wrap gap-1">
                      {channel.brand_contact_signals.map((sig) => (
                        <span key={sig} className="tag bg-emerald-50 text-emerald-700 border-emerald-200">
                          {sig}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {channel.commercial_signals?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {channel.commercial_signals.map((sig) => (
                      <span key={sig} className="tag bg-amber-50 text-amber-700 border-amber-200">
                        {sig}
                      </span>
                    ))}
                  </div>
                )}

                {channel.tools_section_phrases?.length > 0 && (
                  <div className="mt-3 p-3 rounded-md bg-orange-50 border border-orange-100">
                    <p className="text-xs font-medium text-orange-700 mb-2 flex items-center gap-1">
                      <Wrench className="h-3.5 w-3.5" />
                      Tool Stack Phrases Detected
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {channel.tools_section_phrases.map((phrase) => (
                        <span key={phrase} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                          "{phrase}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {channel.affiliate_platforms_found?.length > 0 && (
                  <div className="mt-3 p-3 rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                    <p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      Affiliate Platform Links Found
                    </p>
                    <div className="space-y-2">
                      {channel.affiliate_platforms_found.map((platform) => (
                        <div key={platform}>
                          <p className="text-xs font-medium text-purple-600 capitalize">{platform}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {channel.affiliate_platform_links?.[platform]?.slice(0, 3).map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:text-purple-800 hover:underline truncate max-w-[200px] block"
                              >
                                {url.replace(/https?:\/\/(www\.)?/, '').substring(0, 40)}...
                              </a>
                            ))}
                            {(channel.affiliate_platform_links?.[platform]?.length || 0) > 3 && (
                              <span className="text-xs text-purple-500">
                                +{channel.affiliate_platform_links[platform].length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Stats */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Statistics</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Subscribers</p>
                    <p className="font-mono text-lg font-semibold">
                      {channel.hidden_subscriber_count ? "Hidden" : formatNumber(channel.subscriber_count)}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Avg Views (Recent)</p>
                    <p className="font-mono text-lg font-semibold">{formatNumber(channel.avg_views_recent)}</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Total Videos</p>
                    <p className="font-mono text-lg font-semibold">{formatNumber(channel.video_count)}</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Last Upload</p>
                    <p className="font-mono text-lg font-semibold">
                      {channel.days_since_upload !== null ? `${channel.days_since_upload}d ago` : "-"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Channel Health Indicators */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Channel Health
                </h4>
                <div className="grid grid-cols-1 gap-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Upload Frequency</p>
                      <p className="text-sm font-medium">{channel.upload_consistency || "Unknown"}</p>
                    </div>
                    {channel.upload_avg_days != null && (
                      <span className="text-xs text-muted-foreground">
                        ~{channel.upload_avg_days}d between uploads
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Engagement Health</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {channel.engagement_health && (
                          <Badge className={`${ENGAGEMENT_HEALTH_CONFIG[channel.engagement_health]?.color || "bg-slate-100 text-slate-600"} text-xs`}>
                            {channel.engagement_health}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {channel.engagement_rate != null && (
                      <span className="text-xs text-muted-foreground">
                        {channel.engagement_rate}% views/subs
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Growth Trend</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {channel.growth_indicator === "Growing" && <ArrowUp className="h-4 w-4 text-emerald-500" />}
                        {channel.growth_indicator === "Stable" && <Minus className="h-4 w-4 text-slate-400" />}
                        {channel.growth_indicator === "Declining" && <ArrowDown className="h-4 w-4 text-red-500" />}
                        <span className="text-sm font-medium">{channel.growth_indicator || "Unknown"}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">Recent vs lifetime avg</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tags */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Tags & Signals</h4>
                <div className="space-y-2">
                  {channel.topic_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {channel.topic_tags.map((tag) => (
                        <span key={tag} className="tag tag-topic">{tag}</span>
                      ))}
                    </div>
                  )}
                  {channel.affiliate_signals?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {channel.affiliate_signals.map((sig) => (
                        <span key={sig} className="tag tag-signal">{sig}</span>
                      ))}
                    </div>
                  )}
                  {channel.keywords_found_by?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Keywords: {channel.keywords_found_by.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Contact Links */}
              {Object.keys(channel.public_links || {}).length > 0 && (
                <>
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Contact Links</h4>
                    <div className="space-y-2">
                      {Object.entries(channel.public_links).map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </a>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Recent Videos */}
              {channel.recent_videos?.length > 0 && (
                <>
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Recent Videos</h4>
                    <div className="video-list">
                      {channel.recent_videos.map((video) => (
                        <div key={video.video_id} className="video-item">
                          <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{formatNumber(video.view_count)} views</span>
                            <span>{new Date(video.published_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Description */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {channel.description || "No description available"}
                </p>
              </div>

              <Separator />

              {/* Brand Intelligence */}
              <div data-testid="brand-intelligence-section">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-pink-500" />
                  Brand Intelligence
                </h4>
                {sponsorshipLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" data-testid="sponsorship-loading">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing last 10 videos...
                  </div>
                ) : sponsorshipData ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Sponsorship Confidence</span>
                      <Badge
                        className={`font-mono ${
                          sponsorshipData.confidence_score >= 60
                            ? "bg-pink-100 text-pink-700 border-pink-200"
                            : sponsorshipData.confidence_score >= 30
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                        data-testid="sponsorship-confidence"
                      >
                        {sponsorshipData.confidence_score}/100
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-slate-50 p-2 text-center">
                        <p className="text-lg font-bold text-slate-900">{sponsorshipData.detected_brands?.length || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Brands</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 text-center">
                        <p className="text-lg font-bold text-slate-900">{sponsorshipData.affiliate_link_count || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Aff Links</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 text-center">
                        <p className="text-lg font-bold text-slate-900">{sponsorshipData.videos_with_sponsorships?.length || 0}</p>
                        <p className="text-[10px] text-muted-foreground">of {sponsorshipData.videos_analyzed || 0} Videos</p>
                      </div>
                    </div>

                    {sponsorshipData.detected_brands?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Detected Past Partners</p>
                        {userUsage?.tier === "pro" || userUsage?.tier === "appsumo" ? (
                          <div className="flex flex-wrap gap-1" data-testid="brand-names-visible">
                            {sponsorshipData.detected_brands.map((brand) => (
                              <Badge key={brand} variant="outline" className="text-xs bg-pink-50 text-pink-700 border-pink-200">
                                {brand}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="relative" data-testid="brand-names-gated">
                            <div className="flex flex-wrap gap-1 blur-sm select-none pointer-events-none">
                              {sponsorshipData.detected_brands.map((brand) => (
                                <Badge key={brand} variant="outline" className="text-xs">
                                  {brand}
                                </Badge>
                              ))}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs bg-white/90 shadow-sm border-pink-200 text-pink-700 hover:bg-pink-50"
                                onClick={() => userUsage?.tier === "free" ? onUpgradePrompt() : navigate("/pricing")}
                                data-testid="brand-upgrade-btn"
                              >
                                <Lock className="h-3 w-3" />
                                {sponsorshipData.detected_brands.length} Brands Detected — Upgrade to Pro
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {sponsorshipData.videos_with_sponsorships?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Videos with Disclosures</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {sponsorshipData.videos_with_sponsorships.map((v) => (
                            <a
                              key={v.video_id}
                              href={`https://www.youtube.com/watch?v=${v.video_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 p-1.5 rounded-md hover:bg-slate-50 transition-colors group"
                              data-testid={`sponsorship-video-${v.video_id}`}
                            >
                              <ExternalLinkIcon className="h-3 w-3 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-slate-700 group-hover:text-primary line-clamp-1">{v.title}</p>
                                <p className="text-[10px] text-muted-foreground">{v.signals?.join(" · ")}</p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {!sponsorshipData.is_sponsored_active && (
                      <p className="text-xs text-muted-foreground italic py-2">No sponsorship signals detected in the last {sponsorshipData.videos_analyzed || 10} videos.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">Unable to load sponsorship data.</p>
                )}
              </div>

              <Separator />

              {/* Notes */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Notes</h4>
                <Textarea
                  placeholder="Add your notes about this channel..."
                  defaultValue={channel.notes || ""}
                  key={channel.channel_id}
                  onBlur={(e) => onUpdateNotes(channel.channel_id, e.target.value)}
                  rows={3}
                  className="text-sm"
                  data-testid="channel-notes-input"
                />
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-4">
                {(channel.outreach_status || "not_contacted") === "not_contacted" ? (
                  <Button
                    className={`w-full gap-2 ${isFreeUser ? "opacity-50 bg-muted text-muted-foreground hover:bg-muted" : "bg-indigo-600 hover:bg-indigo-700"}`}
                    onClick={() => isFreeUser ? onUpgradePrompt() : onOpenPipelineDialog(channel)}
                    data-testid="detail-add-pipeline-btn"
                  >
                    {isFreeUser ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Add to Pipeline
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                    <Handshake className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm font-medium text-indigo-700">In Pipeline</span>
                    {channel.project_name && (
                      <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600">{channel.project_name}</Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant={shortlist.has(channel.channel_id) ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => onToggleShortlist(channel.channel_id)}
                    data-testid="detail-shortlist-btn"
                  >
                    {shortlist.has(channel.channel_id) ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        In Shortlist
                      </>
                    ) : (
                      <>
                        <ListChecks className="h-4 w-4 mr-2" />
                        Add to Shortlist
                      </>
                    )}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={channel.channel_url} target="_blank" rel="noopener noreferrer">
                      <Youtube className="h-4 w-4 mr-2" />
                      View Channel
                    </a>
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                  onClick={() => onExcludeChannel(channel)}
                  data-testid="exclude-channel-btn"
                >
                  <XCircle className="h-4 w-4" />
                  Exclude from Searches
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

ChannelDetailSheet.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  channel: PropTypes.object,
  outreachStatusUpdating: PropTypes.bool,
  followUpDateUpdating: PropTypes.bool,
  contactNoteText: PropTypes.string.isRequired,
  setContactNoteText: PropTypes.func.isRequired,
  shortlist: PropTypes.object.isRequired, // Set instance
  isFreeUser: PropTypes.bool.isRequired,
  onUpgradePrompt: PropTypes.func.isRequired,
  sponsorshipLoading: PropTypes.bool,
  sponsorshipData: PropTypes.object,
  userUsage: PropTypes.object,
  onUpdateOutreachStatus: PropTypes.func.isRequired,
  onUpdateFollowUpDate: PropTypes.func.isRequired,
  onUpdateNotes: PropTypes.func.isRequired,
  onOpenPipelineDialog: PropTypes.func.isRequired,
  onToggleShortlist: PropTypes.func.isRequired,
  onExcludeChannel: PropTypes.func.isRequired,
};
