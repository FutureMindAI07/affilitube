import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Play,
  Youtube,
  Key,
  Search,
  Zap,
  FileText,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const tutorials = [
  {
    id: "api-key",
    title: "How to Create a YouTube API Key",
    description: "Step-by-step guide to getting your free YouTube Data API v3 key from Google Cloud Console. Takes about 5 minutes.",
    videoId: "fMPr4-5wG40", // How to create a YouTube API Key
    duration: "5 min",
    category: "Setup",
    icon: Key,
  },
  {
    id: "first-search",
    title: "Your First Channel Search",
    description: "Learn how to configure keywords, filters, and search depth to find the best affiliate prospects.",
    videoId: null,
    duration: "4 min",
    category: "Getting Started",
    icon: Search,
  },
  {
    id: "enrichment",
    title: "Understanding Channel Enrichment",
    description: "How the two-step search and enrich flow works, and how to manage your API quota effectively.",
    videoId: null,
    duration: "6 min",
    category: "Getting Started",
    icon: Zap,
  },
  {
    id: "scoring",
    title: "How Affiliate Scoring Works",
    description: "Understand the scoring algorithm — what makes a high-scoring channel and how to interpret the results.",
    videoId: null,
    duration: "3 min",
    category: "Features",
    icon: CheckCircle2,
  },
  {
    id: "reports",
    title: "Saving & Exporting Reports",
    description: "How to save searches, create reports, export to CSV, and manage your shortlist.",
    videoId: null,
    duration: "4 min",
    category: "Features",
    icon: FileText,
  },
];

const quickSteps = [
  { step: "1", title: "Add your API Key", description: "Go to Settings and paste your YouTube Data API v3 key", action: "settings" },
  { step: "2", title: "Enter keywords", description: "Add topic keywords related to the niches you want to target" },
  { step: "3", title: "Run a search", description: "Hit Search to find channels, then Enrich to get full details and scores" },
  { step: "4", title: "Review & shortlist", description: "Sort by score, shortlist the best prospects, and export your list" },
];

export default function GettingStarted() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8" data-testid="getting-started-page">
      {/* Quick Start */}
      <div>
        <h2 className="font-heading text-xl font-bold text-slate-900 mb-1">Quick Start</h2>
        <p className="text-sm text-slate-500 mb-5">Get up and running in 4 simple steps</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickSteps.map((s) => (
            <Card key={s.step} className="glass-card group hover:border-indigo-200/60 transition-all">
              <CardContent className="pt-5 pb-5">
                <div className="font-heading text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 opacity-40 group-hover:opacity-100 transition-opacity mb-2">
                  {s.step}
                </div>
                <h3 className="font-heading font-semibold text-slate-900 mb-1">{s.title}</h3>
                <p className="text-sm text-slate-500">{s.description}</p>
                {s.action === "settings" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-full text-xs"
                    onClick={() => navigate("/dashboard")}
                    data-testid="quick-start-settings"
                  >
                    Go to Tool <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Tutorial Videos */}
      <div>
        <h2 className="font-heading text-xl font-bold text-slate-900 mb-1">Tutorial Videos</h2>
        <p className="text-sm text-slate-500 mb-5">Watch these short guides to get the most out of Tubiate</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tutorials.map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.id} className="glass-card group hover:border-indigo-200/60 transition-all overflow-hidden" data-testid={`tutorial-${t.id}`}>
                {/* Video embed area */}
                {t.videoId ? (
                  <div className="aspect-video bg-slate-900">
                    <iframe
                      src={`https://www.youtube.com/embed/${t.videoId}`}
                      title={t.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-50 flex flex-col items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-white shadow-md flex items-center justify-center mb-2 group-hover:shadow-lg group-hover:scale-105 transition-all">
                      <Play className="h-5 w-5 text-indigo-600 ml-0.5" />
                    </div>
                    <p className="text-xs text-slate-400">Coming soon</p>
                  </div>
                )}
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0 border-indigo-200 text-indigo-600">{t.category}</Badge>
                    <span className="text-[10px] text-slate-400">{t.duration}</span>
                  </div>
                  <h3 className="font-heading font-semibold text-slate-900 text-sm mb-1">{t.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{t.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* FAQ / Tips */}
      <div>
        <h2 className="font-heading text-xl font-bold text-slate-900 mb-1">Tips & FAQ</h2>
        <p className="text-sm text-slate-500 mb-5">Common questions and useful tips</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { q: "How many searches can I do per day?", a: "The YouTube API gives you 10,000 units per day. A typical search uses ~200 units, so you can comfortably do 20-30 searches daily. The app tracks your usage in real-time." },
            { q: "What makes a good affiliate score?", a: "Scores above 70 are strong prospects. The score combines subscriber count, engagement rate, affiliate signal detection, tool mentions, and content relevance." },
            { q: "Can I use multiple API keys?", a: "Currently one key per account. If you need more quota, you can create additional Google Cloud projects with separate keys." },
            { q: "How often is channel data refreshed?", a: "Enriched channel data is cached for 24 hours. After that, the next enrichment will fetch fresh data from YouTube." },
          ].map((faq, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="pt-4 pb-4">
                <h3 className="font-heading font-semibold text-slate-900 text-sm mb-1.5">{faq.q}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
