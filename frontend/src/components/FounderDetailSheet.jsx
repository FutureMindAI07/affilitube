/**
 * FounderDetailSheet — admin-only outreach tracker for SaaS founders discovered
 * via SaaS Radar. Mirrors the channel outreach pattern from
 * pages/dashboard/ChannelDetailSheet.jsx (status dropdown, follow-up date,
 * contact note input, contact log) but with founder-shaped data (product name,
 * tagline, bucket badge, PH URL, makers with email + twitter, verdict).
 *
 * Reuses OUTREACH_STATUS_CONFIG from /lib so the status enum stays consistent
 * with the creator pipeline. Every status change appends to contact_log; that
 * log doubles as both an auto-event timeline and a manual-note channel.
 */
import { useState, useEffect } from "react";
import axios from "axios";
import PropTypes from "prop-types";
import { toast } from "sonner";
import {
  ExternalLink,
  Mail,
  Twitter,
  Handshake,
  XCircle,
  MessageSquare,
  Calendar,
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

const BUCKET_COLORS = {
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-slate-50 text-slate-500 border-slate-200",
};
const BUCKET_LABELS = {
  yellow: "Yellow · Paid, no aff. prog",
  green: "Green · Has aff. prog",
  red: "Red · No paid pricing",
  unknown: "Unknown · Not yet checked",
};

/**
 * Build a mailto: URL pre-populated with the SaaS Radar outreach template.
 * Subject and body are URL-encoded; line breaks become %0A automatically via
 * encodeURIComponent.
 *
 * Exported so the SaaS Radar table row's email link can reuse the same template.
 */
export function buildOutreachMailto(email, makerName, productName) {
  const product = productName || "your product";
  // Extract first name: take first whitespace-delimited token of the maker's display name.
  // Strip out any leading non-letters (e.g. emoji, brackets) before grabbing it.
  let firstName = "";
  if (makerName) {
    const cleaned = String(makerName).trim().replace(/^[^\p{L}]+/u, "");
    firstName = cleaned.split(/\s+/)[0] || "";
  }
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  const subject = `Congrats on your ProductHunt launch!`;
  const body = [
    greeting,
    "",
    `Saw ${product} on ProductHunt — congrats on the launch. Getting something shipped and in front of people is genuinely hard, and you've done the hard part.`,
    "",
    "Here's the thing nobody warns you about after launch day: distribution doesn't get easier. Ads are expensive and unpredictable. SEO takes months. Cold outreach at scale feels like shouting into a void.",
    "",
    `And yet somewhere out there are YouTube creators — people with exactly the right audience for a product like ${product} — already reviewing tools in your category, already trusted by the people you're trying to reach.`,
    "",
    "Finding them is the problem. It takes hours of manual searching, spreadsheet-wrangling, and guesswork about who's actually worth contacting versus who'll ghost you or say yes to anything with a commission attached.",
    "That's the problem AffiliTube solves.",
    "",
    "AffiliTube finds YouTube creators already covering your niche, scores them on real affiliate potential (not just subscriber count), and surfaces their contact details — so you can go from \"I need affiliates\" to \"here are 20 pre-qualified creators worth reaching out to\" in an afternoon rather than a week.",
    "",
    `There's a free 14-day trial if you want to see what it surfaces for ${product}'s niche: affilitube.com/for-saas-founders`,
    "",
    "Adrian",
    "Founder, AffiliTube",
  ].join("\n");

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function FounderDetailSheet({ open, onOpenChange, product, onProductUpdate, token }) {
  const api = axios.create({
    baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [followUpUpdating, setFollowUpUpdating] = useState(false);
  const [contactNoteText, setContactNoteText] = useState("");
  const [notesDraft, setNotesDraft] = useState("");

  // Reset notes draft when switching product
  useEffect(() => {
    setNotesDraft(product?.outreach_notes || "");
    setContactNoteText("");
  }, [product?.ph_id, product?.outreach_notes]);

  if (!product) return null;

  const status = product.outreach_status || "not_contacted";
  const followUpISO = product.follow_up_date ? product.follow_up_date.slice(0, 10) : "";

  const callStatus = async (newStatus, note) => {
    setStatusUpdating(true);
    try {
      const res = await api.patch(`/admin/saas-radar/products/${product.ph_id}/outreach-status`, {
        status: newStatus,
        note: note || null,
      });
      onProductUpdate({
        ...product,
        outreach_status: res.data.status,
        contact_log: [...(product.contact_log || []), res.data.log_entry],
      });
      if (note) setContactNoteText("");
      toast.success(note ? "Contact note added" : `Status updated to ${OUTREACH_STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const callFollowUpDate = async (dateOrNull) => {
    setFollowUpUpdating(true);
    try {
      await api.patch(`/admin/saas-radar/products/${product.ph_id}/follow-up-date`, {
        follow_up_date: dateOrNull ? new Date(dateOrNull + "T00:00:00").toISOString() : null,
      });
      onProductUpdate({ ...product, follow_up_date: dateOrNull ? `${dateOrNull}T00:00:00+00:00` : null });
    } catch (e) {
      toast.error("Failed to update follow-up date");
    } finally {
      setFollowUpUpdating(false);
    }
  };

  const callNotes = async (value) => {
    if (value === (product.outreach_notes || "")) return;
    try {
      await api.patch(`/admin/saas-radar/products/${product.ph_id}/notes`, { outreach_notes: value });
      onProductUpdate({ ...product, outreach_notes: value });
    } catch (e) {
      toast.error("Failed to save notes");
    }
  };

  const makers = product.makers || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="founder-detail-sheet">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 pr-6">
            {product.name}
            <a
              href={product.ph_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary shrink-0"
              title="Open ProductHunt launch page"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </SheetTitle>
          <SheetDescription className="text-xs">{product.tagline}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Bucket + product meta */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={BUCKET_COLORS[product.bucket] || ""}>
              {BUCKET_LABELS[product.bucket] || product.bucket}
            </Badge>
            {product.verdict && (
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                Verdict: {product.verdict}
              </Badge>
            )}
            {product.score != null && (
              <Badge variant="outline" className="font-mono">
                Score {product.score}
              </Badge>
            )}
            {Array.isArray(product.notes) && product.notes.length > 0 && (
              <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200" title="Enrichment diagnostic">
                {product.notes.join(", ")}
              </Badge>
            )}
          </div>

          {/* Product links */}
          <div className="space-y-1.5 text-sm">
            {product.website_url && (
              <a
                href={product.resolved_url || product.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
                data-testid="founder-website-link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {product.resolved_domain || product.website_url}
              </a>
            )}
            {product.ph_url && (
              <a
                href={product.ph_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                ProductHunt launch
              </a>
            )}
          </div>

          {/* Makers / contact */}
          {makers.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-3">Makers</h4>
                <div className="space-y-2">
                  {makers.map((m, i) => (
                    <div key={i} className="p-3 rounded-md border border-slate-100 bg-slate-50/60">
                      <div className="font-medium text-sm text-slate-900">{m.name || m.username || "Unknown"}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs">
                        {m.email && (
                          <a
                            href={buildOutreachMailto(m.email, m.name, product.name)}
                            className="flex items-center gap-1 text-blue-700 hover:underline"
                            data-testid={`founder-email-${i}`}
                          >
                            <Mail className="h-3 w-3" />
                            {m.email}
                          </a>
                        )}
                        {m.twitter_username && (
                          <a
                            href={`https://twitter.com/${m.twitter_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sky-700 hover:underline"
                          >
                            <Twitter className="h-3 w-3" />@{m.twitter_username}
                          </a>
                        )}
                        {m.headline && (
                          <span className="text-slate-500 italic">{m.headline}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Outreach Tracking — mirrors the channel pipeline pattern */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Handshake className="h-4 w-4 text-indigo-500" />
              Outreach Tracking
            </h4>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
                <Select
                  value={status}
                  onValueChange={(val) => callStatus(val, null)}
                  disabled={statusUpdating}
                >
                  <SelectTrigger className="h-9" data-testid="founder-status-select">
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
                    value={followUpISO}
                    onChange={(e) => callFollowUpDate(e.target.value || null)}
                    disabled={followUpUpdating}
                    className="h-9 flex-1"
                    data-testid="founder-follow-up-date"
                  />
                  {followUpISO && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => callFollowUpDate(null)}
                      className="h-9 px-2 text-slate-400 hover:text-red-500"
                      data-testid="founder-clear-follow-up-date"
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
                    placeholder="Add a note about this contact…"
                    value={contactNoteText}
                    onChange={(e) => setContactNoteText(e.target.value)}
                    className="h-9 flex-1"
                    data-testid="founder-contact-note-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && contactNoteText.trim()) {
                        callStatus(status === "not_contacted" ? "contacted" : status, contactNoteText.trim());
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-9"
                    disabled={!contactNoteText.trim() || statusUpdating}
                    onClick={() => callStatus(status === "not_contacted" ? "contacted" : status, contactNoteText.trim())}
                    data-testid="founder-add-note-btn"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Logging a note while status is <em>Not Contacted</em> moves it to <em>Contacted</em>.
                </p>
              </div>

              {product.contact_log?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Contact Log</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {[...product.contact_log].reverse().map((entry, i) => {
                      const entryCfg = OUTREACH_STATUS_CONFIG[entry.status] || OUTREACH_STATUS_CONFIG.not_contacted;
                      return (
                        <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-md bg-slate-50 border border-slate-100">
                          <Badge className={`${entryCfg.color} text-[9px] px-1.5 py-0 shrink-0 mt-0.5`}>{entryCfg.label}</Badge>
                          <div className="flex-1 min-w-0">
                            {entry.note ? (
                              <p className="text-slate-700 break-words">{entry.note}</p>
                            ) : (
                              <p className="text-slate-400 italic">Status changed to {entryCfg.label}</p>
                            )}
                            <p className="text-slate-400 mt-0.5">
                              {new Date(entry.timestamp).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
                              })}
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

          {/* Notes textarea */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              Notes
            </h4>
            <Textarea
              placeholder="Free-form notes about this founder / product…"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={(e) => callNotes(e.target.value)}
              rows={4}
              className="text-sm"
              data-testid="founder-notes-textarea"
            />
            <p className="text-[11px] text-slate-400 mt-1">Saves automatically when you click outside the box.</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

FounderDetailSheet.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  product: PropTypes.object,
  onProductUpdate: PropTypes.func.isRequired,
  token: PropTypes.string,
};
