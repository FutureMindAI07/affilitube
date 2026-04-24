import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Youtube,
  Search,
  Mail,
  BookOpen,
  Users,
  Calendar,
  Clock,
  ExternalLink,
  RefreshCw,
  Filter,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ArrowRight,
  Handshake,
  Shield,
  FolderOpen,
  Pencil,
  Check,
  Info,
  ArrowUpDown,
  SlidersHorizontal,
  Sparkles,
  Loader2,
  Copy,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  Settings,
  CreditCard,
  Plus,
} from "lucide-react";
import { ChannelDetailSheet } from "@/components/ChannelDetailSheet";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status configuration with colors and labels
const STATUS_CONFIG = {
  not_contacted: { label: "Not Contacted", color: "bg-slate-100 text-slate-700", icon: Users },
  contacted: { label: "Contacted", color: "bg-blue-100 text-blue-700", icon: Mail },
  replied: { label: "Replied", color: "bg-yellow-100 text-yellow-700", icon: MessageSquare },
  in_negotiation: { label: "In Negotiation", color: "bg-orange-100 text-orange-700", icon: Handshake },
  agreed: { label: "Agreed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-red-100 text-red-700", icon: XCircle },
  no_response: { label: "No Response", color: "bg-slate-200 text-slate-600", icon: Clock },
};

