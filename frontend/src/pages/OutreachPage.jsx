import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Youtube, Search, Mail, BookOpen, LogOut, Bug, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import Outreach from "@/pages/Outreach";

const API = process.env.REACT_APP_BACKEND_URL;

export default function OutreachPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout } = useAuth();
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugSubject, setBugSubject] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSubmitting, setBugSubmitting] = useState(false);

  const submitBugReport = async () => {
    if (!bugSubject.trim() || !bugDescription.trim()) { toast.error("Please fill in both fields"); return; }
    setBugSubmitting(true);
    try {
      await axios.post(`${API}/api/report-bug`, { subject: bugSubject, description: bugDescription }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Bug report submitted!");
      setBugReportOpen(false);
      setBugSubject("");
      setBugDescription("");
    } catch { toast.error("Failed to submit bug report"); }
    finally { setBugSubmitting(false); }
  };

  const navItems = [
    { label: "Prospect Finder", path: "/dashboard", icon: Search },
    { label: "Outreach", path: "/dashboard/outreach", icon: Mail },
    { label: "Getting Started", path: "/dashboard/getting-started", icon: BookOpen },
  ];

  const isActive = (path) => path === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(path);

  return (
    <div className="dashboard-bg font-body min-h-screen">
      <header className="glass-header" data-testid="app-header">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Youtube className="h-4 w-4 text-white" />
            </div>
            <span className="font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 hidden sm:inline">Affilitube</span>
          </a>
          <nav className="hidden md:flex items-center gap-1" data-testid="dashboard-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button key={item.path} onClick={() => navigate(item.path)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"}`} data-testid={`nav-${item.path.split("/").pop() || "tool"}`}>
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                </button>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => setBugReportOpen(true)} className="text-slate-500 hover:text-slate-900" data-testid="bug-report-btn"><Bug className="h-4 w-4" /></Button>
            </TooltipTrigger><TooltipContent>Report a Bug</TooltipContent></Tooltip></TooltipProvider>
            <span className="text-xs text-slate-500 hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { navigate("/"); setTimeout(logout, 100); }} className="text-slate-500 hover:text-slate-900" data-testid="logout-btn"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden border-b bg-white/60 backdrop-blur-sm px-4 py-2 flex gap-1 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button key={item.path} onClick={() => navigate(item.path)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>
              <Icon className="h-3 w-3" /> {item.label}
            </button>
          );
        })}
      </div>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Outreach />
      </main>

      {/* Bug Report Dialog */}
      <Dialog open={bugReportOpen} onOpenChange={setBugReportOpen}>
        <DialogContent><DialogHeader><DialogTitle>Report a Bug</DialogTitle><DialogDescription>Describe the issue and we'll look into it.</DialogDescription></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2"><Label>Subject</Label><Input value={bugSubject} onChange={(e) => setBugSubject(e.target.value)} placeholder="Brief description" data-testid="bug-subject" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={bugDescription} onChange={(e) => setBugDescription(e.target.value)} placeholder="Steps to reproduce, expected behaviour..." rows={5} data-testid="bug-description" /></div>
          </div>
          <DialogFooter><Button onClick={submitBugReport} disabled={bugSubmitting} className="btn-gradient" data-testid="bug-submit-btn">{bugSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Report"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
