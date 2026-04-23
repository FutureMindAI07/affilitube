import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  DollarSign,
  Activity,
  Gauge,
  TrendingUp,
  Calendar,
  Mail,
  Trash2,
  Edit,
  Youtube,
  Clock,
  BarChart3,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  ArrowLeft,
  Sparkles,
  UserPlus,
  CalendarClock,
} from "lucide-react";

const API = `${import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminPanel() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  
  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Admin access required");
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const api = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  // State
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [userTierFilter, setUserTierFilter] = useState("all");
  const [quota, setQuota] = useState(null);
  const [searchActivity, setSearchActivity] = useState([]);
  const [revenue, setRevenue] = useState(null);
  
  // Dialog states
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [newTier, setNewTier] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [creditUser, setCreditUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState("50");

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "", password: "", tier: "free", draft_credits: "0", access_expires_at: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === "overview") loadOverview();
    else if (activeTab === "users") loadUsers();
    else if (activeTab === "quota") loadQuota();
    else if (activeTab === "activity") loadActivity();
    else if (activeTab === "revenue") loadRevenue();
  }, [activeTab, usersPage, userSearch, userTierFilter]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/overview");
      setOverview(res.data);
    } catch (e) {
      if (e.response?.status === 403) {
        toast.error("Admin access required");
        navigate("/dashboard");
      } else {
        toast.error("Failed to load overview");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users", {
        params: {
          search: userSearch,
          tier_filter: userTierFilter,
          skip: usersPage * 50,
          limit: 50,
        },
      });
      setUsers(res.data.users);
      setUsersTotal(res.data.total);
    } catch (e) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const loadQuota = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/quota");
      setQuota(res.data);
    } catch (e) {
      toast.error("Failed to load quota data");
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/search-activity");
      setSearchActivity(res.data.searches);
    } catch (e) {
      toast.error("Failed to load search activity");
    } finally {
      setLoading(false);
    }
  };

  const loadRevenue = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/revenue");
      setRevenue(res.data);
    } catch (e) {
      toast.error("Failed to load revenue data");
    } finally {
      setLoading(false);
    }
  };

  const updateUserTier = async () => {
    if (!editingUser || !newTier) return;
    try {
      await api.put(`/admin/users/${editingUser.id}/tier`, { tier: newTier });
      toast.success(`User tier updated to ${newTier}`);
      setEditingUser(null);
      setNewTier("");
      loadUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update tier");
    }
  };

  const deleteUser = async () => {
    if (!deletingUser) return;
    try {
      await api.delete(`/admin/users/${deletingUser.id}`);
      toast.success("User deleted");
      setDeletingUser(null);
      loadUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to delete user");
    }
  };

  const grantCredits = async () => {
    if (!creditUser || !creditAmount) return;
    try {
      const res = await api.put(`/admin/users/${creditUser.id}/credits`, { credits: parseInt(creditAmount) });
      toast.success(`${res.data.credits_added} credits granted to ${res.data.email} (balance: ${res.data.new_balance})`);
      setCreditUser(null);
      setCreditAmount("50");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to grant credits");
    }
  };

  const createUser = async () => {
    if (!createForm.email || !createForm.password) return;
    setCreateLoading(true);
    try {
      const payload = {
        email: createForm.email,
        password: createForm.password,
        tier: createForm.tier,
        draft_credits: parseInt(createForm.draft_credits) || 0,
      };
      if (createForm.access_expires_at) {
        payload.access_expires_at = new Date(createForm.access_expires_at).toISOString();
      }
      const res = await api.post("/admin/users", payload);
      toast.success(`User ${res.data.email} created (${res.data.tier} tier)`);
      setCreateOpen(false);
      setCreateForm({ email: "", password: "", tier: "free", draft_credits: "0", access_expires_at: "" });
      loadUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create user");
    } finally {
      setCreateLoading(false);
    }
  };

  const updateExpiry = async () => {
    if (!editingUser) return;
    try {
      await api.put(`/admin/users/${editingUser.id}/expiry`, {
        access_expires_at: newExpiry ? new Date(newExpiry).toISOString() : null,
      });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update expiry");
    }
  };

  const updateUserTierAndExpiry = async () => {
    if (!editingUser || !newTier) return;
    try {
      await api.put(`/admin/users/${editingUser.id}/tier`, { tier: newTier });
      await updateExpiry();
      toast.success(`User updated: ${newTier} tier${newExpiry ? `, expires ${new Date(newExpiry).toLocaleDateString()}` : ""}`);
      setEditingUser(null);
      setNewTier("");
      setNewExpiry("");
      loadUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update user");
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setCreateForm(p => ({ ...p, password: pass }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tierBadge = (tier) => {
    const colors = {
      free: "bg-slate-100 text-slate-700",
      starter: "bg-indigo-100 text-indigo-700",
      pro: "bg-purple-100 text-purple-700",
      appsumo: "bg-orange-100 text-orange-700",
    };
    return (
      <Badge className={`${colors[tier] || colors.free} text-xs`}>
        {tier || "free"}
      </Badge>
    );
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 font-body">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100/50">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Youtube className="h-4 w-4 text-white" />
              </div>
              <span className="font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Affilitube</span>
            </a>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-600" />
              <span className="font-semibold text-slate-900">Admin Panel</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-slate-500"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
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

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "users", label: "Users", icon: Users },
            { id: "quota", label: "API Quota", icon: Gauge },
            { id: "activity", label: "Search Activity", icon: Activity },
            { id: "revenue", label: "Revenue", icon: DollarSign },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && overview && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Users</p>
                      <p className="text-3xl font-bold text-slate-900">{overview.users.total}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-indigo-600" />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 text-xs flex-wrap">
                    <span className="text-slate-500">Free: {overview.users.free}</span>
                    <span className="text-indigo-600 font-medium">Starter: {overview.users.starter || 0}</span>
                    <span className="text-purple-600 font-medium">Pro: {overview.users.pro}</span>
                    <span className="text-orange-600">AppSumo: {overview.users.appsumo}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Searches Today</p>
                      <p className="text-3xl font-bold text-slate-900">{overview.searches.today}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <Search className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-3 text-xs text-slate-500">
                    <span>Week: {overview.searches.this_week}</span>
                    <span>Month: {overview.searches.this_month}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">API Quota Used</p>
                      <p className="text-3xl font-bold text-slate-900">{overview.quota.percentage}%</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Gauge className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          overview.quota.percentage > 80 ? "bg-red-500" : overview.quota.percentage > 50 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, overview.quota.percentage)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{overview.quota.used_today.toLocaleString()} / 10,000 units</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Monthly Revenue</p>
                      <p className="text-3xl font-bold text-slate-900">${overview.revenue.monthly_estimate}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    {overview.revenue.pro_subscribers} Pro subscribers
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Stats */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    New Signups (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-slate-900">{overview.new_signups_7d}</p>
                  <p className="text-sm text-slate-500 mt-1">new users this week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-500" />
                    Search Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{overview.searches.today}</p>
                      <p className="text-xs text-slate-500">Today</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{overview.searches.this_week}</p>
                      <p className="text-xs text-slate-500">This Week</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{overview.searches.this_month}</p>
                      <p className="text-xs text-slate-500">This Month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs text-slate-500">Search by email</Label>
                    <Input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setUsersPage(0); }}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-40">
                    <Label className="text-xs text-slate-500">Filter by tier</Label>
                    <Select value={userTierFilter} onValueChange={(v) => { setUserTierFilter(v); setUsersPage(0); }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tiers</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="appsumo">AppSumo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={loadUsers} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700" data-testid="create-user-btn">
                    <UserPlus className="h-4 w-4" />
                    Create User
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Signup Date</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Searches/Mo</TableHead>
                        <TableHead className="text-right">Total Searches</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-slate-400" />
                              {u.email}
                              {u.role === "admin" && (
                                <Badge variant="outline" className="text-xs">Admin</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{tierBadge(u.tier)}</TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {formatDate(u.created_at)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {formatDate(u.last_active)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {u.access_expires_at ? (
                              <span className={`flex items-center gap-1 ${new Date(u.access_expires_at) < new Date() ? "text-red-500" : "text-amber-600"}`}>
                                <CalendarClock className="h-3.5 w-3.5" />
                                {new Date(u.access_expires_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{u.searches_this_month || 0}</TableCell>
                          <TableCell className="text-right">{u.total_searches || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setCreditUser(u); setCreditAmount("50"); }}
                                title="Grant AI draft credits"
                                className="text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                                data-testid={`grant-credits-btn-${u.id}`}
                              >
                                <Sparkles className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingUser(u);
                                  setNewTier(u.tier || "free");
                                  setNewExpiry(u.access_expires_at ? u.access_expires_at.split("T")[0] : "");
                                }}
                                disabled={u.role === "admin"}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingUser(u)}
                                disabled={u.role === "admin"}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-slate-500">
                    Showing {usersPage * 50 + 1}-{Math.min((usersPage + 1) * 50, usersTotal)} of {usersTotal} users
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={usersPage === 0}
                      onClick={() => setUsersPage(usersPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(usersPage + 1) * 50 >= usersTotal}
                      onClick={() => setUsersPage(usersPage + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quota Tab */}
        {activeTab === "quota" && quota && (
          <div className="space-y-6">
            {/* Quota Overview */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-indigo-500" />
                    Today's Usage
                  </CardTitle>
                  <CardDescription>YouTube API quota consumed today</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">Total Used</span>
                        <span className="font-medium">{quota.totals.total_units.toLocaleString()} / 10,000</span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            quota.percentage_used > 80 ? "bg-red-500" : quota.percentage_used > 50 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, quota.percentage_used)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{quota.percentage_used}% of daily limit</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-xs text-slate-500">Search Calls</p>
                        <p className="text-lg font-semibold">{quota.totals.search_calls}</p>
                        <p className="text-xs text-slate-400">{quota.totals.search_calls * 100} units</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Channel Calls</p>
                        <p className="text-lg font-semibold">{quota.totals.channel_calls}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Playlist Calls</p>
                        <p className="text-lg font-semibold">{quota.totals.playlist_calls}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Video Calls</p>
                        <p className="text-lg font-semibold">{quota.totals.video_calls}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    Top Users by Quota
                  </CardTitle>
                  <CardDescription>Users consuming the most API quota today</CardDescription>
                </CardHeader>
                <CardContent>
                  {quota.top_users.length === 0 ? (
                    <p className="text-sm text-slate-500">No usage recorded today</p>
                  ) : (
                    <div className="space-y-3">
                      {quota.top_users.slice(0, 5).map((u, i) => (
                        <div key={u.user_id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                            <span className="text-sm truncate max-w-[180px]">{u.user_email}</span>
                          </div>
                          <span className="text-sm font-medium">{u.total_units} units</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Hourly Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-500" />
                  Hourly Search Activity
                </CardTitle>
                <CardDescription>Searches per hour today (UTC)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32">
                  {quota.hourly_searches.map((h) => {
                    const maxSearches = Math.max(...quota.hourly_searches.map(x => x.searches), 1);
                    const height = (h.searches / maxSearches) * 100;
                    return (
                      <div
                        key={h.hour}
                        className="flex-1 bg-indigo-100 hover:bg-indigo-200 rounded-t transition-all relative group"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          {h.hour}:00 - {h.searches} searches
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>0:00</span>
                  <span>6:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-500" />
                    Recent Search Activity
                  </CardTitle>
                  <CardDescription>Last 100 searches across all users</CardDescription>
                </div>
                <Button variant="outline" onClick={loadActivity} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Niche</TableHead>
                      <TableHead>Keywords</TableHead>
                      <TableHead className="text-right">Results</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchActivity.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                          {formatDate(s.timestamp)}
                        </TableCell>
                        <TableCell className="text-sm">{s.user_email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {s.niche?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <span className="text-sm text-slate-600 truncate block">
                            {s.keywords?.join(", ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{s.results_count}</TableCell>
                      </TableRow>
                    ))}
                    {searchActivity.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                          No search activity recorded yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revenue Tab */}
        {activeTab === "revenue" && revenue && (
          <div className="space-y-6">
            {/* Revenue Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                <CardContent className="pt-6">
                  <p className="text-sm text-purple-100">Monthly Recurring Revenue</p>
                  <p className="text-4xl font-bold mt-1">${revenue.mrr}</p>
                  <p className="text-xs text-purple-200 mt-2">ARR: ${revenue.arr}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500">Total Subscribers</p>
                  <p className="text-3xl font-bold text-slate-900">{revenue.subscribers.total}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500">Pro Monthly</p>
                  <p className="text-3xl font-bold text-slate-900">{revenue.subscribers.pro_monthly}</p>
                  <p className="text-xs text-slate-400">$39/month each</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500">Pro Yearly</p>
                  <p className="text-3xl font-bold text-slate-900">{revenue.subscribers.pro_yearly}</p>
                  <p className="text-xs text-slate-400">$299/year each</p>
                </CardContent>
              </Card>
            </div>

            {/* Paid Users Table */}
            <Card>
              <CardHeader>
                <CardTitle>Paid Users</CardTitle>
                <CardDescription>All users with Starter, Pro, or AppSumo tier</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Paid Date</TableHead>
                        <TableHead>Signup Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenue.paid_users.map((u) => (
                        <TableRow key={u.email}>
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>{tierBadge(u.tier)}</TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {u.plan === "pro_yearly" ? "Yearly" : "Monthly"}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {formatDate(u.paid_at)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {formatDate(u.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {revenue.paid_users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                            No paid users yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        )}
      </div>

      {/* Edit User Tier Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update tier and access for {editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tier</Label>
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Access Expiry</Label>
              <p className="text-xs text-slate-500 mb-1.5">Leave empty for permanent access. Account auto-downgrades to Free when expired.</p>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="flex-1"
                  data-testid="edit-expiry-input"
                />
                {newExpiry && (
                  <Button variant="ghost" size="sm" onClick={() => setNewExpiry("")} className="text-slate-400 hover:text-red-500 h-9 px-2">
                    Clear
                  </Button>
                )}
              </div>
              {/* Quick presets */}
              <div className="flex gap-2 mt-2">
                {[
                  { label: "3 days", days: 3 },
                  { label: "1 week", days: 7 },
                  { label: "2 weeks", days: 14 },
                  { label: "1 month", days: 30 },
                ].map((p) => (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + p.days);
                      setNewExpiry(d.toISOString().split("T")[0]);
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={updateUserTierAndExpiry} className="bg-indigo-600 hover:bg-indigo-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingUser?.email}? This will also delete all their searches, saved reports, and channel data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>Cancel</Button>
            <Button onClick={deleteUser} variant="destructive">
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Credits Dialog */}
      <Dialog open={!!creditUser} onOpenChange={() => setCreditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Grant AI Draft Credits
            </DialogTitle>
            <DialogDescription>
              Add draft credits to {creditUser?.email}'s account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">Number of credits</Label>
            <div className="flex gap-2">
              {["10", "50", "100", "500"].map((val) => (
                <Button
                  key={val}
                  variant={creditAmount === val ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreditAmount(val)}
                  className={creditAmount === val ? "bg-purple-600 hover:bg-purple-700" : ""}
                >
                  {val}
                </Button>
              ))}
              <Input
                type="number"
                min={1}
                max={10000}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-24 h-9"
                data-testid="grant-credits-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditUser(null)}>Cancel</Button>
            <Button
              onClick={grantCredits}
              className="bg-purple-600 hover:bg-purple-700 gap-1.5"
              data-testid="grant-credits-confirm-btn"
            >
              <Sparkles className="h-4 w-4" />
              Grant {creditAmount} Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-500" />
              Create User
            </DialogTitle>
            <DialogDescription>
              Manually create a user account with a specific tier and optional time limit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Email *</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={createForm.email}
                onChange={(e) => setCreateForm(p => ({ ...p, email: e.target.value }))}
                data-testid="create-user-email"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Password *</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="At least 6 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm(p => ({ ...p, password: e.target.value }))}
                  className="flex-1"
                  data-testid="create-user-password"
                />
                <Button variant="outline" size="sm" onClick={generatePassword} className="shrink-0 h-9 text-xs">
                  Generate
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Tier</Label>
              <Select value={createForm.tier} onValueChange={(v) => setCreateForm(p => ({ ...p, tier: v }))}>
                <SelectTrigger className="mt-1" data-testid="create-user-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">AI Draft Credits</Label>
              <Input
                type="number"
                min={0}
                value={createForm.draft_credits}
                onChange={(e) => setCreateForm(p => ({ ...p, draft_credits: e.target.value }))}
                className="mt-1"
                data-testid="create-user-credits"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Access Expiry</Label>
              <p className="text-xs text-slate-500 mb-1.5">Optional. Account auto-downgrades to Free when this date passes.</p>
              <Input
                type="date"
                value={createForm.access_expires_at}
                onChange={(e) => setCreateForm(p => ({ ...p, access_expires_at: e.target.value }))}
                data-testid="create-user-expiry"
              />
              <div className="flex gap-2 mt-2">
                {[
                  { label: "3 days", days: 3 },
                  { label: "1 week", days: 7 },
                  { label: "2 weeks", days: 14 },
                  { label: "1 month", days: 30 },
                ].map((p) => (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + p.days);
                      setCreateForm(prev => ({ ...prev, access_expires_at: d.toISOString().split("T")[0] }));
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={createUser}
              disabled={createLoading || !createForm.email || !createForm.password}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
              data-testid="create-user-submit"
            >
              <UserPlus className="h-4 w-4" />
              {createLoading ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
