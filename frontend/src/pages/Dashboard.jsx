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
  Shield,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import TrialBanner from "@/components/TrialBanner";
import CountryFilter from "@/components/CountryFilter";
import DropLogPanel from "@/components/DropLogPanel";
import SearchTemplatePicker from "@/components/SearchTemplatePicker";
import { flagEmoji, countryName } from "@/lib/countries";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Bug, BookOpen, Calendar, MessageSquare, XCircle, Plus, ArrowUp, ArrowDown, Minus, Activity, TrendingUp, CreditCard, User as UserIcon, ChevronDown as ChevronDownIcon, Gift, ExternalLink as ExternalLinkIcon } from "lucide-react";
import { useSearchResults } from "@/contexts/SearchResultsContext";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import {
  ENGAGEMENT_HEALTH_CONFIG,
  UPLOAD_CONSISTENCY_ICONS,
  computeHealthIndicators,
} from "@/lib/healthIndicators";
import { SEARCH_PRESETS, DEFAULT_KEYWORD_PLACEHOLDER } from "@/lib/searchPresets";
import { OUTREACH_STATUS_CONFIG } from "@/lib/outreachConfig";
import BugReportDialog from "@/pages/dashboard/dialogs/BugReportDialog";
import AddToPipelineDialog from "@/pages/dashboard/dialogs/AddToPipelineDialog";
import SaveSearchDialog from "@/pages/dashboard/dialogs/SaveSearchDialog";
import SaveReportDialog from "@/pages/dashboard/dialogs/SaveReportDialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const searchResults = useSearchResults();

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
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const isFreeUser = userUsage?.tier === "free";

  const [keywords, setKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");
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
  const [hidePipelineChannels, setHidePipelineChannels] = useState(false);
  const [pipelineChannelIds, setPipelineChannelIds] = useState(new Set());

  // Super Search (admin only)
  const [superSearch, setSuperSearch] = useState(false);
  const [strictMode, setStrictMode] = useState(false);
  const [competitorBrands, setCompetitorBrands] = useState([]);
  const [competitorInput, setCompetitorInput] = useState("");
  // Super Search results: hide Reject-graded channels by default
  const [showRejected, setShowRejected] = useState(false);

  // Geography filter (search-time)
  const [targetCountries, setTargetCountries] = useState([]); // ISO codes
  const [includeUnknownCountry, setIncludeUnknownCountry] = useState(true);
  // Geography filter (post-search results filter — independent from search-time selection)
  const [resultsCountries, setResultsCountries] = useState([]);
  const [resultsIncludeUnknown, setResultsIncludeUnknown] = useState(true);

  // Drop log — combined from /search and /channels/enrich responses
  const [dropLog, setDropLog] = useState([]);

  // Saved Search Templates (Step 1 picker)
  const [showTemplatePicker, setShowTemplatePicker] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [quotaEstimate, setQuotaEstimate] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchStatus, setSearchStatus] = useState("");

  // Channels state from shared context (persists across navigation)
  const channels = searchResults.channels;
  const setChannels = searchResults.setChannels;
  const rawSearchResults = searchResults.rawSearchResults;
  const setRawSearchResults = searchResults.setRawSearchResults;

  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [enrichStatus, setEnrichStatus] = useState("");
  const [shortlist, setShortlist] = useState(new Set());
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sponsorshipData, setSponsorshipData] = useState(null);
  const [sponsorshipLoading, setSponsorshipLoading] = useState(false);

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
  const [filterOutreachStatus, setFilterOutreachStatus] = useState("all");
  const [filterEngagementHealth, setFilterEngagementHealth] = useState("all");

  // Outreach state for detail panel
  const [outreachStatusUpdating, setOutreachStatusUpdating] = useState(false);
  const [followUpDateUpdating, setFollowUpDateUpdating] = useState(false);
  const [contactNoteText, setContactNoteText] = useState("");

  // Follow-ups due count
  const [followUpsDueCount, setFollowUpsDueCount] = useState(0);

  // Add to Pipeline dialog state
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [pipelineChannel, setPipelineChannel] = useState(null);
  const [pipelineProjectName, setPipelineProjectName] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState("not_contacted");
  const [userProjects, setUserProjects] = useState([]);
  const [pipelineAdding, setPipelineAdding] = useState(false);

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
  const [reportSortBy, setReportSortBy] = useState("score_total");
  const [reportSortOrder, setReportSortOrder] = useState("desc");
  const [reportFilterMinScore, setReportFilterMinScore] = useState(0);
  const [reportFilterHighAffiliate, setReportFilterHighAffiliate] = useState(false);
  const [reportFilterHasPlatformLinks, setReportFilterHasPlatformLinks] = useState(false);
  const [reportFilterOutreachStatus, setReportFilterOutreachStatus] = useState("all");
  const [reportFilterEngagementHealth, setReportFilterEngagementHealth] = useState("all");
  const [reportPage, setReportPage] = useState(1);
  const [loadingReport, setLoadingReport] = useState(false);

  // Load niches and user usage on mount
  useEffect(() => {
    loadNiches();
    loadUserUsage();
    loadShortlist();
    loadSearchHistory();
    loadSavedReports();
    loadAffiliatePlatforms();
    loadFollowUpsDue();
    loadPipelineIds();
    if (user?.role === "admin") loadCompetitorBrands();
    // Restore search results: first try session, then autosave
    if (channels.length === 0) {
      const restored = searchResults.restoreFromSession();
      if (!restored) {
        loadAutoSaved();
      }
    }
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
      if (res.data.access_expired) {
        toast.error("Your trial access has expired. You've been moved to the Free plan.", { id: "access-expired", duration: 10000 });
      }
      if (res.data.search_warning === "approaching_limit") {
        toast.warning("You're approaching your monthly search limit. Need more searches? Get in touch and we'll arrange a higher quota for your account.", { id: "search-warning", duration: 10000 });
      }
    } catch (e) {
      console.error("Error loading user usage:", e);
    }
  };

  const selectNiche = (niche) => {
    setSelectedNiche(niche);
    setKeywordPlaceholder(niche.placeholder_examples || DEFAULT_KEYWORD_PLACEHOLDER);
  };

  // Pre-fill the search form from a Saved Search Template
  const applyTemplate = (template) => {
    if (!template) return;
    // Resolve niche from loaded niches list (fallback to saas_software if not found)
    const niche =
      niches.find((n) => n.key === (template.niche || "saas_software")) ||
      niches.find((n) => n.key === "saas_software") ||
      niches[0];
    if (niche) selectNiche(niche);
    setKeywords((template.keywords || []).join("\n"));
    setExcludeKeywords((template.exclude_keywords || []).join("\n"));
    if (typeof template.min_subscribers === "number") setMinSubs(template.min_subscribers);
    if (typeof template.max_subscribers === "number") setMaxSubs(template.max_subscribers);
    if (typeof template.super_search === "boolean") setSuperSearch(template.super_search);
    if (typeof template.strict_mode === "boolean") setStrictMode(template.strict_mode);
    setSelectedTemplate(template);
    setShowTemplatePicker(false);
    // Scroll user to the keyword input after a tick so they land on the editable form
    setTimeout(() => {
      const el = document.querySelector('[data-testid="keywords-input"], textarea');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  // Skip the picker — user wants a blank custom search
  const skipTemplatePicker = () => {
    setShowTemplatePicker(false);
    setSelectedTemplate(null);
  };

  // If the user is returning to the search page with existing state (keywords typed,
  // results loaded, or a saved report being viewed), skip the template picker.
  useEffect(() => {
    if (keywords.trim() || channels.length > 0 || viewingReport) {
      setShowTemplatePicker(false);
    }
    // Only run on first mount — after that, the user explicitly controls visibility
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAffiliatePlatforms = async () => {
    try {
      const res = await api.get("/affiliate-platforms");
      setAvailablePlatforms(res.data.platforms || []);
    } catch (e) {
      console.error("Error loading affiliate platforms:", e);
    }
  };

  const loadPipelineIds = async () => {
    try {
      const res = await api.get("/channels/by-outreach-status");
      setPipelineChannelIds(new Set((res.data.channels || []).map(ch => ch.channel_id)));
    } catch (e) {
      setPipelineChannelIds(new Set());
    }
  };

  const loadCompetitorBrands = async () => {
    try {
      const res = await api.get("/admin/competitor-brands");
      const brands = res.data.competitor_brands || [];
      setCompetitorBrands(brands);
      setCompetitorInput(brands.join(", "));
    } catch (e) {
      // not critical
    }
  };

  const saveCompetitorBrands = async () => {
    const brands = competitorInput.split(",").map(b => b.trim()).filter(Boolean);
    try {
      await api.put("/admin/competitor-brands", { competitor_brands: brands });
      setCompetitorBrands(brands);
      toast.success("Competitor brands saved");
    } catch (e) {
      toast.error("Failed to save competitor brands");
    }
  };

  const loadFollowUpsDue = async () => {
    try {
      const res = await api.get("/channels/follow-ups/due");
      setFollowUpsDueCount(res.data.count || 0);
    } catch (e) {
      console.error("Error loading follow-ups:", e);
    }
  };

  const updateOutreachStatus = async (channelId, status, note) => {
    setOutreachStatusUpdating(true);
    try {
      await api.patch(`/channels/${channelId}/outreach-status`, { status, note: note || null });
      toast.success(`Status updated to ${OUTREACH_STATUS_CONFIG[status]?.label || status}`);
      // Update local state
      setChannels(prev => prev.map(ch => ch.channel_id === channelId ? { ...ch, outreach_status: status } : ch));
      if (selectedChannel?.channel_id === channelId) {
        const logEntry = { timestamp: new Date().toISOString(), status, note: note || "" };
        setSelectedChannel(prev => ({
          ...prev,
          outreach_status: status,
          contact_log: [...(prev.contact_log || []), logEntry]
        }));
      }
      setContactNoteText("");
      loadFollowUpsDue();
      loadPipelineIds();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update status");
    } finally {
      setOutreachStatusUpdating(false);
    }
  };

  const updateFollowUpDate = async (channelId, date) => {
    setFollowUpDateUpdating(true);
    try {
      const dateStr = date ? date.toISOString().split("T")[0] : null;
      await api.patch(`/channels/${channelId}/follow-up-date`, { follow_up_date: dateStr });
      toast.success(date ? `Follow-up set for ${dateStr}` : "Follow-up date cleared");
      setChannels(prev => prev.map(ch => ch.channel_id === channelId ? { ...ch, follow_up_date: dateStr } : ch));
      if (selectedChannel?.channel_id === channelId) {
        setSelectedChannel(prev => ({ ...prev, follow_up_date: dateStr }));
      }
      loadFollowUpsDue();
    } catch (e) {
      toast.error("Failed to update follow-up date");
    } finally {
      setFollowUpDateUpdating(false);
    }
  };

  const loadUserProjects = async () => {
    try {
      const res = await api.get("/pipeline/projects");
      setUserProjects(res.data.projects || []);
    } catch (e) {
      console.error("Error loading projects:", e);
    }
  };

  const openPipelineDialog = (channel) => {
    setPipelineChannel(channel);
    setPipelineProjectName("");
    setPipelineStatus("contacted");
    setPipelineDialogOpen(true);
    loadUserProjects();
  };

  const addToPipeline = async () => {
    if (!pipelineChannel) return;
    setPipelineAdding(true);
    try {
      await api.patch(`/channels/${pipelineChannel.channel_id}/outreach-status`, {
        status: pipelineStatus,
        project_name: pipelineProjectName.trim() || null,
        note: "Added to pipeline"
      });
      toast.success(`${pipelineChannel.channel_name} added to pipeline`);
      setChannels(channels.map(ch =>
        ch.channel_id === pipelineChannel.channel_id
          ? { ...ch, outreach_status: pipelineStatus, project_name: pipelineProjectName.trim() || null }
          : ch
      ));
      if (selectedChannel?.channel_id === pipelineChannel.channel_id) {
        setSelectedChannel(prev => ({ ...prev, outreach_status: pipelineStatus, project_name: pipelineProjectName.trim() || null }));
      }
      setPipelineDialogOpen(false);
      loadFollowUpsDue();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to add to pipeline");
    } finally {
      setPipelineAdding(false);
    }
  };

  const autoSaveResults = async (channelData, rawData, metadata) => {
    try {
      await api.post("/search-results/autosave", {
        channels: channelData,
        raw_search_results: rawData,
        search_metadata: metadata
      });
    } catch (e) {
      console.error("Auto-save failed:", e);
    }
  };

  const loadAutoSaved = async () => {
    try {
      const res = await api.get("/search-results/autosave");
      if (res.data.exists && res.data.channels?.length) {
        setChannels(res.data.channels);
        if (res.data.raw_search_results) setRawSearchResults(res.data.raw_search_results);
        if (res.data.search_metadata) searchResults.setSearchMetadata(res.data.search_metadata);
        return true;
      }
    } catch (e) {
      console.error("Auto-load failed:", e);
    }
    return false;
  };

  const clearSearchResults = async () => {
    setChannels([]);
    setRawSearchResults(null);
    searchResults.setSearchMetadata(null);
    searchResults.clearResults();
    try { await api.delete("/search-results/autosave"); } catch {}
    toast.info("Search results cleared");
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

  // Start Stripe checkout for the 500-draft credit pack ($9.99) — reused for the
  // low-balance "Top up credits" nudge inside the Super Search panel.
  const [buyingCredits, setBuyingCredits] = useState(false);
  const handleBuyCredits = async () => {
    setBuyingCredits(true);
    try {
      const res = await api.post("/checkout/credits", { endorsely_referral: window.endorsely_referral || null });
      if (res.data.url) window.location.href = res.data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start checkout");
    } finally {
      setBuyingCredits(false);
    }
  };

  const runSearch = async () => {    if (!selectedNiche) {
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
      toast.error("Monthly search limit reached. Upgrade your plan or contact us for a higher quota.");
      return;
    }

    setIsSearching(true);
    setSearchProgress(10);
    setSearchStatus("Searching YouTube...");
    setChannels([]);
    setRawSearchResults(null);
    setDropLog([]);

    try {
      const searchRes = await api.post("/search", {
        keywords: keywordList,
        exclude_keywords: excludeKeywords.split("\n").map(k => k.trim()).filter(Boolean),
        niche: selectedNiche.key,
        min_subscribers: minSubs,
        max_subscribers: maxSubs,
        uploaded_within_days: uploadedWithin,
        max_results_per_keyword: maxResults,
        search_mode: searchMode,
      });

      setSearchProgress(100);
      setRawSearchResults(searchRes.data);
      setDropLog(searchRes.data.drops || []);
      
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
        uploaded_within_days: uploadedWithin,
        hide_pipeline_channels: hidePipelineChannels,
        super_search: superSearch,
        competitor_brands: superSearch ? competitorBrands : [],
        strict_mode: superSearch && strictMode,
        target_countries: targetCountries,
        include_unknown_country: includeUnknownCountry,
      });

      setEnrichProgress(100);
      setEnrichStatus(`Complete! ${enrichRes.data.total} channels processed.`);
      setChannels(enrichRes.data.channels);
      // Combine pre-enrichment drops (from /search) with enrichment drops
      setDropLog((prev) => [...prev, ...(enrichRes.data.drops || [])]);
      // When Super Search returns grades, default to sorting by AI grade
      const anyGrade = (enrichRes.data.channels || []).some((c) => c?.ai_assessment?.grade);
      if (anyGrade) {
        setSortBy("ai_grade");
        setSortOrder("desc");
        setShowRejected(false);
      }
      toast.success(`Enriched ${enrichRes.data.total} channels with scores`);

      // Super Search feedback toast + refresh user usage so credit balance updates in UI
      const ss = enrichRes.data.super_search;
      if (ss && ss.requested) {
        if (ss.refunded) {
          toast.error(`Super Search refunded — all AI grading attempts failed. Your 12 credits are back.`);
        } else if (ss.credits_charged > 0) {
          const cachedNote = ss.cached_grades_used > 0 ? `, ${ss.cached_grades_used} from cache (free)` : "";
          const cappedNote = ss.soft_capped ? " · capped at 80 channels" : "";
          toast.success(`Super Search used ${ss.credits_charged} credits — graded ${ss.graded_now} new channels${cachedNote}${cappedNote}`);
        } else if (ss.cached_grades_used > 0 && ss.to_grade === 0) {
          toast.success(`Super Search free — all ${ss.cached_grades_used} channels used cached grades`);
        }
        // Refresh user usage to pull new credit balance
        try { loadUserUsage?.(); } catch (_) { /* ignore */ }
      }
      
      // Auto-save results for persistence
      const meta = {
        niche: selectedNiche?.key,
        keywords: keywords.split("\n").filter(k => k.trim()),
        timestamp: new Date().toISOString(),
        total: enrichRes.data.total
      };
      searchResults.setSearchMetadata(meta);
      autoSaveResults(enrichRes.data.channels, rawSearchResults, meta);
    } catch (e) {
      const detail = e.response?.data?.detail;
      // Insufficient-credit error from Super Search backend
      if (e.response?.status === 402 && typeof detail === "object" && detail?.error === "insufficient_credits") {
        toast.error(detail.message || `Super Search needs 12 credits. You have ${detail.credits_available || 0}.`);
        setEnrichStatus(`Insufficient credits for Super Search`);
      } else {
        const msg = typeof detail === "string" ? detail : (detail?.message || "Enrichment failed");
        toast.error(msg);
        setEnrichStatus(`Error: ${msg}`);
      }
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
      await api.put(`/channels/${channelId}/notes`, { notes });
      setChannels((prev) =>
        prev.map((ch) => (ch.channel_id === channelId ? { ...ch, notes } : ch))
      );
      if (selectedChannel?.channel_id === channelId) {
        setSelectedChannel((prev) => ({ ...prev, notes }));
      }
    } catch (e) {
      console.error("Notes save error:", e?.response?.status, e?.response?.data, e?.message);
      toast.error(e?.response?.data?.detail || "Failed to save notes");
    }
  };

  // Fetch sponsorship data on-demand when detail panel opens
  const fetchSponsorshipData = async (channelId) => {
    setSponsorshipData(null);
    setSponsorshipLoading(true);
    try {
      const res = await api.get(`/channels/${channelId}/sponsorship-data`);
      setSponsorshipData(res.data);
    } catch (e) {
      console.error("Sponsorship fetch error:", e?.response?.status);
      setSponsorshipData(null);
    } finally {
      setSponsorshipLoading(false);
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
    fetchSponsorshipData(channel.channel_id);
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
          exclude_keywords: excludeKeywords.split("\n").map(k => k.trim()).filter(Boolean),
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
    setExcludeKeywords((search.filters.exclude_keywords || []).join("\n"));
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
  const resultsCountrySet = new Set(resultsCountries.map((c) => c.toUpperCase()));
  // AI grade sort weight: A > B > C > Ungraded > Reject
  const GRADE_RANK = { A: 4, B: 3, C: 2, Ungraded: 1, Reject: 0 };
  const gradeRank = (ch) => GRADE_RANK[ch?.ai_assessment?.grade] ?? 1;

  // Detect whether any channel has an AI grade — used to decide if Reject hiding applies
  const hasAnyAIGrade = channels.some((ch) => ch?.ai_assessment?.grade);

  const sortedChannels = [...channels]
    .map(computeHealthIndicators)
    .filter((ch) => ch.score_total >= filterMinScore)
    .filter((ch) => !filterHighAffiliate || (ch.affiliate_score >= 60))
    .filter((ch) => !filterHasPlatformLinks || (ch.affiliate_platforms_found?.length > 0))
    .filter((ch) => filterOutreachStatus === "all" || (ch.outreach_status || "not_contacted") === filterOutreachStatus)
    .filter((ch) => filterEngagementHealth === "all" || (ch.engagement_health || "") === filterEngagementHealth)
    .filter((ch) => !hidePipelineChannels || !pipelineChannelIds.has(ch.channel_id))
    .filter((ch) => {
      if (resultsCountries.length === 0) return true;
      const code = (ch.country || "").toUpperCase();
      if (!code) return resultsIncludeUnknown;
      return resultsCountrySet.has(code);
    })
    // Hide AI-rejected channels by default (only when grades exist)
    .filter((ch) => showRejected || ch?.ai_assessment?.grade !== "Reject")
    .sort((a, b) => {
      if (sortBy === "ai_grade") {
        const diff = gradeRank(b) - gradeRank(a);
        if (diff !== 0) return sortOrder === "desc" ? diff : -diff;
        // Tiebreaker: total score, always desc
        return (b.score_total || 0) - (a.score_total || 0);
      }
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });

  // Count Reject-graded channels so we can label the toggle
  const rejectedCount = channels.filter((ch) => ch?.ai_assessment?.grade === "Reject").length;

  const totalPages = Math.ceil(sortedChannels.length / pageSize);
  const paginatedChannels = sortedChannels.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to page 1 when filters/sort change
  useEffect(() => { setCurrentPage(1); }, [filterMinScore, filterHighAffiliate, filterHasPlatformLinks, filterOutreachStatus, filterEngagementHealth, resultsCountries, resultsIncludeUnknown, sortBy, sortOrder, showRejected, channels]);

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
            <button onClick={() => navigate("/dashboard/pipeline")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all" data-testid="nav-pipeline">
              <Handshake className="h-3.5 w-3.5" />
              Pipeline
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
                    : userUsage.tier === "starter"
                    ? 'border-indigo-200 bg-indigo-50/50 text-indigo-700'
                    : 'border-slate-200 bg-slate-50/50 text-slate-600'
                }`}
              >
                {userUsage.is_unlimited ? (
                  <>
                    <Zap className="h-3 w-3" />
                    {userUsage.tier_name} Plan
                  </>
                ) : userUsage.tier === "starter" ? (
                  <>
                    <Zap className="h-3 w-3" />
                    Starter — {userUsage.searches_remaining}/{userUsage.max_searches} searches
                  </>
                ) : (
                  <>
                    <Gauge className="h-3 w-3" />
                    {userUsage.searches_remaining}/{userUsage.max_searches} searches
                  </>
                )}
              </Badge>
            )}

            {/* Admin Link - only visible to admins */}
            {user?.role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
                className="rounded-full gap-2 border-purple-200 bg-purple-50/50 text-purple-700 hover:bg-purple-100"
                data-testid="admin-link"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </Button>
            )}
            
            {/* Manage Subscription - moved to user dropdown */}
          
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

            {/* User Dropdown Menu */}
            <Separator orientation="vertical" className="h-5" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600 hover:text-slate-900" data-testid="user-menu-btn">
                  <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center">
                    <UserIcon className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <span className="text-xs hidden sm:inline max-w-[120px] truncate">{user?.email}</span>
                  <ChevronDownIcon className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" data-testid="user-menu-dropdown">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.email}</p>
                  {userUsage && <p className="text-xs text-muted-foreground">{userUsage.tier_name} Plan</p>}
                </div>
                <DropdownMenuSeparator />
                {userUsage && (userUsage.tier === "starter" || userUsage.tier === "pro") && (
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    data-testid="manage-subscription-btn"
                    onClick={async () => {
                      try {
                        const res = await api.post("/billing/portal-session");
                        window.location.href = res.data.url;
                      } catch (e) {
                        toast.error(e.response?.data?.detail || "Unable to open billing portal");
                      }
                    }}
                  >
                    <CreditCard className="h-4 w-4" />
                    Manage Subscription
                  </DropdownMenuItem>
                )}
                {userUsage && !userUsage.is_unlimited && (
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/pricing")}>
                    <Zap className="h-4 w-4" />
                    {userUsage.tier === "free" ? "Upgrade Plan" : "Upgrade to Pro"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setBugReportOpen(true)} data-testid="bug-report-btn">
                  <Bug className="h-4 w-4" />
                  Report a Bug
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer text-red-600 focus:text-red-600" onClick={() => { navigate("/"); setTimeout(logout, 100); }} data-testid="logout-btn">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden border-b bg-white/60 backdrop-blur-sm px-4 py-2 flex gap-1 overflow-x-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 whitespace-nowrap">
          <Search className="h-3 w-3" /> Prospect Finder
        </button>
        <button onClick={() => navigate("/dashboard/pipeline")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 whitespace-nowrap">
          <Handshake className="h-3 w-3" /> Pipeline
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
        {/* Trial Banner */}
        <TrialBanner usage={userUsage} />

        {/* Follow Ups Due Indicator */}
        {followUpsDueCount > 0 && (
          <button
            onClick={() => navigate("/dashboard/pipeline?overdue=true")}
            className="w-full"
            data-testid="follow-ups-due-card"
          >
            <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-red-800">
                        {followUpsDueCount} Follow-Up{followUpsDueCount !== 1 ? "s" : ""} Due
                      </p>
                      <p className="text-xs text-red-600">You have overdue follow-ups that need attention</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-red-600">
                    <span className="text-sm font-medium">View Pipeline</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        )}

        {/* Loaded Results Indicator - compact chip */}
        {channels.length > 0 && !isSearching && !isEnriching && (
          <div className="flex items-center gap-2 px-1" data-testid="results-loaded-indicator">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50/80 border border-indigo-100/60">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
              <span className="text-xs text-indigo-700 font-medium">
                {channels.length} channels loaded{searchResults.searchMetadata?.niche ? ` from ${searchResults.searchMetadata.niche.replace(/_/g, " ")}` : ""}
              </span>
              {searchResults.searchMetadata?.timestamp && (
                <span className="text-[10px] text-indigo-400">
                  ({new Date(searchResults.searchMetadata.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                </span>
              )}
              <button onClick={clearSearchResults} className="ml-1 text-indigo-400 hover:text-red-500 transition-colors" data-testid="clear-results-btn">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Saved Search Templates — Step 1 (only when no search has been run yet) */}
        {showTemplatePicker && !viewingReport && (
          <SearchTemplatePicker
            onSelectTemplate={applyTemplate}
            onSkip={skipTemplatePicker}
          />
        )}

        {/* "Selected template" banner with Change template action */}
        {!showTemplatePicker && selectedTemplate && !viewingReport && (
          <div
            className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 px-5 py-3 flex items-center justify-between gap-3"
            data-testid="active-template-banner"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Template applied</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{selectedTemplate.name}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setShowTemplatePicker(true); setSelectedTemplate(null); }}
              className="rounded-full h-8 text-xs shrink-0"
              data-testid="change-template-btn"
            >
              Change template
            </Button>
          </div>
        )}

        {/* "Pick a template" hint when picker is dismissed and no template selected */}
        {!showTemplatePicker && !selectedTemplate && !viewingReport && channels.length === 0 && (
          <div
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 flex items-center justify-between gap-3"
            data-testid="template-reopen-row"
          >
            <p className="text-xs text-slate-500">Want a head start? Pick a saved template to pre-fill the form.</p>
            <button
              type="button"
              onClick={() => setShowTemplatePicker(true)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              data-testid="template-reopen-btn"
            >
              Show templates
            </button>
          </div>
        )}

        {/* Search Panel */}
        <Card className="glass-card" data-testid="search-panel">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-heading">
                  <Search className="h-5 w-5 text-indigo-500" />
                  Search Configuration
                </CardTitle>
                <CardDescription>
                  Select your niche, enter keywords, and find YouTube affiliate prospects
                </CardDescription>
              </div>
              {userUsage && !userUsage.is_unlimited && (
                <Button
                  size="sm"
                  className="btn-gradient shrink-0"
                  onClick={() => navigate("/pricing")}
                  data-testid="search-panel-upgrade-btn"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  {userUsage.tier === "free" ? "Upgrade" : "Upgrade to Pro"}
                </Button>
              )}
            </div>
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

            {/* Keywords + Exclude Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords (one per line)</Label>
                <Textarea
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  rows={5}
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
              <div className="space-y-2">
                <Label htmlFor="exclude-keywords" className="flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  Exclude Keywords (one per line)
                </Label>
                <Textarea
                  id="exclude-keywords"
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                  placeholder={"e.g.\nmusic\ngaming\nvlog"}
                  data-testid="exclude-keywords-input"
                />
                <p className="text-xs text-slate-500">
                  Channels matching these keywords will be filtered out
                </p>
              </div>
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

                <Separator />

                {/* Hide Pipeline Channels */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Hide Pipeline Channels</Label>
                    <p className="text-xs text-muted-foreground">Exclude channels already in your Outreach Pipeline from results</p>
                  </div>
                  <Switch
                    checked={hidePipelineChannels}
                    onCheckedChange={setHidePipelineChannels}
                    data-testid="hide-pipeline-switch"
                  />
                </div>

                <Separator />

                {/* Country / Region targeting */}
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm">Country / Region</Label>
                    <p className="text-xs text-muted-foreground">
                      Limit results to creators in specific countries. Country is self-declared on YouTube, so many channels won't have one set.
                    </p>
                  </div>
                  <CountryFilter
                    value={targetCountries}
                    onChange={setTargetCountries}
                    includeUnknown={includeUnknownCountry}
                    onIncludeUnknownChange={setIncludeUnknownCountry}
                    testId="search-country-filter"
                  />
                </div>

                {/* Super Search — available to all users, gated by 12-credit cost per run */}
                <>
                  <Separator />
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-600" />
                        <div>
                          <Label className="text-sm font-semibold text-amber-900">Super Search</Label>
                          <p className="text-xs text-amber-700">
                            Run GPT-4o grading on every channel that passes standard filters — A/B grades surface to the top.
                          </p>
                          <p className="text-[11px] text-amber-700/80 mt-1">
                            Costs <span className="font-semibold">12 credits per search</span>. Re-running the same search within 24h is free for previously-graded channels.
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={superSearch}
                        onCheckedChange={setSuperSearch}
                        data-testid="super-search-switch"
                      />
                    </div>

                    {/* Low-balance nudge — appears once Super Search is enabled and balance < 24 (2 runs) */}
                    {superSearch && typeof userUsage?.draft_credits === "number" && userUsage.draft_credits < 24 && (
                      <div
                        className="rounded-md border border-amber-300 bg-amber-100/80 px-3 py-2 flex items-center justify-between gap-3"
                        data-testid="super-search-low-balance-nudge"
                      >
                        <div className="text-xs text-amber-900 leading-snug">
                          <span className="font-semibold">{userUsage.draft_credits} credits left</span>
                          {" — that's "}
                          <span className="font-semibold">
                            {Math.floor(userUsage.draft_credits / 12)} more {Math.floor(userUsage.draft_credits / 12) === 1 ? "Super Search" : "Super Searches"}
                          </span>
                          {". Top up to avoid hitting zero mid-prospecting."}
                        </div>
                        <Button
                          size="sm"
                          onClick={handleBuyCredits}
                          disabled={buyingCredits}
                          className="h-7 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 shrink-0"
                          data-testid="super-search-top-up-btn"
                        >
                          {buyingCredits ? "Loading…" : "Top up credits"}
                        </Button>
                      </div>
                    )}
                      {superSearch && (
                        <>
                          <div className="rounded-md bg-white/70 border border-amber-200 p-3 flex items-start justify-between gap-3">
                            <div>
                              <Label className="text-xs font-semibold text-amber-900">Strict mode (require proven affiliate activity)</Label>
                              <p className="text-[11px] text-amber-700/80 mt-0.5">
                                When ON, apply the legacy hard filters before AI grading: ≥3 affiliate links, recent affiliate activity (90d), and 3+ sponsored videos in the last 10. Default OFF — let the AI judge.
                              </p>
                            </div>
                            <Switch
                              checked={strictMode}
                              onCheckedChange={setStrictMode}
                              data-testid="strict-mode-switch"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-amber-800 mb-1 block">Competitor Brands (comma-separated)</Label>
                            <div className="flex gap-2">
                              <Input
                                value={competitorInput}
                                onChange={(e) => setCompetitorInput(e.target.value)}
                                placeholder="e.g. NordVPN, Surfshark, ExpressVPN"
                                className="h-8 text-xs flex-1 bg-white"
                                data-testid="competitor-brands-input"
                              />
                              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={saveCompetitorBrands}>Save</Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
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
                  title={
                    superSearch
                      ? `Super Search: 12 credits per run (~$0.24) · ${userUsage?.draft_credits ?? 0} credits available`
                      : undefined
                  }
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isSearching ? "Searching..." : "Search Channels"}
                </Button>

                {/* Inline credit cost chip — only when Super Search is on */}
                {superSearch && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1"
                    title={`Super Search costs 12 credits per run (~$0.24). You have ${userUsage?.draft_credits ?? 0} credit${userUsage?.draft_credits === 1 ? "" : "s"} available.`}
                    data-testid="super-search-cost-chip"
                  >
                    <Sparkles className="h-3 w-3" />
                    12 credits · {userUsage?.draft_credits ?? 0} available · ~$0.24
                  </span>
                )}
                
                {/* Save Search Dialog */}
                <Button
                  variant="outline"
                  disabled={isFreeUser ? false : !keywords.trim()}
                  onClick={() => {
                    if (isFreeUser) {
                      setUpgradeDialogOpen(true);
                    } else {
                      setSaveSearchOpen(true);
                    }
                  }}
                  className={isFreeUser ? "opacity-50" : ""}
                  data-testid="save-search-btn"
                >
                  {isFreeUser ? <Lock className="h-4 w-4 mr-2 text-muted-foreground" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Search
                </Button>
                <SaveSearchDialog
                  open={saveSearchOpen}
                  onOpenChange={setSaveSearchOpen}
                  searchName={searchName}
                  setSearchName={setSearchName}
                  keywords={keywords}
                  minSubs={minSubs}
                  maxSubs={maxSubs}
                  uploadedWithin={uploadedWithin}
                  searchMode={searchMode}
                  channelsCount={channels.length}
                  onSave={saveCurrentSearch}
                />
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
      <BugReportDialog
        open={bugReportOpen}
        onOpenChange={setBugReportOpen}
        bugSubject={bugSubject}
        setBugSubject={setBugSubject}
        bugSeverity={bugSeverity}
        setBugSeverity={setBugSeverity}
        bugDescription={bugDescription}
        setBugDescription={setBugDescription}
        bugSteps={bugSteps}
        setBugSteps={setBugSteps}
        bugSubmitting={bugSubmitting}
        onSubmit={submitBugReport}
      />

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

                {/* Outreach Tracking */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Handshake className="h-4 w-4 text-indigo-500" />
                    Outreach Tracking
                  </h4>
                  
                  {/* Status Dropdown */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
                      <Select
                        value={selectedChannel.outreach_status || "not_contacted"}
                        onValueChange={(val) => updateOutreachStatus(selectedChannel.channel_id, val, null)}
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

                    {/* Follow-Up Date */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Follow-Up Date</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={selectedChannel.follow_up_date || ""}
                          onChange={(e) => updateFollowUpDate(selectedChannel.channel_id, e.target.value ? new Date(e.target.value + "T00:00:00") : null)}
                          disabled={followUpDateUpdating}
                          className="h-9 flex-1"
                          data-testid="detail-follow-up-date"
                        />
                        {selectedChannel.follow_up_date && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateFollowUpDate(selectedChannel.channel_id, null)}
                            className="h-9 px-2 text-slate-400 hover:text-red-500"
                            data-testid="clear-follow-up-date"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Add Note */}
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
                              updateOutreachStatus(selectedChannel.channel_id, selectedChannel.outreach_status || "contacted", contactNoteText.trim());
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-9"
                          disabled={!contactNoteText.trim() || outreachStatusUpdating}
                          onClick={() => updateOutreachStatus(selectedChannel.channel_id, selectedChannel.outreach_status || "contacted", contactNoteText.trim())}
                          data-testid="detail-add-note-btn"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Contact Log */}
                    {selectedChannel.contact_log?.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Contact Log</Label>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {[...selectedChannel.contact_log].reverse().map((entry, i) => {
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

                {/* Channel Health Indicators */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Channel Health
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {/* Upload Consistency */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-xs text-muted-foreground">Upload Frequency</p>
                        <p className="text-sm font-medium">
                          {selectedChannel.upload_consistency || "Unknown"}
                        </p>
                      </div>
                      {selectedChannel.upload_avg_days != null && (
                        <span className="text-xs text-muted-foreground">
                          ~{selectedChannel.upload_avg_days}d between uploads
                        </span>
                      )}
                    </div>
                    {/* Engagement Health */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-xs text-muted-foreground">Engagement Health</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {selectedChannel.engagement_health && (
                            <Badge className={`${ENGAGEMENT_HEALTH_CONFIG[selectedChannel.engagement_health]?.color || "bg-slate-100 text-slate-600"} text-xs`}>
                              {selectedChannel.engagement_health}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {selectedChannel.engagement_rate != null && (
                        <span className="text-xs text-muted-foreground">
                          {selectedChannel.engagement_rate}% views/subs
                        </span>
                      )}
                    </div>
                    {/* Growth Indicator */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-xs text-muted-foreground">Growth Trend</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {selectedChannel.growth_indicator === "Growing" && <ArrowUp className="h-4 w-4 text-emerald-500" />}
                          {selectedChannel.growth_indicator === "Stable" && <Minus className="h-4 w-4 text-slate-400" />}
                          {selectedChannel.growth_indicator === "Declining" && <ArrowDown className="h-4 w-4 text-red-500" />}
                          <span className="text-sm font-medium">{selectedChannel.growth_indicator || "Unknown"}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Recent vs lifetime avg
                      </span>
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
                      {/* Confidence Score */}
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

                      {/* Stats row */}
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

                      {/* Detected brands */}
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
                                  onClick={() => userUsage?.tier === "free" ? setUpgradeDialogOpen(true) : navigate("/pricing")}
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

                      {/* Videos with sponsorships */}
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
                    defaultValue={selectedChannel.notes || ""}
                    key={selectedChannel.channel_id}
                    onBlur={(e) =>
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
                <div className="space-y-2 pt-4">
                  {/* Add to Pipeline - prominent CTA */}
                  {(selectedChannel.outreach_status || "not_contacted") === "not_contacted" ? (
                    <Button
                      className={`w-full gap-2 ${isFreeUser ? "opacity-50 bg-muted text-muted-foreground hover:bg-muted" : "bg-indigo-600 hover:bg-indigo-700"}`}
                      onClick={() => isFreeUser ? setUpgradeDialogOpen(true) : openPipelineDialog(selectedChannel)}
                      data-testid="detail-add-pipeline-btn"
                    >
                      {isFreeUser ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      Add to Pipeline
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                      <Handshake className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm font-medium text-indigo-700">In Pipeline</span>
                      {selectedChannel.project_name && (
                        <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600">{selectedChannel.project_name}</Badge>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
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
                  {/* Exclude Channel Button */}
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                    onClick={async () => {
                      try {
                        await api.post(`/channels/${selectedChannel.channel_id}/exclude`);
                        setChannels((prev) => prev.filter((ch) => ch.channel_id !== selectedChannel.channel_id));
                        setDetailOpen(false);
                        toast.success(`${selectedChannel.channel_name} excluded from future searches`);
                      } catch (e) {
                        toast.error("Failed to exclude channel");
                      }
                    }}
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
                                setSelectedChannel(channel);
                                setDetailOpen(true);
                                fetchSponsorshipData(channel.channel_id);
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
                                <div className="flex flex-wrap gap-1">
                                  {channel.affiliate_platforms_found?.map((platform) => (
                                    <span key={platform} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700 border border-teal-200">
                                      <Link className="h-2.5 w-2.5" />
                                      {platform}
                                    </span>
                                  ))}
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

      {/* Add to Pipeline Dialog */}
      <AddToPipelineDialog
        open={pipelineDialogOpen}
        onOpenChange={setPipelineDialogOpen}
        channel={pipelineChannel}
        projectName={pipelineProjectName}
        setProjectName={setPipelineProjectName}
        userProjects={userProjects}
        status={pipelineStatus}
        setStatus={setPipelineStatus}
        submitting={pipelineAdding}
        onSubmit={addToPipeline}
      />
      <UpgradeDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen} />
    </div>
  );
}
