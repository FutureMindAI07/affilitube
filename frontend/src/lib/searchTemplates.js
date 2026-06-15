// Saved Search Templates — config-driven, easy to extend.
// Add new templates to the SEARCH_TEMPLATES array below.

export const COMMON_EXCLUDE = [
  "gaming",
  "vlog",
  "music",
  "dropshipping",
  "amazon",
  "passive income",
  "make money online",
  "faceless",
  "course",
  "coaching",
];

export const SEARCH_TEMPLATES = [
  {
    id: "saas-tool-reviewers",
    name: "SaaS Tool Reviewers",
    icon: "Star",
    description:
      "Creators who review and compare SaaS products. Best starting point for SaaS affiliate prospecting.",
    niche: "saas_software",
    keywords: [
      "saas review",
      "software review",
      "best saas tools",
      "saas alternative",
      "saas discount",
    ],
    exclude_keywords: COMMON_EXCLUDE,
    min_subscribers: 2000,
    max_subscribers: 15000,
    super_search: true,
    strict_mode: false,
  },
  {
    id: "email-marketing-tools",
    name: "Email Marketing Tools",
    icon: "Mail",
    description:
      "Creators covering email marketing platforms. High affiliate motivation and strong SaaS buyer audience.",
    niche: "saas_software",
    keywords: [
      "brevo review",
      "activecampaign alternative",
      "mailerlite review",
      "convertkit alternative",
      "beehiiv review",
    ],
    exclude_keywords: COMMON_EXCLUDE,
    min_subscribers: 2000,
    max_subscribers: 15000,
    super_search: true,
    strict_mode: false,
  },
  {
    id: "no-code-automation",
    name: "No-Code & Automation",
    icon: "Workflow",
    description:
      "No-code and automation creators. Technically sophisticated audience that actively buys and recommends SaaS tools.",
    niche: "saas_software",
    keywords: [
      "make.com tutorial",
      "zapier alternative",
      "no-code tools review",
      "automation software review",
    ],
    exclude_keywords: [...COMMON_EXCLUDE, "notion", "airtable"],
    min_subscribers: 2000,
    max_subscribers: 15000,
    super_search: true,
    strict_mode: false,
  },
  {
    id: "ai-tools-reviewers",
    name: "AI Tools Reviewers",
    icon: "Sparkles",
    description:
      "Creators reviewing AI-powered business tools. Fast-growing niche with high commercial intent.",
    niche: "saas_software",
    keywords: [
      "best ai tools",
      "ai software review",
      "ai tools for business",
      "ai productivity tools",
    ],
    exclude_keywords: COMMON_EXCLUDE,
    min_subscribers: 2000,
    max_subscribers: 15000,
    super_search: true,
    strict_mode: false,
  },
  {
    id: "saas-founders-operators",
    name: "SaaS Founders & Operators",
    icon: "Rocket",
    description:
      "Creators talking directly to SaaS founders and operators. Lower affiliate history but highest audience ICP match — use a tool pitch rather than a standard affiliate ask.",
    niche: "saas_software",
    keywords: [
      "saas founder",
      "saas marketing strategy",
      "saas growth",
      "saas go to market",
    ],
    exclude_keywords: COMMON_EXCLUDE,
    min_subscribers: 500,
    max_subscribers: 10000,
    super_search: true,
    strict_mode: false,
  },
  {
    id: "partnerstack-reverse",
    name: "Reverse Affiliate Search",
    icon: "Target",
    description:
      "Paste any SaaS product name to find creators already making content about it. Highest-signal prospecting method.",
    niche: "saas_software",
    mode: "reverse_search",
    product_placeholder: "e.g. Descript, Brevo, Apollo.io",
    keywords: [], // generated dynamically from product input
    exclude_keywords: COMMON_EXCLUDE,
    min_subscribers: 2000,
    max_subscribers: 15000,
    super_search: true,
    strict_mode: false,
  },
];

// Generate keyword variants for the PartnerStack reverse-search template.
export function reverseSearchKeywordsFor(productName) {
  const p = (productName || "").trim();
  if (!p) return [];
  return [`${p} review`, `${p} alternative`, `${p} tutorial`, `${p} vs`];
}
