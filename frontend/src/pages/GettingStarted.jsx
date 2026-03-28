import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Youtube, Search, Mail, BookOpen, LayoutGrid, Sparkles, Target, Download, CheckCircle2 } from "lucide-react";

const quickStartSteps = [
  {
    num: "1",
    title: "Select Your Niche",
    desc: "Choose from 14 niches — SaaS & Software, Fitness, Finance, Ecommerce, Education, Marketing, Beauty, Travel, Gaming, Home & DIY, Pet Care, Personal Development, Food & Cooking, or Tech & Gadgets. Each uses tailored scoring keywords.",
    icon: LayoutGrid,
  },
  {
    num: "2",
    title: "Enter Keywords",
    desc: "Add topic keywords relevant to your target creators — like 'automation tutorial' for SaaS or 'best protein powder' for fitness. Set your subscriber range and search filters.",
    icon: Search,
  },
  {
    num: "3",
    title: "Run Search & Enrich",
    desc: "Click Search to find matching YouTube channels, then click Enrich to get full details: stats, recent videos, affiliate signals, and scores for each channel.",
    icon: Sparkles,
  },
  {
    num: "4",
    title: "Review & Shortlist",
    desc: "Sort channels by Total Score or Affiliate Score. Add promising prospects to your shortlist, add notes, and export your list as a CSV for outreach.",
    icon: Target,
  },
];

const tutorials = [
  {
    title: "How to Use the Prospect Finder",
    desc: "Complete walkthrough of searching, enriching, and scoring YouTube channels.",
    videoId: "placeholder1",
    duration: "5:30",
  },
  {
    title: "Understanding Channel Scores",
    desc: "Deep dive into the Total Score and Affiliate Score calculations.",
    videoId: "placeholder2",
    duration: "4:15",
  },
  {
    title: "Exporting & Outreach Tips",
    desc: "How to export your shortlist and use the outreach templates effectively.",
    videoId: "placeholder3",
    duration: "3:45",
  },
];

export default function GettingStarted() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 font-body">
      {/* Shared Dashboard Header */}
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
            <button onClick={() => navigate("/dashboard/outreach")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all">
              <Mail className="h-3.5 w-3.5" />
              Outreach
            </button>
            <button onClick={() => navigate("/dashboard/getting-started")} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700">
              <BookOpen className="h-3.5 w-3.5" />
              Getting Started
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-slate-500 hover:text-slate-900"
            >
              Log Out
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 z-40 px-4 py-2 flex justify-around">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 whitespace-nowrap">
          <Search className="h-3 w-3" /> Finder
        </button>
        <button onClick={() => navigate("/dashboard/outreach")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 whitespace-nowrap">
          <Mail className="h-3 w-3" /> Outreach
        </button>
        <button onClick={() => navigate("/dashboard/getting-started")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 whitespace-nowrap">
          <BookOpen className="h-3 w-3" /> Getting Started
        </button>
      </div>

      {/* Main Content */}
      <main className="max-w-[1000px] mx-auto px-6 py-10 space-y-12 pb-24 md:pb-10">
        {/* Welcome */}
        <div className="text-center">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900">Welcome to Affilitube</h1>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto">
            Find YouTube creators ready to promote your brand across 14 niches. Follow the quick start below to run your first search.
          </p>
        </div>

        {/* Quick Start */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Quick Start
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {quickStartSteps.map((step) => (
              <Card key={step.num} className="bg-white/80 border-slate-100 hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shrink-0">
                      <step.icon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Step {step.num}</span>
                        <h3 className="font-heading font-semibold text-slate-900">{step.title}</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Button
              onClick={() => navigate("/dashboard")}
              className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-8"
            >
              Go to Prospect Finder
            </Button>
          </div>
        </section>

        {/* Key Features */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Key Features
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: "14 Niches", desc: "SaaS, Fitness, Finance, Ecommerce, Education, Marketing, Beauty, Travel, Gaming, Home, Pet, Personal Dev, Food, Tech — each with tailored scoring keywords.", icon: LayoutGrid },
              { title: "Dual Scoring", desc: "Every channel gets a Total Score (0-100) and separate Affiliate Score for outreach prioritization.", icon: Target },
              { title: "CSV Export", desc: "Export all data including scores, signals, contact info, and your notes (Pro plan).", icon: Download },
            ].map((f) => (
              <Card key={f.title} className="bg-white/80 border-slate-100">
                <CardContent className="pt-6">
                  <f.icon className="h-8 w-8 text-indigo-500 mb-3" />
                  <h3 className="font-heading font-semibold text-slate-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Video Tutorials */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            Video Tutorials
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {tutorials.map((t) => (
              <Card key={t.title} className="bg-white/80 border-slate-100 overflow-hidden group hover:shadow-md transition-shadow">
                <div className="relative aspect-video bg-slate-100 flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
                    <Youtube className="h-6 w-6 text-slate-400" />
                  </div>
                  <span className="absolute bottom-2 right-2 text-xs bg-black/70 text-white px-2 py-0.5 rounded">{t.duration}</span>
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-heading font-semibold text-slate-900 text-sm mb-1">{t.title}</h3>
                  <p className="text-xs text-slate-500">{t.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500 text-center">
            Video tutorials coming soon! Check back for walkthroughs and tips.
          </p>
        </section>

        {/* Tips */}
        <section className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 rounded-2xl p-6 border border-indigo-100/50">
          <h2 className="font-heading text-lg font-semibold text-slate-900 mb-4">Pro Tips</h2>
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
              <span><strong>Use specific keywords</strong> — "zapier tutorial" works better than just "automation".</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
              <span><strong>Enable video description scanning</strong> (in Advanced Settings) to detect more affiliate links, though it uses more API quota.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
              <span><strong>Sort by Affiliate Score</strong> to surface creators most likely to accept partnership offers.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
              <span><strong>Save your searches</strong> (Pro) to re-run them later with one click as new channels emerge.</span>
            </li>
          </ul>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Button
            onClick={() => navigate("/dashboard")}
            size="lg"
            className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-10"
          >
            Start Prospecting
          </Button>
        </div>
      </main>
    </div>
  );
}
