import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Youtube, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
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
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="w-full max-w-md"
        >
          <motion.div variants={fadeUp} className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl shadow-slate-200/30 p-10">
            <div className="text-center mb-8">
              <h1 className="font-heading text-2xl font-bold text-slate-900">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-500">Log in to access your dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email" className="h-11 rounded-lg bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium" data-testid="forgot-password-link">Forgot password?</Link>
                </div>
                <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password" className="h-11 rounded-lg bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5" data-testid="login-error">{error}</p>}

              <Button type="submit" className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-11 font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all" disabled={loading} data-testid="login-submit-btn">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Log In<ArrowRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Don't have an account?{" "}
              <Link to="/signup" className="text-indigo-600 hover:text-indigo-700 font-semibold">Sign up</Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
