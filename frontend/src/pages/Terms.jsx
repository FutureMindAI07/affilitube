import { Youtube, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white font-body">
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Youtube className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Tubiate</span>
          </Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <h1 className="text-4xl font-heading font-bold text-slate-900 mb-2" data-testid="terms-heading">Terms of Service</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>

        <div className="legal-prose text-sm leading-relaxed">
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using Tubiate ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.</p>

          <h2>2. Description of Service</h2>
          <p>The Service is a web-based tool that helps users identify and evaluate YouTube channels as potential affiliate marketing partners. The Service uses the YouTube Data API v3 to retrieve publicly available channel and video information.</p>

          <h2>3. Account Registration</h2>
          <p>To use the Service, you must create an account with a valid email address and password. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

          <h2>4. YouTube API Key</h2>
          <p>The Service requires a YouTube Data API v3 key provided by you. You are responsible for obtaining this key from Google Cloud Console and complying with the YouTube API Terms of Service and Google's terms. We do not provide API keys and are not responsible for any quota limitations or restrictions imposed by Google.</p>

          <h2>5. Acceptable Use</h2>
          <p>You agree to use the Service only for lawful purposes and in compliance with YouTube's Terms of Service and Google's API policies. You agree not to:</p>
          <ul>
            <li>Use the Service to harass, spam, or mislead YouTube content creators</li>
            <li>Attempt to circumvent YouTube API quota limits</li>
            <li>Reverse engineer, decompile, or disassemble the Service</li>
            <li>Share your account with others or resell access to the Service</li>
          </ul>

          <h2>6. Lifetime Access</h2>
          <p>A "Lifetime" license means access to the Service for as long as it is commercially operated. We reserve the right to discontinue the Service with reasonable notice. In such an event, we will provide at least 90 days' notice.</p>

          <h2>7. Payment and Refunds</h2>
          <p>Payment is a one-time fee as displayed on the pricing page. Refunds are available within 30 days of purchase if you are not satisfied with the Service, provided you have not made excessive use of the platform.</p>

          <h2>8. Data and Privacy</h2>
          <p>Please refer to our <Link to="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link> for information about how we collect, use, and protect your data.</p>

          <h2>9. Disclaimer of Warranties</h2>
          <p>The Service is provided "as is" without warranties of any kind. We do not guarantee the accuracy or completeness of channel data, scores, or affiliate signal detection. Results should be verified independently before making business decisions.</p>

          <h2>10. Limitation of Liability</h2>
          <p>In no event shall we be liable for any indirect, incidental, special, or consequential damages arising out of or in connection with your use of the Service.</p>

          <h2>11. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>

          <h2>12. Contact</h2>
          <p>If you have questions about these Terms, please contact us through the Service's support channels.</p>
        </div>
      </div>

      <footer className="py-8 border-t border-slate-100 text-sm text-slate-400">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <span>&copy; {new Date().getFullYear()} Tubiate</span>
          <div className="flex gap-6">
            <Link to="/terms" className="text-indigo-600 font-medium">Terms</Link>
            <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
