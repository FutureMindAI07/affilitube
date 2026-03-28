import {
  Search,
  BarChart3,
  Target,
  Download,
  Zap,
  CheckCircle2,
  ChevronDown,
  Wrench,
  Link2,
  Timer,
  Youtube,
  ArrowRight,
  Sparkles,
  Shield,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};

const features = [
  {
    icon: Search,
    title: "Smart Channel Discovery",
    desc: "Turn niche keywords into a ranked list of YouTube channels. Deduplicate across searches automatically.",
    span: "md:col-span-2",
  },
  {
    icon: BarChart3,
    title: "Dual Scoring Engine",
    desc: "Every channel scored 0-100 on relevance, tutorial intent, activity, engagement, and a separate Affiliate Score.",
    span: "",
  },
  {
    icon: Target,
    title: "Affiliate Signal Detection",
    desc: "Detects affiliate language, commercial intent, brand partnership signals, and business emails.",
    span: "",
  },
  {
    icon: Wrench,
    title: "Tool Stack Detection",
    desc: "Flags creators who list 'Tools I Use' or 'Resources' — the strongest affiliate indicator.",
    span: "",
  },
  {
    icon: Link2,
    title: "Platform Link Scanning",
    desc: "Scan for actual URLs from AppSumo, Amazon, Gumroad, ClickBank, ShareASale, and 6 more platforms.",
    span: "",
  },
  {
    icon: Download,
    title: "One-Click CSV Export",
    desc: "Export scores, contact info, platform links, and notes. Shortlist first or export everything.",
    span: "md:col-span-2",
  },
];

const steps = [
  {
    num: "01",
    title: "Enter Keywords",
    desc: "Add your niche keywords — like 'zapier tutorial' or 'best automation tools'. Set subscriber range and search mode.",
  },
  {
    num: "02",
    title: "Search & Enrich",
    desc: "The tool searches YouTube, finds matching channels, then enriches each one with stats, recent videos, and contact info.",
  },
  {
    num: "03",
    title: "Review Scored Results",
    desc: "See every channel scored and ranked. Filter by affiliate potential, platform links, or minimum score.",
  },
  {
    num: "04",
    title: "Export Your Shortlist",
    desc: "Pick your top prospects, add notes, and export a CSV ready for outreach.",
  },
];

const faqs = [
  {
    q: "What does this tool actually do?",
    a: "It helps you find YouTube channels that are likely to promote products as affiliates. You enter keywords, and the tool searches YouTube, pulls channel data, then scores each one on multiple factors — topic relevance, affiliate signals, commercial intent, and more. You get a ranked list of prospects ready for outreach.",
  },
  {
    q: "Do I need a YouTube API key?",
    a: "Yes. You'll need a YouTube Data API v3 key from Google Cloud Console. It's free to create and comes with 10,000 units per day — enough for hundreds of channel lookups. Using your own key means you keep full control over quota and billing, and we never touch your YouTube account. We include a short step‑by‑step video, so you'll be up and running in under 5 minutes, and the app tracks your quota usage in real time with a countdown to reset.",
  },
  {
    q: "How does the scoring work?",
    a: "Each channel gets two scores. A Total Score (0-100) based on topic relevance, tutorial intent, activity, subscriber fit, engagement, and contactability. And a separate Affiliate Score (0-100) that weights affiliate language, commercial signals, brand contact openness, tool stack mentions, and business email availability.",
  },
  {
    q: "What affiliate platforms can it detect?",
    a: "The tool scans for actual URLs from AppSumo, Amazon Associates, Impact, PartnerStack, ShareASale, CJ Affiliate, Gumroad, ClickBank, Rakuten, and Awin. You choose which platforms to look for, and it flags channels that have those links in their descriptions.",
  },
  {
    q: "What is 'Tool Stack Detection'?",
    a: "Many affiliate creators have sections in their video descriptions listing tools they use — like 'My Tech Stack', 'Tools I Use', or 'Resources Mentioned'. The tool detects 16+ variations of these phrases and flags channels as 'Likely Affiliate Creators' when found.",
  },
  {
    q: "How many API credits does each search use?",
    a: "It depends on your settings. A quick scan of 3 keywords might use ~400 units. A deep scan with video description scanning could use ~2,000. The tool shows you the estimated cost before every search, and you can choose from Quick, Balanced, or Deep Scan presets.",
  },
  {
    q: "Can I save my results and come back later?",
    a: "Yes. You can save search configurations to re-run them anytime, and save full result sets as named reports. Your shortlists, notes, and all channel data persist between sessions.",
  },
  {
    q: "What data is included in the CSV export?",
    a: "Everything — channel name, URL, subscriber count, total score, affiliate score, all signal breakdowns, detected affiliate platforms, tool stack phrases, business email, public links (website, Instagram, Twitter, LinkedIn), recent video data, and your custom notes.",
  },
  {
    q: "Does the tool contact YouTube channels for me?",
    a: "No. This is a research and scoring tool. It identifies the best prospects and gives you their public contact information. However, we do include a library of pre-built outreach email templates — just fill in your details, preview the email, and copy it ready to send.",
  },
  {
    q: "Is there a limit on how many channels I can analyze?",
    a: "The only limit is your YouTube API daily quota (10,000 units). Within that, you can search, enrich, and score as many channels as you like. The Advanced Settings let you control exactly how many API units each search consumes.",
  },
];

