import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";

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

  // Quick status update dialog
  const [updatingChannel, setUpdatingChannel] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");

  useEffect(() => {
    loadProjects();
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

  const loadChannels = async () => {
    setLoading(true);
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
      setLoading(false);
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
      loadChannels();
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
      loadChannels();
      loadProjects();
    } catch (e) {
      toast.error("Failed to update project");
    }
  };

  const filteredChannels = channels.filter(ch => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return ch.channel_name?.toLowerCase().includes(query) || 
           ch.business_email?.toLowerCase().includes(query);
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
          <Button onClick={loadChannels} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
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
                          {editingProjectId === channel.channel_id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editProjectValue}
                                onChange={(e) => setEditProjectValue(e.target.value)}
                                placeholder="Project name..."
                                className="h-6 text-xs w-36 px-1.5"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === "Enter") saveProjectName(channel.channel_id); if (e.key === "Escape") setEditingProjectId(null); }}
                                data-testid={`edit-project-input-${channel.channel_id}`}
                              />
                              <button onClick={() => saveProjectName(channel.channel_id)} className="text-emerald-600 hover:text-emerald-700">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingProjectId(channel.channel_id); setEditProjectValue(channel.project_name || ""); }}
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
                              data-testid={`project-label-${channel.channel_id}`}
                            >
                              <FolderOpen className="h-3 w-3" />
                              {channel.project_name || "No project"}
                              <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                            </button>
                          )}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUpdatingChannel(channel);
                          setNewStatus(channel.outreach_status || "not_contacted");
                        }}
                        className="shrink-0"
                      >
                        Update Status
                      </Button>
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
    </div>
  );
}
