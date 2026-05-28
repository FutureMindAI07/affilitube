import { useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Youtube,
  ArrowRight,
  CheckCircle2,
  Star,
  Clock,
  Shield,
  TrendingUp,
  Cookie,
  PoundSterling,
  RefreshCw,
  Sparkles,
  Award,
  Loader2,
  CheckCircle,
  Image as ImageIcon,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

function NumberStat({ value, label, source }) {
  return (
    <div className="space-y-1">
      <p className="text-3xl sm:text-4xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
        {value}
      </p>
      <p className="text-sm text-slate-300 font-medium">{label}</p>
      {source && <p className="text-[11px] text-slate-500">{source}</p>}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="uppercase tracking-[0.2em] text-xs font-semibold text-indigo-600 mb-3">{children}</p>
  );
}

export default function PartnerProgramLanding() {
  const [form, setForm] = useState({ full_name: "", email: "", promotion_experience: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submitApplication = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Please add your name and email so we can get back to you.");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/partner-program/apply`, form);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>AffiliTube Partner Program — Earn Up to 40% Recurring | AffiliTube</title>
        <meta name="description" content="Join the AffiliTube Partner Program. Recurring commissions up to 40%, 90-day cookie window, real partner support. Apply for free — no traffic minimums." />
      </Helmet>

      <div className="min-h-screen font-body bg-white">
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
              onClick={() => scrollToSection("apply")}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-sm px-5"
              data-testid="nav-apply-cta"
            >
              Apply to Partner
            </Button>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative bg-slate-950 pt-32 pb-24 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950" />
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="max-w-3xl">
              <Badge className="mb-6 bg-emerald-500/10 text-emerald-300 border-emerald-500/20 rounded-full px-4 py-1.5 text-sm font-medium inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                Partner Program — Now Open
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-white leading-[1.1] tracking-tight">
                Earn Up to <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">40%</span> Promoting the Tool Brands and Creators Can't Ignore
              </h1>
              <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-2xl">
                Join the AffiliTube Partner Program and earn recurring commissions on one of the fastest-growing YouTube discovery platforms in the market. We treat partners as partners — not sales tools.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button
                  onClick={() => scrollToSection("apply")}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-base px-8 py-6 h-auto"
                  data-testid="hero-apply-cta"
                >
                  Apply Now — It's Free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  onClick={() => scrollToSection("how-it-works")}
                  variant="ghost"
                  className="rounded-full text-white hover:bg-white/10 text-base px-8 py-6 h-auto"
                  data-testid="hero-how-cta"
                >
                  See How It Works
                </Button>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-400">
                {[
                  { icon: Star, text: "Featured on ProductHunt" },
                  { icon: TrendingUp, text: "Listed on PeerPush" },
                  { icon: Clock, text: "90-Day Cookie Window" },
                  { icon: Shield, text: "Secure Tracking & Payouts" },
                ].map((item, idx) => (
                  <div key={item.text} className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 text-indigo-400" />
                    <span>{item.text}</span>
                    {idx < 3 && <span className="hidden sm:inline text-slate-700 ml-3">|</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Market Stats Bar */}
        <section className="bg-slate-900 py-14 border-y border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              <NumberStat value="$32.5B" label="Global influencer marketing market value in 2025" source="Source: Influencer Marketing Hub / Statista" />
              <NumberStat value="35%" label="Year-over-year industry growth 2024–2025" source="Source: Statista" />
              <NumberStat value="$116B" label="Projected market size by 2033" source="Source: Grand View Research" />
              <NumberStat value="$5.78" label="Average ROI per $1 spent on influencer marketing" source="Source: Influencer Marketing Hub" />
            </div>
          </div>
        </section>

        {/* The Product */}
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-14">
              <SectionLabel>The Product</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-slate-900 leading-tight">
                YouTube Creator Discovery — Built for Results
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                AffiliTube is a dedicated YouTube discovery platform that helps brands, agencies, and marketers find the right creators — whether for affiliate partnerships or influencer campaigns. No spreadsheet rabbit holes. No guesswork.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left: feature list */}
              <ul className="space-y-3">
                {[
                  "Targeted channel search across 14 specialist niches",
                  "Channel health scoring for authentic, high-engagement creators",
                  "Brand Intelligence to reveal sponsorship and affiliate history",
                  "Built-in outreach pipeline to organise campaigns",
                  "Saved reports with parity to live results",
                  "AI email drafter that writes personalised outreach based on channel bio, description and content",
                  "Three pricing tiers: Free / Starter ($39.99/mo) / Pro ($79/mo)",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50/60 transition-colors">
                    <div className="h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="text-sm text-slate-700">{f}</span>
                  </li>
                ))}
              </ul>

              {/* Right: Mock UI card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 shadow-2xl shadow-indigo-100 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 border-b border-slate-200">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <div className="ml-3 flex-1 h-6 rounded bg-white border border-slate-200 text-[11px] text-slate-400 flex items-center px-3">
                    affilitube.com/dashboard
                  </div>
                </div>
                <div className="p-5 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Search Results</p>
                      <p className="text-sm font-semibold text-slate-900">"saas tools" · 124 channels</p>
                    </div>
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 rounded-full">Sorted by Score</Badge>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      { name: "Bootstrapped Bytes", subs: "248K subs", score: "A+", tone: "bg-emerald-100 text-emerald-700" },
                      { name: "The SaaS Studio", subs: "187K subs", score: "A", tone: "bg-indigo-100 text-indigo-700" },
                      { name: "Indie Hacker Daily", subs: "92K subs", score: "A", tone: "bg-indigo-100 text-indigo-700" },
                      { name: "Tools & Templates", subs: "54K subs", score: "B+", tone: "bg-amber-100 text-amber-700" },
                      { name: "Founder Tuesdays", subs: "31K subs", score: "B+", tone: "bg-amber-100 text-amber-700" },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xs font-semibold text-indigo-700">
                            {row.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{row.name}</p>
                            <p className="text-[11px] text-slate-500">{row.subs}</p>
                          </div>
                        </div>
                        <Badge className={`${row.tone} border-0 rounded-md font-mono font-bold`}>{row.score}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Opportunity */}
        <section className="py-24 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <SectionLabel>The Opportunity</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-slate-900 leading-tight">
                You're Promoting Into a Booming Market
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                The market for finding and managing YouTube creators — for both affiliate programmes and influencer campaigns — is growing faster than almost any other segment of digital marketing. Brands are actively seeking better tools to find the right people.
              </p>
            </div>

            <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8 sm:p-10 max-w-5xl">
              <h3 className="text-lg font-heading font-semibold text-slate-900 mb-3">
                Why the timing is right for your audience
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-8 max-w-3xl">
                More than half of multinational companies plan to increase creator marketing budgets in 2025. YouTube remains the most trusted long-form platform for affiliate-driven and influencer-led brand ROI.
              </p>
              <div className="grid sm:grid-cols-3 gap-6">
                {[
                  { value: "$1.7B → $32.5B", label: "Industry growth from 2016 to 2025" },
                  { value: "80%", label: "of brands maintained or increased creator marketing spend in 2025" },
                  { value: "23.3% CAGR", label: "Projected platform market growth to 2030" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                      {s.value}
                    </p>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-8">Sources: Influencer Marketing Hub, Grand View Research, Statista, Sprout Social</p>
            </div>
          </div>
        </section>

        {/* Commission Structure */}
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <SectionLabel>Commission Structure</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-slate-900 leading-tight">
                Generous Commissions That Grow With You
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                Start earning from day one. As you perform, you unlock higher rates — with our best partners earning 40% for the lifetime of every subscription they refer.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
              {/* New Partners */}
              <div className="rounded-3xl border border-slate-200 bg-white p-8">
                <Badge className="bg-slate-100 text-slate-700 border-slate-200 rounded-full mb-5">New Partners</Badge>
                <p className="text-6xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">30%</p>
                <p className="text-sm text-slate-600 mt-2 mb-6">Per sale, for your first 12 months</p>
                <ul className="space-y-3">
                  {[
                    "Recurring commission every month the customer stays",
                    "Applies to Starter ($39.99/mo) and Pro ($79/mo)",
                    "90-day cookie window — long lead times still convert",
                    "Minimum payout just £50",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Star Partners */}
              <div className="relative rounded-3xl p-[2px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-indigo-200">
                <div className="rounded-[22px] bg-white p-8 h-full">
                  <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 rounded-full mb-5 inline-flex items-center gap-1.5">
                    <Star className="h-3 w-3" /> Star Partners
                  </Badge>
                  <p className="text-6xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">40%</p>
                  <p className="text-sm text-slate-600 mt-2 mb-6">For the lifetime of every subscription</p>
                  <ul className="space-y-3">
                    {[
                      "Unlocked for high performers after 12 months",
                      "Lifetime rate — never reduced for top partners",
                      "Priority support and early access to new features",
                      "Direct line to the founder for strategy & support",
                    ].map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <p className="mt-8 text-sm text-slate-600 max-w-3xl">
              <span className="font-semibold text-slate-900">Example:</span> Refer just 10 Starter subscribers → <span className="font-semibold">£1,198/mo</span> in recurring commissions at 30%. Scale from there.
            </p>
          </div>
        </section>

        {/* Tracking & Payments */}
        <section className="py-24 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <SectionLabel>Tracking & Payments</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-slate-900 leading-tight">
                Reliable Infrastructure You Can Trust
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                We handle everything through a dedicated affiliate platform so you always know exactly what you've earned and when you'll be paid.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: Cookie, title: "90-Day Cookie Window", desc: "Visitors who click your link have 90 days to convert. Even slow-consideration buyers earn you commission." },
                { icon: PoundSterling, title: "£50 Minimum Payout", desc: "Low threshold means you get paid faster. No waiting until you've accumulated hundreds in earnings." },
                { icon: Shield, title: "Secure Platform", desc: "All tracking and payments run through a secure, dedicated affiliate platform with real-time dashboards." },
                { icon: RefreshCw, title: "Recurring Commissions", desc: "Earn every month your referrals stay subscribed. One good referral pays you again and again." },
              ].map((c) => (
                <div key={c.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                    <c.icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="font-heading font-semibold text-slate-900 text-sm mb-2">{c.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500 mt-6">Your own dashboard to track your sales and performance.</p>
          </div>
        </section>

        {/* Creative Resources */}
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <SectionLabel>Creative Resources</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-slate-900 leading-tight">
                Everything You Need to Promote Effectively
              </h2>
            </div>

            <div className="grid lg:grid-cols-2 gap-10">
              {/* Left */}
              <div className="space-y-6">
                <p className="text-base text-slate-600 leading-relaxed">
                  We maintain a growing library of ready-to-use creative assets so you can start promoting the moment you're approved.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Banner Ads (multiple sizes)",
                    "Social Media Graphics",
                    "YouTube Thumbnails",
                    "Email Copy Templates",
                    "Logo & Brand Assets",
                    "Product Screenshots",
                    "Demo Videos",
                    "Feature Highlight Cards",
                  ].map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1.5">
                      <ImageIcon className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    <span className="font-semibold text-slate-900">Need something custom? Just ask.</span> If a specific asset would help your content or audience, we'll create it for you — typically within a few days.
                  </p>
                </div>
              </div>

              {/* Right */}
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                  <h3 className="font-heading font-semibold text-slate-900 mb-2">New to Affiliate Marketing?</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    No problem. If you're not sure which keywords to target or how to position AffiliTube for your audience, we'll help with that too. We can work through keyword research with you, review your content strategy, and suggest angles that convert well.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                  <h3 className="font-heading font-semibold text-slate-900 mb-3">Ideal audiences for AffiliTube</h3>
                  <ul className="space-y-2">
                    {[
                      "Marketing agencies and freelancers",
                      "Content creators & YouTubers",
                      "Affiliate marketing bloggers & educators",
                      "SaaS and marketing tool reviewers",
                      "eCommerce & DTC brand owners",
                    ].map((a) => (
                      <li key={a} className="flex items-center gap-2 text-sm text-slate-700">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Philosophy */}
        <section className="py-24 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <SectionLabel>Our Philosophy</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-slate-900 leading-tight">
                Partners, Not Sales Tools
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                We built AffiliTube because finding the right YouTube creator for your affiliate programme or campaign shouldn't take a week. We run our partner programme the same way — with the same respect and commitment we'd want ourselves.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                "Your success is my success. When you refer someone, I want them to love the product and stick around — which means I'm just as motivated to help you succeed as you are.",
                "If you're struggling to convert, I want to know about it. We'll work together to figure out what's not landing — whether that's the copy, the assets, or the audience fit.",
                "Star partners get direct access to me. Not a ticketing system. Not a support bot. A real conversation about how we can both grow faster.",
              ].map((q) => (
                <div key={q} className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col">
                  <p className="text-sm text-slate-700 leading-relaxed italic mb-5 flex-1">"{q}"</p>
                  <p className="text-xs text-slate-500 font-medium">— Adrian, Founder of AffiliTube</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <div className="mb-12">
              <SectionLabel>How It Works</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-slate-900 leading-tight">
                Up and Running in Minutes
              </h2>
            </div>

            <div className="relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-indigo-300 via-purple-300 to-indigo-100" />
              <ol className="space-y-8">
                {[
                  { title: "Apply for Free", desc: "Fill in a short application. No traffic minimums, no follower requirements. We review every application personally and reply within 1–2 business days." },
                  { title: "Get Your Tracking Link & Assets", desc: "Once approved, you'll receive your unique tracking link and access to the full creative library." },
                  { title: "Promote Your Way", desc: "Blog posts, YouTube reviews, newsletters, social content — your audience, your methods." },
                  { title: "Earn Recurring Commissions", desc: "Get paid every month your referrals stay subscribed. Watch your income compound as your audience grows." },
                ].map((step, i) => (
                  <li key={step.title} className="relative pl-14">
                    <div className="absolute left-0 top-0 h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-heading font-bold text-sm shadow-lg shadow-indigo-200">
                      {i + 1}
                    </div>
                    <h3 className="font-heading font-semibold text-slate-900 text-lg mb-1.5">{step.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Application Form */}
        <section id="apply" className="py-24 bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-transparent to-transparent" />
          <div className="relative max-w-3xl mx-auto px-6">
            <div className="text-center mb-10">
              <Badge className="mb-5 bg-amber-500/10 text-amber-300 border-amber-500/20 rounded-full px-4 py-1.5 text-sm font-medium inline-flex items-center gap-2">
                <Award className="h-3.5 w-3.5" />
                Limited Partner Slots — Applications Open
              </Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-white leading-tight">
                Ready to Start Earning?
              </h2>
              <p className="mt-5 text-base text-slate-300 leading-relaxed max-w-xl mx-auto">
                Apply to the AffiliTube Partner Program today. There's no cost, no minimum audience size, and no complicated approval process. If your audience is relevant, we want to work with you.
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-7 sm:p-10 shadow-2xl">
              {submitted ? (
                <div className="text-center py-8" data-testid="apply-success">
                  <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto mb-5">
                    <CheckCircle className="h-7 w-7 text-emerald-300" />
                  </div>
                  <h3 className="text-2xl font-heading font-bold text-white mb-2">Application received</h3>
                  <p className="text-sm text-slate-300 max-w-md mx-auto">
                    Thanks for applying to the AffiliTube Partner Program. We review every application personally and will be in touch within 1–2 business days.
                  </p>
                </div>
              ) : (
                <form onSubmit={submitApplication} className="space-y-5" data-testid="apply-form">
                  <div>
                    <Label htmlFor="full_name" className="text-slate-200 text-sm">Full Name <span className="text-red-400">*</span></Label>
                    <Input
                      id="full_name"
                      type="text"
                      required
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="Your name"
                      className="mt-2 h-11 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20"
                      data-testid="apply-full-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-slate-200 text-sm">Email Address <span className="text-red-400">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@example.com"
                      className="mt-2 h-11 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20"
                      data-testid="apply-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="experience" className="text-slate-200 text-sm">
                      Tell us about any products you've promoted before
                    </Label>
                    <Textarea
                      id="experience"
                      rows={5}
                      value={form.promotion_experience}
                      onChange={(e) => setForm({ ...form, promotion_experience: e.target.value })}
                      placeholder="Share any affiliate or influencer work you've done — websites, YouTube channels, newsletters, etc. Completely fine if you're new to affiliate marketing, just tell us a bit about yourself and your audience."
                      className="mt-2 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20"
                      data-testid="apply-experience"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 h-12 text-base font-semibold shadow-lg shadow-indigo-500/30"
                    data-testid="apply-submit-btn"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Apply to the Partner Program
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-center text-slate-400">
                    By applying you agree to our <a href="/terms" className="underline hover:text-white">Terms</a> and <a href="/privacy" className="underline hover:text-white">Privacy Policy</a>.
                  </p>
                </form>
              )}
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
