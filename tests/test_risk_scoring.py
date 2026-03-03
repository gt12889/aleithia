"""Tests for WLC risk scoring — ensures backend matches frontend Dashboard.tsx model.

The canonical risk model uses:
  - Logistic (sigmoid) normalization per dimension
  - Weighted Linear Combination (WLC) aggregation
  - 6 dimensions: regulatory (0.25), market (0.20), economic (0.20),
    accessibility (0.15), political (0.10), community (0.10)
  - 0-10 scale (higher = more risk)
"""
import math


def _make_inspection(result: str) -> dict:
    return {"metadata": {"raw_record": {"results": result}}}


def _make_review(rating: float) -> dict:
    return {"metadata": {"rating": rating}}


def test_logistic_midpoint():
    """Logistic function returns 0.5 at the midpoint x0."""
    from modal_app.web import _logistic
    assert abs(_logistic(0.22, 0.22, 8) - 0.5) < 1e-6


def test_logistic_monotonic():
    """Logistic function is monotonically increasing."""
    from modal_app.web import _logistic
    prev = 0
    for x in [0, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0]:
        val = _logistic(x, 0.22, 8)
        assert val >= prev
        prev = val


def test_risk_wlc_no_data_returns_neutral():
    """With no data, risk score should be neutral (5.0)."""
    from modal_app.web import _compute_risk_wlc
    score = _compute_risk_wlc([], [], [], [], [])
    assert score == 5.0


def test_risk_wlc_high_fail_rate_increases_risk():
    """High inspection failure rate should produce elevated risk."""
    from modal_app.web import _compute_risk_wlc

    # 80% fail rate — should be high risk
    inspections = [_make_inspection("Fail")] * 8 + [_make_inspection("Pass")] * 2
    score = _compute_risk_wlc(inspections, [], [], [], [])
    assert score > 7.0, f"80% fail rate should be high risk, got {score}"


def test_risk_wlc_low_fail_rate_lowers_risk():
    """Low inspection failure rate should produce low risk."""
    from modal_app.web import _compute_risk_wlc

    # 5% fail rate — should be low risk
    inspections = [_make_inspection("Fail")] * 1 + [_make_inspection("Pass")] * 19
    score = _compute_risk_wlc(inspections, [], [], [], [])
    assert score < 4.0, f"5% fail rate should be low risk, got {score}"


def test_risk_wlc_many_permits_lowers_risk():
    """Active development (many permits) should reduce risk."""
    from modal_app.web import _compute_risk_wlc

    # 20 permits — active area
    permits = [{}] * 20
    score_many = _compute_risk_wlc([], permits, [], [], [])
    score_few = _compute_risk_wlc([], [{}] * 2, [], [], [])
    assert score_many < score_few, f"More permits should lower risk: {score_many} vs {score_few}"


def test_risk_wlc_many_licenses_increases_risk():
    """High license density (competition) should increase risk."""
    from modal_app.web import _compute_risk_wlc

    score_crowded = _compute_risk_wlc([], [], [{}] * 30, [], [])
    score_sparse = _compute_risk_wlc([], [], [{}] * 3, [], [])
    assert score_crowded > score_sparse, f"More licenses should raise risk: {score_crowded} vs {score_sparse}"


def test_risk_wlc_high_reviews_lowers_risk():
    """High average review ratings should lower market risk."""
    from modal_app.web import _compute_risk_wlc

    good_reviews = [_make_review(4.8)] * 10
    bad_reviews = [_make_review(2.5)] * 10
    score_good = _compute_risk_wlc([], [], [], [], [], good_reviews)
    score_bad = _compute_risk_wlc([], [], [], [], [], bad_reviews)
    assert score_good < score_bad, f"Good reviews should lower risk: {score_good} vs {score_bad}"


def test_risk_wlc_more_news_lowers_risk():
    """More news/community visibility should slightly lower risk."""
    from modal_app.web import _compute_risk_wlc

    score_visible = _compute_risk_wlc([], [], [], [{}] * 15, [])
    score_quiet = _compute_risk_wlc([], [], [], [{}] * 1, [])
    assert score_visible < score_quiet, f"More news should lower risk: {score_visible} vs {score_quiet}"


def test_risk_wlc_legislative_activity_increases_risk():
    """Active legislation creates regulatory uncertainty — higher risk."""
    from modal_app.web import _compute_risk_wlc

    score_active = _compute_risk_wlc([], [], [], [], [{}] * 10)
    score_quiet = _compute_risk_wlc([], [], [], [], [{}] * 1)
    assert score_active > score_quiet, f"More politics should raise risk: {score_active} vs {score_quiet}"


