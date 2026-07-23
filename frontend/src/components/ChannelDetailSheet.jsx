import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { flagEmoji, countryName } from "@/lib/countries";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ExternalLink,
  Youtube,
  Mail,
  CheckCircle2,
  Handshake,
  MessageSquare,
  XCircle,
  Gift,
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  Lock,
} from "lucide-react";

const OUTREACH_STATUS_CONFIG = {
  not_contacted: { label: "Not Contacted", color: "bg-slate-100 text-slate-700 border-slate-200" },
  contacted: { label: "Contacted", color: "bg-blue-100 text-blue-700 border-blue-200" },
  replied: { label: "Replied", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  in_negotiation: { label: "In Negotiation", color: "bg-orange-100 text-orange-700 border-orange-200" },
  agreed: { label: "Agreed", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  declined: { label: "Declined", color: "bg-red-100 text-red-700 border-red-200" },
  no_response: { label: "No Response", color: "bg-slate-200 text-slate-600 border-slate-300" },
};

const ENGAGEMENT_HEALTH_CONFIG = {
  Healthy: { color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  Average: { color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  Low: { color: "bg-orange-100 text-orange-700 border-orange-200" },
  "Very Low": { color: "bg-red-100 text-red-700 border-red-200" },
};

const getScoreClass = (score) => {
  if (score >= 60) return "score-high";
  if (score >= 40) return "score-medium";
  return "score-low";
};

const getAffiliateScoreClass = (score) => {
  if (score >= 60) return "bg-purple-100 text-purple-700 border-purple-200";
  if (score >= 40) return "bg-violet-100 text-violet-700 border-violet-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
};

const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || "0";
};

export function ChannelDetailSheet({
  channel,
  open,
  onOpenChange,
  api,
  userTier,
  onStatusUpdate,
  onNotesUpdate,
  onUpgradeClick,
}) {
  const [sponsorshipData, setSponsorshipData] = useState(null);
  const [sponsorshipLoading, setSponsorshipLoading] = useState(false);
  const [contactNoteText, setContactNoteText] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    if (open && channel) {
      fetchSponsorshipData(channel.channel_id);
      setContactNoteText("");
    }
  }, [open, channel?.channel_id]);

  const fetchSponsorshipData = async (channelId) => {
    setSponsorshipData(null);
    setSponsorshipLoading(true);
    try {
      const res = await api.get(`/channels/${channelId}/sponsorship-data`);
      setSponsorshipData(res.data);
    } catch {
      setSponsorshipData(null);
    } finally {
      setSponsorshipLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus, note) => {
    if (!channel) return;
    setStatusUpdating(true);
    try {
      await api.patch(`/channels/${channel.channel_id}/outreach-status`, {
        status: newStatus,
        note: note || null,
      });
      if (onStatusUpdate) onStatusUpdate(channel.channel_id, newStatus, note);
      if (note) setContactNoteText("");
    } catch {
      // parent handles error
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleNotesUpdate = async (notes) => {
    if (!channel) return;
    try {
      await api.put(`/channels/${channel.channel_id}/notes`, { notes });
      if (onNotesUpdate) onNotesUpdate(channel.channel_id, notes);
    } catch {
      // silent
    }
  };

  const handleFollowUpDate = async (date) => {
    if (!channel) return;
    try {
      await api.patch(`/channels/${channel.channel_id}/follow-up-date`, {
        follow_up_date: date || null,
      });
      if (onStatusUpdate) onStatusUpdate();
    } catch {
      // silent
    }
  };

  const isPro = userTier === "pro" || userTier === "appsumo";

  if (!channel) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-lg overflow-y-auto"
        data-testid="pipeline-channel-detail-sheet"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {channel.channel_name}
            <a
              href={channel.channel_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </SheetTitle>
          <SheetDescription>
            <span className="inline-flex items-center gap-2">
              <span>{channel.subscriber_count?.toLocaleString()} subscribers</span>
              {channel.country && (
                <span className="inline-flex items-center gap-1 text-slate-500" title={countryName(channel.country)}>
                  <span>•</span>
                  <span className="leading-none">{flagEmoji(channel.country)}</span>
                  <span>{countryName(channel.country)}</span>
                </span>
              )}
            </span>
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
              <span className="text-sm text-muted-foreground">Total</span>
              <Badge className={`${getAffiliateScoreClass(channel.affiliate_score || 0)} text-lg px-3 py-1`}>
                {channel.affiliate_score || 0}/100
              </Badge>
              <span className="text-sm text-muted-foreground">Affiliate</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Topic", channel.score_topic, 30],
                ["Tutorial", channel.score_tutorial, 20],
                ["Activity", channel.score_activity, 15],
                ["Subscribers", channel.score_subscriber, 15],
                ["Engagement", channel.score_engagement, 10],
                ["Contact", channel.score_contactability, 10],
              ].map(([label, val, max]) => (
                <div key={label} className="p-2 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-mono text-sm font-medium">{val}/{max}</p>
                </div>
              ))}
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
                  onValueChange={(val) => handleStatusUpdate(val, null)}
                  disabled={statusUpdating}
                >
                  <SelectTrigger className="h-9" data-testid="pipeline-detail-outreach-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OUTREACH_STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${cfg.color.split(" ")[0]}`} />
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
                    onChange={(e) => handleFollowUpDate(e.target.value ? e.target.value : null)}
                    className="h-9 flex-1"
                    data-testid="pipeline-detail-follow-up-date"
                  />
                  {channel.follow_up_date && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFollowUpDate(null)}
                      className="h-9 px-2 text-slate-400 hover:text-red-500"
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
                    data-testid="pipeline-detail-contact-note-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && contactNoteText.trim()) {
                        handleStatusUpdate(channel.outreach_status || "contacted", contactNoteText.trim());
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-9"
                    disabled={!contactNoteText.trim() || statusUpdating}
                    onClick={() => handleStatusUpdate(channel.outreach_status || "contacted", contactNoteText.trim())}
                    data-testid="pipeline-detail-add-note-btn"
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
            <h4 className="text-sm font-semibold mb-3">Affiliate Potential</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-3 rounded-md bg-purple-50 border border-purple-100">
                <p className="text-xs text-purple-600">Affiliate Signals</p>
                <p className="font-mono text-lg font-semibold text-purple-700">{channel.affiliate_signals_count || 0}</p>
              </div>
              <div className="p-3 rounded-md bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-600">Commercial Signals</p>
                <p className="font-mono text-lg font-semibold text-amber-700">{channel.commercial_signals_count || 0}</p>
              </div>
              <div className="p-3 rounded-md bg-emerald-50 border border-emerald-100">
                <p className="text-xs text-emerald-600">Brand Contact</p>
                <p className="font-mono text-lg font-semibold text-emerald-700">{channel.brand_contact_signals_count || 0}</p>
              </div>
              <div className="p-3 rounded-md bg-blue-50 border border-blue-100">
                <p className="text-xs text-blue-600">Business Email</p>
                <p className="font-mono text-sm font-semibold text-blue-700">
                  {channel.has_business_email ? <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Yes</span> : "No"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {channel.has_affiliate_language && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Has Affiliate Links</Badge>
              )}
              {channel.does_reviews && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Does Reviews</Badge>
              )}
              {channel.has_link_in_bio && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Link in Bio</Badge>
              )}
              {(channel.brand_contact_signals_count > 0 || channel.has_business_email) && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Open to Brand Deals</Badge>
              )}
            </div>
            {channel.business_email && (
              <div className="p-3 rounded-md bg-blue-50 border border-blue-100 mb-3">
                <p className="text-xs text-blue-600 mb-1">Business Email</p>
                <a href={`mailto:${channel.business_email}`} className="text-sm text-blue-700 font-medium hover:underline flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {channel.business_email}
                </a>
              </div>
            )}
          </div>

          <Separator />

          {/* Statistics */}
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
                <p className="text-xs text-muted-foreground">Avg Views</p>
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

          {/* Channel Health */}
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
                  <span className="text-xs text-muted-foreground">~{channel.upload_avg_days}d between uploads</span>
                )}
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Engagement Health</p>
                  {channel.engagement_health && (
                    <Badge className={`${ENGAGEMENT_HEALTH_CONFIG[channel.engagement_health]?.color || "bg-slate-100 text-slate-600"} text-xs mt-0.5`}>
                      {channel.engagement_health}
                    </Badge>
                  )}
                </div>
                {channel.engagement_rate != null && (
                  <span className="text-xs text-muted-foreground">{channel.engagement_rate}% views/subs</span>
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
              </div>
            </div>
          </div>

          <Separator />

          {/* Tags & Signals */}
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
                    <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
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
                <div className="space-y-2">
                  {channel.recent_videos.map((video) => (
                    <div key={video.video_id} className="p-2 rounded-md bg-muted/30 border border-slate-100">
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
          <div data-testid="pipeline-brand-intelligence-section">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Gift className="h-4 w-4 text-pink-500" />
              Brand Intelligence
            </h4>
            {sponsorshipLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" data-testid="pipeline-sponsorship-loading">
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
                    data-testid="pipeline-sponsorship-confidence"
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
                    {isPro ? (
                      <div className="flex flex-wrap gap-1" data-testid="pipeline-brand-names-visible">
                        {sponsorshipData.detected_brands.map((brand) => (
                          <Badge key={brand} variant="outline" className="text-xs bg-pink-50 text-pink-700 border-pink-200">{brand}</Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="relative" data-testid="pipeline-brand-names-gated">
                        <div className="flex flex-wrap gap-1 blur-sm select-none pointer-events-none">
                          {sponsorshipData.detected_brands.map((brand) => (
                            <Badge key={brand} variant="outline" className="text-xs">{brand}</Badge>
                          ))}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs bg-white/90 shadow-sm border-pink-200 text-pink-700 hover:bg-pink-50"
                            onClick={() => onUpgradeClick && onUpgradeClick()}
                            data-testid="pipeline-brand-upgrade-btn"
                          >
                            <Lock className="h-3 w-3" />
                            {sponsorshipData.detected_brands.length} Brands — Upgrade to Pro
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {sponsorshipData.detected_promo_codes?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Active Codes</p>
                    {isPro ? (
                      <div className="flex flex-wrap gap-1" data-testid="pipeline-promo-codes-visible">
                        {sponsorshipData.detected_promo_codes.map((code) => (
                          <Badge
                            key={code}
                            variant="outline"
                            className="text-xs bg-amber-50 text-amber-800 border-amber-200 font-mono"
                          >
                            {code}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="relative" data-testid="pipeline-promo-codes-gated">
                        <div className="flex flex-wrap gap-1 blur-sm select-none pointer-events-none">
                          {sponsorshipData.detected_promo_codes.map((code) => (
                            <Badge key={code} variant="outline" className="text-xs font-mono">{code}</Badge>
                          ))}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs bg-white/90 shadow-sm border-amber-200 text-amber-800 hover:bg-amber-50"
                            onClick={() => onUpgradeClick && onUpgradeClick()}
                            data-testid="pipeline-promo-upgrade-btn"
                          >
                            <Lock className="h-3 w-3" />
                            {sponsorshipData.detected_promo_codes.length} Codes — Upgrade to Pro
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
                        >
                          <ExternalLink className="h-3 w-3 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0" />
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
              onBlur={(e) => handleNotesUpdate(e.target.value)}
              rows={3}
              className="text-sm"
              data-testid="pipeline-channel-notes-input"
            />
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-4">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <Handshake className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-700">In Pipeline</span>
              {channel.project_name && (
                <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600">{channel.project_name}</Badge>
              )}
            </div>
            <Button variant="outline" className="w-full" asChild>
              <a href={channel.channel_url} target="_blank" rel="noopener noreferrer">
                <Youtube className="h-4 w-4 mr-2" />
                View Channel
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
