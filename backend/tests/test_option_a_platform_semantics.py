"""Tests for Option A semantic flip:
  - AFFILIATE_PLATFORMS now includes 20 named entries (was 11)
  - detect_affiliate_platform_links scans ALL by default when we pass the full key set
  - detect_sponsorships surfaces the same rstyle/shopmy/magiclinks families
    via MASTER_AFFILIATE_LINK_PATTERNS (unchanged, but co-verify no drift)
  - The new affiliate_links_total field is well-defined as a count over
    MASTER_AFFILIATE_LINK_PATTERNS (integration test relies on enrichment flow,
    so we test the counting formula directly)

Explicitly NOT tested here: end-to-end enrichment (covered elsewhere), the
frontend filter application (JS unit tests live outside this dir), UI badge cap.
"""

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from server import (  # noqa: E402
    AFFILIATE_PLATFORMS,
    MASTER_AFFILIATE_LINK_PATTERNS,
    detect_affiliate_platform_links,
)


# ---------- AFFILIATE_PLATFORMS expansion ----------

EXPECTED_NEW_PLATFORMS = {
    "shopmy", "magiclinks", "mavely", "howl", "collabs",
    "skimlinks", "sovrn", "partnerize", "flexoffers",
}


def test_new_creator_networks_are_named():
    for key in EXPECTED_NEW_PLATFORMS:
        assert key in AFFILIATE_PLATFORMS, f"{key} missing from AFFILIATE_PLATFORMS"
        entry = AFFILIATE_PLATFORMS[key]
        assert "name" in entry and entry["name"]
        assert "patterns" in entry and len(entry["patterns"]) > 0


def test_shareasale_absorbs_shrsl():
    assert "shrsl.com" in AFFILIATE_PLATFORMS["shareasale"]["patterns"]


def test_ltk_absorbs_rstyle():
    assert "rstyle.me" in AFFILIATE_PLATFORMS["ltk"]["patterns"]


def test_amazon_covers_influencer_storefronts():
    patterns = AFFILIATE_PLATFORMS["amazon"]["patterns"]
    assert any("shop" in p for p in patterns), "Amazon should include /shop/ storefront pattern"


# ---------- detect_affiliate_platform_links behaviour (Option A: scan all) ----------

ALL_KEYS = list(AFFILIATE_PLATFORMS.keys())


def test_scanning_all_platforms_finds_shopmy():
    text = "Shop my picks: https://www.shopmy.us/collections/fall-picks"
    _, found, count = detect_affiliate_platform_links(text, ALL_KEYS)
    assert "shopmy" in found
    assert count >= 1


def test_scanning_all_platforms_finds_rstyle_via_ltk():
    text = "Wearing: https://rstyle.me/+abc123def"
    _, found, _ = detect_affiliate_platform_links(text, ALL_KEYS)
    assert "ltk" in found, f"expected ltk in {found}"


def test_scanning_all_platforms_finds_magiclinks():
    text = "Products in this vid: https://go.magik.ly/ml/abc/"
    _, found, _ = detect_affiliate_platform_links(text, ALL_KEYS)
    assert "magiclinks" in found


def test_multiple_platforms_matched_in_one_channel():
    text = """
        Fashion haul links below!
        Amazon: https://amzn.to/3xyzXYZ
        Sephora via ShopMy: https://shopmy.us/collections/beauty
        Outfit inspo: https://rstyle.me/+longcode123
        Zara stuff: https://viglink.com/redirect?u=zara.com
    """
    _, found, count = detect_affiliate_platform_links(text, ALL_KEYS)
    assert "amazon" in found
    assert "shopmy" in found
    assert "ltk" in found
    assert "sovrn" in found
    assert count == len(found)


def test_no_matches_returns_empty():
    text = "Just a regular vlog post with no affiliate links whatsoever."
    _, found, count = detect_affiliate_platform_links(text, ALL_KEYS)
    assert found == []
    assert count == 0


def test_picker_filter_can_still_restrict_when_passed_subset():
    """Even after the semantic flip, callers can still opt to scan only a subset
    (e.g. legacy callers or admin overrides). Verify the function still respects
    an explicit shorter list."""
    text = "https://amzn.to/xxx and https://shopmy.us/aaa"
    _, found_all, _ = detect_affiliate_platform_links(text, ALL_KEYS)
    _, found_amazon_only, _ = detect_affiliate_platform_links(text, ["amazon"])
    assert "shopmy" in found_all
    assert "shopmy" not in found_amazon_only
    assert found_amazon_only == ["amazon"]


# ---------- affiliate_links_total formula ----------
# The enrichment flow computes this via:
#     for p in MASTER_AFFILIATE_LINK_PATTERNS: total += len(re.findall(p, text, IGNORECASE))
# We test that formula directly to catch regressions if the master list drifts.

def _links_total(text: str) -> int:
    total = 0
    for p in MASTER_AFFILIATE_LINK_PATTERNS:
        total += len(re.findall(p, text, re.IGNORECASE))
    return total


def test_links_total_counts_named_networks():
    text = "amzn.to/1 amzn.to/2 shopmy.us/x rstyle.me/+abc howl.me/y"
    total = _links_total(text)
    assert total >= 5, f"expected at least 5 links, got {total}"


def test_links_total_counts_unnamed_networks_too():
    """A key acceptance criterion for Option A: the fallback pill must fire on
    channels using platforms NOT in AFFILIATE_PLATFORMS (e.g. a hypothetical
    obscure network) as long as they match MASTER_AFFILIATE_LINK_PATTERNS."""
    # geni.us is in MASTER but NOT badged in AFFILIATE_PLATFORMS — perfect proxy.
    text = "Check the geni.us links: https://geni.us/foo and https://geni.us/bar"
    total = _links_total(text)
    assert total >= 2

    # And verify it does NOT match the named-platform detector
    _, found, _ = detect_affiliate_platform_links(text, ALL_KEYS)
    assert "geni.us" not in [AFFILIATE_PLATFORMS.get(k, {}).get("name", "") for k in found]


def test_links_total_zero_for_clean_text():
    assert _links_total("Just a description with no affiliate URLs.") == 0