def test_risk_wlc_multi_dimension_integration():
    """Full multi-dimension scenario produces reasonable score."""
    from modal_app.web import _compute_risk_wlc

    inspections = [_make_inspection("Pass")] * 15 + [_make_inspection("Fail")] * 5  # 25% fail
    permits = [{}] * 10
    licenses = [{}] * 12
    news = [{}] * 8
    politics = [{}] * 3
    reviews = [_make_review(4.2)] * 5

    score = _compute_risk_wlc(inspections, permits, licenses, news, politics, reviews)
    # Moderate scenario: ~city-avg fail rate, decent permits, avg competition
    assert 3.0 <= score <= 6.0, f"Moderate scenario should be 3-6, got {score}"


def test_compute_metrics_no_seeded_data():
    """_compute_metrics returns zeros for missing data — no seeded fakes."""
    from modal_app.web import _compute_metrics

    result = _compute_metrics("Test Neighborhood", [], [], [], [], [])
    assert result["active_permits"] == 0
    assert result["news_mentions"] == 0
    assert result["avg_review_rating"] == 0.0
    assert result["review_count"] == 0
    assert result["risk_score"] == 5.0  # neutral when no data


def test_compute_metrics_uses_real_data_only():
    """_compute_metrics returns actual counts, not name-hash seeds."""
    from modal_app.web import _compute_metrics

    inspections = [_make_inspection("Pass")] * 8 + [_make_inspection("Fail")] * 2
    permits = [{}] * 5
    licenses = [{}] * 7
    reviews = [_make_review(4.5), _make_review(3.8)]

    result = _compute_metrics("West Loop", inspections, permits, licenses, [{}] * 3, [{}] * 2, reviews)

    assert result["active_permits"] == 5
    assert result["review_count"] == 2
    assert result["avg_review_rating"] == 4.2  # (4.5+3.8)/2 = 4.15 → rounded to 4.2
    assert result["risk_score"] != 5.0  # Should compute a real score


def test_compute_metrics_consistent_across_neighborhoods():
    """Same inputs should produce same risk score regardless of neighborhood name.

    Previously, seeded fake data based on name hash caused different neighborhoods
    with identical real data to get different scores.
    """
    from modal_app.web import _compute_metrics

    inspections = [_make_inspection("Pass")] * 10
    permits = [{}] * 3
    licenses = [{}] * 5

    r1 = _compute_metrics("West Loop", inspections, permits, licenses, [], [])
    r2 = _compute_metrics("Logan Square", inspections, permits, licenses, [], [])
    r3 = _compute_metrics("Hyde Park", inspections, permits, licenses, [], [])

    assert r1["risk_score"] == r2["risk_score"] == r3["risk_score"]
    assert r1["active_permits"] == r2["active_permits"] == r3["active_permits"] == 3
    assert r1["review_count"] == r2["review_count"] == r3["review_count"] == 0


def test_frontend_backend_parity():
    """Backend WLC should match frontend logistic formula for the same inputs.

    Frontend formula (Dashboard.tsx:90-294):
      logistic(fail_rate, 0.22, 8) for regulatory
      logistic(license_count, 12, 0.25) for market
      1 - logistic(permit_count, 8, 0.3) for economic
      logistic(politics_count, 5, 0.4) for political
      1 - logistic(news_count, 8, 0.3) for community
    """
    from modal_app.web import _logistic, _compute_risk_wlc

    # Manually compute expected score using frontend formula
    fail_rate = 5 / 20  # 25%
    license_count = 15
    permit_count = 10
    politics_count = 4
    news_count = 6

    W = {
        "regulatory": 0.25,
        "market_license": 0.10,  # market * 0.5
        "economic": 0.20,
        "political": 0.10,
        "community": 0.10,
    }

    risks = {
        "regulatory": _logistic(fail_rate, 0.22, 8),
        "market_license": _logistic(license_count, 12, 0.25),
        "economic": 1 - _logistic(permit_count, 8, 0.3),
        "political": _logistic(politics_count, 5, 0.4),
        "community": 1 - _logistic(news_count, 8, 0.3),
    }

    weighted = sum(risks[k] * W[k] for k in W)
    total_w = sum(W.values())
    expected = round((weighted / total_w) * 10, 1)

    # Now compute via backend
    inspections = [_make_inspection("Pass")] * 15 + [_make_inspection("Fail")] * 5
    permits = [{}] * permit_count
    licenses = [{}] * license_count
    news = [{}] * news_count
    politics = [{}] * politics_count

    actual = _compute_risk_wlc(inspections, permits, licenses, news, politics)
    assert actual == expected, f"Backend {actual} != frontend {expected}"
