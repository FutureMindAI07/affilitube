import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ArrowUp,
  Search,
  BarChart3,
  Gift,
  Sparkles,
  Users,
  Mail,
  Target,
  CheckCircle2,
  Shield,
  Zap,
  Clock,
  MessageSquare,
  Youtube,
} from "lucide-react";

export default function SaaSFoundersLanding() {
  const navigate = useNavigate();

  const startTrial = () => navigate("/signup?trial=starter_14");

  return (
    <>
      <Helmet>
        <title>Find YouTube Affiliates for Your SaaS | AffiliTube</title>
        <meta name="description" content="AffiliTube helps SaaS founders find YouTube influencer affiliates fast. Search by niche, see competitor partnerships, and automate outreach — free 14-day trial, no card required." />
      </Helmet>

      <div className="min-h-screen font-body">
        {/* Nav */}
        <nav className="fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Youtube className="h-4 w-4 text-white" />
              </div>
              <span className="font-heading font-bold text-white">Affilitube</span>
            </a>
            <Button
              onClick={startTrial}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-sm px-5"
            >
              Start Free Trial
            </Button>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative bg-slate-950 pt-32 pb-24 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950" />
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="max-w-3xl">
              <Badge className="mb-6 bg-indigo-500/10 text-indigo-300 border-indigo-500/20 rounded-full px-4 py-1.5 text-sm font-medium">
                Built for SaaS Founders
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-white leading-[1.1] tracking-tight">
                Building was the easy part.
              </h1>
              <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-2xl">
                You're a builder, not a marketer. AffiliTube finds the YouTube creators already
                promoting SaaS products in your niche — so you can get your first paying customers
                without becoming a full-time marketer.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button
                  onClick={startTrial}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-base px-8 py-6 h-auto"
                  data-testid="hero-trial-cta"
                >
                  Start Your Free 14-Day Trial
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <a
                  href="/pricing"
                  className="text-sm text-slate-400 hover:text-indigo-400 transition-colors underline underline-offset-4"
                >
                  Already convinced? Skip straight to a paid plan
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                No credit card required · Full Starter access for 14 days · Upgrade to keep your data
              </p>
            </div>
          </div>
        </section>

        {/* Pain Section — Reddit-style cards */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-base sm:text-lg font-heading font-semibold text-slate-900 text-center mb-12">
              Sound familiar?
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {[
                { sub: "r/SaaS", user: "u/frustrated_founder", title: "I don't understand marketing, even at all", votes: 247 },
                { sub: "r/microsaas", user: "u/solo_dev_42", title: "Solo MicroSaaS founders: where do you get stuck with customer acquisition?", votes: 183 },
                { sub: "r/startups", user: "u/bootstrapped_af", title: "Badly need a SaaS marketer — can't afford one", votes: 312 },
                { sub: "r/EntrepreneurRideAlong", user: "u/ship_it_fast", title: "How do people actually grow a SaaS thru affiliate marketing today?", votes: 156 },
              ].map((card) => (
                <div
                  key={card.title}
                  className="flex gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                    <ArrowUp className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-mono font-bold text-slate-600">{card.votes}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1">
                      <span className="font-semibold text-slate-500">{card.sub}</span>
                      <span>·</span>
                      <span>{card.user}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 leading-snug">{card.title}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-slate-500 mt-8">
              If you've asked any version of these questions, you're in the right place.
            </p>
          </div>
        </section>

        {/* Solution Section */}
        <section className="py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-base sm:text-lg font-heading font-semibold text-slate-900 text-center mb-4">
              Your competitors are already using YouTube creators.
            </h2>
            <p className="text-sm text-slate-500 text-center mb-14 max-w-lg mx-auto">
              Here's how to find the ones they're using.
            </p>
            <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {[
                { icon: Users, title: "YouTube creators already have your audience", desc: "They've spent years building trust with exactly the people you want as customers." },
                { icon: CheckCircle2, title: "They promote products they believe in", desc: "Unlike paid ads, creator recommendations feel like a friend's advice." },
                { icon: Target, title: "Affiliate deals are performance-based", desc: "You only pay when they send you customers. Zero wasted budget." },
                { icon: Shield, title: "They're already promoting SaaS tools", desc: "AffiliTube only surfaces creators with a proven track record of affiliate promotions." },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="shrink-0 h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-slate-900 text-sm">{item.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-base sm:text-lg font-heading font-semibold text-slate-900 text-center mb-4">
              What used to take weeks now takes minutes.
            </h2>
            <p className="text-sm text-slate-500 text-center mb-14 max-w-md mx-auto">
              Everything you need to find, qualify, and contact YouTube affiliate partners.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Search, title: "Keyword Search by Niche", desc: "Type your niche or product category. Instantly find creators already covering it." },
                { icon: Shield, title: "Competitor Intelligence", desc: "Search by competitor name to find the exact creators promoting them." },
                { icon: CheckCircle2, title: "Affiliate-Verified Creators", desc: "Filter to show only creators who have active affiliate links in their content." },
                { icon: BarChart3, title: "Subscriber & Engagement Data", desc: "See follower counts, view rates, and engagement scores at a glance." },
                { icon: Gift, title: "Brand Intelligence", desc: "View every brand a creator has worked with and which videos contain affiliate promotions." },
                { icon: Zap, title: "Affiliate Score & Overall Score", desc: "Proprietary scoring to help you prioritise your outreach list fast." },
                { icon: Users, title: "Outreach Pipeline", desc: "Organise prospects into a structured pipeline so nothing falls through the cracks." },
                { icon: Mail, title: "AI Email Drafter", desc: "AI reads each creator's bio and videos and writes a personalised outreach email tailored to them." },
              ].map((f) => (
                <div key={f.title} className="p-5 rounded-xl border border-slate-100 bg-slate-50/30">
                  <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
                    <f.icon className="h-4 w-4 text-indigo-600" />
                  </div>
                  <h3 className="font-heading font-semibold text-slate-900 text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400 mt-8">
              Note: Export is not included during the trial. Upgrade to a paid plan to export your data and keep everything you've built.
            </p>
          </div>
        </section>

        {/* Trust / Social Proof */}
        <section className="py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-base sm:text-lg font-heading font-semibold text-slate-900 text-center mb-12">
              Built for founders, not marketing teams.
            </h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-14">
              {[
                { quote: "I found 12 qualified affiliates in my first week. No agency needed.", name: "Alex R.", role: "Founder", company: "SaaS Startup" },
                { quote: "The affiliate score saved me hours of manual research. Every prospect was relevant.", name: "Jordan M.", role: "Solo Founder", company: "Productivity Tool" },
                { quote: "Finally a tool that understands what bootstrapped founders actually need.", name: "Sam K.", role: "Co-founder", company: "AI Platform" },
              ].map((t) => (
                <div key={t.name} className="p-6 rounded-xl border border-slate-200 bg-white">
                  <MessageSquare className="h-5 w-5 text-indigo-300 mb-3" />
                  <p className="text-sm text-slate-700 leading-relaxed italic">"{t.quote}"</p>
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}, {t.company}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
              {[
                { value: "14", label: "Niches covered out of the box" },
                { value: "Minutes", label: "Not weeks to find prospects" },
                { value: "14 days", label: "Free to prove it works" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-heading font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Teaser */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-base sm:text-lg font-heading font-semibold text-slate-900 text-center mb-12">
              Start free. Scale when it works.
            </h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {/* Trial */}
              <div className="rounded-2xl border-2 border-indigo-500 p-6 relative shadow-lg shadow-indigo-500/10">
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white rounded-full px-3 text-xs">
                  Start Here
                </Badge>
                <h3 className="font-heading font-semibold text-slate-900 mb-1">14-Day Free Trial</h3>
                <p className="text-xs text-slate-500 mb-4">Full Starter access, no card needed</p>
                <p className="text-3xl font-heading font-bold text-slate-900 mb-1">$0</p>
                <p className="text-xs text-slate-400 mb-5">for 14 days</p>
                <Button
                  onClick={startTrial}
                  className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 mb-5"
                >
                  Start Free Trial
                </Button>
                <ul className="space-y-2 text-xs text-slate-600">
                  {["20 searches / month", "Unlimited results", "Pipeline CRM (3 projects)", "Saved searches & reports", "Export locked"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${f.includes("locked") ? "text-slate-300" : "text-indigo-500"}`} />
                      <span className={f.includes("locked") ? "text-slate-400" : ""}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Starter */}
              <div className="rounded-2xl border border-slate-200 p-6">
                <h3 className="font-heading font-semibold text-slate-900 mb-1">Starter</h3>
                <p className="text-xs text-slate-500 mb-4">Keep your data, unlock export</p>
                <p className="text-3xl font-heading font-bold text-slate-900 mb-1">
                  $39.99<span className="text-base font-normal text-slate-400">/mo</span>
                </p>
                <p className="text-xs text-slate-400 mb-5">billed monthly</p>
                <Button onClick={() => navigate("/pricing")} variant="outline" className="w-full rounded-full mb-5">
                  See Full Pricing
                </Button>
                <ul className="space-y-2 text-xs text-slate-600">
                  {["Everything in the trial", "CSV export", "Full Brand Intelligence", "AI outreach drafts (credits)"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro */}
              <div className="rounded-2xl border border-slate-200 p-6">
                <h3 className="font-heading font-semibold text-slate-900 mb-1">Pro</h3>
                <p className="text-xs text-slate-500 mb-4">For teams & agencies</p>
                <p className="text-3xl font-heading font-bold text-slate-900 mb-1">
                  $79<span className="text-base font-normal text-slate-400">/mo</span>
                </p>
                <p className="text-xs text-slate-400 mb-5">billed monthly</p>
                <Button onClick={() => navigate("/pricing")} variant="outline" className="w-full rounded-full mb-5">
                  See Full Pricing
                </Button>
                <ul className="space-y-2 text-xs text-slate-600">
                  {["Everything in Starter", "100 searches / month", "Unlimited pipeline projects", "Priority support"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white mb-4">
              Your first affiliates are already out there. Let's find them.
            </h2>
            <p className="text-indigo-100 mb-8 max-w-xl mx-auto">
              Join SaaS founders using AffiliTube to build their affiliate channel — without hiring a marketing team.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Button
                onClick={startTrial}
                className="rounded-full bg-white text-indigo-700 hover:bg-indigo-50 text-base px-8 py-6 h-auto font-semibold shadow-lg shadow-indigo-900/30"
                data-testid="final-trial-cta"
              >
                Start Your Free 14-Day Trial
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <a
                href="/pricing"
                className="text-sm text-indigo-200 hover:text-white transition-colors underline underline-offset-4"
              >
                Already convinced? Skip straight to a paid plan
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
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
    </>
  );
}
