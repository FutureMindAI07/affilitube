/**
 * SearchPanel — extracted from Dashboard.jsx (Phase 5 refactor).
 *
 * Renders the search configuration card:
 *   • Top-right upgrade CTA (for non-unlimited tiers)
 *   • Niche selector grid
 *   • Keywords + Exclude Keywords textareas
 *   • Filters grid (min subs, max subs, uploaded within, max results, search mode)
 *   • Advanced Settings collapsible (presets, fine-tune, platforms,
 *     hide pipeline, country, Super Search, strict mode, competitor brands)
 *   • Search + Save Search buttons
 *   • Progress bar (while searching)
 *
 * Behaviour is unchanged. All state and action callbacks live in the parent
 * (Dashboard) and are passed via props — no Context, no global store.
 */
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Sparkles,
  AlertCircle,
  XCircle,
  ChevronDown,
  SlidersHorizontal,
  Shield,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CountryFilter from "@/components/CountryFilter";
import SaveSearchDialog from "@/pages/dashboard/dialogs/SaveSearchDialog";
import { SEARCH_PRESETS } from "@/lib/searchPresets";

// Display-only ordering for the niche selector grid. Prioritises influencer/
// creator-focused niches at the top and pushes SaaS/tech/marketing to the end.
// Anything not in this list falls to the tail in alpha order, so a newly added
// backend niche never disappears from the UI — you'll just want to explicitly
// place it here to control its final position.
const NICHE_DISPLAY_ORDER = [
  "fashion", "lifestyle", "parenting", "home_decor",
  "beauty_skincare", "travel", "food_cooking", "pet_care",
  "personal_development", "home_diy", "gaming",
  "tech_gadgets", "ecommerce_amazon", "fitness_health",
  "finance_investing", "online_courses",
  "marketing_tools", "saas_software",
];

function sortNichesForDisplay(niches) {
  if (!niches || niches.length === 0) return [];
  const orderIndex = new Map(NICHE_DISPLAY_ORDER.map((k, i) => [k, i]));
  return [...niches].sort((a, b) => {
    const ai = orderIndex.has(a.key) ? orderIndex.get(a.key) : Number.POSITIVE_INFINITY;
    const bi = orderIndex.has(b.key) ? orderIndex.get(b.key) : Number.POSITIVE_INFINITY;
    if (ai !== bi) return ai - bi;
    // Tie-breaker for unmapped niches: alpha by name
    return (a.name || "").localeCompare(b.name || "");
  });
}

