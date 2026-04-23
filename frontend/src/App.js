import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SearchResultsProvider } from "@/contexts/SearchResultsContext";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Signup from "@/pages/Signup";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import OutreachPage from "@/pages/OutreachPage";
import OutreachPipeline from "@/pages/OutreachPipeline";
import GettingStartedPage from "@/pages/GettingStartedPage";
import AdminPanel from "@/pages/AdminPanel";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import ForgotPassword from "@/pages/ForgotPassword";
import FreeLanding from "@/pages/FreeLanding";
import AffiliatesLanding from "@/pages/AffiliatesLanding";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (!user) return <Navigate to="/login" />;
  // Allow all authenticated users (free tier gets limited access in the dashboard)
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== "admin") return <Navigate to="/dashboard" />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <SearchResultsProvider>
      <BrowserRouter>
        <div className="min-h-screen">
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/free" element={<FreeLanding />} />
            <Route path="/affiliates" element={<AffiliatesLanding />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/outreach"
              element={
                <ProtectedRoute>
                  <OutreachPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/pipeline"
              element={
                <ProtectedRoute>
                  <OutreachPipeline />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/getting-started"
              element={
                <ProtectedRoute>
                  <GettingStartedPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
      </SearchResultsProvider>
    </AuthProvider>
  );
}

export default App;
