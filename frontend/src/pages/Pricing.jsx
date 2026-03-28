import { useState } from "react";
import {
  CheckCircle2,
  ArrowRight,
  Zap,
  Youtube,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const included = [
  "Keyword-based YouTube channel search",
  "Multi-layer scoring engine (Total + Affiliate scores)",
  "Affiliate signal & commercial intent detection",
  "Tool Stack Detection ('Likely Affiliate Creator')",
  "10+ affiliate platform link scanning",
  "Advanced API controls (Quick / Balanced / Deep Scan)",
  "Channel detail panels with full breakdowns",
  "Shortlisting with custom notes",
  "CSV export with all data fields",
  "Search history & saved reports",
  "Real-time API quota tracking",
  "Lifetime access & updates",
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    if (!user) {
      navigate("/signup");
      return;
    }
    if (user.has_paid) {
      navigate("/dashboard");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/api/checkout/create-session`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = res.data.url;
    } catch (e) {
      const msg = e.response?.data?.detail || "Checkout failed";
      alert(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-body">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Youtube className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Tubiate</span>
          </a>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => navigate("/dashboard")} className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600" data-testid="pricing-nav-dashboard">Dashboard</Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate("/login")} className="rounded-full" data-testid="pricing-nav-login">Log In</Button>
            )}
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-28">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h1 variants={fadeUp} className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 tracking-tight">
              Simple, one-time pricing
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
              No subscriptions. No usage fees. Pay once and get lifetime access to the full tool.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="max-w-lg mx-auto"
          >
            <motion.div
              variants={fadeUp}
              className="relative rounded-3xl bg-white border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden group"
              data-testid="pricing-card"
            >
              {/* Gradient top border */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-600 to-purple-600" />

              {/* Glow on hover */}
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none shadow-[0_0_40px_rgba(79,70,229,0.15)]" />

              <div className="px-10 pt-10 pb-8 text-center border-b border-slate-100">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold mb-5">
                  <Zap className="h-3 w-3" />
                  LIFETIME DEAL
                </div>
                <div className="flex items-end justify-center gap-1">
                  <span className="font-heading text-6xl font-bold text-slate-900">$99</span>
                  <span className="text-slate-500 mb-2 font-medium">one-time</span>
                </div>
                <p className="mt-4 text-slate-500">Full access. Forever. No hidden costs.</p>
              </div>

              <div className="px-10 py-8">
                <p className="text-xs font-semibold tracking-wider uppercase text-slate-400 mb-5">
                  Everything included
                </p>
                <ul className="space-y-3.5">
                  {included.map((item, i) => (
                    <motion.li key={item} variants={fadeUp} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span className="text-slate-700">{item}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              <div className="px-10 pb-10">
                <Button
                  size="lg"
                  className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-12 text-base font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  onClick={handleBuy}
                  disabled={loading}
                  data-testid="pricing-buy-btn"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting to checkout...</>
                  ) : user?.has_paid ? (
                    <>Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" /></>
                  ) : (
                    <>Get Lifetime Access <ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
                <p className="mt-4 text-xs text-center text-slate-400">
                  Secure checkout. Instant access after purchase.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 border-t border-slate-100 text-sm text-slate-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Youtube className="h-4 w-4 text-white" />
            </div>
            <span className="text-slate-300 font-heading font-semibold">Tubiate</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/terms" className="hover:text-slate-600 transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
