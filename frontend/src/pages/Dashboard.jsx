import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Search,
  X,
  Save,
  Sparkles,
  Zap,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import TrialBanner from "@/components/TrialBanner";
import SearchTemplatePicker from "@/components/SearchTemplatePicker";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar } from "lucide-react";
import { useSearchResults } from "@/contexts/SearchResultsContext";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import {
  computeHealthIndicators,
} from "@/lib/healthIndicators";
import { SEARCH_PRESETS, DEFAULT_KEYWORD_PLACEHOLDER } from "@/lib/searchPresets";
import { OUTREACH_STATUS_CONFIG } from "@/lib/outreachConfig";
import BugReportDialog from "@/pages/dashboard/dialogs/BugReportDialog";
import AddToPipelineDialog from "@/pages/dashboard/dialogs/AddToPipelineDialog";
import DashboardHeader from "@/pages/dashboard/DashboardHeader";
import ChannelDetailSheet from "@/pages/dashboard/ChannelDetailSheet";
import SearchPanel from "@/pages/dashboard/SearchPanel";
import ResultsSection from "@/pages/dashboard/ResultsSection";
import HistoricalReportView from "@/pages/dashboard/HistoricalReportView";
import { getScoreClass, getAffiliateScoreClass, formatNumber } from "@/lib/formatters";

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

  const excludeChannel = async (channelObj) => {
    try {
      await api.post(`/channels/${channelObj.channel_id}/exclude`);
      setChannels((prev) => prev.filter((ch) => ch.channel_id !== channelObj.channel_id));
      setDetailOpen(false);
      toast.success(`${channelObj.channel_name} excluded from future searches`);
    } catch (e) {
      toast.error("Failed to exclude channel");
    }
  };

  return (
    <div className="dashboard-bg font-body">
      {/* Shared Dashboard Header */}
      <DashboardHeader
        user={user}
        userUsage={userUsage}
        historyOpen={historyOpen}
        setHistoryOpen={setHistoryOpen}
        searchHistory={searchHistory}
        savedReports={savedReports}
        viewReport={viewReport}
        deleteReport={deleteReport}
        loadSavedSearch={loadSavedSearch}
        runSavedSearch={runSavedSearch}
        deleteSavedSearch={deleteSavedSearch}
        onOpenBugReport={() => setBugReportOpen(true)}
        onLogout={logout}
        api={api}
      />

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
            niche={selectedNiche?.key}
          />
        )}

        {/* "Selected template" banner with Change template action.
            Variant flips to a warning style when the selected template is
            niche-specific but the user has switched to a different niche. */}
        {!showTemplatePicker && selectedTemplate && !viewingReport && (() => {
          const tplNiche = selectedTemplate.niche;
          const tplUniversal = selectedTemplate.universal === true;
          const currentNicheKey = selectedNiche?.key;
          const niceCurrentName = selectedNiche?.name;
          const niceTplName = niches.find((n) => n.key === tplNiche)?.name || tplNiche;
          const mismatch =
            !tplUniversal && tplNiche && currentNicheKey && tplNiche !== currentNicheKey;

          if (mismatch) {
            return (
              <div
                className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 flex items-center justify-between gap-3"
                data-testid="active-template-banner-mismatch"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-amber-800">
                      Template no longer fits this niche — clear?
                    </p>
                    <p className="text-sm font-semibold text-amber-900 truncate">
                      {selectedTemplate.name}
                      <span className="ml-2 font-normal text-xs text-amber-700">
                        (tagged: {niceTplName} · current: {niceCurrentName})
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowTemplatePicker(true); setSelectedTemplate(null); }}
                  className="rounded-full h-8 text-xs shrink-0 border-amber-300 hover:bg-amber-100 text-amber-900"
                  data-testid="clear-mismatched-template-btn"
                >
                  Clear template
                </Button>
              </div>
            );
          }

          return (
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
          );
        })()}

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
        <SearchPanel
          userUsage={userUsage}
          niches={niches}
          selectedNiche={selectedNiche}
          selectNiche={selectNiche}
          keywords={keywords}
          setKeywords={setKeywords}
          keywordPlaceholder={keywordPlaceholder}
          excludeKeywords={excludeKeywords}
          setExcludeKeywords={setExcludeKeywords}
          minSubs={minSubs}
          setMinSubs={setMinSubs}
          maxSubs={maxSubs}
          setMaxSubs={setMaxSubs}
          uploadedWithin={uploadedWithin}
          setUploadedWithin={setUploadedWithin}
          maxResults={maxResults}
          setMaxResults={setMaxResults}
          searchMode={searchMode}
          setSearchMode={setSearchMode}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          searchPreset={searchPreset}
          applyPreset={applyPreset}
          videosToScan={videosToScan}
          setVideosToScan={setVideosToScan}
          maxChannelsToEnrich={maxChannelsToEnrich}
          setMaxChannelsToEnrich={setMaxChannelsToEnrich}
          unlimitedChannels={unlimitedChannels}
          setUnlimitedChannels={setUnlimitedChannels}
          scanVideoDescriptions={scanVideoDescriptions}
          setScanVideoDescriptions={setScanVideoDescriptions}
          setSearchPreset={setSearchPreset}
          availablePlatforms={availablePlatforms}
          affiliatePlatforms={affiliatePlatforms}
          togglePlatform={togglePlatform}
          hidePipelineChannels={hidePipelineChannels}
          setHidePipelineChannels={setHidePipelineChannels}
          targetCountries={targetCountries}
          setTargetCountries={setTargetCountries}
          includeUnknownCountry={includeUnknownCountry}
          setIncludeUnknownCountry={setIncludeUnknownCountry}
          superSearch={superSearch}
          setSuperSearch={setSuperSearch}
          strictMode={strictMode}
          setStrictMode={setStrictMode}
          competitorInput={competitorInput}
          setCompetitorInput={setCompetitorInput}
          saveCompetitorBrands={saveCompetitorBrands}
          buyingCredits={buyingCredits}
          handleBuyCredits={handleBuyCredits}
          runSearch={runSearch}
          isSearching={isSearching}
          searchProgress={searchProgress}
          searchStatus={searchStatus}
          saveSearchOpen={saveSearchOpen}
          setSaveSearchOpen={setSaveSearchOpen}
          searchName={searchName}
          setSearchName={setSearchName}
          channels={channels}
          saveCurrentSearch={saveCurrentSearch}
        />


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
          <ResultsSection
            channels={channels}
            isSearching={isSearching}
            isEnriching={isEnriching}
            sortedChannels={sortedChannels}
            paginatedChannels={paginatedChannels}
            rawSearchResults={rawSearchResults}
            shortlist={shortlist}
            isFreeUser={isFreeUser}
            user={user}
            dropLog={dropLog}
            saveReportOpen={saveReportOpen}
            setSaveReportOpen={setSaveReportOpen}
            reportName={reportName}
            setReportName={setReportName}
            setUpgradeDialogOpen={setUpgradeDialogOpen}
            keywords={keywords}
            minSubs={minSubs}
            maxSubs={maxSubs}
            filterMinScore={filterMinScore}
            setFilterMinScore={setFilterMinScore}
            filterHighAffiliate={filterHighAffiliate}
            setFilterHighAffiliate={setFilterHighAffiliate}
            filterHasPlatformLinks={filterHasPlatformLinks}
            setFilterHasPlatformLinks={setFilterHasPlatformLinks}
            filterOutreachStatus={filterOutreachStatus}
            setFilterOutreachStatus={setFilterOutreachStatus}
            filterEngagementHealth={filterEngagementHealth}
            setFilterEngagementHealth={setFilterEngagementHealth}
            resultsCountries={resultsCountries}
            setResultsCountries={setResultsCountries}
            resultsIncludeUnknown={resultsIncludeUnknown}
            setResultsIncludeUnknown={setResultsIncludeUnknown}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            showRejected={showRejected}
            setShowRejected={setShowRejected}
            rejectedCount={rejectedCount}
            hasAnyAIGrade={hasAnyAIGrade}
            superSearch={superSearch}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            runEnrichment={runEnrichment}
            exportCSV={exportCSV}
            saveReport={saveReport}
            openChannelDetail={openChannelDetail}
            openPipelineDialog={openPipelineDialog}
            toggleShortlist={toggleShortlist}
          />
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
      <ChannelDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        channel={selectedChannel}
        outreachStatusUpdating={outreachStatusUpdating}
        followUpDateUpdating={followUpDateUpdating}
        contactNoteText={contactNoteText}
        setContactNoteText={setContactNoteText}
        shortlist={shortlist}
        isFreeUser={isFreeUser}
        onUpgradePrompt={() => setUpgradeDialogOpen(true)}
        sponsorshipLoading={sponsorshipLoading}
        sponsorshipData={sponsorshipData}
        userUsage={userUsage}
        onUpdateOutreachStatus={updateOutreachStatus}
        onUpdateFollowUpDate={updateFollowUpDate}
        onUpdateNotes={updateNotes}
        onOpenPipelineDialog={openPipelineDialog}
        onToggleShortlist={toggleShortlist}
        onExcludeChannel={excludeChannel}
      />

      {/* Historical Report View */}
      {viewingReport && (
        <HistoricalReportView
          viewingReport={viewingReport}
          closeReportView={closeReportView}
          isFreeUser={isFreeUser}
          setUpgradeDialogOpen={setUpgradeDialogOpen}
          exportCSV={exportCSV}
          reportFilterMinScore={reportFilterMinScore}
          setReportFilterMinScore={setReportFilterMinScore}
          reportFilterHighAffiliate={reportFilterHighAffiliate}
          setReportFilterHighAffiliate={setReportFilterHighAffiliate}
          reportFilterHasPlatformLinks={reportFilterHasPlatformLinks}
          setReportFilterHasPlatformLinks={setReportFilterHasPlatformLinks}
          reportFilterOutreachStatus={reportFilterOutreachStatus}
          setReportFilterOutreachStatus={setReportFilterOutreachStatus}
          reportFilterEngagementHealth={reportFilterEngagementHealth}
          setReportFilterEngagementHealth={setReportFilterEngagementHealth}
          reportSortBy={reportSortBy}
          setReportSortBy={setReportSortBy}
          reportSortOrder={reportSortOrder}
          setReportSortOrder={setReportSortOrder}
          reportPage={reportPage}
          setReportPage={setReportPage}
          pageSize={pageSize}
          openPipelineDialog={openPipelineDialog}
          openChannelDetail={openChannelDetail}
          user={user}
          superSearch={superSearch}
        />
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
