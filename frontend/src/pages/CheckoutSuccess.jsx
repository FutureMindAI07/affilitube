import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Youtube, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { token, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking, paid, failed
  const [planTier, setPlanTier] = useState(null);

  useEffect(() => {
    if (!sessionId || !token) return;
    let attempts = 0;
    const maxAttempts = 8;
    const interval = 2000;

    const poll = async () => {
      try {
        const res = await axios.get(`${API}/api/checkout/status/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.payment_status === "paid") {
          setStatus("paid");
          setPlanTier(res.data.tier);
          if (refreshUser) refreshUser();
          return;
        }
      } catch (e) {
        console.error("Status check error:", e);
      }
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, interval);
      } else {
        setStatus("failed");
      }
    };
    poll();
  }, [sessionId, token, refreshUser]);

  return (
    <div className="min-h-screen bg-white font-body flex flex-col items-center justify-center px-6">
      <a href="/" className="flex items-center gap-2.5 mb-12">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Youtube className="h-5 w-5 text-white" />
        </div>
        <span className="font-heading font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Affilitube</span>
      </a>

      {status === "checking" && (
        <div className="text-center" data-testid="checkout-checking">
          <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-5" />
          <h1 className="font-heading text-2xl font-bold text-slate-900 mb-2">Confirming your payment...</h1>
          <p className="text-slate-500">This will only take a moment.</p>
        </div>
      )}

      {status === "paid" && (
        <div className="text-center" data-testid="checkout-success">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 mb-2">Welcome to Affilitube {planTier === "starter" ? "Starter" : "Pro"}!</h1>
          <p className="text-slate-500 mb-8 max-w-sm">
            {planTier === "starter"
              ? "Your Starter access is now active. Enjoy 20 monthly searches and full export capabilities."
              : "Your Pro access is now active. Enjoy unlimited searches and full export capabilities."}
          </p>
          <Button
            onClick={() => navigate("/dashboard")}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-11 px-8 font-semibold shadow-lg shadow-indigo-500/20"
            data-testid="checkout-go-dashboard"
          >
            Go to Dashboard
          </Button>
        </div>
      )}

      {status === "failed" && (
        <div className="text-center" data-testid="checkout-failed">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 mb-2">Payment status unclear</h1>
          <p className="text-slate-500 mb-8 max-w-sm">We couldn't confirm your payment yet. If you were charged, your access will activate shortly.</p>
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
            className="rounded-full"
            data-testid="checkout-retry-dashboard"
          >
            Go to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
