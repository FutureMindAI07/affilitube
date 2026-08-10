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
import GetStartedFree from "@/pages/GetStartedFree";
import BlogAffiliateSaaS from "@/pages/BlogAffiliateSaaS";
import SaaSFoundersLanding from "@/pages/SaaSFoundersLanding";
import PartnerProgramLanding from "@/pages/PartnerProgramLanding";
import ClientLayout from "@/pages/client/ClientLayout";
import ClientAssignments from "@/pages/client/ClientAssignments";
import ClientProjectView from "@/pages/client/ClientProjectView";
import { CookieConsent } from "@/components/CookieConsent";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (!user) return <Navigate to="/login" />;
  // Redirect client-role users into their read-only view — they must never see the main dashboard.
  if (user.role === "client") return <Navigate to="/client" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === "client") return <Navigate to="/client" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" />;
  return children;
}

function ClientRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role !== "client") return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <SearchResultsProvider>
      <BrowserRouter>
        <div className="min-h-screen">
          <Toaster position="top-right" richColors />
          <CookieConsent />
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
            <Route path="/get-started-for-free" element={<GetStartedFree />} />
            <Route path="/how-to-find-affiliate-marketers-for-your-ai-saas" element={<BlogAffiliateSaaS />} />
            <Route path="/for-saas-founders" element={<SaaSFoundersLanding />} />
            <Route path="/affilitube-affiliate-program" element={<PartnerProgramLanding />} />
            <Route path="/client" element={<ClientRoute><ClientLayout /></ClientRoute>}>
              <Route index element={<ClientAssignments />} />
              <Route path="project/:assignmentId" element={<ClientProjectView />} />
            </Route>
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
