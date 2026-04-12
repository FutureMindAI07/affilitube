import { Youtube, Search, Sparkles, Zap, BarChart3, ArrowRight, CheckCircle2, X, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const steps = [
  { num: "1", title: "Select Your Niche", desc: "Choose from 14 niches like SaaS, fitness, finance and more.", icon: Target },
  { num: "2", title: "Enter Keywords", desc: "Add topic keywords for your target creators.", icon: Sparkles },
  { num: "3", title: "Search & Enrich", desc: "Find and score YouTube channels instantly.", icon: Search },
  { num: "4", title: "Shortlist & Outreach", desc: "Save your best prospects and start outreach.", icon: Zap },
];

const benefits = [
  { icon: Search, title: "14 Niches Covered", desc: "From SaaS to fitness, finance to ecommerce — find influencers in any market." },
  { icon: Target, title: "Affiliate Signal Detection", desc: "See which creators are already active affiliates before you reach out." },
  { icon: TrendingUp, title: "Channel Health Indicators", desc: "Engagement health, growth signals and upload consistency for every channel." },
];

const tiers = [
  {
    name: "Free", price: "$0", period: "forever",
    features: [
      { text: "3 searches/month", included: true },
      { text: "10 results per search", included: true },
      { text: "Channel scoring", included: true },
      { text: "CSV export", included: false },
      { text: "Saved searches & reports", included: false },
      { text: "Outreach pipeline", included: false },
    ],
  },
  {
    name: "Starter", price: "$39.99", period: "/month",
    features: [
      { text: "20 searches/month", included: true },
      { text: "Unlimited results", included: true },
      { text: "Channel scoring", included: true },
      { text: "CSV export", included: true },
      { text: "Saved searches & reports", included: true },
      { text: "3 pipeline projects", included: true },
    ],
  },
  {
    name: "Pro", price: "$79", period: "/month",
    features: [
      { text: "Unlimited searches", included: true },
      { text: "Unlimited results", included: true },
      { text: "Channel scoring", included: true },
      { text: "CSV export", included: true },
      { text: "Saved searches & reports", included: true },
      { text: "Unlimited pipeline projects", included: true },
    ],
  },
];

export default function FreeLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-body">
      {/* Minimal header — logo only */}
      <div className="px-6 h-16 flex items-center justify-center">
        <a href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Youtube className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Affilitube
          </span>
        </a>
      </div>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-purple-50 to-white" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl" />

        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="relative max-w-3xl mx-auto px-6 pt-16 pb-24 text-center"
        >
          <motion.h1
            variants={fadeUp}
            className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1]"
            data-testid="hero-headline"
          >
            Find YouTube Influencers{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              for Your Brand
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 text-base sm:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed"
          >
            Search, score and shortlist YouTube creators as potential partners — completely free to start. No credit card required.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10">
            <Button
              onClick={() => navigate("/signup")}
              className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-13 px-8 text-base font-semibold shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
              data-testid="hero-cta-btn"
            >
              Start Free — 3 Searches/Month
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="mt-4 text-sm text-slate-400">Free forever. Upgrade when you're ready.</p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-6 bg-white">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="max-w-4xl mx-auto"
        >
          <motion.h2
            variants={fadeUp}
            className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-14"
          >
            How It Works
          </motion.h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <motion.div key={step.num} variants={fadeUp} className="text-center" data-testid={`step-${step.num}`}>
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100/60 flex items-center justify-center mb-4">
                  <step.icon className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-600 text-white text-xs font-bold mb-2">
                  {step.num}
                </div>
                <h3 className="font-heading font-semibold text-slate-900 mb-1">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── KEY BENEFITS ── */}
      <section className="py-20 px-6 bg-slate-50/60">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="max-w-4xl mx-auto"
        >
          <motion.h2
            variants={fadeUp}
            className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-14"
          >
            Why Affilitube?
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((b) => (
              <motion.div
                key={b.title}
                variants={fadeUp}
                className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm"
                data-testid={`benefit-${b.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100/60 flex items-center justify-center mb-4">
                  <b.icon className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="font-heading font-semibold text-slate-900 mb-2">{b.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── PRICING SNAPSHOT ── */}
      <section className="py-20 px-6 bg-white">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="max-w-4xl mx-auto"
        >
          <motion.h2
            variants={fadeUp}
            className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-4"
          >
            Simple Pricing
          </motion.h2>
          <motion.p variants={fadeUp} className="text-center text-slate-500 mb-12">
            Start free. Upgrade as you grow.
          </motion.p>

          <motion.div variants={fadeUp} className="grid md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-6 flex flex-col ${
                  tier.name === "Starter"
                    ? "border-2 border-indigo-300 shadow-md bg-white"
                    : "border border-slate-200 bg-white"
                }`}
                data-testid={`tier-${tier.name.toLowerCase()}`}
              >
                {tier.name === "Starter" && (
                  <span className="inline-flex self-start items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
                    <Zap className="h-3 w-3" /> Most Popular
                  </span>
                )}
                <h3 className="font-heading font-bold text-lg text-slate-900">{tier.name}</h3>
                <div className="mt-2 mb-5">
                  <span className="font-heading text-3xl font-bold text-slate-900">{tier.price}</span>
                  <span className="text-sm text-slate-500">{tier.period}</span>
                </div>
                <ul className="space-y-2 flex-1">
                  {tier.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2 text-sm">
                      {f.included ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300 shrink-0" />
                      )}
                      <span className={f.included ? "text-slate-700" : "text-slate-400"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="text-center mt-8 space-y-4">
            <Link to="/pricing" className="text-sm text-indigo-600 hover:underline font-medium">
              View Full Pricing
            </Link>
            <div>
              <Button
                onClick={() => navigate("/signup")}
                className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-12 px-8 font-semibold shadow-lg shadow-indigo-500/20 transition-all"
                data-testid="pricing-cta-btn"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 border-t border-slate-100 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <Youtube className="h-4 w-4 text-white" />
            </div>
            <span className="font-heading font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Affilitube
            </span>
          </a>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
          </div>
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Affilitube</p>
        </div>
      </footer>
    </div>
  );
}
