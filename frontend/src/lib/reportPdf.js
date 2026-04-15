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
exports.generateReportPdf = generateReportPdf;
var jspdf_1 = require("jspdf");
function generateReportPdf(_a) {
    var _b, _c, _d, _e;
    var profile = _a.profile, insights = _a.insights, advantages = _a.advantages, risks = _a.risks, competitors = _a.competitors, regulatory = _a.regulatory, metrics = _a.metrics, sourcesData = _a.sourcesData, neighborhoodData = _a.neighborhoodData;
    var doc = new jspdf_1.jsPDF({ unit: 'pt', format: 'letter' });
    var marginX = 72; // 1 inch margins
    var topMargin = 72;
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var contentWidth = pageWidth - marginX * 2;
    var y = topMargin;
    var dateLabel = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    // Generate reference number: ALT-{NEIGHBORHOOD_4CHARS}-{HASH}
    var nbrCode = profile.neighborhood.replace(/\s/g, '').substring(0, 4).toUpperCase();
    var hashSrc = "".concat(profile.neighborhood, "-").concat(profile.business_type, "-").concat(Date.now());
    var hash = 0;
    for (var i = 0; i < hashSrc.length; i++)
        hash = ((hash << 5) - hash + hashSrc.charCodeAt(i)) | 0;
    var refNumber = "ALT-".concat(nbrCode, "-").concat(Math.abs(hash).toString(16).substring(0, 6).toUpperCase());
    var addPageHeader = function () {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(180, 40, 40);
        doc.text('CONFIDENTIAL', marginX, 36);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text(refNumber, pageWidth - marginX, 36, { align: 'right' });
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.5);
        doc.line(marginX, 42, pageWidth - marginX, 42);
        doc.setTextColor(0, 0, 0);
    };
    var addFooterFinal = function (page, total) {
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.5);
        doc.line(marginX, pageHeight - 40, pageWidth - marginX, pageHeight - 40);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text('Confidential \u2014 Prepared by Aleithia Intelligence Platform', marginX, pageHeight - 28);
        doc.text("Page ".concat(page, " of ").concat(total), pageWidth - marginX, pageHeight - 28, { align: 'right' });
        doc.setTextColor(0, 0, 0);
    };
    var newPage = function () {
        doc.addPage();
        y = topMargin;
        addPageHeader();
    };
    var ensureSpace = function (minHeight) {
        if (minHeight === void 0) { minHeight = 30; }
        if (y + minHeight > pageHeight - 56) {
            newPage();
        }
    };
    var addSection = function (num, title) {
        ensureSpace(44);
        doc.setDrawColor(40, 40, 40);
        doc.setLineWidth(1.5);
        doc.line(marginX, y, marginX + contentWidth, y);
        y += 14;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("SECTION ".concat(num), marginX, y);
        y += 16;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text(title, marginX, y);
        doc.setTextColor(0, 0, 0);
        y += 22;
    };
    var addSubheading = function (text) {
        ensureSpace(22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(text, marginX, y);
        doc.setTextColor(0, 0, 0);
        y += 14;
    };
    var addParagraph = function (text, size) {
        if (size === void 0) { size = 9.5; }
        var lineHeight = size * 1.5;
        var lines = doc.splitTextToSize(text, contentWidth);
        ensureSpace(lines.length * lineHeight + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(size);
        doc.setTextColor(40, 40, 40);
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            doc.text(line, marginX, y);
            y += lineHeight;
        }
        y += 6;
        doc.setTextColor(0, 0, 0);
    };
    var addBullet = function (text) {
        var colonIdx = text.indexOf(': ');
        var label = colonIdx > 0 ? text.substring(0, colonIdx) : '';
        var detail = colonIdx > 0 ? text.substring(colonIdx + 2) : text;
        var display = label ? "".concat(label, " \u2014 ").concat(detail) : text;
        var wrapped = doc.splitTextToSize(display, contentWidth - 14);
        ensureSpace(wrapped.length * 13 + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
        doc.text('\u2022', marginX, y);
        doc.text(wrapped, marginX + 12, y);
        y += wrapped.length * 13 + 4;
        doc.setTextColor(0, 0, 0);
    };
    var addMetricRow = function (label, value) {
        ensureSpace(16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
        doc.text(label, marginX + 12, y);
        doc.setFont('helvetica', 'bold');
        doc.text(value, marginX + contentWidth - 10, y, { align: 'right' });
        doc.setDrawColor(221, 221, 221);
        doc.setLineWidth(0.3);
        doc.line(marginX + 12, y + 4, marginX + contentWidth - 10, y + 4);
        doc.setTextColor(0, 0, 0);
        y += 16;
    };
    var addTable = function (headers, rows, colWidths) {
        var rowHeight = 18;
        var headerHeight = 20;
        var fontSize = 8.5;
        var totalRows = rows.length + 1;
        var tableHeight = headerHeight + rows.length * rowHeight;
        ensureSpace(Math.min(tableHeight, headerHeight + rowHeight * 3));
        var colX = [marginX];
        for (var i = 1; i < colWidths.length; i++) {
            colX.push(colX[i - 1] + colWidths[i - 1]);
        }
        var tableWidth = colWidths.reduce(function (a, b) { return a + b; }, 0);
        doc.setFillColor(240, 240, 240);
        doc.rect(marginX, y, tableWidth, headerHeight, 'F');
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.5);
        doc.rect(marginX, y, tableWidth, headerHeight, 'S');
        for (var c = 1; c < colWidths.length; c++) {
            doc.line(colX[c], y, colX[c], y + headerHeight);
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fontSize);
        doc.setTextColor(40, 40, 40);
        for (var c = 0; c < headers.length; c++) {
            doc.text(headers[c], colX[c] + 6, y + 13);
        }
        y += headerHeight;
        for (var r = 0; r < rows.length; r++) {
            ensureSpace(rowHeight + 4);
            if (r % 2 === 1) {
                doc.setFillColor(248, 248, 248);
                doc.rect(marginX, y, tableWidth, rowHeight, 'F');
            }
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.rect(marginX, y, tableWidth, rowHeight, 'S');
            for (var c = 1; c < colWidths.length; c++) {
                doc.line(colX[c], y, colX[c], y + rowHeight);
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(fontSize);
            doc.setTextColor(40, 40, 40);
            for (var c = 0; c < rows[r].length; c++) {
                var cellText = rows[r][c];
                var maxCellWidth = colWidths[c] - 12;
                var truncated = doc.splitTextToSize(cellText, maxCellWidth)[0] || '';
                doc.text(truncated, colX[c] + 6, y + 12);
            }
            y += rowHeight;
        }
        void totalRows;
        y += 8;
        doc.setTextColor(0, 0, 0);
    };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(180, 40, 40);
    doc.text('CONFIDENTIAL', pageWidth / 2, 72, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y = 88;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(2);
    doc.line(marginX, y, pageWidth - marginX, y);
    doc.setLineWidth(0.5);
    doc.line(marginX, y + 5, pageWidth - marginX, y + 5);
    y = 180;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('Location Intelligence', pageWidth / 2, y, { align: 'center' });
    y += 28;
    doc.text('Assessment Report', pageWidth / 2, y, { align: 'center' });
    y += 24;
    var ruleLen = 140;
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - ruleLen / 2, y, pageWidth / 2 + ruleLen / 2, y);
    y += 28;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text("".concat(profile.business_type, " \u2014 ").concat(profile.neighborhood, ", Chicago, IL"), pageWidth / 2, y, { align: 'center' });
    y += 52;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(48);
    doc.setTextColor(40, 40, 40);
    doc.text("".concat(insights.overall), pageWidth / 2, y, { align: 'center' });
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('BUSINESS INTELLIGENCE SCORE (0\u2013100)', pageWidth / 2, y, { align: 'center' });
    y += 56;
    var leftCol = marginX + 40;
    var rightCol = pageWidth / 2 + 40;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text('PREPARED BY', leftCol, y);
    doc.text('DATE', rightCol, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text('Aleithia Intelligence Platform', leftCol, y);
    doc.text(dateLabel, rightCol, y);
    y += 24;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text('REFERENCE', leftCol, y);
    doc.text('RISK PROFILE', rightCol, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(refNumber, leftCol, y);
    doc.text(insights.profile.charAt(0).toUpperCase() + insights.profile.slice(1), rightCol, y);
    var bottomRuleY = pageHeight - 100;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.5);
    doc.line(marginX, bottomRuleY, pageWidth - marginX, bottomRuleY);
    doc.setLineWidth(2);
    doc.line(marginX, bottomRuleY + 5, pageWidth - marginX, bottomRuleY + 5);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    var noticeLines = doc.splitTextToSize('This document contains proprietary analysis and is intended solely for the use of the addressee.', contentWidth - 40);
    doc.text(noticeLines, pageWidth / 2, bottomRuleY + 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    newPage();
    addSection(1, 'Executive Summary');
    var verdict = insights.overall >= 65 ? 'Favorable' : insights.overall >= 40 ? 'Mixed signals' : 'Unfavorable';
    var strongest = __spreadArray([], insights.categories, true).sort(function (a, b) { return b.score - a.score; })[0];
    var summaryText = "".concat(verdict, " for a ").concat(profile.business_type, " in ").concat(profile.neighborhood, ". Score: ").concat(insights.overall, "/100 (").concat(insights.profile, " profile, ").concat(insights.coverageCount, "/6 categories scored).").concat(strongest ? " Best signal: ".concat(strongest.name, " (").concat(strongest.score, "/100).") : '');
    addParagraph(summaryText);
    if (insights.categories.length > 0) {
        y += 4;
        addSubheading('Category Scores');
        var catHeaders = ['Category', 'Score', 'Assessment'];
        var catRows = __spreadArray([], insights.categories, true).sort(function (a, b) { return b.score - a.score; })
            .map(function (c) { return [c.name, "".concat(c.score, "/100"), c.claim]; });
        var catWidths = [contentWidth * 0.22, contentWidth * 0.15, contentWidth * 0.63];
        addTable(catHeaders, catRows, catWidths);
    }
    if (advantages.length > 0) {
        y += 4;
        addSubheading('Key Advantages');
        advantages.slice(0, 3).forEach(function (s) { return addBullet("".concat(s.title, ": ").concat(s.detail)); });
    }
    if (risks.length > 0) {
        y += 4;
        addSubheading('Key Risks');
        risks.slice(0, 3).forEach(function (s) { return addBullet("".concat(s.title, ": ").concat(s.detail)); });
    }
    addSection(2, 'Labor Market Analytics');
    var demo = neighborhoodData.demographics;
    if (demo) {
        addSubheading('Talent Supply');
        addMetricRow('Population within neighborhood', demo.total_population ? demo.total_population.toLocaleString() : 'N/A');
        addMetricRow('Median age', demo.median_age ? "".concat(demo.median_age, " years") : 'N/A');
        y += 6;
        addSubheading('Wage Indicator');
        addMetricRow('Median household income', demo.median_household_income ? "$".concat(Math.round(demo.median_household_income).toLocaleString()) : 'N/A');
        addMetricRow('Unemployment rate', demo.unemployment_rate != null ? "".concat((demo.unemployment_rate * 100).toFixed(1), "%") : 'N/A');
        y += 6;
        addSubheading('Education Profile');
        addMetricRow("Bachelor's degree holders", demo.bachelors_degree != null ? "".concat((demo.bachelors_degree * 100).toFixed(1), "%") : 'N/A');
        addMetricRow("Master's degree holders", demo.masters_degree != null ? "".concat((demo.masters_degree * 100).toFixed(1), "%") : 'N/A');
        y += 6;
        addSubheading('Competition for Talent');
        addMetricRow('Active business licenses (labor competition proxy)', "".concat(neighborhoodData.license_count));
    }
    else {
        addParagraph('Demographic data not available for this neighborhood.');
    }
    addSection(3, 'Competitive Landscape');
    var directCount = competitors.filter(function (c) { return c.isDirect; }).length;
    addMetricRow('Total business licenses in area', "".concat(neighborhoodData.license_count));
    addMetricRow('Direct competitors identified', "".concat(directCount));
    var reviews = neighborhoodData.reviews || [];
    var ratings = reviews.map(function (r) { var _a; return ((_a = r.metadata) === null || _a === void 0 ? void 0 : _a.rating) || 0; }).filter(function (r) { return r > 0; });
    var avgRating = ratings.length > 0 ? (ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length).toFixed(1) : 'N/A';
    addMetricRow('Average competitor review rating', avgRating !== 'N/A' ? "".concat(avgRating, "/5") : 'N/A');
    y += 6;
    if (competitors.length > 0) {
        addSubheading('Notable Competitors');
        var compHeaders = ['Business Name', 'License Type', 'Competitor Type'];
        var compRows = competitors.map(function (c) { return [c.name, c.type, c.isDirect ? 'DIRECT' : 'Indirect']; });
        var compWidths = [contentWidth * 0.38, contentWidth * 0.38, contentWidth * 0.24];
        addTable(compHeaders, compRows, compWidths);
    }
    else {
        addParagraph('No competitor data available.');
    }
    addSection(4, 'Operational Cost Modeling');
    if (demo) {
        addSubheading('Real Estate Signal');
        addMetricRow('Median gross rent', demo.median_gross_rent ? "$".concat(Math.round(demo.median_gross_rent).toLocaleString(), "/mo") : 'N/A');
        addMetricRow('Median home value', demo.median_home_value ? "$".concat(Math.round(demo.median_home_value).toLocaleString()) : 'N/A');
        y += 6;
    }
    addSubheading('Permit Investment');
    var totalFees = neighborhoodData.permits.reduce(function (sum, p) {
        var _a;
        var raw = (_a = p.metadata) === null || _a === void 0 ? void 0 : _a.raw_record;
        var fee = parseFloat(String((raw === null || raw === void 0 ? void 0 : raw.building_fee_paid) || '0')) || 0;
        return sum + fee;
    }, 0);
    addMetricRow('Total building fees paid (recent permits)', totalFees > 0 ? "$".concat(Math.round(totalFees).toLocaleString()) : 'N/A');
    addMetricRow('Active permits', "".concat(neighborhoodData.permit_count));
    if (regulatory.permitBreakdown.length > 0) {
        y += 4;
        addSubheading('Permits by Type');
        var permitHeaders = ['Permit Type', 'Count'];
        var permitRows = regulatory.permitBreakdown.map(function (p) { return [p.type, "".concat(p.count)]; });
        var permitWidths = [contentWidth * 0.75, contentWidth * 0.25];
        addTable(permitHeaders, permitRows, permitWidths);
    }
    addSection(5, 'Risk Assessment');
    if (risks.length > 0) {
        risks.slice(0, 5).forEach(function (s) { return addBullet("".concat(s.title, ": ").concat(s.detail)); });
    }
    else {
        addParagraph('No dominant risks detected at this time.');
    }
    y += 6;
    addSubheading('Inspection Compliance');
    addMetricRow('Inspection pass rate', "".concat(regulatory.passRate, "%"));
    addMetricRow('Total inspections', "".concat(regulatory.total));
    addMetricRow('Failed inspections', "".concat(regulatory.failed));
    if (regulatory.recentInspections.length > 0) {
        y += 4;
        addSubheading('Recent Inspection Results');
        var inspHeaders = ['Establishment', 'Result'];
        var inspRows = regulatory.recentInspections.map(function (i) { return [i.name, i.result]; });
        var inspWidths = [contentWidth * 0.65, contentWidth * 0.35];
        addTable(inspHeaders, inspRows, inspWidths);
    }
    if (regulatory.federalAlerts.length > 0) {
        y += 4;
        addSubheading('Federal Regulatory Alerts');
        regulatory.federalAlerts.forEach(function (a) { return addBullet("".concat(a.title, " (").concat(a.agency, ")")); });
    }
    var weakCategories = insights.categories.filter(function (c) { return c.score < 40; });
    if (weakCategories.length > 0) {
        y += 4;
        addSubheading('Low-Scoring Categories (< 40/100)');
        weakCategories.forEach(function (c) { return addBullet("".concat(c.name, ": ").concat(c.score, "/100 \u2014 ").concat(c.claim)); });
    }
    addSection(6, 'Incentive & Regulatory Environment');
    addMetricRow('Inspection pass rate', "".concat(regulatory.passRate, "% (").concat(regulatory.passed, " pass / ").concat(regulatory.total, " total)"));
    addMetricRow('Political/legislative activity', "".concat(neighborhoodData.politics.length, " items"));
    addMetricRow('Federal register activity', "".concat((neighborhoodData.federal_register || []).length, " regulations"));
    addMetricRow('News mentions', "".concat(neighborhoodData.news.length, " articles"));
    addMetricRow('Community signals (Reddit/TikTok)', "".concat((((_b = neighborhoodData.reddit) === null || _b === void 0 ? void 0 : _b.length) || 0) + (((_c = neighborhoodData.tiktok) === null || _c === void 0 ? void 0 : _c.length) || 0), " posts"));
    addSection(7, 'Accessibility & Transit');
    var transit = neighborhoodData.transit;
    if (transit) {
        addMetricRow('Transit score', "".concat(transit.transit_score, "/100"));
        addMetricRow('CTA stations nearby', "".concat(transit.stations_nearby));
        addMetricRow('Total daily riders (nearby stations)', "".concat(transit.total_daily_riders.toLocaleString()));
        if (transit.station_names.length > 0) {
            addBullet("Stations: ".concat(transit.station_names.join(', ')));
        }
    }
    else {
        addParagraph('No CTA transit data available for this neighborhood.');
    }
    var cctvCams = ((_d = neighborhoodData.cctv) === null || _d === void 0 ? void 0 : _d.cameras) || [];
    if (cctvCams.length > 0) {
        y += 4;
        addSubheading('Highway Traffic Density');
        var avgVeh = Math.round(cctvCams.reduce(function (s, c) { return s + c.vehicles; }, 0) / cctvCams.length);
        addMetricRow('Nearby cameras', "".concat(cctvCams.length));
        addMetricRow('Avg vehicles per camera', "".concat(avgVeh));
        addMetricRow('Density', ((_e = neighborhoodData.cctv) === null || _e === void 0 ? void 0 : _e.density) || 'N/A');
    }
    addSection(8, 'Key Metrics Summary');
    var colWidth = contentWidth / 2;
    var cellGap = 6;
    var cellW = colWidth - cellGap / 2;
    var cellH = 36;
    for (var i = 0; i < metrics.length; i += 2) {
        ensureSpace(cellH + 6);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(marginX, y, cellW, cellH, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(metrics[i].label.toUpperCase(), marginX + 8, y + 12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(40, 40, 40);
        doc.text(metrics[i].value, marginX + 8, y + 28);
        if (i + 1 < metrics.length) {
            var rx = marginX + cellW + cellGap;
            doc.setDrawColor(200, 200, 200);
            doc.rect(rx, y, cellW, cellH, 'S');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            doc.text(metrics[i + 1].label.toUpperCase(), rx + 8, y + 12);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(40, 40, 40);
            doc.text(metrics[i + 1].value, rx + 8, y + 28);
        }
        y += cellH + 6;
    }
    doc.setTextColor(0, 0, 0);
    addSection(9, 'Data Sources & Methodology');
    var srcHeaders = ['Source', 'Documents'];
    var srcRows = sourcesData.sources.map(function (s) { return [s.name, "".concat(s.count)]; });
    srcRows.push(['TOTAL', "".concat(sourcesData.total)]);
    var srcWidths = [contentWidth * 0.7, contentWidth * 0.3];
    addTable(srcHeaders, srcRows, srcWidths);
    y += 4;
    addParagraph('Business Intelligence Score (BIS) is computed by Aleithia across 6 categories: Regulatory, Economic, Market, Demographic, Safety, and Community. ' +
        'Each category is scored 0\u2013100 based on sub-metrics derived from live pipeline data. The overall score is a weighted average using the selected risk profile. ' +
        "This report was generated using the \"".concat(insights.profile, "\" risk profile with ").concat(insights.coverageCount, " of 6 categories scored."), 8.5);
    ensureSpace(120);
    y += 8;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(1.5);
    doc.line(marginX, y, marginX + contentWidth, y);
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text('DISCLAIMER', marginX, y);
    y += 16;
    var disclaimerText = 'This report is provided for informational purposes only and does not constitute legal, financial, or investment advice. ' +
        'The data and analysis contained herein have been derived from publicly available sources believed to be reliable; however, ' +
        'Aleithia Intelligence Platform makes no representations or warranties, express or implied, as to the accuracy, completeness, ' +
        'or timeliness of the information. Recipients of this report should conduct their own independent due diligence and seek ' +
        'professional counsel before making any business, investment, or legal decisions based on the information provided. ' +
        'This document is confidential and intended solely for the use of the addressee. Any unauthorized distribution, reproduction, ' +
        'or use of this report is strictly prohibited.';
    var disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth);
    var disclaimerLineHeight = 10.5;
    ensureSpace(disclaimerLines.length * disclaimerLineHeight + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    for (var _i = 0, disclaimerLines_1 = disclaimerLines; _i < disclaimerLines_1.length; _i++) {
        var line = disclaimerLines_1[_i];
        doc.text(line, marginX, y);
        y += disclaimerLineHeight;
    }
    doc.setTextColor(0, 0, 0);
    var totalPages = doc.getNumberOfPages();
    for (var i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) {
            addPageHeader();
        }
        addFooterFinal(i, totalPages);
    }
    var fileName = "aleithia-proposal-".concat(profile.neighborhood.toLowerCase().replaceAll(' ', '-'), "-").concat(profile.business_type.toLowerCase().replaceAll(' ', '-'), ".pdf");
    doc.save(fileName);
}
