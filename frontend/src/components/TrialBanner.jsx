import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Sparkles, Clock, AlertTriangle, X, ArrowRight } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const DISMISS_KEY = "affi_trial_banner_dismissed_at";

/**
 * Soft trial banner. Auto-fetches /user/usage and shows:
 *  - "X days left in your Starter trial" with upgrade CTA while active
 *  - "Your trial has ended" with upgrade CTA when expired (non-dismissible)
 * Active-trial banner is dismissible per-session (and re-appears in the final 3 days).
 */
export default function TrialBanner({ usage: usageProp }) {
  const navigate = useNavigate();
  const [usage, setUsage] = useState(usageProp || null);
  const [dismissedAt, setDismissedAt] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY); } catch { return null; }
  });

  useEffect(() => { if (usageProp) setUsage(usageProp); }, [usageProp]);

  useEffect(() => {
    if (usageProp) return; // parent supplies it
    const token = localStorage.getItem("token");
    if (!token) return;
    axios
      .get(`${API}/api/user/usage`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setUsage(res.data))
      .catch(() => {});
  }, [usageProp]);

  if (!usage) return null;

  const isTrial = usage.is_trial === true;
  const trialExpired = usage.trial_expired === true || (isTrial && usage.trial_days_remaining === 0);
  if (!isTrial && !trialExpired) return null;

  const days = usage.trial_days_remaining ?? 0;
  const urgent = days <= 3;
  const dismissibleForSession = isTrial && !trialExpired && !urgent;
  if (dismissibleForSession && dismissedAt) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDismissedAt(String(Date.now()));
  };

  const goUpgrade = () => navigate("/pricing");

  // Expired state
  if (trialExpired) {
    return (
      <div
        data-testid="trial-banner-expired"
        className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
      >
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-900">Your Starter trial has ended</p>
            <p className="text-xs text-red-700/80 mt-0.5">
              Your data is safely preserved. Upgrade to keep using Starter features and exports.
            </p>
          </div>
        </div>
        <button
          onClick={goUpgrade}
          data-testid="trial-banner-upgrade-btn"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-semibold px-4 py-2 transition-all"
        >
          Upgrade to Starter
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Active trial state
  const styles = urgent
    ? {
        wrap: "rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4",
        iconWrap: "h-9 w-9 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center",
        Icon: Clock,
        iconColor: "text-amber-700",
        title: "text-amber-900",
        body: "text-amber-800/80",
        btn: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white",
      }
    : {
        wrap: "rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4",
        iconWrap: "h-9 w-9 shrink-0 rounded-xl bg-indigo-100 flex items-center justify-center",
        Icon: Sparkles,
        iconColor: "text-indigo-600",
        title: "text-indigo-900",
        body: "text-indigo-800/80",
        btn: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white",
      };

  const dayLabel = days === 1 ? "1 day" : `${days} days`;
  const title = urgent
    ? `Only ${dayLabel} left in your Starter trial`
    : `${dayLabel} left in your Starter trial`;
  const body = urgent
    ? "Upgrade now to keep your pipeline, saved searches, and unlock CSV export before your trial ends."
    : "Loving Affilitube? Upgrade to keep your data and unlock CSV export when your trial ends.";

  const { Icon } = styles;

  return (
    <div
      data-testid="trial-banner-active"
      className={`${styles.wrap} flex flex-col sm:flex-row sm:items-center gap-3 justify-between relative`}
    >
      <div className="flex items-start gap-3">
        <div className={styles.iconWrap}>
          <Icon className={`h-4 w-4 ${styles.iconColor}`} />
        </div>
        <div>
          <p className={`text-sm font-semibold ${styles.title}`} data-testid="trial-banner-title">{title}</p>
          <p className={`text-xs mt-0.5 ${styles.body}`}>{body}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={goUpgrade}
          data-testid="trial-banner-upgrade-btn"
          className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-4 py-2 transition-all ${styles.btn}`}
        >
          Upgrade to Starter
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        {dismissibleForSession && (
          <button
            onClick={dismiss}
            data-testid="trial-banner-dismiss-btn"
            aria-label="Dismiss"
            className="p-1.5 rounded-full hover:bg-white/60 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
