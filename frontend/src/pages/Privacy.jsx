import { Youtube, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white font-body">
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Youtube className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Affilitube</span>
          </Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <h1 className="text-4xl font-heading font-bold text-slate-900 mb-2" data-testid="privacy-heading">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>

        <div className="legal-prose text-sm leading-relaxed">
          <h2>1. Information We Collect</h2>
          <p>When you use Affilitube, we collect:</p>
          <ul>
            <li><strong>Account information:</strong> Your email address and encrypted password when you register</li>
            <li><strong>Payment information:</strong> Processed securely through Stripe; we do not store your credit card details</li>
            <li><strong>Search data:</strong> Keywords, niche selections, search configurations, and results generated during your use of the Service</li>
            <li><strong>Usage data:</strong> Feature usage patterns, search counts, and subscription status</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the collected information to:</p>
          <ul>
            <li>Provide and operate the Service</li>
            <li>Authenticate your account and manage your subscription</li>
            <li>Store your search results, shortlists, and reports</li>
            <li>Track usage to enforce tier limits (Free vs Pro)</li>
            <li>Improve the Service and develop new features</li>
            <li>Send transactional emails (password resets, subscription confirmations)</li>
          </ul>

          <h2>3. YouTube Data</h2>
          <p>The Service retrieves publicly available data from YouTube through the YouTube Data API v3. This includes channel names, descriptions, subscriber counts, video titles, and video descriptions. This data is publicly available on YouTube and is used solely to provide the scoring and analysis features of the Service. We cache this data temporarily to improve performance.</p>

          <h2>4. Data Storage</h2>
          <p>Your data is stored in secure databases. Your password is encrypted using industry-standard hashing (bcrypt). All data transmission is encrypted via HTTPS.</p>

          <h2>5. Data Sharing</h2>
          <p>We do not sell, trade, or share your personal information with third parties, except:</p>
          <ul>
            <li><strong>Payment processing:</strong> Stripe processes payments on our behalf</li>
            <li><strong>Legal requirements:</strong> If required by law or to protect our rights</li>
          </ul>

          <h2>6. Cookies and Local Storage</h2>
          <p>The Service uses local storage to maintain your authentication session. We use minimal analytics to understand usage patterns and improve the Service.</p>

          <h2>7. Data Retention</h2>
          <p>Your account data, search history, and saved reports are retained for as long as your account is active. If you cancel your subscription, your data remains accessible (read-only for saved reports) until you delete your account. You may request deletion of your account and all associated data at any time.</p>

          <h2>8. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your search results and reports via CSV (Pro plan)</li>
            <li>Cancel your subscription at any time</li>
          </ul>

          <h2>9. Security</h2>
          <p>We implement appropriate technical and organizational measures to protect your data, including encrypted passwords, secure API communication (HTTPS), role-based access controls, and regular security reviews.</p>

          <h2>10. Children's Privacy</h2>
          <p>The Service is not intended for users under 18 years of age. We do not knowingly collect personal information from children.</p>

          <h2>11. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Last updated" date. Material changes will be communicated via email.</p>

          <h2>12. Contact</h2>
          <p>If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us through the Service's bug report feature or support channels.</p>
        </div>
      </div>

      <footer className="py-8 border-t border-slate-100 text-sm text-slate-400">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <span>&copy; {new Date().getFullYear()} Affilitube</span>
          <div className="flex gap-6">
            <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <Link to="/privacy" className="text-indigo-600 font-medium">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
