"""Unit tests for SaaS Radar core detection logic (no network calls)."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from saas_radar import (  # noqa: E402
    _detect_affiliate_platform,
    _find_affiliate_link_in_html,
    _count_paid_tiers,
    _extract_emails,
    BUCKET_SCORES,
    AFFILIATE_KEYWORDS_RX,
    PRICING_KEYWORDS_RX,
)


def test_bucket_scores_yellow_highest():
    assert BUCKET_SCORES["yellow"] == 100
    assert BUCKET_SCORES["green"] == 80
    assert BUCKET_SCORES["red"] == 10
    assert BUCKET_SCORES["unknown"] == 0
    assert BUCKET_SCORES["yellow"] > BUCKET_SCORES["green"]


def test_detect_affiliate_platform_rewardful():
    html = '<script src="https://cdn.rewardful.com/aff.js"></script>'
    assert _detect_affiliate_platform(html) == "rewardful"


def test_detect_affiliate_platform_firstpromoter():
    html = '<a href="https://example.fprom.co/signup">Join</a>'
    assert _detect_affiliate_platform(html) == "firstpromoter"


def test_detect_affiliate_platform_partnerstack():
    html = '<script src="https://partnerstack.com/embed"></script>'
    assert _detect_affiliate_platform(html) == "partnerstack"


def test_detect_affiliate_platform_none():
    html = '<p>Just a regular landing page.</p>'
    assert _detect_affiliate_platform(html) is None


def test_find_affiliate_link_by_path():
    html = '''<html><body>
        <a href="/affiliates">Become a partner</a>
        <a href="/about">About</a>
    </body></html>'''
    link = _find_affiliate_link_in_html(html, "https://example.com/")
    assert link is not None and "/affiliates" in link
    assert link.startswith("https://example.com")


def test_find_affiliate_link_by_text():
    html = '''<html><body>
        <a href="/x">Affiliate Program</a>
    </body></html>'''
    link = _find_affiliate_link_in_html(html, "https://example.com")
    assert link is not None
    assert "/x" in link


def test_affiliate_keyword_regex_matches():
    assert AFFILIATE_KEYWORDS_RX.search("Join our affiliate program and earn 30% recurring commission")
    assert AFFILIATE_KEYWORDS_RX.search("Become a partner today")
    assert not AFFILIATE_KEYWORDS_RX.search("This is just a homepage with no affiliate info")


def test_pricing_keyword_regex_matches():
    assert PRICING_KEYWORDS_RX.search("$29/mo")
    assert PRICING_KEYWORDS_RX.search("$29 / month")
    assert PRICING_KEYWORDS_RX.search("Starter plan")
    assert PRICING_KEYWORDS_RX.search("billed annually")
    assert not PRICING_KEYWORDS_RX.search("Free to use forever")


def test_count_paid_tiers_three():
    html = "Starter $19/mo, Pro $49/mo, Business $99/mo"
    assert _count_paid_tiers(html) == 3


def test_count_paid_tiers_zero():
    assert _count_paid_tiers("free plan only") == 0


def test_extract_emails_prefers_own_domain():
    html = 'Contact us at hello@realstartup.com or noreply@gmail.com'
    emails = _extract_emails(html, "realstartup.com")
    assert emails[0] == "hello@realstartup.com"
    assert "noreply@gmail.com" not in emails  # noreply is now blacklisted as placeholder


def test_extract_emails_filters_assets():
    html = 'Logo at logo@2x.png, contact founder@startup.io'
    emails = _extract_emails(html, "startup.io")
    assert "founder@startup.io" in emails
    assert not any(".png" in e for e in emails)


def test_extract_emails_filters_sentry():
    html = 'Track at abc123@sentry.io, contact founder@startup.io'
    emails = _extract_emails(html, "startup.io")
    assert all("sentry" not in e for e in emails)
    assert "founder@startup.io" in emails


def test_extract_emails_filters_placeholder_local_parts():
    html = "Email us at jane@startup.io, your@startup.io, name@startup.io, foo@startup.io, founder@startup.io"
    emails = _extract_emails(html, "startup.io")
    assert "founder@startup.io" in emails
    assert "jane@startup.io" not in emails
    assert "your@startup.io" not in emails
    assert "name@startup.io" not in emails
    assert "foo@startup.io" not in emails


def test_extract_emails_filters_placeholder_domains():
    html = "Email us at hello@yourdomain.com, contact@yourcompany.com, real@startup.io, sample@example.com, sales@company.com"
    emails = _extract_emails(html, "startup.io")
    assert "real@startup.io" in emails
    assert all("yourdomain.com" not in e for e in emails)
    assert all("yourcompany.com" not in e for e in emails)
    assert all("example.com" not in e for e in emails)
    assert all("company.com" not in e for e in emails)


def test_extract_emails_filters_normalized_placeholder():
    html = "Email us at jane.doe@startup.io, john_doe@startup.io, first.last@startup.io, founder@startup.io"
    emails = _extract_emails(html, "startup.io")
    assert "founder@startup.io" in emails
    assert "jane.doe@startup.io" not in emails
    assert "john_doe@startup.io" not in emails
    assert "first.last@startup.io" not in emails
