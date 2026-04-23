import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  BarChart3,
  Target,
  Zap,
  CheckCircle2,
  Youtube,
  ArrowRight,
  Sparkles,
  Users,
  Mail,
  Activity,
  Gift,
  Clock,
  TrendingUp,
  Shield,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AffiliatesLanding() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState("monthly");

  const handleCheckout = async (planPrefix) => {
    if (!user) {
      const planId = `${planPrefix}_${billingCycle === "yearly" ? "annual" : "monthly"}`;
      navigate(`/signup?plan=${planId}`);
      return;
    }
    setLoading(true);
    try {
      const planId = `${planPrefix}_${billingCycle === "yearly" ? "annual" : "monthly"}`;
      const res = await axios.post(
        `${API}/checkout/create-session`,
        { plan: planId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = res.data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen font-body">
      {/* Minimal Nav */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Youtube className="h-4 w-4 text-white" />
            </div>
            <span className="font-heading font-bold text-white">Affilitube</span>
          </a>
          <Button
            onClick={() => scrollToSection("pricing")}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-sm px-5"
          >
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-slate-950 pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-indigo-500/10 text-indigo-300 border-indigo-500/20 rounded-full px-4 py-1.5 text-sm font-medium">
              YouTube Partner Discovery Tool
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-white leading-[1.1] tracking-tight">
              Stop guessing.
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                Start finding YouTube affiliates and influencers
              </span>{" "}
              who actually convert.
            </h1>
            <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-2xl">
              Affilitube scans thousands of YouTube channels and scores them on affiliate potential,
              sponsorship history, and audience fit — so you only reach out to creators who already
              promote products like yours.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                onClick={() => scrollToSection("pricing")}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-base px-8 py-6 h-auto"
                data-testid="hero-cta"
              >
                Start Finding Affiliates
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => scrollToSection("how-it-works")}
                className="rounded-full text-slate-400 hover:text-white hover:bg-slate-800 text-base px-6 py-6 h-auto"
              >
                See how it works
              </Button>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              No credit card required. 50 free channel scans.
            </p>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-base sm:text-lg font-heading font-semibold text-slate-900 text-center mb-12">
            Sound familiar?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Clock,
                title: "Hours wasted scrolling YouTube",
                desc: "You're manually searching YouTube, opening channels one by one, guessing if they'd be a good fit for your brand.",
              },
              {
                icon: Mail,
                title: "Cold outreach that goes nowhere",
                desc: "You send 50 emails and hear back from 2. Most creators you contact have never done a brand deal or affiliate promotion.",
              },
              {
                icon: Target,
                title: "No way to tell who's open to deals",
                desc: "Some channels look great on the surface but have zero affiliate activity. You can't tell until it's too late.",
              },
            ].map((pain) => (
              <div
                key={pain.title}
                className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50"
              >
                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                  <pain.icon className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="font-heading font-semibold text-slate-900 mb-2">{pain.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{pain.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-base sm:text-lg font-heading font-semibold text-slate-900 text-center mb-4">
            From search to outreach in minutes, not days
          </h2>
          <p className="text-sm text-slate-500 text-center mb-14 max-w-lg mx-auto">
            Three steps to find YouTube affiliates and influencers who are genuinely open to partnerships.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Search,
                title: "Pick your niche & keywords",
                desc: "Choose from 14 niches — SaaS, Finance, Health, E-commerce, and more. Enter your keywords. Affilitube searches YouTube's channel AND video index.",
                color: "from-indigo-500 to-blue-500",
              },
              {
                step: "02",
                icon: BarChart3,
                title: "Get scored results",
                desc: "Every channel is enriched with subscriber data, engagement health, affiliate signals, brand contact signals, and a proprietary Affiliate Score out of 100.",
                color: "from-purple-500 to-pink-500",
              },
              {
                step: "03",
                icon: Mail,
                title: "Reach out to the right ones",
                desc: "Add top prospects to your Pipeline, use AI-drafted outreach emails personalized to each creator, and track every conversation to close.",
                color: "from-emerald-500 to-teal-500",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <span className="text-6xl font-heading font-bold text-slate-100 absolute -top-2 -left-1">
                  {item.step}
                </span>
                <div className="relative pt-10 pb-6 px-6">
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4`}>
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-heading font-semibold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 space-y-20">
          {[
            {
              icon: Sparkles,
              badge: "Scoring",
              title: "Affiliate Score & Signals",
              desc: "Know who's already promoting products. Affilitube detects affiliate links, sponsorship disclosures, \"tools I use\" sections, and commercial language — then scores each channel 0-100 on affiliate and influencer potential.",
              highlights: ["Affiliate link detection", "Commercial signal analysis", "Brand contact signals", "Tools stack detection"],
              color: "purple",
              image: "https://customer-assets.emergentagent.com/job_028caec5-f1e6-42b5-a626-d2310908d417/artifacts/8cv1n66l_Enriched%20search%20results.png",
            },
            {
              icon: Gift,
              badge: "Intelligence",
              title: "Brand Intelligence",
              desc: "See which brands a creator has worked with before. Our sponsorship detection scans their last 10 videos for disclosure signals, partner mentions, and affiliate link patterns — so you know who's already open to deals.",
              highlights: ["Sponsorship history", "Brand name detection", "Disclosure analysis", "Confidence scoring"],
              color: "pink",
              image: "https://customer-assets.emergentagent.com/job_028caec5-f1e6-42b5-a626-d2310908d417/artifacts/41nyvbmn_Brand%20intelligence.png",
            },
            {
              icon: Zap,
              badge: "AI Outreach",
              title: "AI-Drafted Outreach Emails",
              desc: "Generate personalized, non-spammy outreach emails in one click. The AI references the creator's actual videos, uses your product details, and writes in a tone that doesn't sound like a template.",
              highlights: ["References specific videos", "Your brand voice & tone", "Plain text, no marketing jargon", "One-click copy & send"],
              color: "indigo",
              image: "https://customer-assets.emergentagent.com/job_028caec5-f1e6-42b5-a626-d2310908d417/artifacts/7dcyguk2_AI%20outreach%20email%20draft.png",
            },
            {
              icon: Users,
              badge: "CRM",
              title: "Pipeline CRM",
              desc: "Track every prospect from first contact to signed deal. Organize by project, set follow-up dates, log notes, and sort by who's most likely to convert — all without leaving Affilitube.",
              highlights: ["Project organization", "Follow-up reminders", "Contact history", "Status tracking"],
              color: "emerald",
              image: "https://customer-assets.emergentagent.com/job_028caec5-f1e6-42b5-a626-d2310908d417/artifacts/4fdbqp1d_Outreach%20pipeline.png",
            },
          ].map((feature, idx) => {
            const colorMap = {
              purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100", badge: "bg-purple-100 text-purple-700" },
              pink: { bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-100", badge: "bg-pink-100 text-pink-700" },
              indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100", badge: "bg-indigo-100 text-indigo-700" },
              emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", badge: "bg-emerald-100 text-emerald-700" },
            };
            const c = colorMap[feature.color];
            return (
              <div key={feature.title} className={`flex flex-col ${idx % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"} gap-12 items-center`}>
                <div className="flex-1">
                  <Badge className={`${c.badge} rounded-full px-3 py-1 text-xs font-medium mb-4`}>
                    {feature.badge}
                  </Badge>
                  <h3 className="text-2xl font-heading font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-500 leading-relaxed mb-6">{feature.desc}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {feature.highlights.map((h) => (
                      <div key={h} className="flex items-center gap-2">
                        <CheckCircle2 className={`h-4 w-4 ${c.text} shrink-0`} />
                        <span className="text-sm text-slate-600">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`flex-1 w-full rounded-2xl ${c.bg} border ${c.border} overflow-hidden`}>
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "14", label: "Niches covered", icon: BarChart3 },
              { value: "100+", label: "Signals analyzed per channel", icon: Activity },
              { value: "<2 min", label: "From search to scored results", icon: Zap },
              { value: "50", label: "Free channel scans to start", icon: Shield },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="h-5 w-5 text-indigo-400 mx-auto mb-3" />
                <p className="text-3xl font-heading font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-base sm:text-lg font-heading font-semibold text-slate-900 text-center mb-3">
            Simple pricing. Start free.
          </h2>
          <p className="text-sm text-slate-500 text-center mb-8">
            No credit card required for the free plan. Upgrade when you're ready.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`text-sm px-4 py-1.5 rounded-full transition-colors ${billingCycle === "monthly" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`text-sm px-4 py-1.5 rounded-full transition-colors ${billingCycle === "yearly" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              Yearly
              <span className="ml-1.5 text-xs text-emerald-600 font-medium">Save 33%</span>
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl border border-slate-200 p-6">
              <h3 className="font-heading font-semibold text-slate-900 mb-1">Free</h3>
              <p className="text-sm text-slate-500 mb-4">Get started, no card needed</p>
              <p className="text-3xl font-heading font-bold text-slate-900 mb-6">$0</p>
              <Button
                onClick={() => navigate("/signup")}
                variant="outline"
                className="w-full rounded-full mb-6"
                data-testid="pricing-free-cta"
              >
                Sign Up Free
              </Button>
              <ul className="space-y-2.5 text-sm text-slate-600">
                {["3 searches / month", "50 channels per search", "Channel scoring & health", "14 niche categories"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-slate-300 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Starter */}
            <div className="rounded-2xl border-2 border-indigo-500 p-6 relative shadow-lg shadow-indigo-500/10">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white rounded-full px-3 text-xs">
                Most Popular
              </Badge>
              <h3 className="font-heading font-semibold text-slate-900 mb-1">Starter</h3>
              <p className="text-sm text-slate-500 mb-4">For serious affiliate marketers</p>
              <p className="text-3xl font-heading font-bold text-slate-900 mb-1">
                ${billingCycle === "yearly" ? "26.66" : "39.99"}
                <span className="text-base font-normal text-slate-400">/mo</span>
              </p>
              {billingCycle === "yearly" && (
                <p className="text-xs text-emerald-600 mb-4">Billed annually ($319.99/yr)</p>
              )}
              {billingCycle !== "yearly" && <div className="mb-4" />}
              <Button
                onClick={() => handleCheckout("starter")}
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 mb-6"
                data-testid="pricing-starter-cta"
              >
                {loading ? "Loading..." : "Get Started"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <ul className="space-y-2.5 text-sm text-slate-600">
                {[
                  "20 searches / month",
                  "Unlimited results per search",
                  "CSV export",
                  "Saved searches & reports",
                  "Pipeline CRM (3 projects)",
                  "AI outreach drafts (credits)",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border border-slate-200 p-6">
              <h3 className="font-heading font-semibold text-slate-900 mb-1">Pro</h3>
              <p className="text-sm text-slate-500 mb-4">For teams & agencies</p>
              <p className="text-3xl font-heading font-bold text-slate-900 mb-1">
                ${billingCycle === "yearly" ? "52.67" : "79"}
                <span className="text-base font-normal text-slate-400">/mo</span>
              </p>
              {billingCycle === "yearly" && (
                <p className="text-xs text-emerald-600 mb-4">Billed annually ($632/yr)</p>
              )}
              {billingCycle !== "yearly" && <div className="mb-4" />}
              <Button
                onClick={() => handleCheckout("pro")}
                disabled={loading}
                className="w-full rounded-full bg-slate-900 hover:bg-slate-800 mb-6"
                data-testid="pricing-pro-cta"
              >
                {loading ? "Loading..." : "Get Started"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <ul className="space-y-2.5 text-sm text-slate-600">
                {[
                  "Unlimited searches",
                  "Unlimited results",
                  "Everything in Starter",
                  "Unlimited pipeline projects",
                  "Brand Intelligence (full)",
                  "AI outreach drafts (credits)",
                  "Priority support",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white mb-4">
            Your competitors are already finding affiliates and influencers faster.
          </h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto">
            50 free channel scans. No credit card. Set up in 30 seconds.
          </p>
          <Button
            onClick={() => scrollToSection("pricing")}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-base px-8 py-6 h-auto"
            data-testid="final-cta"
          >
            Start Finding Affiliates
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-8 bg-slate-950 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Youtube className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm text-slate-500">Affilitube</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="/terms" className="hover:text-slate-300 transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-slate-300 transition-colors">Privacy</a>
            <a href="/pricing" className="hover:text-slate-300 transition-colors">Pricing</a>
            <a href="/login" className="hover:text-slate-300 transition-colors">Login</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
