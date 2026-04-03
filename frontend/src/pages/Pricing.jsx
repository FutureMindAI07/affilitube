import { CheckCircle2, X, Youtube, Zap, ArrowRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try Affilitube with limited searches",
    features: [
      { text: "3 searches per month", included: true },
      { text: "10 channel results per search", included: true },
      { text: "Full scoring & channel details", included: true },
      { text: "Niche selector (14 niches)", included: true },
      { text: "Shortlist channels", included: true },
      { text: "CSV export", included: false },
      { text: "Saved searches", included: false },
      { text: "Saved reports", included: false },
      { text: "Outreach pipeline", included: false },
    ],
    cta: "Get Started Free",
    ctaAction: "signup",
    popular: false,
    highlighted: false,
  },
  {
    name: "Starter",
    priceMonthly: "$39.99",
    priceYearly: "$319.99",
    monthlyEquivalent: "$26.67",
    period: "month",
    periodYearly: "year",
    description: "Perfect for founders and small teams",
    features: [
      { text: "20 searches per month", included: true },
      { text: "Full channel results (no limits)", included: true },
      { text: "Full scoring & channel details", included: true },
      { text: "Niche selector (14 niches)", included: true },
      { text: "Shortlist channels", included: true },
      { text: "CSV export", included: true },
      { text: "Saved searches", included: true },
      { text: "Saved reports", included: true },
      { text: "Outreach pipeline (up to 3 projects)", included: true },
      { text: "Unlimited pipeline projects", included: false },
    ],
    cta: "Start Starter",
    ctaAction: "checkout",
    planPrefix: "starter",
    popular: true,
    highlighted: false,
  },
  {
    name: "Pro",
    priceMonthly: "$79",
    priceYearly: "$632",
    monthlyEquivalent: "$52.67",
    period: "month",
    periodYearly: "year",
    description: "For serious influencer marketers",
    features: [
      { text: "Unlimited searches", included: true },
      { text: "Full channel results (no limits)", included: true },
      { text: "Full scoring & channel details", included: true },
      { text: "Niche selector (14 niches)", included: true },
      { text: "Shortlist channels", included: true },
      { text: "CSV export", included: true },
      { text: "Saved searches", included: true },
      { text: "Saved reports", included: true },
      { text: "Unlimited outreach pipeline projects", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Start Pro",
    ctaAction: "checkout",
    planPrefix: "pro",
    popular: false,
    highlighted: true,
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [loading, setLoading] = useState(false);

  const handleCTA = async (plan) => {
    if (plan.ctaAction === "signup") {
      navigate("/signup");
      return;
    }

    if (!user) {
      navigate("/signup");
      return;
    }

    setLoading(true);
    try {
      const planId = billingCycle === "yearly"
        ? `${plan.planPrefix}_yearly`
        : `${plan.planPrefix}_monthly`;
      const res = await axios.post(
        `${API}/api/checkout/create-session`,
        { plan: planId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = res.data.url;
    } catch (e) {
      const detail = e.response?.data?.detail || "Failed to create checkout session";
      toast.error(detail);
    } finally {
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
            <span className="font-heading font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Affilitube</span>
          </a>
          <div className="flex items-center gap-3">
            {user ? (
              <Button
                onClick={() => navigate("/dashboard")}
                className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")} className="rounded-full">
                  Log In
                </Button>
                <Button onClick={() => navigate("/signup")} className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600">
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Pricing Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.1 } },
            }}
            className="text-center mb-12"
          >
            <motion.h1
              variants={fadeUp}
              className="font-heading text-4xl md:text-5xl font-bold text-slate-900 tracking-tight"
            >
              Simple, transparent pricing
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto"
            >
              Start free with 3 searches per month. Upgrade to Starter or Pro for full access and powerful outreach tools.
            </motion.p>

            {/* Billing Toggle */}
            <motion.div variants={fadeUp} className="mt-8 inline-flex items-center gap-3 p-1 bg-slate-100 rounded-full">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  billingCycle === "monthly"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                data-testid="billing-monthly-toggle"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  billingCycle === "yearly"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                data-testid="billing-yearly-toggle"
              >
                Yearly
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                  Save ~33%
                </span>
              </button>
            </motion.div>
          </motion.div>

          {/* Pricing Cards */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.12 } },
            }}
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
          >
            {plans.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                data-testid={`pricing-card-${plan.name.toLowerCase()}`}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  plan.highlighted
                    ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/20 md:-mt-2 md:mb-0 md:pb-9"
                    : plan.popular
                    ? "bg-white border-2 border-indigo-300 shadow-md"
                    : "bg-white border border-slate-200 shadow-sm"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-lg">
                      <Zap className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-indigo-600 text-xs font-semibold shadow-lg">
                      <Crown className="h-3 w-3" />
                      Best Value
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className={`font-heading font-bold text-xl ${plan.highlighted ? "text-white" : "text-slate-900"}`}>
                    {plan.name}
                  </h3>
                  <p className={`mt-1 text-sm ${plan.highlighted ? "text-indigo-100" : "text-slate-500"}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  {plan.name === "Free" ? (
                    <>
                      <span className="font-heading text-4xl font-bold text-slate-900">{plan.price}</span>
                      <span className="text-sm text-slate-500">/{plan.period}</span>
                    </>
                  ) : (
                    <>
                      <span className={`font-heading text-4xl font-bold ${plan.highlighted ? "text-white" : "text-slate-900"}`}>
                        {billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly}
                      </span>
                      <span className={`text-sm ${plan.highlighted ? "text-indigo-100" : "text-slate-500"}`}>
                        /{billingCycle === "yearly" ? plan.periodYearly : plan.period}
                      </span>
                      {billingCycle === "yearly" && (
                        <p className={`text-sm mt-1 ${plan.highlighted ? "text-indigo-100" : "text-slate-500"}`}>
                          (~{plan.monthlyEquivalent}/month)
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-2.5">
                      {feature.included ? (
                        <CheckCircle2 className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${plan.highlighted ? "text-indigo-200" : "text-emerald-500"}`} />
                      ) : (
                        <X className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${plan.highlighted ? "text-indigo-300" : "text-slate-300"}`} />
                      )}
                      <span className={`text-sm ${
                        feature.included
                          ? plan.highlighted ? "text-white" : "text-slate-700"
                          : plan.highlighted ? "text-indigo-200 line-through" : "text-slate-400 line-through"
                      }`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleCTA(plan)}
                  disabled={loading}
                  data-testid={`cta-${plan.name.toLowerCase()}`}
                  className={`w-full rounded-full h-12 font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg"
                      : plan.popular
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            ))}
          </motion.div>

          {/* FAQ teaser */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 text-center"
          >
            <p className="text-slate-500">
              Have questions?{" "}
              <a href="/#faq" className="text-indigo-600 hover:underline font-medium">
                Check our FAQ
              </a>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Affilitube. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