function FaqItem({ q, a, index }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      variants={fadeUp}
      className="border-b border-slate-200/70"
      data-testid="faq-item"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="font-heading font-semibold text-slate-900 pr-4 group-hover:text-indigo-600 transition-colors">
          {q}
        </span>
        <ChevronDown
          className={`h-5 w-5 text-slate-400 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? "max-h-96 pb-5" : "max-h-0"}`}
      >
        <p className="text-slate-600 leading-relaxed">{a}</p>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  const handleCTA = () => {
    navigate("/pricing");
  };

  return (
    <div className="min-h-screen bg-white font-body">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Youtube className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Tubiate</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
            <a href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/login")}
              className="rounded-full text-slate-600 hover:text-slate-900"
              data-testid="nav-login-btn"
            >
              Log In
            </Button>
            <Button
              onClick={() => navigate("/pricing")}
              className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95"
              data-testid="nav-get-started-btn"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-16">
        {/* Mesh background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-purple-50 to-transparent" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur border border-indigo-100 text-indigo-700 text-sm font-medium mb-8 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Find high-converting YouTube affiliates in minutes
            </motion.div>

            <motion.h1 variants={fadeUp} className="font-heading text-5xl md:text-7xl font-bold text-slate-900 tracking-tight leading-[1.1]">
              Discover YouTube Channels
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mt-2">
                Ready to Promote Your SaaS
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-8 text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Search, score, and shortlist YouTube creators who already promote SaaS and online tools
              with affiliate links. Find channels that match your niche, size, and buyer intent —
              in minutes, not weeks of manual research.
            </motion.p>

            {/* Benefit Bullets */}
            <motion.div variants={stagger} className="mt-12 max-w-2xl mx-auto space-y-3">
              {[
                { icon: Search, color: "indigo", title: "Find SaaS-focused creators fast", desc: 'Turn your niche keywords into a ranked list of YouTube channels already reviewing software and "best tools" for your audience.' },
                { icon: Target, color: "purple", title: "See real affiliate intent", desc: "Spot creators who use affiliate language, list \"tools I use\", and link to platforms like AppSumo, Amazon, and PartnerStack." },
                { icon: Download, color: "emerald", title: "Get outreach-ready data", desc: "Export a clean CSV with scores, contact info, platform links, and notes so you can start outreach immediately." },
              ].map((b) => (
                <motion.div
                  key={b.title}
                  variants={fadeUp}
                  className="flex items-start gap-4 bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/80 shadow-[0_2px_10px_rgb(0,0,0,0.03)] text-left hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-indigo-100 transition-all duration-300"
                >
                  <div className={`mt-0.5 h-10 w-10 rounded-xl bg-${b.color}-100 flex items-center justify-center shrink-0`}>
                    <b.icon className={`h-5 w-5 text-${b.color}-600`} />
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-slate-900">{b.title}</p>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{b.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={handleCTA}
                className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-base px-10 h-12 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95"
                data-testid="hero-cta-btn"
              >
                Get Lifetime Access
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full text-base px-10 h-12 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                See Features
              </Button>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                One-time payment
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Lifetime updates
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                No recurring fees
              </span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Demo Video */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              See it in action
            </motion.p>
            <motion.h2 variants={fadeUp} className="mt-3 font-heading text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-10">
              Watch a quick demo
            </motion.h2>
            <motion.div variants={fadeUp} className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-300/30 border border-slate-200/60 aspect-video" data-testid="demo-video">
              <iframe
                src="https://www.youtube.com/embed/uVNMhYAgMak"
                title="Tubiate Demo"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features — Bento Grid */}
      <section id="features" className="py-28 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-20"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Features
            </motion.p>
            <motion.h2 variants={fadeUp} className="mt-3 font-heading text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
              Everything you need to find
              <br className="hidden sm:block" /> affiliate partners
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-5"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className={`group p-7 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-indigo-100 transition-all duration-300 ${f.span}`}
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-5 group-hover:from-indigo-600 group-hover:to-purple-600 transition-colors duration-300">
                  <f.icon className="h-6 w-6 text-indigo-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-20"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              How It Works
            </motion.p>
            <motion.h2 variants={fadeUp} className="mt-3 font-heading text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
              From keyword to prospect list
              <br className="hidden sm:block" /> in 4 steps
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {steps.map((s, i) => (
              <motion.div key={s.num} variants={fadeUp} className="relative group">
                <div className="font-heading text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 opacity-30 group-hover:opacity-100 transition-opacity duration-300 mb-4">
                  {s.num}
                </div>
                <h3 className="font-heading font-semibold text-lg text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-600 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-slate-50/50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
          >
            {[
              { val: "6+", label: "Scoring Criteria" },
              { val: "10+", label: "Affiliate Platforms" },
              { val: "16+", label: "Tool Stack Phrases" },
              { val: "CSV", label: "One-Click Export" },
            ].map((s) => (
              <motion.div key={s.label} variants={fadeUp}>
                <div className="font-heading text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                  {s.val}
                </div>
                <div className="text-sm text-slate-500 mt-2 font-medium">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-28 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              FAQ
            </motion.p>
            <motion.h2 variants={fadeUp} className="mt-3 font-heading text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
              Frequently asked questions
            </motion.h2>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
          >
            {faqs.map((f, i) => (
              <FaqItem key={f.q} {...f} index={i} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white tracking-tight">
            Ready to find your next YouTube affiliates?
          </h2>
          <p className="mt-5 text-indigo-100 text-lg leading-relaxed">
            Get lifetime access today. One payment, no recurring fees, unlimited searches.
          </p>
          <Button
            size="lg"
            onClick={handleCTA}
            className="mt-10 rounded-full bg-white text-indigo-600 hover:bg-indigo-50 text-base px-10 h-12 font-semibold shadow-xl shadow-black/10 hover:scale-105 active:scale-95 transition-all"
            data-testid="footer-cta-btn"
          >
            Get Lifetime Access — $99
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 text-slate-400 text-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Youtube className="h-4 w-4 text-white" />
              </div>
              <span className="text-slate-300 font-heading font-semibold">Tubiate</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </div>
            <p>&copy; {new Date().getFullYear()} Tubiate. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
