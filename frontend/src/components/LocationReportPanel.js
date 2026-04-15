"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LocationReportPanel;
var react_1 = require("react");
var insights_ts_1 = require("../insights.ts");
var api_ts_1 = require("../api.ts");
var reportPdf_ts_1 = require("../lib/reportPdf.ts");
// ── Extraction helpers ──────────────────────────────────────────────
function extractAllAdvantages(data, profile) {
    var _a, _b;
    var signals = [];
    var isServiceBusiness = ['Salon', 'Barbershop', 'Gym'].includes(profile.business_type);
    var isFoodBusiness = ['Restaurant', 'Coffee Shop', 'Bar', 'Cafe'].includes(profile.business_type);
    if (isServiceBusiness && data.demographics) {
        var d = data.demographics;
        if (d.total_population && d.total_population > 5000) {
            signals.push({
                title: 'Large resident base',
                detail: "~".concat(Math.round(d.total_population / 1000), "K residents in the neighborhood."),
            });
        }
    }
    var realestate = ((_a = data.realestate) === null || _a === void 0 ? void 0 : _a.length) || 0;
    if (realestate > 3) {
        signals.push({
            title: 'Active real estate market',
            detail: "".concat(realestate, " listings \u2014 area is attracting investment."),
        });
    }
    if (isFoodBusiness) {
        var newsCount = ((_b = data.news) === null || _b === void 0 ? void 0 : _b.length) || 0;
        if (newsCount > 5) {
            signals.push({
                title: 'Local media coverage',
                detail: "".concat(newsCount, " recent news mentions in the area."),
            });
        }
    }
    var uniqueLicenseTypes = new Set(data.licenses.map(function (l) { var _a, _b; return ((_b = (_a = l.metadata) === null || _a === void 0 ? void 0 : _a.raw_record) === null || _b === void 0 ? void 0 : _b.license_description) || ''; }).filter(Boolean));
    if (uniqueLicenseTypes.size > 15) {
        signals.push({
            title: 'Diverse business mix',
            detail: "".concat(uniqueLicenseTypes.size, " different business types \u2014 established commercial corridor."),
        });
    }
    if (data.transit && data.transit.stations_nearby >= 2) {
        signals.push({
            title: 'Strong transit access',
            detail: "".concat(data.transit.stations_nearby, " CTA stations (").concat(data.transit.station_names.slice(0, 3).join(', '), "), ~").concat(Math.round(data.transit.total_daily_riders / 1000), "K daily riders."),
        });
    }
    var reviews = data.reviews || [];
    var ratings = reviews.map(function (r) { var _a; return ((_a = r.metadata) === null || _a === void 0 ? void 0 : _a.rating) || 0; }).filter(function (r) { return r > 0; });
    if (ratings.length >= 3) {
        var avgRating = ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length;
        if (avgRating >= 4.0) {
            signals.push({
                title: 'High review ratings',
                detail: "".concat(avgRating.toFixed(1), "/5 avg across ").concat(ratings.length, " businesses."),
            });
        }
    }
    var insights = (0, insights_ts_1.computeInsights)(data, profile, 'conservative');
    var _loop_1 = function (cat) {
        if (cat.score >= 65 && !signals.some(function (s) { return s.title.toLowerCase().includes(cat.name.toLowerCase()); })) {
            signals.push({
                title: "".concat(cat.name, ": ").concat(cat.score, "/100"),
                detail: cat.claim,
            });
        }
    };
    for (var _i = 0, _c = insights.categories; _i < _c.length; _i++) {
        var cat = _c[_i];
        _loop_1(cat);
    }
    return signals.slice(0, 5);
}
function extractAllRisks(data, profile) {
    var _a, _b, _c;
    var signals = [];
    var isServiceBusiness = ['Salon', 'Barbershop', 'Gym'].includes(profile.business_type);
    var isFoodBusiness = ['Restaurant', 'Coffee Shop', 'Bar', 'Cafe'].includes(profile.business_type);
    if (isServiceBusiness && data.cctv) {
        var cameras = data.cctv.cameras || [];
        var avgPeds = data.cctv.avg_pedestrians || 0;
        if (cameras.length > 0 && avgPeds < 5) {
            signals.push({
                title: 'Low foot traffic',
                detail: "~".concat(Math.round(avgPeds), " pedestrians/observation across ").concat(cameras.length, " cameras."),
            });
        }
    }
    if (isServiceBusiness && ((_a = data.demographics) === null || _a === void 0 ? void 0 : _a.median_household_income)) {
        var income = data.demographics.median_household_income;
        if (income < 30000) {
            signals.push({
                title: 'Low-income area',
                detail: "Median household income ~$".concat(Math.round(income / 1000), "K \u2014 limits premium service demand."),
            });
        }
    }
    if (isFoodBusiness && data.reviews && data.reviews.length > 5) {
        var recentReviews = data.reviews.filter(function (r) {
            var metadata = r.metadata;
            var raw = metadata === null || metadata === void 0 ? void 0 : metadata.raw_record;
            var reviewDate = (raw === null || raw === void 0 ? void 0 : raw.review_date) || (raw === null || raw === void 0 ? void 0 : raw.date);
            if (!reviewDate)
                return false;
            var daysSince = (Date.now() - new Date(reviewDate).getTime()) / (1000 * 60 * 60 * 24);
            return daysSince < 90;
        }).length;
        var recentPct = (recentReviews / data.reviews.length) * 100;
        if (recentPct < 25) {
            signals.push({
                title: 'Declining review activity',
                detail: "Only ".concat(recentReviews, " of ").concat(data.reviews.length, " reviews from the last 90 days."),
            });
        }
    }
    if (data.licenses.length > 30) {
        signals.push({
            title: 'Crowded market',
            detail: "".concat(data.licenses.length, " active business licenses in the area."),
        });
    }
    if (isFoodBusiness && data.inspection_stats.total > 0) {
        var passRate = data.inspection_stats.passed / data.inspection_stats.total;
        if (passRate < 0.6) {
            signals.push({
                title: 'Low inspection pass rate',
                detail: "".concat(Math.round(passRate * 100), "% of ").concat(data.inspection_stats.total, " inspections passed."),
            });
        }
    }
    if (!data.transit || data.transit.stations_nearby === 0) {
        signals.push({
            title: 'No nearby transit',
            detail: 'No CTA L-stations within range. Customers rely on driving or bus.',
        });
    }
    var fedCount = ((_b = data.federal_register) === null || _b === void 0 ? void 0 : _b.length) || 0;
    if (fedCount > 5) {
        signals.push({
            title: 'Federal regulatory pressure',
            detail: "".concat(fedCount, " recent SBA/FDA/OSHA/EPA regulations to review."),
        });
    }
    var reviewCount = ((_c = data.reviews) === null || _c === void 0 ? void 0 : _c.length) || 0;
    if (reviewCount > 0 && reviewCount < 3) {
        signals.push({
            title: 'Sparse review data',
            detail: "Only ".concat(reviewCount, " review(s) \u2014 not enough for reliable market read."),
        });
    }
    var insights = (0, insights_ts_1.computeInsights)(data, profile, 'conservative');
    var _loop_2 = function (cat) {
        if (cat.score < 40 && !signals.some(function (s) { return s.title.toLowerCase().includes(cat.name.toLowerCase()); })) {
            signals.push({
                title: "".concat(cat.name, ": ").concat(cat.score, "/100"),
                detail: cat.claim,
            });
        }
    };
    for (var _i = 0, _d = insights.categories; _i < _d.length; _i++) {
        var cat = _d[_i];
        _loop_2(cat);
    }
    return signals.slice(0, 5);
}
function extractCompetitors(data, profile) {
    var _a;
    var keywords = insights_ts_1.LICENSE_MAP[profile.business_type] || [];
    var seen = new Set();
    var competitors = [];
    var _loop_3 = function (l) {
        var raw = (_a = l.metadata) === null || _a === void 0 ? void 0 : _a.raw_record;
        var name_1 = (raw === null || raw === void 0 ? void 0 : raw.doing_business_as_name) || '';
        var desc = (raw === null || raw === void 0 ? void 0 : raw.license_description) || '';
        if (!name_1 || seen.has(name_1))
            return "continue";
        seen.add(name_1);
        var isDirect = keywords.length > 0
            ? keywords.some(function (kw) { return desc.toLowerCase().includes(kw); })
            : false;
        competitors.push({ name: name_1, type: desc, isDirect: isDirect });
    };
    for (var _i = 0, _b = data.licenses; _i < _b.length; _i++) {
        var l = _b[_i];
        _loop_3(l);
    }
    // Sort: direct competitors first, then alphabetical
    competitors.sort(function (a, b) {
        if (a.isDirect !== b.isDirect)
            return a.isDirect ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return competitors.slice(0, 8);
}
function extractRegulatory(data) {
    var _a;
    var stats = data.inspection_stats;
    var passRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
    // Recent inspections
    var recentInspections = data.inspections
        .slice(0, 5)
        .map(function (i) {
        var _a;
        var raw = (_a = i.metadata) === null || _a === void 0 ? void 0 : _a.raw_record;
        return {
            name: (raw === null || raw === void 0 ? void 0 : raw.dba_name) || i.title || 'Unknown',
            result: (raw === null || raw === void 0 ? void 0 : raw.results) || 'N/A',
        };
    });
    // Permit breakdown by type
    var permitTypes = {};
    for (var _i = 0, _b = data.permits; _i < _b.length; _i++) {
        var p = _b[_i];
        var raw = (_a = p.metadata) === null || _a === void 0 ? void 0 : _a.raw_record;
        var type = (raw === null || raw === void 0 ? void 0 : raw.permit_type) || 'Other';
        permitTypes[type] = (permitTypes[type] || 0) + 1;
    }
    var permitBreakdown = Object.entries(permitTypes)
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, 5)
        .map(function (_a) {
        var type = _a[0], count = _a[1];
        return ({ type: type, count: count });
    });
    // Federal register alerts
    var federalAlerts = (data.federal_register || [])
        .slice(0, 3)
        .map(function (d) {
        var _a;
        return ({
            title: d.title || 'Untitled regulation',
            agency: ((_a = d.metadata) === null || _a === void 0 ? void 0 : _a.agency) || 'Federal',
        });
    });
    return {
        passRate: passRate,
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        recentInspections: recentInspections,
        permitBreakdown: permitBreakdown,
        federalAlerts: federalAlerts,
    };
}
function extractMetrics(data) {
    var _a, _b;
    var stats = data.inspection_stats;
    var reviews = data.reviews || [];
    var ratings = reviews.map(function (r) { var _a; return ((_a = r.metadata) === null || _a === void 0 ? void 0 : _a.rating) || 0; }).filter(function (r) { return r > 0; });
    var avgRating = ratings.length > 0 ? (ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length).toFixed(1) : '—';
    return [
        {
            label: 'Inspection Pass Rate',
            value: stats.total > 0 ? "".concat(Math.round((stats.passed / stats.total) * 100), "%") : '—',
        },
        {
            label: 'Avg Review Rating',
            value: avgRating !== '—' ? "".concat(avgRating, "/5") : '—',
        },
        {
            label: 'Active Permits',
            value: "".concat(data.permit_count),
        },
        {
            label: 'Business Licenses',
            value: "".concat(data.license_count),
        },
        {
            label: 'Transit Score',
            value: data.transit ? "".concat(data.transit.transit_score) : '—',
        },
        {
            label: 'Population',
            value: ((_a = data.demographics) === null || _a === void 0 ? void 0 : _a.total_population)
                ? data.demographics.total_population.toLocaleString()
                : '—',
        },
        {
            label: 'Median Income',
            value: ((_b = data.demographics) === null || _b === void 0 ? void 0 : _b.median_household_income)
                ? "$".concat(Math.round(data.demographics.median_household_income / 1000), "K")
                : '—',
        },
        {
            label: 'Review Count',
            value: "".concat(reviews.length),
        },
    ];
}
function extractSources(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    var raw = [
        ['News', ((_a = data.news) === null || _a === void 0 ? void 0 : _a.length) || 0],
        ['Politics', ((_b = data.politics) === null || _b === void 0 ? void 0 : _b.length) || 0],
        ['Reddit', ((_c = data.reddit) === null || _c === void 0 ? void 0 : _c.length) || 0],
        ['Reviews', ((_d = data.reviews) === null || _d === void 0 ? void 0 : _d.length) || 0],
        ['Real Estate', ((_e = data.realestate) === null || _e === void 0 ? void 0 : _e.length) || 0],
        ['TikTok', ((_f = data.tiktok) === null || _f === void 0 ? void 0 : _f.length) || 0],
        ['Traffic', ((_g = data.traffic) === null || _g === void 0 ? void 0 : _g.length) || 0],
        ['Federal Register', ((_h = data.federal_register) === null || _h === void 0 ? void 0 : _h.length) || 0],
        ['Inspections', ((_j = data.inspections) === null || _j === void 0 ? void 0 : _j.length) || 0],
        ['Permits', ((_k = data.permits) === null || _k === void 0 ? void 0 : _k.length) || 0],
        ['Licenses', ((_l = data.licenses) === null || _l === void 0 ? void 0 : _l.length) || 0],
    ];
    var sources = raw
        .filter(function (_a) {
        var count = _a[1];
        return count > 0;
    })
        .map(function (_a) {
        var name = _a[0], count = _a[1];
        return ({ name: name, count: count });
    });
    var total = sources.reduce(function (sum, s) { return sum + s.count; }, 0);
    return { sources: sources, total: total };
}
function buildExecutiveSummary(insights) {
    var overall = insights.overall;
    var cats = __spreadArray([], insights.categories, true).sort(function (a, b) { return b.score - a.score; });
    var strongest = cats[0];
    var weakest = cats[cats.length - 1];
    var verdict = overall >= 65 ? 'Favorable' : overall >= 40 ? 'Mixed signals' : 'Unfavorable';
    var summary = "".concat(verdict, " \u2014 ").concat(overall, "/100 across ").concat(insights.coverageCount, " categories.");
    if (strongest) {
        summary += " Best signal: ".concat(strongest.name, " (").concat(strongest.score, ")");
        if (weakest && weakest.score < 40) {
            summary += "; weakest: ".concat(weakest.name, " (").concat(weakest.score, ").");
        }
        else {
            summary += '; no major red flags.';
        }
    }
    return summary;
}
// ── Score color helpers ─────────────────────────────────────────────
function scoreColor(score) {
    if (score >= 65)
        return 'text-emerald-400';
    if (score >= 40)
        return 'text-amber-400';
    return 'text-red-400';
}
function scoreBorderColor(score) {
    if (score >= 65)
        return 'border-emerald-500/30';
    if (score >= 40)
        return 'border-amber-500/30';
    return 'border-red-500/30';
}
function scoreBgColor(score) {
    if (score >= 65)
        return 'bg-emerald-500/[0.08]';
    if (score >= 40)
        return 'bg-amber-500/[0.08]';
    return 'bg-red-500/[0.08]';
}
// ── Component ───────────────────────────────────────────────────────
function LocationReportPanel(_a) {
    var profile = _a.profile, neighborhoodData = _a.neighborhoodData, loading = _a.loading, _agentInfo = _a.agentInfo;
    var _b = (0, react_1.useState)([]), socialTrends = _b[0], setSocialTrends = _b[1];
    var _c = (0, react_1.useState)(false), socialLoading = _c[0], setSocialLoading = _c[1];
    var _d = (0, react_1.useState)(null), socialError = _d[0], setSocialError = _d[1];
    (0, react_1.useEffect)(function () {
        if (!profile.neighborhood)
            return;
        var cancelled = false;
        setSocialLoading(true);
        setSocialError(null);
        setSocialTrends([]);
        api_ts_1.api.socialTrends(profile.neighborhood, profile.business_type)
            .then(function (data) {
            if (!cancelled)
                setSocialTrends(data.trends);
        })
            .catch(function (err) {
            if (!cancelled)
                setSocialError(err.message || 'Failed to load social trends');
        })
            .finally(function () {
            if (!cancelled)
                setSocialLoading(false);
        });
        return function () { cancelled = true; };
    }, [profile.neighborhood, profile.business_type]);
    var insights = neighborhoodData
        ? (0, insights_ts_1.computeInsights)(neighborhoodData, profile, 'conservative')
        : null;
    var advantages = neighborhoodData ? extractAllAdvantages(neighborhoodData, profile) : [];
    var risks = neighborhoodData ? extractAllRisks(neighborhoodData, profile) : [];
    var competitors = neighborhoodData ? extractCompetitors(neighborhoodData, profile) : [];
    var regulatory = neighborhoodData ? extractRegulatory(neighborhoodData) : null;
    var metrics = neighborhoodData ? extractMetrics(neighborhoodData) : [];
    var sourcesData = neighborhoodData ? extractSources(neighborhoodData) : { sources: [], total: 0 };
    var handleDownloadPdf = function () {
        if (loading || !insights || !neighborhoodData)
            return;
        (0, reportPdf_ts_1.generateReportPdf)({
            profile: profile,
            insights: insights,
            advantages: advantages,
            risks: risks,
            competitors: competitors,
            regulatory: regulatory,
            metrics: metrics,
            sourcesData: sourcesData,
            neighborhoodData: neighborhoodData,
        });
    };
    return (<section className="h-full flex flex-col border border-white/[0.06] bg-white/[0.02]">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-white/35">Intelligence Brief</p>
          <h3 className="text-sm font-semibold text-white mt-1">{profile.business_type} • {profile.neighborhood}</h3>
        </div>
        <button type="button" onClick={handleDownloadPdf} disabled={loading} className="text-[10px] font-mono uppercase tracking-wider border border-white/20 px-2.5 py-1.5 text-white/75 hover:text-white hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
          Download PDF
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (<div className="text-xs text-white/40 font-mono">Generating intelligence brief from live pipeline signals…</div>) : !neighborhoodData || !insights ? (<div className="text-xs text-white/40 font-mono">Select a neighborhood to generate intelligence brief.</div>) : (<>
            {/* 1. Score Banner */}
            <div className={"border ".concat(scoreBorderColor(insights.overall), " ").concat(scoreBgColor(insights.overall), " p-4 text-center")}>
              <p className={"text-3xl font-bold ".concat(scoreColor(insights.overall))}>{insights.overall}</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/50 mt-1">
                Business Intelligence Score
              </p>
              <p className="text-[10px] text-white/40 mt-0.5">
                {insights.profile} profile • {insights.coverageCount} of 6 categories scored
              </p>
            </div>

            {/* 2. Verdict */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/35 mb-2">Verdict</p>
              <p className="text-[11px] text-white/70 leading-relaxed">
                {buildExecutiveSummary(insights)}
              </p>
            </div>

            {/* 3. Advantages */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-300/70 mb-2">
                Advantages {advantages.length > 0 && <span className="text-white/30">({advantages.length})</span>}
              </p>
              <div className="space-y-2">
                {advantages.length > 0 ? advantages.map(function (item) { return (<div key={item.title} className="border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                    <p className="text-xs font-semibold text-emerald-300">{item.title}</p>
                    <p className="text-[11px] text-white/65 mt-1 leading-relaxed">{item.detail}</p>
                  </div>); }) : (<p className="text-[11px] text-white/40">No clear advantages from available data.</p>)}
              </div>
            </div>

            {/* 4. Risks */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300/70 mb-2">
                Risks {risks.length > 0 && <span className="text-white/30">({risks.length})</span>}
              </p>
              <div className="space-y-2">
                {risks.length > 0 ? risks.map(function (item) { return (<div key={item.title} className="border border-amber-500/20 bg-amber-500/[0.05] p-3">
                    <p className="text-xs font-semibold text-amber-200">{item.title}</p>
                    <p className="text-[11px] text-white/65 mt-1 leading-relaxed">{item.detail}</p>
                  </div>); }) : (<p className="text-[11px] text-white/40">No major risks identified.</p>)}
              </div>
            </div>

            {/* 5. Social Media Trends */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-300/70 mb-2">
                Social Media Trends
              </p>
              <div className="space-y-2">
                {socialLoading ? (<p className="text-[11px] text-cyan-300/50 animate-pulse">Analyzing social signals…</p>) : socialError ? (<p className="text-[11px] text-red-400/70">{socialError}</p>) : socialTrends.length > 0 ? socialTrends.map(function (trend) { return (<div key={trend.title} className="border border-cyan-500/20 bg-cyan-500/[0.05] p-3">
                    <p className="text-xs font-semibold text-cyan-300">{trend.title}</p>
                    <p className="text-[11px] text-white/65 mt-1 leading-relaxed">{trend.detail}</p>
                  </div>); }) : (<p className="text-[11px] text-white/40">No social media data available for this neighborhood.</p>)}
              </div>
            </div>

            {/* 6. Competitive Landscape */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-blue-300/70 mb-2">
                Competitive Landscape {competitors.length > 0 && <span className="text-white/30">({competitors.length})</span>}
              </p>
              {competitors.length > 0 ? (<div className="space-y-1">
                  {competitors.map(function (c) { return (<div key={c.name} className="flex items-start gap-2 text-[11px]">
                      <span className={"mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ".concat(c.isDirect ? 'bg-red-400' : 'bg-white/20')}/>
                      <div>
                        <span className="text-white/80">{c.name}</span>
                        <span className="text-white/35 ml-1.5">{c.type}</span>
                        {c.isDirect && <span className="text-red-400/80 ml-1.5 text-[9px] font-mono uppercase">Direct</span>}
                      </div>
                    </div>); })}
                </div>) : (<p className="text-[11px] text-white/40 italic">No competitor data available.</p>)}
            </div>

            {/* 7. Regulatory Checklist */}
            {regulatory && (<div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-violet-300/70 mb-2">Regulatory Checklist</p>
                <div className="space-y-3">
                  {/* Inspection pass rate */}
                  <div className="border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Inspections</p>
                    {regulatory.total > 0 ? (<p className="text-sm font-semibold text-white/90">
                        {regulatory.passRate}% pass rate
                        <span className="text-[10px] text-white/40 font-normal ml-2">
                          ({regulatory.passed}/{regulatory.total} passed, {regulatory.failed} failed)
                        </span>
                      </p>) : (<p className="text-[11px] text-white/40">No inspection data available.</p>)}
                    {regulatory.recentInspections.length > 0 && (<div className="mt-2 space-y-1">
                        {regulatory.recentInspections.map(function (i, idx) { return (<div key={idx} className="flex justify-between text-[10px]">
                            <span className="text-white/60 truncate mr-2">{i.name}</span>
                            <span className={"shrink-0 font-mono ".concat(i.result.toLowerCase().includes('pass') ? 'text-emerald-400/70' : i.result.toLowerCase().includes('fail') ? 'text-red-400/70' : 'text-white/40')}>
                              {i.result}
                            </span>
                          </div>); })}
                      </div>)}
                  </div>

                  {/* Permits by type */}
                  {regulatory.permitBreakdown.length > 0 && (<div className="border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Permits by Type</p>
                      <div className="space-y-1">
                        {regulatory.permitBreakdown.map(function (p) { return (<div key={p.type} className="flex justify-between text-[10px]">
                            <span className="text-white/60">{p.type}</span>
                            <span className="text-white/40 font-mono">{p.count}</span>
                          </div>); })}
                      </div>
                    </div>)}

                  {/* Federal alerts */}
                  {regulatory.federalAlerts.length > 0 && (<div className="border border-red-500/10 bg-red-500/[0.03] p-3">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-red-300/60 mb-1">Federal Regulation Alerts</p>
                      <div className="space-y-1.5">
                        {regulatory.federalAlerts.map(function (a, idx) { return (<div key={idx} className="text-[10px]">
                            <p className="text-white/70">{a.title}</p>
                            <p className="text-white/30">{a.agency}</p>
                          </div>); })}
                      </div>
                    </div>)}
                </div>
              </div>)}

            {/* 7. Key Metrics Grid */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/35 mb-2">Key Metrics</p>
              <div className="grid grid-cols-2 gap-2">
                {metrics.map(function (m) { return (<div key={m.label} className="border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="text-[10px] text-white/40 font-mono truncate">{m.label}</p>
                    <p className="text-sm font-semibold text-white/90 mt-0.5">{m.value}</p>
                  </div>); })}
              </div>
            </div>

            {/* 8. Data Sources */}
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] font-mono text-white/25">
                {sourcesData.total} documents analyzed across {sourcesData.sources.length} sources
              </p>
            </div>
          </>)}
      </div>
    </section>);
}
