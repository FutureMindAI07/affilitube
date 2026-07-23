// Frontend-only display helpers for the affiliate platform badges in the results
// column. Keeps ordering + capping logic in one place so both ResultsSection.jsx
// and HistoricalReportView.jsx stay identical.

// Order in which platform badges are surfaced when the column can only fit N.
// Anything not in this list falls to the end in alpha order.
// Tweak freely without a backend redeploy — this is display-only.
export const PLATFORM_BADGE_PRIORITY = [
  "amazon", "ltk", "partnerstack", "impact",
  "shopmy", "magiclinks", "shareasale", "cj",
  "mavely", "howl", "collabs", "skimlinks",
  "gumroad", "clickbank", "rakuten", "awin",
  "flexoffers", "partnerize", "sovrn", "appsumo",
];

// Human-readable label for a platform key. Kept minimal — for anything not here
// we just Title-Case the key. Backend AFFILIATE_PLATFORMS is the source of truth
// for the display `name`, but the results column receives only the key.
export const PLATFORM_LABEL = {
  amazon: "Amazon",
  ltk: "LTK",
  partnerstack: "PartnerStack",
  impact: "Impact",
  shopmy: "ShopMy",
  magiclinks: "MagicLinks",
  shareasale: "ShareASale",
  cj: "CJ",
  mavely: "Mavely",
  howl: "Howl",
  collabs: "Collabs",
  skimlinks: "Skimlinks",
  gumroad: "Gumroad",
  clickbank: "ClickBank",
  rakuten: "Rakuten",
  awin: "Awin",
  flexoffers: "FlexOffers",
  partnerize: "Partnerize",
  sovrn: "Sovrn",
  appsumo: "AppSumo",
};

const _labelFor = (key) =>
  PLATFORM_LABEL[key] || key.charAt(0).toUpperCase() + key.slice(1);

// Given a channel's raw affiliate_platforms_found (unordered), return:
//   { visible: [platformKeys], hiddenCount: N, hiddenLabels: "…, …" }
// Callers render `visible` as pills, then a "+N" chip if hiddenCount > 0
// (tooltip = hiddenLabels).
export function selectVisiblePlatforms(platformsFound, cap = 2) {
  if (!platformsFound || platformsFound.length === 0) {
    return { visible: [], hiddenCount: 0, hiddenLabels: "" };
  }
  const seen = new Set(platformsFound);
  // 1. Priority-ordered platforms that this channel actually has
  const ordered = PLATFORM_BADGE_PRIORITY.filter((k) => seen.has(k));
  // 2. Any leftover platforms not in priority list, alpha-sorted
  const leftovers = [...platformsFound]
    .filter((k) => !PLATFORM_BADGE_PRIORITY.includes(k))
    .sort();
  const full = [...ordered, ...leftovers];
  const visible = full.slice(0, cap);
  const hidden = full.slice(cap);
  return {
    visible,
    hiddenCount: hidden.length,
    hiddenLabels: hidden.map(_labelFor).join(", "),
  };
}

export const platformLabelFor = _labelFor;