export default function OutreachPipeline() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const api = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOverdueOnly, setShowOverdueOnly] = useState(searchParams.get("overdue") === "true");
  
  // Project filter
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState("all");
  
  // Inline project editing
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editProjectValue, setEditProjectValue] = useState("");

  // Move to project dialog
  const [moveChannel, setMoveChannel] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");

  // Quick status update dialog
  const [updatingChannel, setUpdatingChannel] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");

  // Channel detail sheet
  const [detailChannel, setDetailChannel] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [userTier, setUserTier] = useState("free");

  // Score filter & sort
  const [minScore, setMinScore] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // AI Draft state
  const [draftOpenId, setDraftOpenId] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftCache, setDraftCache] = useState({});

  // Draft credits & outreach config
  const [draftCredits, setDraftCredits] = useState(0);
  const [outreachConfig, setOutreachConfig] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    product_name: "", target_audience: "", value_prop: "",
    tone: "casual-professional", custom_closing: "", product_url: "", sender_name: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);

  useEffect(() => {
    loadProjects();
    fetchUserTier();
    // Handle credit purchase return from Stripe
    if (searchParams.get("credits_purchased") === "true") {
      toast.success("500 AI draft credits added to your account.");
      // Clean up URL param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("credits_purchased");
      navigate(`/dashboard/pipeline${newParams.toString() ? `?${newParams}` : ""}`, { replace: true });
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [statusFilter, showOverdueOnly, projectFilter]);

  const loadProjects = async () => {
    try {
      const res = await api.get("/pipeline/projects");
      setProjects(res.data.projects || []);
    } catch (e) {
      console.error("Error loading projects:", e);
    }
  };

  const fetchUserTier = async () => {
    try {
      const res = await api.get("/user/usage");
      setUserTier(res.data.tier || "free");
      setDraftCredits(res.data.draft_credits || 0);
    } catch (e) {
      console.error("Error fetching user tier:", e);
    }
    try {
      const res = await api.get("/user/outreach-config");
      const cfg = res.data.outreach_config || {};
      setOutreachConfig(cfg);
      if (cfg.product_name) {
        setSettingsForm(prev => ({ ...prev, ...cfg }));
      }
    } catch (e) {
      console.error("Error fetching outreach config:", e);
    }
  };

  const openChannelDetail = (channel) => {
    setDetailChannel(channel);
    setDetailOpen(true);
  };

  const isAdmin = user?.role === "admin";
  const isPaidTier = userTier === "starter" || userTier === "pro";
  const canUseDraft = isAdmin || isPaidTier;

  const handleAiDraft = async (channel) => {
    const cid = channel.channel_id;
    // If non-admin, check config first
    if (!isAdmin && (!outreachConfig || !outreachConfig.product_name)) {
      setSettingsOpen(true);
      toast.info("Complete your Outreach Settings to start generating drafts.");
      return;
    }
    // If non-admin, check credits
    if (!isAdmin && draftCredits <= 0) {
      toast.error("No draft credits remaining. Purchase more to continue.");
      return;
    }
    // Toggle if already open with cached data
    if (draftOpenId === cid && draftCache[cid]) {
      setDraftOpenId(null);
      return;
    }
    if (draftCache[cid]) {
      setDraftOpenId(cid);
      return;
    }
    setDraftOpenId(cid);
    setDraftLoading(true);
    try {
      const res = await api.post(`/channels/${cid}/ai-draft`);
      setDraftCache(prev => ({ ...prev, [cid]: res.data }));
      if (!isAdmin) setDraftCredits(prev => Math.max(0, prev - 1));
    } catch (e) {
      const detail = e.response?.data?.detail || "AI draft generation failed";
      if (e.response?.status === 402) {
        toast.error("No draft credits remaining. Purchase more to continue.");
      } else if (e.response?.status === 400) {
        setSettingsOpen(true);
        toast.info(detail);
      } else {
        toast.error(detail);
      }
      setDraftOpenId(null);
    } finally {
      setDraftLoading(false);
    }
  };

  const regenerateDraft = async (channelId) => {
    if (!isAdmin && draftCredits <= 0) {
      toast.error("No draft credits remaining.");
      return;
    }
    setDraftLoading(true);
    try {
      const res = await api.post(`/channels/${channelId}/ai-draft`);
      setDraftCache(prev => ({ ...prev, [channelId]: res.data }));
      if (!isAdmin) setDraftCredits(prev => Math.max(0, prev - 1));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Regeneration failed");
    } finally {
      setDraftLoading(false);
    }
  };

  const saveOutreachConfig = async () => {
    if (!settingsForm.product_name || !settingsForm.target_audience || !settingsForm.value_prop) {
      toast.error("Product Name, Target Audience, and Value Prop are required.");
      return;
    }
    setSettingsSaving(true);
    try {
      await api.put("/user/outreach-config", settingsForm);
      setOutreachConfig({ ...settingsForm });
      setSettingsOpen(false);
      toast.success("Outreach settings saved.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleBuyCredits = async () => {
    setBuyingCredits(true);
    try {
      const res = await api.post("/checkout/credits");
      if (res.data.url) window.location.href = res.data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start checkout");
    } finally {
      setBuyingCredits(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const copyAllDraft = (draft) => {
    const full = `To: ${draft.business_email}\nSubject: ${draft.subject}\n\n${draft.body}`;
    navigator.clipboard.writeText(full);
    toast.success("Full draft copied to clipboard!");
  };

  const loadChannels = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (showOverdueOnly) {
        const res = await api.get("/channels/follow-ups/due");
        setChannels(res.data.channels);
        setStatusCounts({});
      } else {
        const res = await api.get("/channels/by-outreach-status", {
          params: {
            status: statusFilter !== "all" ? statusFilter : undefined,
            project: projectFilter !== "all" ? projectFilter : undefined
          }
        });
        setChannels(res.data.channels);
        setStatusCounts(res.data.status_counts);
      }
    } catch (e) {
      toast.error("Failed to load channels");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const updateStatus = async () => {
    if (!updatingChannel || !newStatus) return;
    try {
      await api.patch(`/channels/${updatingChannel.channel_id}/outreach-status`, {
        status: newStatus,
        note: statusNote || null
      });
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus].label}`);
      setUpdatingChannel(null);
      setNewStatus("");
      setStatusNote("");
      loadChannels(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update status");
    }
  };

  const saveProjectName = async (channelId) => {
    try {
      await api.patch(`/channels/${channelId}/project-name`, {
        project_name: editProjectValue.trim() || null
      });
      toast.success("Project updated");
      setEditingProjectId(null);
      loadChannels(true);
      loadProjects();
    } catch (e) {
      toast.error("Failed to update project");
    }
  };

  const moveToProject = async (projectName) => {
    if (!moveChannel) return;
    try {
      await api.patch(`/channels/${moveChannel.channel_id}/project-name`, {
        project_name: projectName || null
      });
      toast.success(`Moved to ${projectName || "No project"}`);
      setMoveChannel(null);
      loadChannels(true);
      loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to move channel");
    }
  };

  const createAndMoveToProject = async () => {
    const name = newProjectName.trim();
    if (!name || !moveChannel) return;
    try {
      await api.patch(`/channels/${moveChannel.channel_id}/project-name`, {
        project_name: name
      });
      toast.success(`Moved to new project "${name}"`);
      setMoveChannel(null);
      setNewProjectName("");
      loadChannels(true);
      loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create project");
    }
  };

  const removeFromPipeline = async (channel) => {
    try {
      await api.delete(`/channels/${channel.channel_id}/pipeline`);
      toast.success(`${channel.channel_name} removed from pipeline`);
      loadChannels(true);
      loadProjects();
    } catch (e) {
      toast.error("Failed to remove from pipeline");
    }
  };

  const filteredChannels = channels
    .filter(ch => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!ch.channel_name?.toLowerCase().includes(query) && !ch.business_email?.toLowerCase().includes(query)) return false;
      }
      if (minScore && (ch.affiliate_score || 0) < parseInt(minScore)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "score_desc": return (b.affiliate_score || 0) - (a.affiliate_score || 0);
        case "score_asc": return (a.affiliate_score || 0) - (b.affiliate_score || 0);
        case "subs_desc": return (b.subscriber_count || 0) - (a.subscriber_count || 0);
        case "name_asc": return (a.channel_name || "").localeCompare(b.channel_name || "");
        case "sponsored_first": {
          const aSponsored = a.sponsorship_data?.is_sponsored_active ? 1 : 0;
          const bSponsored = b.sponsorship_data?.is_sponsored_active ? 1 : 0;
          return bSponsored - aSponsored || (b.affiliate_score || 0) - (a.affiliate_score || 0);
        }
        default: return 0;
      }
    });

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const isOverdue = (followUpDate) => {
    if (!followUpDate) return false;
    const today = new Date().toISOString().split("T")[0];
    return followUpDate <= today;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 font-body">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100/50">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Youtube className="h-4 w-4 text-white" />
              </div>
              <span className="font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 hidden sm:inline">Affilitube</span>
            </a>
          </div>

          {/* Tab Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all">
              <Search className="h-3.5 w-3.5" />
              Prospect Finder
            </button>
            <button onClick={() => navigate("/dashboard/pipeline")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700">
              <Handshake className="h-3.5 w-3.5" />
              Outreach Pipeline
            </button>
            <button onClick={() => navigate("/dashboard/outreach")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all">
              <Mail className="h-3.5 w-3.5" />
              Templates
            </button>
            <button onClick={() => navigate("/dashboard/getting-started")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all">
              <BookOpen className="h-3.5 w-3.5" />
              Getting Started
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
                className="rounded-full gap-2 border-purple-200 bg-purple-50/50 text-purple-700 hover:bg-purple-100"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { logout(); navigate("/login"); }}
              className="text-slate-500"
            >
              Log Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-slate-900">Outreach Pipeline</h1>
            <p className="text-slate-500 text-sm mt-1">Track your outreach progress with YouTube creators</p>
          </div>
          <div className="flex items-center gap-2">
            {canUseDraft && (
              <>
                {!isAdmin && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100" data-testid="draft-credits-badge">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    <span className="text-sm font-medium text-purple-700">{draftCredits} credits</span>
                  </div>
                )}
                {!isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBuyCredits}
                    disabled={buyingCredits}
                    className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
                    data-testid="buy-credits-btn"
                  >
                    {buyingCredits ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                    Buy Credits
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                  className="h-9 w-9 p-0 text-slate-400 hover:text-purple-600"
                  data-testid="outreach-settings-btn"
                  title="Outreach Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button onClick={loadChannels} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Status Summary Cards */}
        {!showOverdueOnly && Object.keys(statusCounts).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(STATUS_CONFIG).filter(([key]) => key !== "not_contacted").map(([key, config]) => {
              const count = statusCounts[key] || 0;
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    statusFilter === key
                      ? "border-indigo-500 bg-indigo-50/50 shadow-md"
                      : "border-slate-100 bg-white hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span className="text-lg font-bold text-slate-900">{count}</span>
                  </div>
                  <span className="text-xs text-slate-500">{config.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search by channel name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  data-testid="pipeline-search-input"
                />
              </div>
              <div className="w-48">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setShowOverdueOnly(false); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(STATUS_CONFIG).filter(([key]) => key !== "not_contacted").map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger data-testid="pipeline-project-filter">
                    <SelectValue placeholder="Filter by project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant={showOverdueOnly ? "default" : "outline"}
                onClick={() => { setShowOverdueOnly(!showOverdueOnly); setStatusFilter("all"); }}
                className={`gap-2 ${showOverdueOnly ? "bg-red-500 hover:bg-red-600" : ""}`}
              >
                <AlertCircle className="h-4 w-4" />
                Overdue Follow-ups
              </Button>
            </div>
            {/* Score filter & Sort row */}
            <div className="flex flex-wrap gap-4 items-end mt-3 pt-3 border-t border-slate-100">
              <div className="w-40">
                <label className="text-xs text-slate-500 mb-1 block">Min Affiliate Score</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 40"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  className="h-9"
                  data-testid="pipeline-min-score-filter"
                />
              </div>
              <div className="w-48">
                <label className="text-xs text-slate-500 mb-1 block">Sort by</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9" data-testid="pipeline-sort-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Default Order</SelectItem>
                    <SelectItem value="sponsored_first">Has Disclosures First</SelectItem>
                    <SelectItem value="score_desc">Score: High to Low</SelectItem>
                    <SelectItem value="score_asc">Score: Low to High</SelectItem>
                    <SelectItem value="subs_desc">Subscribers: Most</SelectItem>
                    <SelectItem value="name_asc">Name: A to Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(minScore || sortBy !== "newest") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setMinScore(""); setSortBy("newest"); }}
                  className="text-slate-400 hover:text-slate-600 h-9"
                  data-testid="pipeline-clear-filters"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
              <span className="text-xs text-slate-400 ml-auto self-end pb-1.5">
                {filteredChannels.length} channel{filteredChannels.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Channels List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filteredChannels.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-heading font-semibold text-slate-900 mb-2">
                {showOverdueOnly ? "No overdue follow-ups" : "No channels in pipeline"}
              </h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                {showOverdueOnly 
                  ? "Great job! You have no overdue follow-ups."
                  : "Start tracking your outreach by updating the status of channels in the Prospect Finder."
                }
              </p>
              <Button onClick={() => navigate("/dashboard")} className="mt-4 gap-2">
                <Search className="h-4 w-4" />
                Go to Prospect Finder
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredChannels.map((channel) => {
              const statusConfig = STATUS_CONFIG[channel.outreach_status] || STATUS_CONFIG.not_contacted;
              const StatusIcon = statusConfig.icon;
              const overdue = isOverdue(channel.follow_up_date) && 
                             !["agreed", "declined"].includes(channel.outreach_status);
              
              return (
                <Card 
                  key={channel.channel_id} 
                  className={`hover:shadow-md transition-shadow ${overdue ? "border-red-200 bg-red-50/30" : ""}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      {/* Channel Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <a
                            href={channel.channel_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-slate-900 hover:text-indigo-600 truncate"
                          >
                            {channel.channel_name}
                          </a>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>{channel.subscriber_count?.toLocaleString()} subscribers</span>
                          <span>Affiliate Score: {channel.affiliate_score || 0}</span>
                          {channel.business_email && (
                            <span className="text-indigo-600">{channel.business_email}</span>
                          )}
                        </div>
                        {/* Project Label */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            onClick={() => { setMoveChannel(channel); setNewProjectName(""); }}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
                            data-testid={`project-label-${channel.channel_id}`}
                          >
                            <FolderOpen className="h-3 w-3" />
                            {channel.project_name || "No project"}
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>

                      {/* Follow-up Date */}
                      <div className="text-right shrink-0">
                        {channel.follow_up_date ? (
                          <div className={`flex items-center gap-1.5 ${overdue ? "text-red-600" : "text-slate-500"}`}>
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm">
                              {overdue ? "Overdue: " : "Follow-up: "}
                              {formatDate(channel.follow_up_date)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No follow-up set</span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <Badge className={`${statusConfig.color} gap-1.5 shrink-0`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openChannelDetail(channel)}
                          className="gap-1.5"
                          data-testid={`info-btn-${channel.channel_id}`}
                        >
                          <Info className="h-3.5 w-3.5" />
                          Info
                        </Button>
                        {canUseDraft && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAiDraft(channel)}
                            className={`gap-1.5 ${draftOpenId === channel.channel_id ? "bg-purple-50 border-purple-300 text-purple-700" : ""}`}
                            disabled={draftLoading && draftOpenId === channel.channel_id}
                            data-testid={`ai-draft-btn-${channel.channel_id}`}
                          >
                            {draftLoading && draftOpenId === channel.channel_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            AI Draft
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setUpdatingChannel(channel);
                            setNewStatus(channel.outreach_status || "not_contacted");
                          }}
                        >
                          Update Status
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                          onClick={() => removeFromPipeline(channel)}
                          data-testid={`remove-pipeline-btn-${channel.channel_id}`}
                          title="Remove from pipeline"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Contact Log Preview */}
                    {channel.contact_log && channel.contact_log.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          Last contact: {formatDate(channel.contact_log[channel.contact_log.length - 1].timestamp)}
                          {channel.contact_log[channel.contact_log.length - 1].note && (
                            <span className="text-slate-400">
                              — "{channel.contact_log[channel.contact_log.length - 1].note}"
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* AI Draft Panel */}
                    {draftOpenId === channel.channel_id && (
                      <div className="mt-3 pt-3 border-t border-purple-100 animate-in slide-in-from-top-2 duration-200" data-testid={`ai-draft-panel-${channel.channel_id}`}>
                        {draftLoading && !draftCache[channel.channel_id] ? (
                          <div className="flex items-center gap-3 py-6 justify-center text-sm text-purple-600">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Generating personalized outreach draft...
                          </div>
                        ) : draftCache[channel.channel_id] ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-purple-800 flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4" />
                                AI Outreach Draft
                              </h4>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => regenerateDraft(channel.channel_id)}
                                  disabled={draftLoading}
                                  className="h-7 gap-1 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  data-testid={`ai-draft-regenerate-${channel.channel_id}`}
                                >
                                  {draftLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                                  Regenerate
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyAllDraft(draftCache[channel.channel_id])}
                                  className="h-7 gap-1 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  data-testid={`ai-draft-copy-all-${channel.channel_id}`}
                                >
                                  <Copy className="h-3 w-3" />
                                  Copy All
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDraftOpenId(null)}
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {/* Email To */}
                            {draftCache[channel.channel_id].business_email && (
                              <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 border border-blue-100">
                                <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-sm text-blue-700 font-medium truncate">{draftCache[channel.channel_id].business_email}</span>
                                <button
                                  onClick={() => copyToClipboard(draftCache[channel.channel_id].business_email, "Email")}
                                  className="ml-auto text-blue-400 hover:text-blue-600 shrink-0"
                                  data-testid={`ai-draft-copy-email-${channel.channel_id}`}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                            {/* Subject */}
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-purple-500 font-semibold mb-1 block">Subject</label>
                              <div className="flex items-center gap-2 p-2 rounded-md bg-purple-50 border border-purple-100">
                                <span className="text-sm text-slate-800 flex-1" data-testid={`ai-draft-subject-${channel.channel_id}`}>{draftCache[channel.channel_id].subject}</span>
                                <button
                                  onClick={() => copyToClipboard(draftCache[channel.channel_id].subject, "Subject")}
                                  className="text-purple-400 hover:text-purple-600 shrink-0"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            {/* Body */}
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-purple-500 font-semibold mb-1 block">Message</label>
                              <div className="relative p-3 rounded-md bg-white border border-purple-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed" data-testid={`ai-draft-body-${channel.channel_id}`}>
                                {draftCache[channel.channel_id].body}
                                <button
                                  onClick={() => copyToClipboard(draftCache[channel.channel_id].body, "Message")}
                                  className="absolute top-2 right-2 text-purple-300 hover:text-purple-600"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Update Status Dialog */}
      <Dialog open={!!updatingChannel} onOpenChange={() => { setUpdatingChannel(null); setNewStatus(""); setStatusNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Outreach Status</DialogTitle>
            <DialogDescription>
              Update status for {updatingChannel?.channel_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Note (optional)</label>
              <Input
                placeholder="Add a note about this status change..."
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUpdatingChannel(null); setNewStatus(""); setStatusNote(""); }}>
              Cancel
            </Button>
            <Button onClick={updateStatus} className="bg-indigo-600 hover:bg-indigo-700">
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Detail Sheet */}
      <ChannelDetailSheet
        channel={detailChannel}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        api={api}
        userTier={userTier}
        onStatusUpdate={() => loadChannels(true)}
        onNotesUpdate={() => {}}
        onUpgradeClick={() => navigate("/pricing")}
      />

      {/* Move to Project Dialog */}
      <Dialog open={!!moveChannel} onOpenChange={() => setMoveChannel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-indigo-500" />
              Move to Project
            </DialogTitle>
            <DialogDescription>
              Assign {moveChannel?.channel_name} to a project.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            {/* Existing projects */}
            {projects.length > 0 && (
              <div>
                <label className="text-xs text-slate-500 mb-2 block">Existing Projects</label>
                <div className="space-y-1.5">
                  {projects.map((p) => (
                    <button
                      key={p}
                      onClick={() => moveToProject(p)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        moveChannel?.project_name === p
                          ? "bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium"
                          : "bg-slate-50 border border-slate-100 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200"
                      }`}
                      data-testid={`move-to-project-${p}`}
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                      {p}
                      {moveChannel?.project_name === p && (
                        <span className="ml-auto text-xs text-indigo-500">current</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Remove from project */}
            {moveChannel?.project_name && (
              <button
                onClick={() => moveToProject(null)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 bg-slate-50 border border-slate-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                data-testid="remove-from-project"
              >
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                Remove from project
              </button>
            )}

            {/* Create new project */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Create New Project</label>
              <div className="flex gap-2">
                <Input
                  placeholder="New project name..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="h-9 flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && newProjectName.trim()) createAndMoveToProject(); }}
                  data-testid="new-project-input"
                />
                <Button
                  size="sm"
                  className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                  disabled={!newProjectName.trim()}
                  onClick={createAndMoveToProject}
                  data-testid="create-project-btn"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Outreach Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-purple-500" />
              Outreach Settings
            </DialogTitle>
            <DialogDescription>
              Configure your AI drafts. These details personalize every email the AI generates for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Product / Company Name *</Label>
              <Input
                placeholder="e.g. Affilitube"
                value={settingsForm.product_name}
                onChange={(e) => setSettingsForm(p => ({ ...p, product_name: e.target.value }))}
                data-testid="settings-product-name"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Target Audience *</Label>
              <Input
                placeholder="e.g. small and medium YouTube creators"
                value={settingsForm.target_audience}
                onChange={(e) => setSettingsForm(p => ({ ...p, target_audience: e.target.value }))}
                data-testid="settings-target-audience"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Value Proposition *</Label>
              <Textarea
                placeholder="e.g. find and connect with affiliate partners who genuinely fit their niche"
                value={settingsForm.value_prop}
                onChange={(e) => setSettingsForm(p => ({ ...p, value_prop: e.target.value }))}
                rows={2}
                data-testid="settings-value-prop"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Tone</Label>
              <Select value={settingsForm.tone} onValueChange={(v) => setSettingsForm(p => ({ ...p, tone: v }))}>
                <SelectTrigger data-testid="settings-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual — like texting a friend</SelectItem>
                  <SelectItem value="casual-professional">Casual-Professional — warm but clear</SelectItem>
                  <SelectItem value="professional">Professional — polite and structured</SelectItem>
                  <SelectItem value="bold">Bold — confident and direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Custom Closing Line</Label>
              <Input
                placeholder="e.g. would you be open to a quick chat? no pressure at all."
                value={settingsForm.custom_closing}
                onChange={(e) => setSettingsForm(p => ({ ...p, custom_closing: e.target.value }))}
                data-testid="settings-custom-closing"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Product URL</Label>
                <Input
                  placeholder="https://yoursite.com"
                  value={settingsForm.product_url}
                  onChange={(e) => setSettingsForm(p => ({ ...p, product_url: e.target.value }))}
                  data-testid="settings-product-url"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Your Name (sign-off)</Label>
                <Input
                  placeholder="e.g. Adrian"
                  value={settingsForm.sender_name}
                  onChange={(e) => setSettingsForm(p => ({ ...p, sender_name: e.target.value }))}
                  data-testid="settings-sender-name"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button
              onClick={saveOutreachConfig}
              disabled={settingsSaving}
              className="bg-purple-600 hover:bg-purple-700 gap-1.5"
              data-testid="settings-save-btn"
            >
              {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
