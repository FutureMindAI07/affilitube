import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Youtube, ArrowRight, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

export default function ForgotPassword() {
  const [step, setStep] = useState("email"); // email, code, done
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/request-password-reset`, { email });
      setStep("code");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/reset-password`, { token: code, new_password: newPassword });
      setStep("done");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-body relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-purple-50 to-white" />
      <div className="absolute top-20 right-1/3 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl" />

      <nav className="relative px-6 h-16 flex items-center">
        <a href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Youtube className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Affilitube</span>
        </a>
      </nav>

      <div className="relative flex-1 flex items-center justify-center px-6 py-12">
        <motion.div initial="hidden" animate="show" variants={stagger} className="w-full max-w-md">
          <motion.div variants={fadeUp} className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl shadow-slate-200/30 p-10">

            {step === "email" && (
              <>
                <div className="text-center mb-8">
                  <h1 className="font-heading text-2xl font-bold text-slate-900">Forgot your password?</h1>
                  <p className="mt-2 text-sm text-slate-500">Enter your email and we'll send you a reset code</p>
                </div>
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700">Email</Label>
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="reset-email" className="h-11 rounded-lg bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5" data-testid="reset-error">{error}</p>}
                  <Button type="submit" className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-11 font-semibold shadow-lg shadow-indigo-500/20 transition-all" disabled={loading} data-testid="reset-submit-btn">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send Reset Code <ArrowRight className="h-4 w-4 ml-2" /></>}
                  </Button>
                </form>
              </>
            )}

            {step === "code" && (
              <>
                <div className="text-center mb-8">
                  <h1 className="font-heading text-2xl font-bold text-slate-900">Enter reset code</h1>
                  <p className="mt-2 text-sm text-slate-500">We sent a 6-digit code to <strong>{email}</strong></p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-slate-700">Reset Code</Label>
                    <Input id="code" type="text" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={6} data-testid="reset-code" className="h-11 rounded-lg bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-center text-lg tracking-widest font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-slate-700">New Password</Label>
                    <Input id="newPassword" type="password" placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required data-testid="reset-new-password" className="h-11 rounded-lg bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-700">Confirm Password</Label>
                    <Input id="confirmPassword" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required data-testid="reset-confirm-password" className="h-11 rounded-lg bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5" data-testid="reset-error">{error}</p>}
                  <Button type="submit" className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-11 font-semibold shadow-lg shadow-indigo-500/20 transition-all" disabled={loading} data-testid="reset-password-btn">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Reset Password <ArrowRight className="h-4 w-4 ml-2" /></>}
                  </Button>
                </form>
              </>
            )}

            {step === "done" && (
              <div className="text-center" data-testid="reset-success">
                <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-slate-900 mb-2">Password reset!</h1>
                <p className="text-sm text-slate-500 mb-6">You can now log in with your new password.</p>
                <Link to="/login">
                  <Button className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-11 px-8 font-semibold shadow-lg shadow-indigo-500/20 transition-all" data-testid="reset-go-login">
                    Go to Login <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}

            {step !== "done" && (
              <p className="mt-6 text-center text-sm text-slate-500">
                <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
                </Link>
              </p>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
