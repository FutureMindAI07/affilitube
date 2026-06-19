/**
 * DashboardHeader — extracted from Dashboard.jsx (Phase 3 refactor).
 *
 * Renders the full top app-chrome:
 *   • Logo + brand mark
 *   • Desktop tab navigation (Prospect Finder / Pipeline / Outreach / Getting Started)
 *   • Mobile horizontal-scroll tab nav
 *   • Tier badge
 *   • Admin link (admin-role only)
 *   • Search History & Reports dialog (button + tabs + lists with view/delete/run)
 *   • User dropdown (email, manage subscription, upgrade, report a bug, sign out)
 *
 * Behaviour is unchanged. All state and action callbacks live in the parent
 * (Dashboard) and are passed via props — no Context, no global store.
 */
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Search,
  Handshake,
  Mail,
  BookOpen,
  History,
  FileText,
  Clock,
  Eye,
  Trash2,
  Play,
  Zap,
  Gauge,
  Shield,
  Youtube,
  CreditCard,
  Bug,
  LogOut,
  User as UserIcon,
  ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function DashboardHeader({
  user,
  userUsage,
  historyOpen,
  setHistoryOpen,
  searchHistory,
  savedReports,
  viewReport,
  deleteReport,
  loadSavedSearch,
  runSavedSearch,
  deleteSavedSearch,
  onOpenBugReport,
  onLogout,
  api,
}) {
  const navigate = useNavigate();

  return (
    <>
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
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={onOpenBugReport} data-testid="bug-report-btn">
                  <Bug className="h-4 w-4" />
                  Report a Bug
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer text-red-600 focus:text-red-600" onClick={() => { navigate("/"); setTimeout(onLogout, 100); }} data-testid="logout-btn">
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
    </>
  );
}

DashboardHeader.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
    role: PropTypes.string,
  }),
  userUsage: PropTypes.object,
  historyOpen: PropTypes.bool.isRequired,
  setHistoryOpen: PropTypes.func.isRequired,
  searchHistory: PropTypes.array.isRequired,
  savedReports: PropTypes.array.isRequired,
  viewReport: PropTypes.func.isRequired,
  deleteReport: PropTypes.func.isRequired,
  loadSavedSearch: PropTypes.func.isRequired,
  runSavedSearch: PropTypes.func.isRequired,
  deleteSavedSearch: PropTypes.func.isRequired,
  onOpenBugReport: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  api: PropTypes.object.isRequired,
};
