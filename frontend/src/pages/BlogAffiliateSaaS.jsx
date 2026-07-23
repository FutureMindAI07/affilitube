import { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, Zap, DollarSign, Users, Search, Settings, BarChart3, Gift, Mail, Target } from "lucide-react";

export default function BlogAffiliateSaaS() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <Helmet>
        <title>How to Find Affiliate Marketers for Your AI SaaS | Affilitube</title>
        <meta name="description" content="Learn how to find affiliate marketers for your AI SaaS product in 30 minutes a day — without paying an agency. Find YouTube creators already talking to your audience." />
        <link rel="canonical" href="https://affilitube.com/how-to-find-affiliate-marketers-for-your-ai-saas" />
        <meta property="og:title" content="How to Find Affiliate Marketers for Your AI SaaS" />
        <meta property="og:description" content="Find YouTube creators already talking to your audience — without an agency or a big budget." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://affilitube.com/how-to-find-affiliate-marketers-for-your-ai-saas" />
      </Helmet>

      <div className="min-h-screen font-body bg-white">
        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100">
          <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Search className="h-4 w-4 text-white" />
              </div>
              <span className="font-heading font-bold text-slate-900">Affilitube</span>
            </a>
            <a href="/get-started-for-free">
              <Button className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-sm px-5">
                Get Started Free
              </Button>
            </a>
          </div>
        </nav>

        {/* Article */}
        <article className="max-w-3xl mx-auto px-6 pt-16 pb-24">
          {/* Hero tag */}
          <Badge className="mb-5 bg-indigo-50 text-indigo-600 border-indigo-100 rounded-full px-4 py-1.5 text-sm font-medium">
            Affiliate Marketing for SaaS
          </Badge>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-heading font-bold text-slate-900 leading-[1.1] tracking-tight">
            How to Find Affiliate Marketers for Your AI SaaS
          </h1>

          {/* Meta info */}
          <div className="flex items-center gap-4 mt-5 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />8 min read</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>Free method</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>30 mins a day</span>
          </div>

          {/* YouTube Embed */}
          <div className="mt-10 aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
            <iframe
              src="https://www.youtube.com/embed/RdbFDVIhlsg"
              title="How to Find Affiliate Marketers for Your AI SaaS"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          {/* Intro */}
          <p className="mt-12 text-xl text-slate-700 leading-relaxed">
            You've built your AI SaaS product. Now comes the hard part — finding the right people to help you sell it. Here's how to do it in around 30 minutes a day, without an agency and without a big budget.
          </p>

          {/* Section: The Problem */}
          <h2 className="mt-14 text-2xl font-heading font-bold text-slate-900">
            The Problem With Finding Affiliates for Your AI SaaS
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Affiliate agencies will do the heavy lifting for you — but you're looking at anywhere from $200 to $2,500 per month. If you've got investors backing you, maybe that's fine. But if you're bootstrapping on a tight budget, that's a big ask right now.
          </p>
          <p className="mt-4 text-slate-600 leading-relaxed">
            The other option most founders try is posting on affiliate platforms and waiting. What you get back is a flood of low-quality applicants with no audience fit, no trust with their followers, and no real skin in the game.
          </p>

          {/* Pull quote */}
          <blockquote className="my-10 pl-6 border-l-4 border-indigo-500">
            <p className="text-lg text-slate-800 italic leading-relaxed">
              "The best affiliates for your AI SaaS are already out there, already talking to your exact audience. You just need to know how to find them."
            </p>
          </blockquote>

          {/* Section: Why YouTube */}
          <h2 className="mt-14 text-2xl font-heading font-bold text-slate-900">
            Why YouTube is Your Untapped Affiliate Channel
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            YouTube creators have something most affiliates don't — a warm, trusting audience that actively seeks their recommendations. A single video from the right creator can drive more qualified signups than a month of banner ads.
          </p>
          <p className="mt-4 text-slate-600 leading-relaxed">
            More importantly, thousands of YouTube creators are already making content around SaaS tools, AI products, and productivity software — the exact topics your potential customers are searching for every day. These creators are your ideal affiliates. They just don't know about your product yet.
          </p>

          {/* Stat boxes */}
          <div className="grid grid-cols-3 gap-4 my-10">
            {[
              { value: "254", label: "Relevant creators found in one search", icon: Users },
              { value: "30 min", label: "Per day to build your pipeline", icon: Clock },
              { value: "$0", label: "Agency fees required", icon: DollarSign },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-5 rounded-xl bg-slate-50 border border-slate-100">
                <stat.icon className="h-5 w-5 text-indigo-500 mx-auto mb-2" />
                <p className="text-2xl font-heading font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Section: Key Insight */}
          <h2 className="mt-14 text-2xl font-heading font-bold text-slate-900">
            The Key Insight Most SaaS Founders Miss
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Here's what changes everything: many of these YouTube creators are actively looking for brand partnerships and affiliate deals. They're putting their business email in their channel descriptions, using phrases like "business inquiries" and "collaboration" in their videos, and signing up to affiliate platforms like PartnerStack and Impact.
          </p>
          <p className="mt-4 text-slate-600 leading-relaxed">
            They're signalling they want to work with brands. You just need the right tool to read those signals at scale.
          </p>

          {/* Section: How To */}
          <h2 className="mt-14 text-2xl font-heading font-bold text-slate-900">
            How to Find YouTube Affiliates for Your AI SaaS in 30 Minutes a Day
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            This is the exact workflow shown in the video above, using Affilitube — a tool built specifically for finding YouTube affiliate prospects.
          </p>

          {/* 6 Steps */}
          <div className="mt-8 space-y-6">
            {[
              {
                num: 1, icon: Target, title: "Select your niche",
                desc: "Choose from 14 niche configurations. For an AI SaaS product, select SaaS & Software — it pre-loads relevant keyword suggestions automatically.",
              },
              {
                num: 2, icon: Search, title: "Search like your customer, not like yourself",
                desc: "Use keywords your potential customers type into YouTube — things like \"SaaS review\", \"AI tools\", and \"productivity software\" — not your product name or category.",
              },
              {
                num: 3, icon: Settings, title: "Configure your search",
                desc: "Set your subscriber range, upload frequency, and let Affilitube automatically scan video descriptions for affiliate signals — no toggles required.",
              },
              {
                num: 4, icon: BarChart3, title: "Enrich and qualify",
                desc: "Affilitube scores every channel by topic relevance, affiliate signals, engagement health, and contactability. Sort by affiliate score to surface the creators most likely to say yes.",
              },
              {
                num: 5, icon: Gift, title: "Review brand intelligence",
                desc: "See how many affiliate links a creator has used across their recent videos, which platforms they promote on, and whether they have a confirmed business email — all in one place.",
              },
              {
                num: 6, icon: Mail, title: "Draft and send with AI",
                desc: "Add promising creators to your outreach pipeline and generate a personalised email in one click. Affilitube references their actual video content — not a generic template.",
              },
            ].map((step) => (
              <div key={step.num} className="flex gap-5">
                <div className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-heading font-bold text-sm">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-slate-600 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Section: What Makes a Good Affiliate */}
          <h2 className="mt-14 text-2xl font-heading font-bold text-slate-900">
            What Makes a Good YouTube Affiliate for Your AI SaaS?
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Not every creator with a big audience is worth approaching. The best affiliate prospects share a few key characteristics:
          </p>
          <div className="mt-6 space-y-6">
            <div>
              <p className="font-heading font-semibold text-slate-900">They're already in your space.</p>
              <p className="mt-1 text-slate-600 leading-relaxed">
                Look for creators whose recent videos cover AI tools, SaaS reviews, productivity software, or no-code automation. Their audience is already primed to buy tools like yours.
              </p>
            </div>
            <div>
              <p className="font-heading font-semibold text-slate-900">They have a track record of promoting products.</p>
              <p className="mt-1 text-slate-600 leading-relaxed">
                A creator who has included affiliate links in 8 out of their last 10 videos is a very different prospect from someone who has never promoted anything. Affilitube's Brand Intelligence section shows you this at a glance.
              </p>
            </div>
            <div>
              <p className="font-heading font-semibold text-slate-900">Their channel is healthy and active.</p>
              <p className="mt-1 text-slate-600 leading-relaxed">
                Subscriber count alone is misleading. Look for strong engagement relative to their audience size, consistent upload frequency, and stable or growing view counts. A creator with 15,000 engaged subscribers is often worth more than one with 200,000 passive ones.
              </p>
            </div>
            <div>
              <p className="font-heading font-semibold text-slate-900">They're contactable.</p>
              <p className="mt-1 text-slate-600 leading-relaxed">
                A business email in their channel description or a "collaborations" link is a strong signal they're open to outreach. Don't waste time chasing creators with no contact information.
              </p>
            </div>
          </div>

          {/* Section: Cost */}
          <h2 className="mt-14 text-2xl font-heading font-bold text-slate-900">
            How Much Does It Cost to Find Affiliates This Way?
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Affilitube starts with a free plan so you can run searches and see results before committing to anything. Paid plans start at around $40 per month — a fraction of what a single month with an affiliate agency would cost.
          </p>
          <p className="mt-4 text-slate-600 leading-relaxed">
            The time investment is around 30 minutes a day: run a search, review your top prospects, add the best ones to your pipeline, and send a few outreach emails. Do that consistently for a month and you'll have a meaningful pipeline of qualified affiliate prospects without spending a cent on agency fees.
          </p>
        </article>

        {/* CTA Block */}
        <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white mb-4">
              Start Finding Your YouTube Affiliates Today
            </h2>
            <p className="text-indigo-100 mb-8 max-w-lg mx-auto">
              No agency. No big budget. Just the right tool and 30 minutes a day.
            </p>
            <a href="/get-started-for-free">
              <Button className="rounded-full bg-white text-indigo-700 hover:bg-indigo-50 text-base px-8 py-6 h-auto font-semibold shadow-lg shadow-indigo-900/30">
                Get Started For Free
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </a>
          </div>
        </section>

        {/* Minimal Footer */}
        <footer className="py-8 bg-slate-950">
          <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Search className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm text-slate-500">Affilitube</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="/terms" className="hover:text-slate-300 transition-colors">Terms</a>
              <a href="/privacy" className="hover:text-slate-300 transition-colors">Privacy</a>
              <a href="/pricing" className="hover:text-slate-300 transition-colors">Pricing</a>
              <a href="/login" className="hover:text-slate-300 transition-colors">Login</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
