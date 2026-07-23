"""Tests for the four new niches, expanded affiliate patterns, and promo-code surfacing.

Scope (mirrors user-approved changelist):
  Item 1: fashion / lifestyle / parenting / home_decor added to NICHE_CONFIGS
  Item 2: all four added to PHYSICAL_PRODUCT_NICHES (checked via GET /api/niches presence
          only — the set itself lives inside a request-scoped closure)
  Item 3: LTK/RewardStyle badged as "LTK"; VigLink, Amazon Influencer, Walmart Creator
          counted (no badge required for the last three)
  Item 4: detect_sponsorships surfaces `detected_promo_codes` (capped at 10) and the
          "CODE at checkout" regex fires without a "use"/"code" label

Explicitly NOT in scope: confidence formula tuning, 10-video cap, brand capitalisation,
affiliate link de-dup, search templates.
"""

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from server import (  # noqa: E402
    NICHE_CONFIGS,
    MASTER_AFFILIATE_LINK_PATTERNS,
    AFFILIATE_PLATFORMS,
    SPONSORSHIP_PATTERNS,
    detect_sponsorships,
)


# ---------- Item 1: Four new niches ----------

REQUIRED_KEYS = {
    "name", "icon", "description",
    "topic_keywords", "affiliate_signal_keywords",
    "affiliate_language_keywords", "commercial_keywords",
    "placeholder_examples",
}

NEW_NICHES = ["fashion", "lifestyle", "parenting", "home_decor"]


def test_new_niches_registered():
    for key in NEW_NICHES:
        assert key in NICHE_CONFIGS, f"{key} missing from NICHE_CONFIGS"


def test_new_niches_have_all_required_keys():
    for key in NEW_NICHES:
        cfg = NICHE_CONFIGS[key]
        assert REQUIRED_KEYS.issubset(cfg.keys()), (
            f"{key} missing keys: {REQUIRED_KEYS - set(cfg.keys())}"
        )


def test_new_niches_keyword_lists_are_nonempty():
    for key in NEW_NICHES:
        cfg = NICHE_CONFIGS[key]
        for list_key in (
            "topic_keywords", "affiliate_signal_keywords",
            "affiliate_language_keywords", "commercial_keywords",
        ):
            assert isinstance(cfg[list_key], list), f"{key}.{list_key} not a list"
            assert len(cfg[list_key]) > 0, f"{key}.{list_key} is empty"


def test_dropped_tokens_are_absent():
    """User explicitly cut bare 'pr' from lifestyle and bare 'code' from all four."""
    # Lifestyle should have 'pr package' but not the bare token 'pr'
    lifestyle_lang = NICHE_CONFIGS["lifestyle"]["affiliate_language_keywords"]
    assert "pr package" in lifestyle_lang
    assert "pr" not in lifestyle_lang, "bare 'pr' token was supposed to be cut"
    # None of the four new niches should have the bare 'code' token
    for key in NEW_NICHES:
        assert "code" not in NICHE_CONFIGS[key]["affiliate_language_keywords"], (
            f"bare 'code' token still present in {key}"
        )


# ---------- Item 3: Affiliate patterns ----------

def _matches_any(url: str) -> bool:
    return any(re.search(p, url, re.IGNORECASE) for p in MASTER_AFFILIATE_LINK_PATTERNS)


def test_ltk_domains_matched():
    assert _matches_any("https://liketoknow.it/abcXYZ")
    assert _matches_any("https://rewardstyle.com/ck/user/123")
    assert _matches_any("https://shopltk.com/xyz")


def test_ltk_badged_in_affiliate_platforms():
    assert "ltk" in AFFILIATE_PLATFORMS
    assert AFFILIATE_PLATFORMS["ltk"]["name"] == "LTK"
    assert "liketoknow.it" in AFFILIATE_PLATFORMS["ltk"]["patterns"]
    assert "rewardstyle.com" in AFFILIATE_PLATFORMS["ltk"]["patterns"]


def test_amazon_influencer_storefront_matched():
    assert _matches_any("https://www.amazon.com/shop/creatorname")
    assert _matches_any("https://amazon.co.uk/shop/handle")


def test_walmart_creator_matched():
    assert _matches_any("https://walmart.com/ip/foo?adid=22222")
    assert _matches_any("https://www.walmart.com/browse?adid=abc&sid=1")
    # Vanilla walmart URL without adid should NOT match (this pattern is affiliate-only)
    assert not _matches_any("https://walmart.com/ip/foo")


def test_viglink_matched():
    assert _matches_any("https://viglink.com/redirect?u=example.com")


# ---------- Item 4: Promo code surfacing + new regex ----------

def _run_detect(description: str, title: str = "Video title"):
    return detect_sponsorships([
        {"video_id": "v1", "title": title, "description": description}
    ])


def test_promo_code_surfaced_from_use_code_pattern():
    result = _run_detect("Use code SAVE20 for 20% off!")
    assert "SAVE20" in result["detected_promo_codes"]
    assert result["promo_code_count"] >= 1


def test_promo_code_surfaced_from_discount_code_label():
    result = _run_detect("Discount code: MEG15 at signup")
    assert "MEG15" in result["detected_promo_codes"]


def test_new_at_checkout_regex_catches_bare_code():
    result = _run_detect("Enter GET10OFF at checkout for a discount")
    assert "GET10OFF" in result["detected_promo_codes"]
    assert result["promo_code_count"] >= 1


def test_at_the_checkout_variant_matched():
    result = _run_detect("Use MEG15 at the checkout to save.")
    assert "MEG15" in result["detected_promo_codes"]


def test_percentage_off_phrase_not_stored_as_code():
    """The `(\\d+%?\\s*off) with code` pattern captures '15% off' — never store that."""
    result = _run_detect("Get 15% off with code below.")
    # count still increments (fine), but the string must not be surfaced as a code
    for c in result["detected_promo_codes"]:
        assert "%" not in c and " " not in c


def test_promo_code_dedup_and_cap():
    # Same code repeated across 12 different phrasings → only ONE entry, uppercase.
    desc = "\n".join([f"use code save20 line {i}" for i in range(12)])
    result = _run_detect(desc)
    assert result["detected_promo_codes"].count("SAVE20") == 1
    # And the payload is capped at 10 unique codes.
    many_codes = " ".join([f"use code CODE{i}A" for i in range(15)])
    result2 = _run_detect(many_codes)
    assert len(result2["detected_promo_codes"]) <= 10


def test_no_codes_when_none_present():
    result = _run_detect("Just a regular vlog with no sponsorship at all.")
    assert result["detected_promo_codes"] == []


def test_stopword_at_checkout_not_captured():
    """'FREE at checkout' shouldn't be captured — FREE isn't a promo code."""
    result = _run_detect("Get FREE at checkout on any order over $50")
    assert "FREE" not in result["detected_promo_codes"]


def test_sponsorship_data_still_backwards_compatible():
    """Adding detected_promo_codes must not break existing fields."""
    result = _run_detect("Sponsored by Notion. Use code MYCODE at checkout.")
    for k in (
        "is_sponsored_active", "detected_brands", "affiliate_link_count",
        "disclosure_count", "promo_code_count", "confidence_score",
        "videos_analyzed", "videos_with_sponsorships", "detected_promo_codes",
    ):
        assert k in result
