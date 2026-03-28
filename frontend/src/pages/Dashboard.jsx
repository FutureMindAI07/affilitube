import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Search,
  Download,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  X,
  ExternalLink,
  Youtube,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Filter,
  ListChecks,
  History,
  Save,
  Clock,
  Trash2,
  Play,
  FileText,
  Eye,
  ArrowLeft,
  Sparkles,
  Link,
  ShoppingBag,
  Mail,
  Handshake,
  Zap,
  Gauge,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Bug, BookOpen } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Search presets
const SEARCH_PRESETS = {
  quick: {
    name: "Quick Scan",
    icon: "🚀",
    description: "Fast, low quota usage",
    settings: {
      videos_to_scan: 3,
      scan_video_descriptions: false,
      max_channels_to_enrich: 100,
    }
  },
  balanced: {
    name: "Balanced",
    icon: "⚖️",
    description: "Good coverage (default)",
    settings: {
      videos_to_scan: 5,
      scan_video_descriptions: false,
      max_channels_to_enrich: 200,
    }
  },
  deep: {
    name: "Deep Scan",
    icon: "🔍",
    description: "Comprehensive, higher quota",
    settings: {
      videos_to_scan: 10,
      scan_video_descriptions: true,
      max_channels_to_enrich: null,
    }
  },
  custom: {
    name: "Custom",
    icon: "⚙️",
    description: "Full control",
    settings: null
  }
};