export default function SearchPanel({
  // Top-level config state
  userUsage,
  niches,
  selectedNiche,
  selectNiche,
  keywords,
  setKeywords,
  keywordPlaceholder,
  excludeKeywords,
  setExcludeKeywords,
  minSubs,
  setMinSubs,
  maxSubs,
  setMaxSubs,
  uploadedWithin,
  setUploadedWithin,
  maxResults,
  setMaxResults,
  searchMode,
  setSearchMode,
  // Advanced settings state
  advancedOpen,
  setAdvancedOpen,
  searchPreset,
  applyPreset,
  videosToScan,
  setVideosToScan,
  maxChannelsToEnrich,
  setMaxChannelsToEnrich,
  unlimitedChannels,
  setUnlimitedChannels,
  setSearchPreset,
  availablePlatforms,
  affiliatePlatforms,
  togglePlatform,
  hidePipelineChannels,
  setHidePipelineChannels,
  targetCountries,
  setTargetCountries,
  includeUnknownCountry,
  setIncludeUnknownCountry,
  superSearch,
  setSuperSearch,
  strictMode,
  setStrictMode,
  competitorInput,
  setCompetitorInput,
  saveCompetitorBrands,
  buyingCredits,
  handleBuyCredits,
  // Search action / progress
  runSearch,
  isSearching,
  searchProgress,
  searchStatus,
  // Save-search dialog
  saveSearchOpen,
  setSaveSearchOpen,
  searchName,
  setSearchName,
  channels,
  saveCurrentSearch,
}) {
  const navigate = useNavigate();

  return (
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
            {sortNichesForDisplay(niches).map((niche) => (
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
            </div>

            <Separator />

            {/* Affiliate Platforms */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Filter by Affiliate Platform
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Every named affiliate network is scanned automatically on every search — you&apos;ll see badges in the results column regardless of what&apos;s ticked here.
                Tick one or more platforms to <span className="font-medium">filter results</span> to only channels using those networks. Leave empty to see all.
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
                <p className="text-xs text-amber-700 mt-2">
                  Filter active: only channels with links on the {affiliatePlatforms.length} selected platform{affiliatePlatforms.length === 1 ? "" : "s"} will show in results.
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
                    <p className="text-xs font-medium text-amber-900 mt-1" data-testid="super-search-value-prop">
                      Turn on AI grading to auto-rank these results by affiliate fit.
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
              <Search className="h-4 w-4" />
              Search Channels
            </Button>
            <Button
              variant="outline"
              onClick={() => setSaveSearchOpen(true)}
              disabled={!keywords.trim()}
              className="gap-2"
              data-testid="save-search-btn"
            >
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
  );
}

SearchPanel.propTypes = {
  userUsage: PropTypes.object,
  niches: PropTypes.array.isRequired,
  selectedNiche: PropTypes.object,
  selectNiche: PropTypes.func.isRequired,
  keywords: PropTypes.string.isRequired,
  setKeywords: PropTypes.func.isRequired,
  keywordPlaceholder: PropTypes.string,
  excludeKeywords: PropTypes.string.isRequired,
  setExcludeKeywords: PropTypes.func.isRequired,
  minSubs: PropTypes.number.isRequired,
  setMinSubs: PropTypes.func.isRequired,
  maxSubs: PropTypes.number.isRequired,
  setMaxSubs: PropTypes.func.isRequired,
  uploadedWithin: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  setUploadedWithin: PropTypes.func.isRequired,
  maxResults: PropTypes.number.isRequired,
  setMaxResults: PropTypes.func.isRequired,
  searchMode: PropTypes.string.isRequired,
  setSearchMode: PropTypes.func.isRequired,
  advancedOpen: PropTypes.bool.isRequired,
  setAdvancedOpen: PropTypes.func.isRequired,
  searchPreset: PropTypes.string.isRequired,
  applyPreset: PropTypes.func.isRequired,
  videosToScan: PropTypes.number.isRequired,
  setVideosToScan: PropTypes.func.isRequired,
  maxChannelsToEnrich: PropTypes.number.isRequired,
  setMaxChannelsToEnrich: PropTypes.func.isRequired,
  unlimitedChannels: PropTypes.bool.isRequired,
  setUnlimitedChannels: PropTypes.func.isRequired,
  setSearchPreset: PropTypes.func.isRequired,
  availablePlatforms: PropTypes.array.isRequired,
  affiliatePlatforms: PropTypes.array.isRequired,
  togglePlatform: PropTypes.func.isRequired,
  hidePipelineChannels: PropTypes.bool.isRequired,
  setHidePipelineChannels: PropTypes.func.isRequired,
  targetCountries: PropTypes.array.isRequired,
  setTargetCountries: PropTypes.func.isRequired,
  includeUnknownCountry: PropTypes.bool.isRequired,
  setIncludeUnknownCountry: PropTypes.func.isRequired,
  superSearch: PropTypes.bool.isRequired,
  setSuperSearch: PropTypes.func.isRequired,
  strictMode: PropTypes.bool.isRequired,
  setStrictMode: PropTypes.func.isRequired,
  competitorInput: PropTypes.string.isRequired,
  setCompetitorInput: PropTypes.func.isRequired,
  saveCompetitorBrands: PropTypes.func.isRequired,
  buyingCredits: PropTypes.bool.isRequired,
  handleBuyCredits: PropTypes.func.isRequired,
  runSearch: PropTypes.func.isRequired,
  isSearching: PropTypes.bool.isRequired,
  searchProgress: PropTypes.number.isRequired,
  searchStatus: PropTypes.string,
  saveSearchOpen: PropTypes.bool.isRequired,
  setSaveSearchOpen: PropTypes.func.isRequired,
  searchName: PropTypes.string.isRequired,
  setSearchName: PropTypes.func.isRequired,
  channels: PropTypes.array.isRequired,
  saveCurrentSearch: PropTypes.func.isRequired,
};
