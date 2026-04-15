"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LICENSE_MAP = void 0;
exports.computeInsights = computeInsights;
var WEIGHTS = {
    conservative: {
        regulatory: 0.25, economic: 0.10, market: 0.15,
        demographic: 0.15, safety: 0.25, community: 0.10,
    },
    growth: {
        regulatory: 0.10, economic: 0.25, market: 0.25,
        demographic: 0.10, safety: 0.10, community: 0.20,
    },
    budget: {
        regulatory: 0.15, economic: 0.15, market: 0.15,
        demographic: 0.25, safety: 0.10, community: 0.20,
    },
};
exports.LICENSE_MAP = {
    'Restaurant': ['retail food', 'restaurant', 'tavern', 'caterer'],
    'Coffee Shop': ['retail food', 'coffee'],
    'Bar / Nightlife': ['tavern', 'liquor', 'late night'],
    'Retail Store': ['retail', 'general retail'],
    'Salon / Barbershop': ['beauty', 'barber', 'nail'],
    'Grocery / Convenience': ['retail food', 'grocery', 'convenience'],
    'Fitness Studio': ['health club', 'fitness', 'gym'],
    'Professional Services': ['professional', 'consulting', 'office'],
    'Food Truck': ['mobile food', 'food truck', 'peddler'],
    'Bakery': ['retail food', 'bakery'],
};
function signal(score) {
    if (score >= 65)
        return { signal: 'positive', signalLabel: 'FAVORABLE' };
    if (score >= 40)
        return { signal: 'neutral', signalLabel: 'MODERATE' };
    return { signal: 'negative', signalLabel: 'CONCERNING' };
}
function avg(values) {
    if (values.length === 0)
        return 0;
    return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
}
function clamp(v, lo, hi) {
    if (lo === void 0) { lo = 0; }
    if (hi === void 0) { hi = 100; }
    return Math.max(lo, Math.min(hi, v));
}
// ── Category Scorers ───────────────────────────────────────────────
function scoreRegulatory(data) {
    var stats = data.inspection_stats;
    if (stats.total === 0 && data.inspections.length === 0)
        return null;
    var subs = [];
    var dataPoints = stats.total;
    if (stats.total > 0) {
        var passRate_1 = (stats.passed / stats.total) * 100;
        subs.push({ name: 'Pass Rate', value: passRate_1, raw: "".concat(stats.passed, " of ").concat(stats.total, " passed (").concat(Math.round(passRate_1), "%)") });
    }
    // Risk level from inspections
    var riskValues = data.inspections
        .map(function (i) { var _a, _b; return (_b = (_a = i.metadata) === null || _a === void 0 ? void 0 : _a.raw_record) === null || _b === void 0 ? void 0 : _b.risk; })
        .filter(Boolean)
        .map(function (r) {
        var s = r.toLowerCase();
        if (s.includes('1') || s.includes('high'))
            return 0;
        if (s.includes('2') || s.includes('medium'))
            return 50;
        return 100;
    });
    if (riskValues.length > 0) {
        var avgRisk = avg(riskValues);
        var highCount = riskValues.filter(function (v) { return v === 0; }).length;
        subs.push({ name: 'Facility Risk Rating', value: avgRisk, raw: "".concat(highCount, " high-risk of ").concat(riskValues.length, " facilities") });
    }
    // Violation density
    var violationLengths = data.inspections
        .map(function (i) { var _a, _b, _c; return ((_c = (_b = (_a = i.metadata) === null || _a === void 0 ? void 0 : _a.raw_record) === null || _b === void 0 ? void 0 : _b.violations) === null || _c === void 0 ? void 0 : _c.length) || 0; })
        .filter(function (v) { return v > 0; });
    if (violationLengths.length > 0) {
        var avgLen = avg(violationLengths);
        var score_1 = clamp(100 - avgLen / 10);
        subs.push({ name: 'Violation Severity', value: score_1, raw: "".concat(violationLengths.length, " violations found") });
    }
    if (subs.length === 0)
        return null;
    var score = Math.round(avg(subs.map(function (s) { return s.value; })));
    var _a = signal(score), sig = _a.signal, signalLabel = _a.signalLabel;
    var passRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
    var highRisk = riskValues.filter(function (v) { return v === 0; }).length;
    return {
        id: 'regulatory', name: 'Regulatory',
        score: score,
        subMetrics: subs,
        claim: "".concat(passRate, "% pass rate across ").concat(stats.total, " inspections, ").concat(highRisk, " high-risk facilities \u2014 ").concat(signalLabel, " regulatory environment"),
        signal: sig,
        signalLabel: signalLabel,
        sources: ['food_inspections'],
        dataPoints: dataPoints,
    };
}
function scoreEconomic(data) {
    var subs = [];
    var permitCount = data.permit_count;
    var licenseCount = data.license_count;
    if (permitCount === 0 && licenseCount === 0)
        return null;
    if (permitCount > 0) {
        var momentum = clamp((permitCount / 15) * 100);
        subs.push({ name: 'Permit Activity', value: momentum, raw: "".concat(permitCount, " active permits") });
    }
    // Investment signal from fees
    var fees = data.permits
        .map(function (p) { var _a, _b; return parseFloat(((_b = (_a = p.metadata) === null || _a === void 0 ? void 0 : _a.raw_record) === null || _b === void 0 ? void 0 : _b.building_fee_paid) || '0'); })
        .filter(function (f) { return f > 0; });
    if (fees.length > 0) {
        var totalFees_1 = fees.reduce(function (a, b) { return a + b; }, 0);
        var investScore = clamp(totalFees_1 / 1000);
        subs.push({ name: 'Construction Investment', value: investScore, raw: "$".concat(Math.round(totalFees_1).toLocaleString(), " in fees paid") });
    }
    // New construction ratio
    if (data.permits.length > 0) {
        var newBuilds_1 = data.permits.filter(function (p) {
            var _a, _b;
            var wt = (((_b = (_a = p.metadata) === null || _a === void 0 ? void 0 : _a.raw_record) === null || _b === void 0 ? void 0 : _b.work_type) || '').toLowerCase();
            return wt.includes('new') || wt.includes('addition');
        }).length;
        var ratio = (newBuilds_1 / data.permits.length) * 100;
        subs.push({ name: 'New Construction', value: ratio, raw: "".concat(newBuilds_1, " of ").concat(data.permits.length, " are new/addition") });
    }
    if (licenseCount > 0) {
        var density = clamp(licenseCount * 4);
        subs.push({ name: 'Active Licenses', value: density, raw: "".concat(licenseCount, " active licenses") });
    }
    if (subs.length === 0)
        return null;
    var score = Math.round(avg(subs.map(function (s) { return s.value; })));
    var _a = signal(score), sig = _a.signal, signalLabel = _a.signalLabel;
    var totalFees = fees.length > 0 ? fees.reduce(function (a, b) { return a + b; }, 0) : 0;
    var newBuilds = data.permits.filter(function (p) {
        var _a, _b;
        var wt = (((_b = (_a = p.metadata) === null || _a === void 0 ? void 0 : _a.raw_record) === null || _b === void 0 ? void 0 : _b.work_type) || '').toLowerCase();
        return wt.includes('new') || wt.includes('addition');
    }).length;
    return {
        id: 'economic', name: 'Development Activity',
        score: score,
        subMetrics: subs,
        claim: "".concat(permitCount, " active permits, $").concat(Math.round(totalFees / 1000), "K invested, ").concat(newBuilds, " new builds \u2014 ").concat(signalLabel, " development activity"),
        signal: sig,
        signalLabel: signalLabel,
        sources: ['building_permits', 'business_licenses'],
        dataPoints: permitCount + licenseCount,
    };
}
function scoreMarket(data, profile, streetscape) {
    var _a;
    var reviews = data.reviews || [];
    var subs = [];
    var ratings = reviews
        .map(function (r) { var _a; return ((_a = r.metadata) === null || _a === void 0 ? void 0 : _a.rating) || 0; })
        .filter(function (r) { return r > 0; });
    if (ratings.length > 0) {
        var avgRating_1 = avg(ratings);
        subs.push({ name: 'Avg Rating', value: (avgRating_1 / 5) * 100, raw: "".concat(avgRating_1.toFixed(1), "/5 across ").concat(ratings.length, " businesses") });
    }
    // Review velocity
    var velocities = reviews
        .map(function (r) { var _a; return (_a = r.metadata) === null || _a === void 0 ? void 0 : _a.velocity_label; })
        .filter(Boolean)
        .map(function (v) {
        if (v === 'high')
            return 100;
        if (v === 'medium' || v === 'med')
            return 50;
        return 20;
    });
    if (velocities.length > 0) {
        subs.push({ name: 'Review Activity', value: avg(velocities), raw: "".concat(velocities.length, " businesses tracked") });
    }
    // Competitor saturation
    var keywords = exports.LICENSE_MAP[profile.business_type] || [];
    var matchingLicenses = keywords.length > 0
        ? data.licenses.filter(function (l) {
            var _a, _b;
            var desc = (((_b = (_a = l.metadata) === null || _a === void 0 ? void 0 : _a.raw_record) === null || _b === void 0 ? void 0 : _b.license_description) || '').toLowerCase();
            return keywords.some(function (kw) { return desc.includes(kw); });
        }).length
        : data.licenses.length;
    var saturation = clamp(100 - matchingLicenses * 8);
    subs.push({ name: 'Competition Level', value: saturation, raw: "".concat(matchingLicenses, " direct competitors") });
    // Review volume
    var reviewCount = (((_a = data.metrics) === null || _a === void 0 ? void 0 : _a.review_count) || reviews.length);
    if (reviewCount > 0) {
        subs.push({ name: 'Review Volume', value: clamp(reviewCount / 5), raw: "".concat(reviewCount, " total reviews") });
    }
    // Space Availability from streetscape vision data
    if (streetscape === null || streetscape === void 0 ? void 0 : streetscape.counts) {
        var total = streetscape.counts.storefront_open + streetscape.counts.storefront_closed + streetscape.counts.for_lease_sign;
        if (total > 0) {
            var vacancyRate = (streetscape.counts.for_lease_sign + streetscape.counts.storefront_closed) / total;
            // Moderate vacancy (15-40%) is best for new entrants; too low = no space, too high = bad area
            var availability = vacancyRate > 0.4 ? clamp(30) : vacancyRate > 0.15 ? clamp(75) : clamp(40);
            subs.push({ name: 'Space Availability', value: availability, raw: "".concat(streetscape.counts.for_lease_sign, " for-lease, ").concat(total, " total storefronts") });
        }
    }
    if (subs.length === 0)
        return null;
    var score = Math.round(avg(subs.map(function (s) { return s.value; })));
    var _b = signal(score), sig = _b.signal, signalLabel = _b.signalLabel;
    var avgRating = ratings.length > 0 ? avg(ratings).toFixed(1) : '—';
    return {
        id: 'market', name: 'Market',
        score: score,
        subMetrics: subs,
        claim: "Avg ".concat(avgRating, "/5 stars across ").concat(ratings.length, " businesses, ").concat(matchingLicenses, " direct competitors \u2014 ").concat(signalLabel, " market conditions"),
        signal: sig,
        signalLabel: signalLabel,
        sources: ['reviews', 'business_licenses'],
        dataPoints: reviews.length + data.licenses.length,
    };
}
function scoreDemographic(data) {
    var d = data.demographics;
    if (!d)
        return null;
    var subs = [];
    if (d.median_gross_rent && d.median_household_income) {
        var rentBurden = (d.median_gross_rent * 12) / d.median_household_income * 100;
        var affordability = clamp((1 - (rentBurden - 20) / 25) * 100);
        subs.push({ name: 'Affordability', value: affordability, raw: "$".concat(d.median_gross_rent.toLocaleString(), "/mo rent vs $").concat(Math.round(d.median_household_income / 1000), "K income (").concat(Math.round(rentBurden), "% burden)") });
    }
    if (d.unemployment_rate !== undefined) {
        var employment = clamp(100 - d.unemployment_rate * 5);
        subs.push({ name: 'Employment', value: employment, raw: "".concat(d.unemployment_rate.toFixed(1), "% unemployment") });
    }
    if (d.bachelors_degree !== undefined || d.masters_degree !== undefined) {
        var bPct = d.bachelors_degree || 0;
        var mPct = d.masters_degree || 0;
        var education = clamp((bPct + mPct) * 2);
        subs.push({ name: 'Education', value: education, raw: "".concat(bPct.toFixed(0), "% bachelor's, ").concat(mPct.toFixed(0), "% master's") });
    }
    if (d.total_population) {
        var popSignal = clamp(d.total_population / 500);
        subs.push({ name: 'Population Size', value: popSignal, raw: "".concat(d.total_population.toLocaleString(), " residents") });
    }
    if (subs.length === 0)
        return null;
    var score = Math.round(avg(subs.map(function (s) { return s.value; })));
    var _a = signal(score), sig = _a.signal, signalLabel = _a.signalLabel;
    var rent = d.median_gross_rent ? "$".concat(d.median_gross_rent.toLocaleString()) : '—';
    var income = d.median_household_income ? "$".concat(Math.round(d.median_household_income / 1000), "K") : '—';
    var burden = d.median_gross_rent && d.median_household_income
        ? "".concat(Math.round((d.median_gross_rent * 12) / d.median_household_income * 100), "%")
        : '—';
    return {
        id: 'demographic', name: 'Demographic',
        score: score,
        subMetrics: subs,
        claim: "Rent ".concat(rent, "/mo vs ").concat(income, " income (").concat(burden, " burden) \u2014 ").concat(signalLabel, " affordability"),
        signal: sig,
        signalLabel: signalLabel,
        sources: ['demographics'], dataPoints: 1,
    };
}
var WALKIN_WEIGHT = {
    'Coffee Shop': 1.0,
    'Retail Store': 0.95,
    'Restaurant': 0.9,
    'Bar': 0.85,
    'Salon': 0.8,
    'Professional Services': 0.3,
    'Warehouse': 0.1,
};
function scoreSafety(data, profile) {
    var _a, _b, _c;
    var subs = [];
    var dataPoints = 0;
    // CCTV highway traffic (IDOT expressway cameras — not street-level)
    if (data.cctv && data.cctv.cameras.length > 0) {
        var densityMap = { low: 25, medium: 60, high: 100 };
        var activity = (_a = densityMap[data.cctv.density]) !== null && _a !== void 0 ? _a : 50;
        subs.push({ name: 'Highway Traffic Volume', value: activity, raw: "".concat(data.cctv.density, " density from ").concat(data.cctv.cameras.length, " IDOT cameras") });
        var vehScore = clamp((data.cctv.avg_vehicles / 100) * 100);
        subs.push({ name: 'Avg Highway Vehicles', value: vehScore, raw: "~".concat(Math.round(data.cctv.avg_vehicles), " avg vehicles") });
        dataPoints += data.cctv.cameras.length;
    }
    // Traffic congestion
    var traffic = data.traffic || [];
    if (traffic.length > 0) {
        var congestionValues = traffic
            .map(function (t) {
            var _a;
            var level = (((_a = t.metadata) === null || _a === void 0 ? void 0 : _a.congestion_level) || '').toLowerCase();
            if (level.includes('free'))
                return 100;
            if (level.includes('moderate'))
                return 66;
            if (level.includes('heavy'))
                return 33;
            if (level.includes('blocked'))
                return 0;
            return 66;
        });
        subs.push({ name: 'Road Congestion', value: avg(congestionValues), raw: "".concat(traffic.length, " traffic zones monitored") });
        dataPoints += traffic.length;
    }
    // Walk-In Potential from CTA transit ridership (not highway cameras)
    if (data.transit && data.transit.stations_nearby > 0) {
        var weight = (_b = WALKIN_WEIGHT[profile.business_type]) !== null && _b !== void 0 ? _b : 0.5;
        var walkinScore = Math.round(data.transit.transit_score * weight);
        var stationList = data.transit.station_names.slice(0, 3).join(', ');
        var ridersLabel = data.transit.total_daily_riders > 0
            ? "~".concat(Math.round(data.transit.total_daily_riders / 1000), "K daily riders")
            : "".concat(data.transit.stations_nearby, " stations nearby");
        subs.push({
            name: 'Walk-In Potential',
            value: walkinScore,
            raw: "".concat(data.transit.stations_nearby, " CTA stations (").concat(stationList, "), ").concat(ridersLabel, ", ").concat(profile.business_type, " weight ").concat(weight),
        });
        dataPoints += data.transit.stations_nearby;
    }
    if (subs.length === 0)
        return null;
    var score = Math.round(avg(subs.map(function (s) { return s.value; })));
    var _d = signal(score), sig = _d.signal, signalLabel = _d.signalLabel;
    var vehicleFlow = data.cctv ? "~".concat(Math.round(data.cctv.avg_vehicles), " vehicles") : 'no data';
    var peakClaim = ((_c = data.cctv) === null || _c === void 0 ? void 0 : _c.peak_hour) != null ? ", peak ~".concat(data.cctv.peak_hour, ":00") : '';
    var transitClaim = data.transit && data.transit.stations_nearby > 0
        ? ", ".concat(data.transit.stations_nearby, " CTA stations")
        : '';
    return {
        id: 'safety', name: 'Traffic & Accessibility',
        score: score,
        subMetrics: subs,
        claim: "".concat(vehicleFlow).concat(peakClaim).concat(transitClaim, " \u2014 ").concat(signalLabel, " accessibility"),
        signal: sig,
        signalLabel: signalLabel,
        sources: ['cctv', 'traffic', 'transit'],
        dataPoints: dataPoints,
    };
}
function scoreCommunity(data) {
    var _a, _b;
    var newsCount = data.news.length;
    var politicsCount = data.politics.length;
    var redditCount = ((_a = data.reddit) === null || _a === void 0 ? void 0 : _a.length) || 0;
    var tiktokCount = ((_b = data.tiktok) === null || _b === void 0 ? void 0 : _b.length) || 0;
    var totalMentions = newsCount + politicsCount + redditCount + tiktokCount;
    if (totalMentions === 0)
        return null;
    var subs = [];
    if (newsCount > 0) {
        subs.push({ name: 'News Coverage', value: clamp(newsCount * 8), raw: "".concat(newsCount, " articles") });
    }
    if (politicsCount > 0) {
        subs.push({ name: 'Political Activity', value: clamp(politicsCount * 10), raw: "".concat(politicsCount, " legislative items") });
    }
    if (redditCount + tiktokCount > 0) {
        subs.push({ name: 'Social Engagement', value: clamp((redditCount + tiktokCount) * 10), raw: "".concat(redditCount, " reddit + ").concat(tiktokCount, " tiktok") });
    }
    subs.push({ name: 'Total Mentions', value: clamp((totalMentions / 20) * 100), raw: "".concat(totalMentions, " total mentions") });
    var score = Math.round(avg(subs.map(function (s) { return s.value; })));
    var _c = signal(score), sig = _c.signal, signalLabel = _c.signalLabel;
    var socialPart = redditCount + tiktokCount > 0
        ? ", ".concat(redditCount + tiktokCount, " social posts")
        : ', no social';
    return {
        id: 'community', name: 'Community',
        score: score,
        subMetrics: subs,
        claim: "".concat(newsCount, " news mentions").concat(socialPart, " \u2014 ").concat(score < 40 ? 'QUIET' : signalLabel, " neighborhood"),
        signal: sig,
        signalLabel: signalLabel,
        sources: ['news', 'politics', 'reddit', 'tiktok'].filter(function (_, i) {
            return [newsCount, politicsCount, redditCount, tiktokCount][i] > 0;
        }),
        dataPoints: totalMentions,
    };
}
// ── WLS Composite ──────────────────────────────────────────────────
function computeWLS(categories, profile) {
    var weights = WEIGHTS[profile];
    var weightedSum = 0;
    var totalWeight = 0;
    for (var _i = 0, categories_1 = categories; _i < categories_1.length; _i++) {
        var cat = categories_1[_i];
        var w = weights[cat.id] || 0;
        weightedSum += cat.score * w;
        totalWeight += w;
    }
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}
// ── Public API ─────────────────────────────────────────────────────
function computeInsights(data, profile, riskProfile, streetscape) {
    var scorers = [
        scoreRegulatory(data),
        scoreEconomic(data),
        scoreMarket(data, profile, streetscape),
        scoreDemographic(data),
        scoreSafety(data, profile),
        scoreCommunity(data),
    ];
    var categories = scorers.filter(function (c) { return c !== null; });
    var overall = computeWLS(categories, riskProfile);
    return {
        categories: categories,
        overall: overall,
        profile: riskProfile,
        coverageCount: categories.length,
        computedAt: new Date().toISOString(),
    };
}
