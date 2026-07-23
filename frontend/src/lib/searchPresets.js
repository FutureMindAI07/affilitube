/**
 * Search preset configurations + default keyword placeholder.
 *
 * Extracted from Dashboard.jsx (Phase 1 refactor). Behaviour is unchanged.
 */

export const SEARCH_PRESETS = {
  quick: {
    name: "Quick Scan",
    icon: "🚀",
    description: "Fast, low quota usage",
    settings: {
      videos_to_scan: 3,
      max_channels_to_enrich: 100,
    }
  },
  balanced: {
    name: "Balanced",
    icon: "⚖️",
    description: "Good coverage (default)",
    settings: {
      videos_to_scan: 5,
      max_channels_to_enrich: 200,
    }
  },
  deep: {
    name: "Deep Scan",
    icon: "🔍",
    description: "Comprehensive, higher quota",
    settings: {
      videos_to_scan: 10,
      max_channels_to_enrich: null,
    }
  },
  custom: {
    name: "Custom",
    icon: "⚙️",
    description: "Full control",
    settings: null
  }
};

export const DEFAULT_KEYWORD_PLACEHOLDER = `Select a niche above to see example keywords`;
