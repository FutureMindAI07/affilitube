import { useState, useEffect } from "react";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
    if (typeof window.loadGA === "function") window.loadGA();
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-0"
      data-testid="cookie-consent-banner"
    >
      <div className="sm:max-w-md sm:m-4 bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-2xl shadow-black/40">
        <p className="text-sm text-slate-300 leading-relaxed">
          We use cookies to analyze site traffic and improve your experience.
          See our{" "}
          <a href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
            Privacy Policy
          </a>.
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={accept}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            data-testid="cookie-accept-btn"
          >
            Accept
          </button>
          <button
            onClick={decline}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            data-testid="cookie-decline-btn"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
