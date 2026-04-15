import { jsPDF } from 'jspdf'

import { computeInsights } from '../insights.ts'
import type { NeighborhoodData, UserProfile } from '../types/index.ts'

type ReportSignal = {
  title: string
  detail: string
}

type ReportCompetitor = {
  name: string
  type: string
  isDirect: boolean
}

type ReportRegulatoryItem = {
  name: string
  result: string
}

type ReportRegulatorySummary = {
  passRate: number
  total: number
  passed: number
  failed: number
  recentInspections: ReportRegulatoryItem[]
  permitBreakdown: { type: string; count: number }[]
  federalAlerts: { title: string; agency: string }[]
}

type ReportMetricItem = {
  label: string
  value: string
}

type ReportSourceCount = {
  name: string
  count: number
}

type ReportInsights = ReturnType<typeof computeInsights>

export interface ReportPdfInput {
  profile: UserProfile
  insights: ReportInsights
  advantages: ReportSignal[]
  risks: ReportSignal[]
  competitors: ReportCompetitor[]
  regulatory: ReportRegulatorySummary
  metrics: ReportMetricItem[]
  sourcesData: { sources: ReportSourceCount[]; total: number }
  neighborhoodData: NeighborhoodData
}

export function generateReportPdf({
  profile,
  insights,
  advantages,
  risks,
  competitors,
  regulatory,
  metrics,
  sourcesData,
  neighborhoodData,
}: ReportPdfInput) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const marginX = 72 // 1 inch margins
  const topMargin = 72
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - marginX * 2
  let y = topMargin
  const dateLabel = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Generate reference number: ALT-{NEIGHBORHOOD_4CHARS}-{HASH}
  const nbrCode = profile.neighborhood.replace(/\s/g, '').substring(0, 4).toUpperCase()
  const hashSrc = `${profile.neighborhood}-${profile.business_type}-${Date.now()}`
  let hash = 0
  for (let i = 0; i < hashSrc.length; i++) hash = ((hash << 5) - hash + hashSrc.charCodeAt(i)) | 0
  const refNumber = `ALT-${nbrCode}-${Math.abs(hash).toString(16).substring(0, 6).toUpperCase()}`

  const addPageHeader = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(180, 40, 40)
    doc.text('CONFIDENTIAL', marginX, 36)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.text(refNumber, pageWidth - marginX, 36, { align: 'right' })
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.5)
    doc.line(marginX, 42, pageWidth - marginX, 42)
    doc.setTextColor(0, 0, 0)
  }

  const addFooterFinal = (page: number, total: number) => {
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.5)
    doc.line(marginX, pageHeight - 40, pageWidth - marginX, pageHeight - 40)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.text('Confidential \u2014 Prepared by Aleithia Intelligence Platform', marginX, pageHeight - 28)
    doc.text(`Page ${page} of ${total}`, pageWidth - marginX, pageHeight - 28, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }

  const newPage = () => {
    doc.addPage()
    y = topMargin
    addPageHeader()
  }

  const ensureSpace = (minHeight = 30) => {
    if (y + minHeight > pageHeight - 56) {
      newPage()
    }
  }

  const addSection = (num: number, title: string) => {
    ensureSpace(44)
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(1.5)
    doc.line(marginX, y, marginX + contentWidth, y)
    y += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`SECTION ${num}`, marginX, y)
    y += 16
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(40, 40, 40)
    doc.text(title, marginX, y)
    doc.setTextColor(0, 0, 0)
    y += 22
  }

  const addSubheading = (text: string) => {
    ensureSpace(22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    doc.text(text, marginX, y)
    doc.setTextColor(0, 0, 0)
    y += 14
  }

  const addParagraph = (text: string, size = 9.5) => {
    const lineHeight = size * 1.5
    const lines: string[] = doc.splitTextToSize(text, contentWidth)
    ensureSpace(lines.length * lineHeight + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(40, 40, 40)
    for (const line of lines) {
      doc.text(line, marginX, y)
      y += lineHeight
    }
    y += 6
    doc.setTextColor(0, 0, 0)
  }

  const addBullet = (text: string) => {
    const colonIdx = text.indexOf(': ')
    const label = colonIdx > 0 ? text.substring(0, colonIdx) : ''
    const detail = colonIdx > 0 ? text.substring(colonIdx + 2) : text
    const display = label ? `${label} \u2014 ${detail}` : text
    const wrapped: string[] = doc.splitTextToSize(display, contentWidth - 14)
    ensureSpace(wrapped.length * 13 + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(40, 40, 40)
    doc.text('\u2022', marginX, y)
    doc.text(wrapped, marginX + 12, y)
    y += wrapped.length * 13 + 4
    doc.setTextColor(0, 0, 0)
  }

  const addMetricRow = (label: string, value: string) => {
    ensureSpace(16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(40, 40, 40)
    doc.text(label, marginX + 12, y)
    doc.setFont('helvetica', 'bold')
    doc.text(value, marginX + contentWidth - 10, y, { align: 'right' })
    doc.setDrawColor(221, 221, 221)
    doc.setLineWidth(0.3)
    doc.line(marginX + 12, y + 4, marginX + contentWidth - 10, y + 4)
    doc.setTextColor(0, 0, 0)
    y += 16
  }

  const addTable = (headers: string[], rows: string[][], colWidths: number[]) => {
    const rowHeight = 18
    const headerHeight = 20
    const fontSize = 8.5
    const totalRows = rows.length + 1
    const tableHeight = headerHeight + rows.length * rowHeight
    ensureSpace(Math.min(tableHeight, headerHeight + rowHeight * 3))

    const colX: number[] = [marginX]
    for (let i = 1; i < colWidths.length; i++) {
      colX.push(colX[i - 1] + colWidths[i - 1])
    }
    const tableWidth = colWidths.reduce((a, b) => a + b, 0)

    doc.setFillColor(240, 240, 240)
    doc.rect(marginX, y, tableWidth, headerHeight, 'F')
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.5)
    doc.rect(marginX, y, tableWidth, headerHeight, 'S')
    for (let c = 1; c < colWidths.length; c++) {
      doc.line(colX[c], y, colX[c], y + headerHeight)
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fontSize)
    doc.setTextColor(40, 40, 40)
    for (let c = 0; c < headers.length; c++) {
      doc.text(headers[c], colX[c] + 6, y + 13)
    }
    y += headerHeight

    for (let r = 0; r < rows.length; r++) {
      ensureSpace(rowHeight + 4)
      if (r % 2 === 1) {
        doc.setFillColor(248, 248, 248)
        doc.rect(marginX, y, tableWidth, rowHeight, 'F')
      }
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.rect(marginX, y, tableWidth, rowHeight, 'S')
      for (let c = 1; c < colWidths.length; c++) {
        doc.line(colX[c], y, colX[c], y + rowHeight)
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(fontSize)
      doc.setTextColor(40, 40, 40)
      for (let c = 0; c < rows[r].length; c++) {
        const cellText = rows[r][c]
        const maxCellWidth = colWidths[c] - 12
        const truncated = doc.splitTextToSize(cellText, maxCellWidth)[0] || ''
        doc.text(truncated, colX[c] + 6, y + 12)
      }
      y += rowHeight
    }
    void totalRows
    y += 8
    doc.setTextColor(0, 0, 0)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(180, 40, 40)
  doc.text('CONFIDENTIAL', pageWidth / 2, 72, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  y = 88
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(2)
  doc.line(marginX, y, pageWidth - marginX, y)
  doc.setLineWidth(0.5)
  doc.line(marginX, y + 5, pageWidth - marginX, y + 5)

  y = 180
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(40, 40, 40)
  doc.text('Location Intelligence', pageWidth / 2, y, { align: 'center' })
  y += 28
  doc.text('Assessment Report', pageWidth / 2, y, { align: 'center' })

  y += 24
  const ruleLen = 140
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.5)
  doc.line(pageWidth / 2 - ruleLen / 2, y, pageWidth / 2 + ruleLen / 2, y)

  y += 28
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(60, 60, 60)
  doc.text(`${profile.business_type} \u2014 ${profile.neighborhood}, Chicago, IL`, pageWidth / 2, y, { align: 'center' })

  y += 52
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(48)
  doc.setTextColor(40, 40, 40)
  doc.text(`${insights.overall}`, pageWidth / 2, y, { align: 'center' })
  y += 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('BUSINESS INTELLIGENCE SCORE (0\u2013100)', pageWidth / 2, y, { align: 'center' })

  y += 56
  const leftCol = marginX + 40
  const rightCol = pageWidth / 2 + 40
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(140, 140, 140)
  doc.text('PREPARED BY', leftCol, y)
  doc.text('DATE', rightCol, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(40, 40, 40)
  doc.text('Aleithia Intelligence Platform', leftCol, y)
  doc.text(dateLabel, rightCol, y)
  y += 24
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(140, 140, 140)
  doc.text('REFERENCE', leftCol, y)
  doc.text('RISK PROFILE', rightCol, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(40, 40, 40)
  doc.text(refNumber, leftCol, y)
  doc.text(insights.profile.charAt(0).toUpperCase() + insights.profile.slice(1), rightCol, y)

  const bottomRuleY = pageHeight - 100
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.5)
  doc.line(marginX, bottomRuleY, pageWidth - marginX, bottomRuleY)
  doc.setLineWidth(2)
  doc.line(marginX, bottomRuleY + 5, pageWidth - marginX, bottomRuleY + 5)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  const noticeLines: string[] = doc.splitTextToSize(
    'This document contains proprietary analysis and is intended solely for the use of the addressee.',
    contentWidth - 40,
  )
  doc.text(noticeLines, pageWidth / 2, bottomRuleY + 20, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  newPage()
  addSection(1, 'Executive Summary')

  const verdict = insights.overall >= 65 ? 'Favorable' : insights.overall >= 40 ? 'Mixed signals' : 'Unfavorable'
  const strongest = [...insights.categories].sort((a, b) => b.score - a.score)[0]
  const summaryText = `${verdict} for a ${profile.business_type} in ${profile.neighborhood}. Score: ${insights.overall}/100 (${insights.profile} profile, ${insights.coverageCount}/6 categories scored).${strongest ? ` Best signal: ${strongest.name} (${strongest.score}/100).` : ''}`
  addParagraph(summaryText)

  if (insights.categories.length > 0) {
    y += 4
    addSubheading('Category Scores')
    const catHeaders = ['Category', 'Score', 'Assessment']
    const catRows = [...insights.categories]
      .sort((a, b) => b.score - a.score)
      .map(c => [c.name, `${c.score}/100`, c.claim])
    const catWidths = [contentWidth * 0.22, contentWidth * 0.15, contentWidth * 0.63]
    addTable(catHeaders, catRows, catWidths)
  }

  if (advantages.length > 0) {
    y += 4
    addSubheading('Key Advantages')
    advantages.slice(0, 3).forEach(s => addBullet(`${s.title}: ${s.detail}`))
  }
  if (risks.length > 0) {
    y += 4
    addSubheading('Key Risks')
    risks.slice(0, 3).forEach(s => addBullet(`${s.title}: ${s.detail}`))
  }

  addSection(2, 'Labor Market Analytics')
  const demo = neighborhoodData.demographics
  if (demo) {
    addSubheading('Talent Supply')
    addMetricRow('Population within neighborhood', demo.total_population ? demo.total_population.toLocaleString() : 'N/A')
    addMetricRow('Median age', demo.median_age ? `${demo.median_age} years` : 'N/A')
    y += 6
    addSubheading('Wage Indicator')
    addMetricRow('Median household income', demo.median_household_income ? `$${Math.round(demo.median_household_income).toLocaleString()}` : 'N/A')
    addMetricRow('Unemployment rate', demo.unemployment_rate != null ? `${(demo.unemployment_rate * 100).toFixed(1)}%` : 'N/A')
    y += 6
    addSubheading('Education Profile')
    addMetricRow("Bachelor's degree holders", demo.bachelors_degree != null ? `${(demo.bachelors_degree * 100).toFixed(1)}%` : 'N/A')
    addMetricRow("Master's degree holders", demo.masters_degree != null ? `${(demo.masters_degree * 100).toFixed(1)}%` : 'N/A')
    y += 6
    addSubheading('Competition for Talent')
    addMetricRow('Active business licenses (labor competition proxy)', `${neighborhoodData.license_count}`)
  } else {
    addParagraph('Demographic data not available for this neighborhood.')
  }

  addSection(3, 'Competitive Landscape')
  const directCount = competitors.filter(c => c.isDirect).length
  addMetricRow('Total business licenses in area', `${neighborhoodData.license_count}`)
  addMetricRow('Direct competitors identified', `${directCount}`)
  const reviews = neighborhoodData.reviews || []
  const ratings = reviews.map(r => (r.metadata?.rating as number) || 0).filter(r => r > 0)
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 'N/A'
  addMetricRow('Average competitor review rating', avgRating !== 'N/A' ? `${avgRating}/5` : 'N/A')
  y += 6
  if (competitors.length > 0) {
    addSubheading('Notable Competitors')
    const compHeaders = ['Business Name', 'License Type', 'Competitor Type']
    const compRows = competitors.map(c => [c.name, c.type, c.isDirect ? 'DIRECT' : 'Indirect'])
    const compWidths = [contentWidth * 0.38, contentWidth * 0.38, contentWidth * 0.24]
    addTable(compHeaders, compRows, compWidths)
  } else {
    addParagraph('No competitor data available.')
  }

  addSection(4, 'Operational Cost Modeling')
  if (demo) {
    addSubheading('Real Estate Signal')
    addMetricRow('Median gross rent', demo.median_gross_rent ? `$${Math.round(demo.median_gross_rent).toLocaleString()}/mo` : 'N/A')
    addMetricRow('Median home value', demo.median_home_value ? `$${Math.round(demo.median_home_value).toLocaleString()}` : 'N/A')
    y += 6
  }
  addSubheading('Permit Investment')
  const totalFees = neighborhoodData.permits.reduce((sum, p) => {
    const raw = p.metadata?.raw_record as Record<string, unknown> | undefined
    const fee = parseFloat(String(raw?.building_fee_paid || '0')) || 0
    return sum + fee
  }, 0)
  addMetricRow('Total building fees paid (recent permits)', totalFees > 0 ? `$${Math.round(totalFees).toLocaleString()}` : 'N/A')
  addMetricRow('Active permits', `${neighborhoodData.permit_count}`)
  if (regulatory.permitBreakdown.length > 0) {
    y += 4
    addSubheading('Permits by Type')
    const permitHeaders = ['Permit Type', 'Count']
    const permitRows = regulatory.permitBreakdown.map(p => [p.type, `${p.count}`])
    const permitWidths = [contentWidth * 0.75, contentWidth * 0.25]
    addTable(permitHeaders, permitRows, permitWidths)
  }

  addSection(5, 'Risk Assessment')
  if (risks.length > 0) {
    risks.slice(0, 5).forEach(s => addBullet(`${s.title}: ${s.detail}`))
  } else {
    addParagraph('No dominant risks detected at this time.')
  }
  y += 6
  addSubheading('Inspection Compliance')
  addMetricRow('Inspection pass rate', `${regulatory.passRate}%`)
  addMetricRow('Total inspections', `${regulatory.total}`)
  addMetricRow('Failed inspections', `${regulatory.failed}`)
  if (regulatory.recentInspections.length > 0) {
    y += 4
    addSubheading('Recent Inspection Results')
    const inspHeaders = ['Establishment', 'Result']
    const inspRows = regulatory.recentInspections.map(i => [i.name, i.result])
    const inspWidths = [contentWidth * 0.65, contentWidth * 0.35]
    addTable(inspHeaders, inspRows, inspWidths)
  }
  if (regulatory.federalAlerts.length > 0) {
    y += 4
    addSubheading('Federal Regulatory Alerts')
    regulatory.federalAlerts.forEach(a => addBullet(`${a.title} (${a.agency})`))
  }
  const weakCategories = insights.categories.filter(c => c.score < 40)
  if (weakCategories.length > 0) {
    y += 4
    addSubheading('Low-Scoring Categories (< 40/100)')
    weakCategories.forEach(c => addBullet(`${c.name}: ${c.score}/100 \u2014 ${c.claim}`))
  }

  addSection(6, 'Incentive & Regulatory Environment')
  addMetricRow('Inspection pass rate', `${regulatory.passRate}% (${regulatory.passed} pass / ${regulatory.total} total)`)
  addMetricRow('Political/legislative activity', `${neighborhoodData.politics.length} items`)
  addMetricRow('Federal register activity', `${(neighborhoodData.federal_register || []).length} regulations`)
  addMetricRow('News mentions', `${neighborhoodData.news.length} articles`)
  addMetricRow('Community signals (Reddit/TikTok)', `${(neighborhoodData.reddit?.length || 0) + (neighborhoodData.tiktok?.length || 0)} posts`)

  addSection(7, 'Accessibility & Transit')
  const transit = neighborhoodData.transit
  if (transit) {
    addMetricRow('Transit score', `${transit.transit_score}/100`)
    addMetricRow('CTA stations nearby', `${transit.stations_nearby}`)
    addMetricRow('Total daily riders (nearby stations)', `${transit.total_daily_riders.toLocaleString()}`)
    if (transit.station_names.length > 0) {
      addBullet(`Stations: ${transit.station_names.join(', ')}`)
    }
  } else {
    addParagraph('No CTA transit data available for this neighborhood.')
  }
  const cctvCams = neighborhoodData.cctv?.cameras || []
  if (cctvCams.length > 0) {
    y += 4
    addSubheading('Highway Traffic Density')
    const avgVeh = Math.round(cctvCams.reduce((s, c) => s + c.vehicles, 0) / cctvCams.length)
    addMetricRow('Nearby cameras', `${cctvCams.length}`)
    addMetricRow('Avg vehicles per camera', `${avgVeh}`)
    addMetricRow('Density', neighborhoodData.cctv?.density || 'N/A')
  }

  addSection(8, 'Key Metrics Summary')
  const colWidth = contentWidth / 2
  const cellGap = 6
  const cellW = colWidth - cellGap / 2
  const cellH = 36
  for (let i = 0; i < metrics.length; i += 2) {
    ensureSpace(cellH + 6)
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.rect(marginX, y, cellW, cellH, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(metrics[i].label.toUpperCase(), marginX + 8, y + 12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(40, 40, 40)
    doc.text(metrics[i].value, marginX + 8, y + 28)
    if (i + 1 < metrics.length) {
      const rx = marginX + cellW + cellGap
      doc.setDrawColor(200, 200, 200)
      doc.rect(rx, y, cellW, cellH, 'S')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      doc.text(metrics[i + 1].label.toUpperCase(), rx + 8, y + 12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(40, 40, 40)
      doc.text(metrics[i + 1].value, rx + 8, y + 28)
    }
    y += cellH + 6
  }
  doc.setTextColor(0, 0, 0)

  addSection(9, 'Data Sources & Methodology')
  const srcHeaders = ['Source', 'Documents']
  const srcRows = sourcesData.sources.map(s => [s.name, `${s.count}`])
  srcRows.push(['TOTAL', `${sourcesData.total}`])
  const srcWidths = [contentWidth * 0.7, contentWidth * 0.3]
  addTable(srcHeaders, srcRows, srcWidths)

  y += 4
  addParagraph(
    'Business Intelligence Score (BIS) is computed by Aleithia across 6 categories: Regulatory, Economic, Market, Demographic, Safety, and Community. ' +
    'Each category is scored 0\u2013100 based on sub-metrics derived from live pipeline data. The overall score is a weighted average using the selected risk profile. ' +
    `This report was generated using the "${insights.profile}" risk profile with ${insights.coverageCount} of 6 categories scored.`,
    8.5,
  )

  ensureSpace(120)
  y += 8
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(1.5)
  doc.line(marginX, y, marginX + contentWidth, y)
  y += 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(40, 40, 40)
  doc.text('DISCLAIMER', marginX, y)
  y += 16

  const disclaimerText =
    'This report is provided for informational purposes only and does not constitute legal, financial, or investment advice. ' +
    'The data and analysis contained herein have been derived from publicly available sources believed to be reliable; however, ' +
    'Aleithia Intelligence Platform makes no representations or warranties, express or implied, as to the accuracy, completeness, ' +
    'or timeliness of the information. Recipients of this report should conduct their own independent due diligence and seek ' +
    'professional counsel before making any business, investment, or legal decisions based on the information provided. ' +
    'This document is confidential and intended solely for the use of the addressee. Any unauthorized distribution, reproduction, ' +
    'or use of this report is strictly prohibited.'
  const disclaimerLines: string[] = doc.splitTextToSize(disclaimerText, contentWidth)
  const disclaimerLineHeight = 10.5
  ensureSpace(disclaimerLines.length * disclaimerLineHeight + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 100, 100)
  for (const line of disclaimerLines) {
    doc.text(line, marginX, y)
    y += disclaimerLineHeight
  }
  doc.setTextColor(0, 0, 0)

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    if (i > 1) {
      addPageHeader()
    }
    addFooterFinal(i, totalPages)
  }

  const fileName = `aleithia-proposal-${profile.neighborhood.toLowerCase().replaceAll(' ', '-')}-${profile.business_type.toLowerCase().replaceAll(' ', '-')}.pdf`
  doc.save(fileName)
}