const DEFAULT_KEYWORD_PLACEHOLDER = `Select a niche above to see example keywords`;

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  // Create authenticated axios instance
  const api = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  // Niche state
  const [niches, setNiches] = useState([]);
  const [selectedNiche, setSelectedNiche] = useState(null);
  const [keywordPlaceholder, setKeywordPlaceholder] = useState(DEFAULT_KEYWORD_PLACEHOLDER);

  // User usage/tier state
  const [userUsage, setUserUsage] = useState(null);

  const [keywords, setKeywords] = useState("");
  const [minSubs, setMinSubs] = useState(2000);
  const [maxSubs, setMaxSubs] = useState(100000);
  const [uploadedWithin, setUploadedWithin] = useState(90);
  const [maxResults, setMaxResults] = useState(50);
  const [searchMode, setSearchMode] = useState("channels_videos");

  // Advanced settings
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchPreset, setSearchPreset] = useState("balanced");
  const [videosToScan, setVideosToScan] = useState(5);
  const [scanVideoDescriptions, setScanVideoDescriptions] = useState(false);
  const [maxChannelsToEnrich, setMaxChannelsToEnrich] = useState(200);
  const [unlimitedChannels, setUnlimitedChannels] = useState(false);
  const [affiliatePlatforms, setAffiliatePlatforms] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState([]);

  const [quotaEstimate, setQuotaEstimate] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchStatus, setSearchStatus] = useState("");

  const [channels, setChannels] = useState([]);
  const [rawSearchResults, setRawSearchResults] = useState(null); // {channel_ids, channel_metadata, total_found}
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [enrichStatus, setEnrichStatus] = useState("");
  const [shortlist, setShortlist] = useState(new Set());
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Bug report
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugSubject, setBugSubject] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSteps, setBugSteps] = useState("");
  const [bugSeverity, setBugSeverity] = useState("medium");
  const [bugSubmitting, setBugSubmitting] = useState(false);

  const [sortBy, setSortBy] = useState("score_total");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [filterHighAffiliate, setFilterHighAffiliate] = useState(false);
  const [filterHasPlatformLinks, setFilterHasPlatformLinks] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Search history state
  const [searchHistory, setSearchHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [searchName, setSearchName] = useState("");

  // Search reports state
  const [savedReports, setSavedReports] = useState([]);
  const [saveReportOpen, setSaveReportOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [viewingReport, setViewingReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Load niches and user usage on mount
  useEffect(() => {
    loadNiches();
    loadUserUsage();
    loadShortlist();
    loadSearchHistory();
    loadSavedReports();
    loadAffiliatePlatforms();
  }, []);

  // Refresh user usage periodically
  useEffect(() => {
    const interval = setInterval(loadUserUsage, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadNiches = async () => {
    try {
      const res = await api.get("/niches");
      setNiches(res.data.niches || []);
    } catch (e) {
      console.error("Error loading niches:", e);
    }
  };

  const loadUserUsage = async () => {
    try {
      const res = await api.get("/user/usage");
      setUserUsage(res.data);
    } catch (e) {
      console.error("Error loading user usage:", e);
    }
  };

  const selectNiche = (niche) => {
    setSelectedNiche(niche);
    setKeywordPlaceholder(niche.placeholder_examples || DEFAULT_KEYWORD_PLACEHOLDER);
  };

  const loadAffiliatePlatforms = async () => {
    try {
      const res = await api.get("/affiliate-platforms");
      setAvailablePlatforms(res.data.platforms || []);
    } catch (e) {
      console.error("Error loading affiliate platforms:", e);
    }
  };

  // Remove loadQuotaUsage - no longer needed for tier-based system

  // Apply preset settings
  const applyPreset = (presetKey) => {
    setSearchPreset(presetKey);
    const preset = SEARCH_PRESETS[presetKey];
    if (preset.settings) {
      setVideosToScan(preset.settings.videos_to_scan);
      setScanVideoDescriptions(preset.settings.scan_video_descriptions);
      if (preset.settings.max_channels_to_enrich === null) {
        setUnlimitedChannels(true);
      } else {
        setUnlimitedChannels(false);
        setMaxChannelsToEnrich(preset.settings.max_channels_to_enrich);
      }
    }
  };

  // Toggle affiliate platform selection
  const togglePlatform = (platformKey) => {
    setAffiliatePlatforms(prev => 
      prev.includes(platformKey) 
        ? prev.filter(p => p !== platformKey)
        : [...prev, platformKey]
    );
    setSearchPreset("custom");
  };

  const loadSearchHistory = async () => {
    try {
      const res = await api.get("/search-history");
      setSearchHistory(res.data.searches || []);
    } catch (e) {
      console.error("Error loading search history:", e);
    }
  };

  const loadSavedReports = async () => {
    try {
      const res = await api.get("/search-reports");
      setSavedReports(res.data.reports || []);
    } catch (e) {
      console.error("Error loading saved reports:", e);
    }
  };

  const loadShortlist = async () => {
    try {
      const res = await api.get("/shortlist");
      setShortlist(new Set(res.data.channel_ids));
    } catch (e) {
      console.error("Error loading shortlist:", e);
    }
  };

  const estimateQuota = useCallback(async () => {
    const keywordList = keywords.split("\n").filter((k) => k.trim());
    if (keywordList.length === 0) return;

    try {
      const res = await api.post("/quota/estimate", {
        keywords: keywordList,
        min_subscribers: minSubs,
        max_subscribers: maxSubs,
        uploaded_within_days: uploadedWithin,
        max_results_per_keyword: maxResults,
        search_mode: searchMode,
        videos_to_scan: videosToScan,
        scan_video_descriptions: scanVideoDescriptions,
        max_channels_to_enrich: unlimitedChannels ? null : maxChannelsToEnrich,
        affiliate_platforms: affiliatePlatforms,
      });
      setQuotaEstimate(res.data);
    } catch (e) {
      console.error("Error estimating quota:", e);
    }
  }, [keywords, minSubs, maxSubs, uploadedWithin, maxResults, searchMode, 
      videosToScan, scanVideoDescriptions, maxChannelsToEnrich, unlimitedChannels, affiliatePlatforms]);

  useEffect(() => {
    const timer = setTimeout(estimateQuota, 500);
    return () => clearTimeout(timer);
  }, [estimateQuota]);

  const runSearch = async () => {
    if (!selectedNiche) {
      toast.error("Please select a niche first");
      return;
    }

    const keywordList = keywords.split("\n").filter((k) => k.trim());
    if (keywordList.length === 0) {
      toast.error("Please enter at least one keyword");
      return;
    }

    // Check tier limits
    if (userUsage && !userUsage.is_unlimited && userUsage.searches_remaining <= 0) {
      toast.error("Monthly search limit reached. Upgrade to Pro for unlimited searches.");
      return;
    }

    setIsSearching(true);
    setSearchProgress(10);
    setSearchStatus("Searching YouTube...");
    setChannels([]);
    setRawSearchResults(null);

    try {
      const searchRes = await api.post("/search", {
        keywords: keywordList,
        niche: selectedNiche.key,
        min_subscribers: minSubs,
        max_subscribers: maxSubs,
        uploaded_within_days: uploadedWithin,
        max_results_per_keyword: maxResults,
        search_mode: searchMode,
      });

      setSearchProgress(100);
      setRawSearchResults(searchRes.data);
      
      // Show different message for free tier result limiting
      const limitMessage = searchRes.data.total_before_limit > searchRes.data.total_found 
        ? ` (limited from ${searchRes.data.total_before_limit} - upgrade for full results)`
        : "";
      setSearchStatus(
        `Found ${searchRes.data.total_found} channels${limitMessage}. Ready to enrich.`
      );
      toast.success(`Found ${searchRes.data.total_found} channels`);
      loadUserUsage();
    } catch (e) {
      const detail = e.response?.data?.detail || "Search failed";
      toast.error(detail);
      setSearchStatus(`Error: ${detail}`);
      loadUserUsage();
    } finally {
      setIsSearching(false);
    }
  };

  const runEnrichment = async () => {
    if (!rawSearchResults || rawSearchResults.total_found === 0) {
      toast.error("No channels to enrich. Run a search first.");
      return;
    }

    setIsEnriching(true);
    setEnrichProgress(20);
    const channelsToEnrich = unlimitedChannels
      ? rawSearchResults.total_found
      : Math.min(rawSearchResults.total_found, maxChannelsToEnrich);
    setEnrichStatus(`Enriching ${channelsToEnrich} channels...`);

    try {
      const enrichRes = await api.post("/channels/enrich", {
        channel_ids: rawSearchResults.channel_ids,
        channel_metadata: rawSearchResults.channel_metadata,
        niche: selectedNiche?.key || "saas_software",
        min_subscribers: minSubs,
        max_subscribers: maxSubs,
        videos_to_scan: videosToScan,
        scan_video_descriptions: scanVideoDescriptions,
        max_channels_to_enrich: unlimitedChannels ? null : maxChannelsToEnrich,
        affiliate_platforms: affiliatePlatforms,
      });

      setEnrichProgress(100);
      setEnrichStatus(`Complete! ${enrichRes.data.total} channels processed.`);
      setChannels(enrichRes.data.channels);
      toast.success(`Enriched ${enrichRes.data.total} channels with scores`);
    } catch (e) {
      const detail = e.response?.data?.detail || "Enrichment failed";
      toast.error(detail);
      setEnrichStatus(`Error: ${detail}`);
    } finally {
      setIsEnriching(false);
    }
  };

  const toggleShortlist = async (channelId) => {
    const newShortlist = new Set(shortlist);
    try {
      if (shortlist.has(channelId)) {
        await api.delete(`/shortlist/${channelId}`);
        newShortlist.delete(channelId);
        toast.info("Removed from shortlist");
      } else {
        await api.post("/shortlist", { channel_id: channelId });
        newShortlist.add(channelId);
        toast.success("Added to shortlist");
      }
      setShortlist(newShortlist);
    } catch (e) {
      toast.error("Failed to update shortlist");
    }
  };

  const updateNotes = async (channelId, notes) => {
    try {
      await axios.put(`${API}/channels/${channelId}/notes`, { notes });
      setChannels((prev) =>
        prev.map((ch) => (ch.channel_id === channelId ? { ...ch, notes } : ch))
      );
      if (selectedChannel?.channel_id === channelId) {
        setSelectedChannel((prev) => ({ ...prev, notes }));
      }
    } catch (e) {
      toast.error("Failed to save notes");
    }
  };

  const exportCSV = async (onlyShortlist = false, reportChannels = null) => {
    // If reportChannels provided, export those directly
    if (reportChannels) {
      const idsToExport = reportChannels.map((ch) => ch.channel_id);
      if (idsToExport.length === 0) {
        toast.error("No channels to export");
        return;
      }
      try {
        const res = await api.post(
          "/export/csv",
          idsToExport,
          { responseType: "blob" }
        );
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `youtube_report_${new Date().toISOString().slice(0, 10)}.csv`
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("CSV exported successfully");
      } catch (e) {
        toast.error("Failed to export CSV");
      }
      return;
    }

    const idsToExport = onlyShortlist
      ? Array.from(shortlist)
      : sortedChannels.map((ch) => ch.channel_id);

    if (idsToExport.length === 0) {
      toast.error("No channels to export");
      return;
    }

    try {
      const res = await api.post(
          "/export/csv",
          idsToExport,
          { responseType: "blob" }
        );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `youtube_prospects_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("CSV exported successfully");
    } catch (e) {
      toast.error("Failed to export CSV");
    }
  };

  const openChannelDetail = (channel) => {
    setSelectedChannel(channel);
    setDetailOpen(true);
  };

  // Search history functions
  const saveCurrentSearch = async () => {
    if (!searchName.trim()) {
      toast.error("Please enter a name for this search");
      return;
    }
    const keywordList = keywords.split("\n").filter((k) => k.trim());
    if (keywordList.length === 0) {
      toast.error("No keywords to save");
      return;
    }
    try {
      await api.post("/search-history", {
        name: searchName,
        keywords: keywordList,
        filters: {
          min_subscribers: minSubs,
          max_subscribers: maxSubs,
          uploaded_within_days: uploadedWithin,
          max_results_per_keyword: maxResults,
          search_mode: searchMode,
        },
        results_count: channels.length || null,
      });
      toast.success("Search saved to history");
      setSaveSearchOpen(false);
      setSearchName("");
      loadSearchHistory();
    } catch (e) {
      toast.error("Failed to save search");
    }
  };

  const loadSavedSearch = async (search) => {
    setKeywords(search.keywords.join("\n"));
    setMinSubs(search.filters.min_subscribers || 2000);
    setMaxSubs(search.filters.max_subscribers || 100000);
    setUploadedWithin(search.filters.uploaded_within_days || 90);
    setMaxResults(search.filters.max_results_per_keyword || 50);
    setSearchMode(search.filters.search_mode || "channels_videos");
    setHistoryOpen(false);
    toast.success(`Loaded "${search.name}"`);
    
    // Mark as used
    try {
      await axios.put(`${API}/search-history/${search.id}/use`);
      loadSearchHistory();
    } catch (e) {
      console.error("Error updating search history:", e);
    }
  };

  const deleteSavedSearch = async (searchId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/search-history/${searchId}`);
      toast.success("Search deleted");
      loadSearchHistory();
    } catch (e) {
      toast.error("Failed to delete search");
    }
  };

  const submitBugReport = async () => {
    if (!bugSubject.trim() || !bugDescription.trim()) {
      toast.error("Please provide a subject and description");
      return;
    }
    setBugSubmitting(true);
    try {
      await api.post("/bug-report", {
        subject: bugSubject,
        description: bugDescription,
        steps_to_reproduce: bugSteps,
        severity: bugSeverity,
      });
      toast.success("Bug report submitted. Thank you!");
      setBugReportOpen(false);
      setBugSubject("");
      setBugDescription("");
      setBugSteps("");
      setBugSeverity("medium");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to submit bug report");
    } finally {
      setBugSubmitting(false);
    }
  };

  const runSavedSearch = async (search) => {
    await loadSavedSearch(search);
    // Small delay to let state update, then trigger search
    setTimeout(() => {
      document.querySelector('[data-testid="search-btn"]')?.click();
    }, 100);
  };

  // Report functions
  const saveReport = async () => {
    if (!reportName.trim()) {
      toast.error("Please enter a name for this report");
      return;
    }
    if (channels.length === 0) {
      toast.error("No results to save");
      return;
    }
    const keywordList = keywords.split("\n").filter((k) => k.trim());
    try {
      await api.post("/search-reports", {
        name: reportName,
        keywords: keywordList,
        filters: {
          min_subscribers: minSubs,
          max_subscribers: maxSubs,
          uploaded_within_days: uploadedWithin,
          max_results_per_keyword: maxResults,
          search_mode: searchMode,
        },
        channels: channels,
        shortlisted_ids: Array.from(shortlist),
      });
      toast.success("Report saved successfully");
      setSaveReportOpen(false);
      setReportName("");
      loadSavedReports();
    } catch (e) {
      toast.error("Failed to save report");
    }
  };

  const viewReport = async (reportId) => {
    setLoadingReport(true);
    try {
      const res = await api.get(`/search-reports/${reportId}`);
      setViewingReport(res.data);
      setHistoryOpen(false);
    } catch (e) {
      toast.error("Failed to load report");
    } finally {
      setLoadingReport(false);
    }
  };

  const deleteReport = async (reportId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/search-reports/${reportId}`);
      toast.success("Report deleted");
      loadSavedReports();
    } catch (e) {
      toast.error("Failed to delete report");
    }
  };

  const closeReportView = () => {
    setViewingReport(null);
  };

  // Sorting and filtering
  const sortedChannels = [...channels]
    .filter((ch) => ch.score_total >= filterMinScore)
    .filter((ch) => !filterHighAffiliate || (ch.affiliate_score >= 60))
    .filter((ch) => !filterHasPlatformLinks || (ch.affiliate_platforms_found?.length > 0))
    .sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });

  const totalPages = Math.ceil(sortedChannels.length / pageSize);
  const paginatedChannels = sortedChannels.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to page 1 when filters/sort change
  useEffect(() => { setCurrentPage(1); }, [filterMinScore, filterHighAffiliate, filterHasPlatformLinks, sortBy, sortOrder, channels]);

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

  return (
    <div className="dashboard-bg font-body">
      {/* Shared Dashboard Header */}
      <header className="glass-header" data-testid="app-header">
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
          <nav className="hidden md:flex items-center gap-1" data-testid="dashboard-nav">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700" data-testid="nav-tool">
              <Search className="h-3.5 w-3.5" />
              Prospect Finder
            </button>
            <button onClick={() => navigate("/dashboard/outreach")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all" data-testid="nav-outreach">
              <Mail className="h-3.5 w-3.5" />
              Outreach
            </button>
            <button onClick={() => navigate("/dashboard/getting-started")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all" data-testid="nav-getting-started">
              <BookOpen className="h-3.5 w-3.5" />
              Getting Started
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {/* Tier Badge */}
            {userUsage && (
              <Badge 
                variant="outline" 
                className={`gap-1.5 text-xs rounded-full ${
                  userUsage.is_unlimited 
                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700' 
                    : 'border-indigo-200 bg-indigo-50/50 text-indigo-700'
                }`}
              >
                {userUsage.is_unlimited ? (
                  <>
                    <Zap className="h-3 w-3" />
                    Pro Plan
                  </>
                ) : (
                  <>
                    <Gauge className="h-3 w-3" />
                    {userUsage.searches_remaining}/{userUsage.max_searches} searches
                  </>
                )}
              </Badge>
            )}
          
          {/* Search History Button */}
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="history-btn"
                className="rounded-full"
              >
                <History className="h-4 w-4 mr-2" />
                History
                {(searchHistory.length > 0 || savedReports.length > 0) && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {searchHistory.length + savedReports.length}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" data-testid="history-dialog">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Search History & Reports
                </DialogTitle>
                <DialogDescription>
                  Load a saved search or view historical reports.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="reports" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="reports" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Reports ({savedReports.length})
                  </TabsTrigger>
                  <TabsTrigger value="searches" className="gap-2">
                    <Search className="h-4 w-4" />
                    Searches ({searchHistory.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="reports" className="mt-4">
                  {savedReports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p>No saved reports yet</p>
                      <p className="text-sm mt-1">Save a report after running a search</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[280px] pr-4">
                      <div className="space-y-2">
                        {savedReports.map((report) => (
                          <div
                            key={report.id}
                            className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={() => viewReport(report.id)}
                            data-testid={`report-item-${report.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{report.name}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {report.channels_count} channels • {report.keywords?.length || 0} keywords
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(report.created_at).toLocaleDateString()} at {new Date(report.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          viewReport(report.id);
                                        }}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View report</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={(e) => deleteReport(report.id, e)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
                
                <TabsContent value="searches" className="mt-4">
                  {searchHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p>No saved searches yet</p>
                      <p className="text-sm mt-1">Save a search configuration to re-run later</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[280px] pr-4">
                      <div className="space-y-2">
                        {searchHistory.map((search) => (
                          <div
                            key={search.id}
                            className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={() => loadSavedSearch(search)}
                            data-testid={`history-item-${search.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{search.name}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {search.keywords.length} keywords • {search.filters.search_mode?.replace("_", " + ")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Subs: {search.filters.min_subscribers?.toLocaleString()}-{search.filters.max_subscribers?.toLocaleString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          runSavedSearch(search);
                                        }}
                                      >
                                        <Play className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Run search</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={(e) => deleteSavedSearch(search.id, e)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

            {/* User Menu */}
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBugReportOpen(true)}
                      className="text-slate-500 hover:text-slate-900"
                      data-testid="bug-report-btn"
                    >
                      <Bug className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Report a Bug</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-xs text-slate-500 hidden sm:inline">{user?.email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { navigate("/"); setTimeout(logout, 100); }}
                className="text-slate-500 hover:text-slate-900"
                data-testid="logout-btn"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
        </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden border-b bg-white/60 backdrop-blur-sm px-4 py-2 flex gap-1 overflow-x-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 whitespace-nowrap">
          <Search className="h-3 w-3" /> Prospect Finder
        </button>
        <button onClick={() => navigate("/dashboard/outreach")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 whitespace-nowrap">
          <Mail className="h-3 w-3" /> Outreach
        </button>
        <button onClick={() => navigate("/dashboard/getting-started")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 whitespace-nowrap">
          <BookOpen className="h-3 w-3" /> Getting Started
        </button>
      </div>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* User Usage Display for Free Tier */}
        {userUsage && !userUsage.is_unlimited && (
          <Card className="bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border-indigo-100/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Gauge className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Free Plan — {userUsage.searches_remaining} of {userUsage.max_searches} searches remaining this month</p>
                    <p className="text-xs text-slate-500">Results limited to 10 channels per search. Upgrade for unlimited.</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className="btn-gradient"
                  onClick={() => navigate("/pricing")}
                >
                  Upgrade to Pro
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Panel */}
        <Card className="glass-card" data-testid="search-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Search className="h-5 w-5 text-indigo-500" />
              Search Configuration
            </CardTitle>
            <CardDescription>
              Select your niche, enter keywords, and find YouTube affiliate prospects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Niche Selector */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Select Your Niche
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {niches.map((niche) => (
                  <button
                    key={niche.key}
                    onClick={() => selectNiche(niche)}
                    className={`p-4 rounded-xl border-2 transition-all text-left hover:shadow-md ${
                      selectedNiche?.key === niche.key
                        ? 'border-indigo-500 bg-indigo-50/80 shadow-md'
                        : 'border-slate-200 bg-white hover:border-indigo-200'
                    }`}
                    data-testid={`niche-${niche.key}`}
                  >
                    <div className="text-2xl mb-2">{niche.icon}</div>
                    <div className="font-medium text-sm text-slate-900">{niche.name}</div>
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">{niche.description}</div>
                  </button>
                ))}
              </div>
              {!selectedNiche && (
                <p className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Please select a niche to continue
                </p>
              )}
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (one per line)</Label>
              <Textarea
                id="keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                rows={6}
                className={`font-mono text-sm ${!selectedNiche ? 'bg-slate-50' : ''}`}
                placeholder={keywordPlaceholder}
                disabled={!selectedNiche}
                data-testid="keywords-input"
              />
              {selectedNiche && (
                <p className="text-xs text-slate-500">
                  Searching in <span className="font-medium text-indigo-600">{selectedNiche.name}</span> niche
                </p>
              )}
            </div>

            {/* Filters Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-subs">Min Subscribers</Label>
                <Input
                  id="min-subs"
                  type="number"
                  value={minSubs}
                  onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; e.target.value = String(v); setMinSubs(v); }}
                  data-testid="min-subs-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-subs">Max Subscribers</Label>
                <Input
                  id="max-subs"
                  type="number"
                  value={maxSubs}
                  onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; e.target.value = String(v); setMaxSubs(v); }}
                  data-testid="max-subs-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uploaded-within">Uploaded Within (days)</Label>
                <Input
                  id="uploaded-within"
                  type="number"
                  value={uploadedWithin}
                  onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; e.target.value = String(v); setUploadedWithin(v); }}
                  data-testid="uploaded-within-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-results">Max Results/Keyword</Label>
                <Input
                  id="max-results"
                  type="number"
                  value={maxResults}
                  onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; e.target.value = String(v); setMaxResults(v); }}
                  max={50}
                  data-testid="max-results-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-mode">Search Mode</Label>
                <Select
                  value={searchMode}
                  onValueChange={setSearchMode}
                  data-testid="search-mode-select"
                >
                  <SelectTrigger id="search-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="channels_videos">
                      Channels + Videos
                    </SelectItem>
                    <SelectItem value="channels_only">Channels Only</SelectItem>
                    <SelectItem value="videos_only">Videos Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Settings */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <SlidersHorizontal className="h-4 w-4" />
                    Advanced Settings
                    {searchPreset !== "balanced" && (
                      <Badge variant="secondary" className="text-xs">
                        {SEARCH_PRESETS[searchPreset]?.name}
                      </Badge>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                {/* Presets */}
                <div className="space-y-2">
                  <Label className="text-sm">Search Preset</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(SEARCH_PRESETS).map(([key, preset]) => (
                      <Button
                        key={key}
                        variant={searchPreset === key ? "default" : "outline"}
                        size="sm"
                        className="flex flex-col h-auto py-2"
                        onClick={() => applyPreset(key)}
                        data-testid={`preset-${key}`}
                      >
                        <span>{preset.icon}</span>
                        <span className="text-xs">{preset.name}</span>
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {SEARCH_PRESETS[searchPreset]?.description}
                  </p>
                </div>

                <Separator />

                {/* Fine-tune Controls */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="videos-to-scan" className="text-sm">Videos per Channel</Label>
                    <Input
                      id="videos-to-scan"
                      type="number"
                      min={1}
                      max={20}
                      value={videosToScan}
                      onChange={(e) => {
                        setVideosToScan(Number(e.target.value));
                        setSearchPreset("custom");
                      }}
                      data-testid="videos-to-scan-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-channels" className="text-sm">Max Channels</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="max-channels"
                        type="number"
                        min={50}
                        max={500}
                        value={maxChannelsToEnrich}
                        onChange={(e) => {
                          setMaxChannelsToEnrich(Number(e.target.value));
                          setSearchPreset("custom");
                        }}
                        disabled={unlimitedChannels}
                        className={unlimitedChannels ? "opacity-50" : ""}
                        data-testid="max-channels-input"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Unlimited Channels</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={unlimitedChannels}
                        onCheckedChange={(checked) => {
                          setUnlimitedChannels(checked);
                          setSearchPreset("custom");
                        }}
                        data-testid="unlimited-channels-switch"
                      />
                      <span className="text-sm text-muted-foreground">All</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Scan Video Descriptions</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={scanVideoDescriptions}
                        onCheckedChange={(checked) => {
                          setScanVideoDescriptions(checked);
                          setSearchPreset("custom");
                        }}
                        data-testid="scan-descriptions-switch"
                      />
                      <span className="text-xs text-muted-foreground">
                        {scanVideoDescriptions ? "+quota" : "Off"}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Affiliate Platforms */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    Detect Affiliate Platform Links
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select platforms to scan for in channel and video descriptions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availablePlatforms.map((platform) => (
                      <Button
                        key={platform.key}
                        variant={affiliatePlatforms.includes(platform.key) ? "default" : "outline"}
                        size="sm"
                        onClick={() => togglePlatform(platform.key)}
                        className="text-xs"
                        data-testid={`platform-${platform.key}`}
                      >
                        {platform.name}
                      </Button>
                    ))}
                  </div>
                  {affiliatePlatforms.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {scanVideoDescriptions 
                        ? "Will scan channel + video descriptions for links" 
                        : "Will scan channel descriptions only. Enable 'Scan Video Descriptions' for deeper search."}
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Search Button */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={runSearch}
                  disabled={isSearching || !selectedNiche}
                  className="gap-2 btn-gradient"
                  data-testid="search-btn"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isSearching ? "Searching..." : "Search Channels"}
                </Button>
                
                {/* Save Search Dialog */}
                <Dialog open={saveSearchOpen} onOpenChange={setSaveSearchOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!keywords.trim()}
                      data-testid="save-search-btn"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Search
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="save-search-dialog">
                    <DialogHeader>
                      <DialogTitle>Save Search</DialogTitle>
                      <DialogDescription>
                        Save this search configuration to quickly run it again later.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="search-name">Search Name</Label>
                        <Input
                          id="search-name"
                          placeholder="e.g., Automation YouTubers Q1 2026"
                          value={searchName}
                          onChange={(e) => setSearchName(e.target.value)}
                          data-testid="search-name-input"
                        />
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Keywords:</strong> {keywords.split("\n").filter(k => k.trim()).length}</p>
                        <p><strong>Filters:</strong> {minSubs.toLocaleString()}-{maxSubs.toLocaleString()} subs, {uploadedWithin} days</p>
                        <p><strong>Mode:</strong> {searchMode.replace("_", " + ")}</p>
                        {channels.length > 0 && (
                          <p><strong>Last Results:</strong> {channels.length} channels</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSaveSearchOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveCurrentSearch} data-testid="confirm-save-search-btn" className="btn-gradient">
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              {isSearching && (
                <div className="flex-1">
                  <Progress value={searchProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchStatus}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enrich Channels Card - shows after search, before enrichment */}
        {rawSearchResults && rawSearchResults.total_found > 0 && channels.length === 0 && !isEnriching && (
          <Card className="glass-card border-indigo-200/50 bg-gradient-to-r from-indigo-50/40 to-purple-50/40" data-testid="enrich-prompt-card">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full p-2.5">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">
                      {rawSearchResults.total_found} channels found
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Enrich to get scores, affiliate signals, and contact info.
                      {!unlimitedChannels && rawSearchResults.total_found > maxChannelsToEnrich && (
                        <span className="text-amber-600 ml-1">
                          (Will enrich top {maxChannelsToEnrich} — adjust in Advanced Settings)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setRawSearchResults(null); setSearchStatus(""); }}
                    data-testid="discard-search-btn"
                    className="rounded-full"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Discard
                  </Button>
                  <Button
                    onClick={runEnrichment}
                    className="gap-2 btn-gradient"
                    data-testid="enrich-all-btn"
                  >
                    <Zap className="h-4 w-4" />
                    Enrich All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enrichment Progress */}
        {isEnriching && (
          <Card className="glass-card" data-testid="enrichment-progress-card">
            <CardContent className="py-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-medium">{enrichStatus}</span>
                </div>
                <Progress value={enrichProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

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
                  <Dialog open={saveReportOpen} onOpenChange={setSaveReportOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={sortedChannels.length === 0}
                        data-testid="save-report-btn"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Save Report
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="save-report-dialog">
                      <DialogHeader>
                        <DialogTitle>Save Report</DialogTitle>
                        <DialogDescription>
                          Save this search with all results for future reference.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="report-name">Report Name</Label>
                          <Input
                            id="report-name"
                            placeholder="e.g., Automation Prospects Jan 2026"
                            value={reportName}
                            onChange={(e) => setReportName(e.target.value)}
                            data-testid="report-name-input"
                          />
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-md">
                          <p><strong>Channels:</strong> {sortedChannels.length}</p>
                          <p><strong>Shortlisted:</strong> {shortlist.size}</p>
                          <p><strong>Keywords:</strong> {keywords.split("\n").filter(k => k.trim()).length}</p>
                          <p><strong>Filters:</strong> {minSubs.toLocaleString()}-{maxSubs.toLocaleString()} subs</p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveReportOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={saveReport} data-testid="confirm-save-report-btn" className="btn-gradient">
                          <FileText className="h-4 w-4 mr-2" />
                          Save Report
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCSV(true)}
                    disabled={shortlist.size === 0}
                    data-testid="export-shortlist-btn"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Shortlist
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCSV(false)}
                    disabled={sortedChannels.length === 0}
                    data-testid="export-all-btn"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export All
                  </Button>
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

        {/* Empty State */}
        {!isSearching && !isEnriching && channels.length === 0 && !rawSearchResults && (
          <Card className="border-dashed glass-card" data-testid="empty-state">
            <CardContent className="empty-state py-16">
              <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full p-4 mb-4">
                <Search className="h-8 w-8 text-indigo-500" />
              </div>
              <h3 className="text-lg font-heading font-semibold mb-2">
                No channels found yet
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Select a niche above, add your keywords, then click
                "Search Channels" to find YouTube creators.
              </p>
              {!selectedNiche && (
                <p className="mt-3 text-sm text-amber-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Select a niche to get started
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Bug Report Dialog */}
      <Dialog open={bugReportOpen} onOpenChange={setBugReportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-orange-500" />
              Report a Bug
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bug-subject">Subject</Label>
              <Input
                id="bug-subject"
                placeholder="Brief summary of the issue"
                value={bugSubject}
                onChange={(e) => setBugSubject(e.target.value)}
                data-testid="bug-subject-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-severity">Severity</Label>
              <Select value={bugSeverity} onValueChange={setBugSeverity}>
                <SelectTrigger data-testid="bug-severity-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low — Minor issue, workaround exists</SelectItem>
                  <SelectItem value="medium">Medium — Feature not working correctly</SelectItem>
                  <SelectItem value="high">High — Major feature broken</SelectItem>
                  <SelectItem value="critical">Critical — App unusable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-description">Description</Label>
              <Textarea
                id="bug-description"
                placeholder="What happened? What did you expect to happen?"
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                rows={3}
                data-testid="bug-description-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-steps">Steps to Reproduce (optional)</Label>
              <Textarea
                id="bug-steps"
                placeholder="1. Go to...\n2. Click on...\n3. See error..."
                value={bugSteps}
                onChange={(e) => setBugSteps(e.target.value)}
                rows={3}
                data-testid="bug-steps-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBugReportOpen(false)}>Cancel</Button>
            <Button
              onClick={submitBugReport}
              disabled={bugSubmitting}
              className="btn-gradient"
              data-testid="bug-submit-btn"
            >
              {bugSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Channel Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          className="w-full sm:max-w-lg overflow-y-auto"
          data-testid="channel-detail-sheet"
        >
          {selectedChannel && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedChannel.channel_name}
                  <a
                    href={selectedChannel.channel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </SheetTitle>
                <SheetDescription>
                  {selectedChannel.search_source === "both"
                    ? "Found via channel & video search"
                    : `Found via ${selectedChannel.search_source?.replace(
                        "_",
                        " "
                      )}`}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Score Summary */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Score Breakdown</h4>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge
                      className={`${getScoreClass(
                        selectedChannel.score_total
                      )} text-lg px-3 py-1`}
                    >
                      {selectedChannel.score_total}/100
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Total Score
                    </span>
                    <Badge
                      className={`${getAffiliateScoreClass(
                        selectedChannel.affiliate_score || 0
                      )} text-lg px-3 py-1`}
                    >
                      {selectedChannel.affiliate_score || 0}/100
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Affiliate Score
                    </span>
                  </div>
                  <div className="score-breakdown">
                    <div className="score-item">
                      <span className="text-xs">Topic Relevance</span>
                      <span className="font-mono text-sm">
                        {selectedChannel.score_topic}/30
                      </span>
                    </div>
                    <div className="score-item">
                      <span className="text-xs">Tutorial Intent</span>
                      <span className="font-mono text-sm">
                        {selectedChannel.score_tutorial}/20
                      </span>
                    </div>
                    <div className="score-item">
                      <span className="text-xs">Activity</span>
                      <span className="font-mono text-sm">
                        {selectedChannel.score_activity}/15
                      </span>
                    </div>
                    <div className="score-item">
                      <span className="text-xs">Subscriber Fit</span>
                      <span className="font-mono text-sm">
                        {selectedChannel.score_subscriber}/15
                      </span>
                    </div>
                    <div className="score-item">
                      <span className="text-xs">Engagement</span>
                      <span className="font-mono text-sm">
                        {selectedChannel.score_engagement}/10
                      </span>
                    </div>
                    <div className="score-item">
                      <span className="text-xs">Contactability</span>
                      <span className="font-mono text-sm">
                        {selectedChannel.score_contactability}/10
                      </span>
                    </div>
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
                        {selectedChannel.affiliate_signals_count || 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-amber-50 border border-amber-100">
                      <p className="text-xs text-amber-600">Commercial Signals</p>
                      <p className="font-mono text-lg font-semibold text-amber-700">
                        {selectedChannel.commercial_signals_count || 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-emerald-50 border border-emerald-100">
                      <p className="text-xs text-emerald-600">Brand Contact Signals</p>
                      <p className="font-mono text-lg font-semibold text-emerald-700">
                        {selectedChannel.brand_contact_signals_count || 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-blue-50 border border-blue-100">
                      <p className="text-xs text-blue-600">Business Email</p>
                      <p className="font-mono text-sm font-semibold text-blue-700">
                        {selectedChannel.has_business_email ? (
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
                        {selectedChannel.tools_stack_signal_score || 0}/30
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedChannel.has_affiliate_language && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        <Link className="h-3 w-3 mr-1" />
                        Has Affiliate Links
                      </Badge>
                    )}
                    {selectedChannel.does_reviews && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Does Reviews
                      </Badge>
                    )}
                    {selectedChannel.has_link_in_bio && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Link in Bio
                      </Badge>
                    )}
                    {selectedChannel.product_monetization && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        <ShoppingBag className="h-3 w-3 mr-1" />
                        Sells Products
                      </Badge>
                    )}
                    {(selectedChannel.brand_contact_signals_count > 0 || selectedChannel.has_business_email) && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <Handshake className="h-3 w-3 mr-1" />
                        Open to Brand Deals
                      </Badge>
                    )}
                    {selectedChannel.tools_section_detected && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        <Wrench className="h-3 w-3 mr-1" />
                        Likely Affiliate Creator
                      </Badge>
                    )}
                  </div>
                  
                  {/* Business Email Display */}
                  {selectedChannel.business_email && (
                    <div className="p-3 rounded-md bg-blue-50 border border-blue-100 mb-3">
                      <p className="text-xs text-blue-600 mb-1">Business Email</p>
                      <a 
                        href={`mailto:${selectedChannel.business_email}`} 
                        className="text-sm text-blue-700 font-medium hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {selectedChannel.business_email}
                      </a>
                    </div>
                  )}
                  
                  {/* Brand Contact Signals */}
                  {selectedChannel.brand_contact_signals?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-2">Brand contact phrases found:</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedChannel.brand_contact_signals.map((sig) => (
                          <span key={sig} className="tag bg-emerald-50 text-emerald-700 border-emerald-200">
                            {sig}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedChannel.commercial_signals?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedChannel.commercial_signals.map((sig) => (
                        <span key={sig} className="tag bg-amber-50 text-amber-700 border-amber-200">
                          {sig}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Tools Section Detected */}
                  {selectedChannel.tools_section_phrases?.length > 0 && (
                    <div className="mt-3 p-3 rounded-md bg-orange-50 border border-orange-100">
                      <p className="text-xs font-medium text-orange-700 mb-2 flex items-center gap-1">
                        <Wrench className="h-3.5 w-3.5" />
                        Tool Stack Phrases Detected
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedChannel.tools_section_phrases.map((phrase) => (
                          <span key={phrase} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                            "{phrase}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Affiliate Platform Links */}
                  {selectedChannel.affiliate_platforms_found?.length > 0 && (
                    <div className="mt-3 p-3 rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                      <p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Affiliate Platform Links Found
                      </p>
                      <div className="space-y-2">
                        {selectedChannel.affiliate_platforms_found.map((platform) => (
                          <div key={platform}>
                            <p className="text-xs font-medium text-purple-600 capitalize">{platform}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedChannel.affiliate_platform_links?.[platform]?.slice(0, 3).map((url, i) => (
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
                              {(selectedChannel.affiliate_platform_links?.[platform]?.length || 0) > 3 && (
                                <span className="text-xs text-purple-500">
                                  +{selectedChannel.affiliate_platform_links[platform].length - 3} more
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
                      <p className="text-xs text-muted-foreground">
                        Subscribers
                      </p>
                      <p className="font-mono text-lg font-semibold">
                        {selectedChannel.hidden_subscriber_count
                          ? "Hidden"
                          : formatNumber(selectedChannel.subscriber_count)}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        Avg Views (Recent)
                      </p>
                      <p className="font-mono text-lg font-semibold">
                        {formatNumber(selectedChannel.avg_views_recent)}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        Total Videos
                      </p>
                      <p className="font-mono text-lg font-semibold">
                        {formatNumber(selectedChannel.video_count)}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        Last Upload
                      </p>
                      <p className="font-mono text-lg font-semibold">
                        {selectedChannel.days_since_upload !== null
                          ? `${selectedChannel.days_since_upload}d ago`
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Tags */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Tags & Signals</h4>
                  <div className="space-y-2">
                    {selectedChannel.topic_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedChannel.topic_tags.map((tag) => (
                          <span key={tag} className="tag tag-topic">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedChannel.affiliate_signals?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedChannel.affiliate_signals.map((sig) => (
                          <span key={sig} className="tag tag-signal">
                            {sig}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedChannel.keywords_found_by?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Keywords:{" "}
                        {selectedChannel.keywords_found_by.join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Contact Links */}
                {Object.keys(selectedChannel.public_links || {}).length > 0 && (
                  <>
                    <div>
                      <h4 className="text-sm font-semibold mb-3">
                        Contact Links
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(selectedChannel.public_links).map(
                          ([platform, url]) => (
                            <a
                              key={platform}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {platform.charAt(0).toUpperCase() +
                                platform.slice(1)}
                            </a>
                          )
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Recent Videos */}
                {selectedChannel.recent_videos?.length > 0 && (
                  <>
                    <div>
                      <h4 className="text-sm font-semibold mb-3">
                        Recent Videos
                      </h4>
                      <div className="video-list">
                        {selectedChannel.recent_videos.map((video) => (
                          <div key={video.video_id} className="video-item">
                            <p className="text-sm font-medium line-clamp-2">
                              {video.title}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>
                                {formatNumber(video.view_count)} views
                              </span>
                              <span>
                                {new Date(
                                  video.published_at
                                ).toLocaleDateString()}
                              </span>
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
                    {selectedChannel.description || "No description available"}
                  </p>
                </div>

                <Separator />

                {/* Notes */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Notes</h4>
                  <Textarea
                    placeholder="Add your notes about this channel..."
                    value={selectedChannel.notes || ""}
                    onChange={(e) =>
                      updateNotes(
                        selectedChannel.channel_id,
                        e.target.value
                      )
                    }
                    rows={3}
                    className="text-sm"
                    data-testid="channel-notes-input"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant={
                      shortlist.has(selectedChannel.channel_id)
                        ? "default"
                        : "outline"
                    }
                    className="flex-1"
                    onClick={() =>
                      toggleShortlist(selectedChannel.channel_id)
                    }
                    data-testid="detail-shortlist-btn"
                  >
                    {shortlist.has(selectedChannel.channel_id) ? (
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
                  <Button
                    variant="outline"
                    asChild
                  >
                    <a
                      href={selectedChannel.channel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Youtube className="h-4 w-4 mr-2" />
                      View Channel
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Historical Report View */}
      {viewingReport && (
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
                  // Export report channels to CSV
                  const idsToExport = viewingReport.channels.map(ch => ch.channel_id);
                  exportCSV(false, viewingReport.channels);
                }}
                data-testid="export-report-btn"
              >
                <Download className="h-4 w-4 mr-2" />
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

            {/* Report Results Table */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading">Channels</CardTitle>
                <CardDescription>
                  Results from this saved report (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Score</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Subscribers</TableHead>
                        <TableHead className="text-right">Avg Views</TableHead>
                        <TableHead className="text-right">Last Upload</TableHead>
                        <TableHead>Topics</TableHead>
                        <TableHead>Signals</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingReport.channels
                        ?.sort((a, b) => (b.score_total || 0) - (a.score_total || 0))
                        .map((channel) => (
                        <TableRow
                          key={channel.channel_id}
                          className={`table-row-hover ${viewingReport.shortlisted_ids?.includes(channel.channel_id) ? 'bg-primary/5' : ''}`}
                          onClick={() => {
                            setSelectedChannel(channel);
                            setDetailOpen(true);
                          }}
                        >
                          <TableCell>
                            <Badge
                              className={`${getScoreClass(channel.score_total)} font-mono`}
                            >
                              {channel.score_total}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate max-w-[200px]">
                                  {channel.channel_name}
                                </span>
                                {viewingReport.shortlisted_ids?.includes(channel.channel_id) && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {channel.keywords_found_by?.join(", ")}
                              </span>
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
                              {channel.affiliate_signals?.slice(0, 2).map((sig) => (
                                <span key={sig} className="tag tag-signal">
                                  {sig}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </main>
        </div>
      )}

      {/* Loading Report Overlay */}
      {loadingReport && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading report...</p>
          </div>
        </div>
      )}
    </div>
  );
}
