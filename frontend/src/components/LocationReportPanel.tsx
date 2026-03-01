import { jsPDF } from 'jspdf'
import type { NeighborhoodData, RiskScore, UserProfile } from '../types/index.ts'
import { computeInsights } from '../insights.ts'

interface AgentInfo {
  agents_deployed: number
  neighborhoods: string[]
  data_points: number
  agent_summaries: Array<{
    name: string
    data_points: number
    sources?: string[]
  }>
}

interface Props {
  profile: UserProfile
  neighborhoodData: NeighborhoodData | null
  riskScore: RiskScore | null
  loading: boolean
  agentInfo: AgentInfo | null
}

type Signal = {
  title: string
  detail: string
}

type ScoredSignal = Signal & { priority: number }

const CATEGORY_TITLES: Record<string, string> = {
  regulatory: 'Regulatory environment',
  economic: 'Economic momentum',
  market: 'Market demand and competition',
  demographic: 'Demographic fit',
  safety: 'Safety and access',
  community: 'Community momentum',
}

const CRITICAL_MISSING_DATA_CHECKS: Array<{
  key: string
  title: string
  detail: string
  isMissing: (data: NeighborhoodData) => boolean
}> = [
  {
    key: 'regulatory',
    title: 'Missing compliance baseline data',
    detail: 'No food inspection coverage is available, which makes licensing/compliance risk harder to quantify before launch.',
    isMissing: (data) => (data.inspection_stats.total ?? 0) === 0 && data.inspections.length === 0,
  },
  {
    key: 'market',
    title: 'Missing customer demand signal',
    detail: 'No review data is available, reducing confidence in pricing power and product-market fit assumptions.',
    isMissing: (data) => (data.reviews?.length || 0) === 0,
  },
  {
    key: 'safety',
    title: 'Missing foot-traffic visibility',
    detail: 'Limited CCTV/traffic observations create uncertainty in pedestrian flow and delivery accessibility forecasts.',
    isMissing: (data) => !data.cctv || data.cctv.cameras.length === 0 || (data.traffic?.length || 0) === 0,
  },
  {
    key: 'demographic',
    title: 'Missing demographic depth',
    detail: 'Demographic baselines are incomplete, making purchasing-power and audience-fit estimates less reliable.',
    isMissing: (data) => !data.demographics,
  },
]

function buildAdvantages(data: NeighborhoodData | null, profile: UserProfile): Signal[] {
  if (!data) return []

  const insights = computeInsights(data, profile, 'conservative')
  const positive = insights.categories
    .filter(cat => cat.signal !== 'negative')
    .sort((a, b) => b.score - a.score)
    .map<ScoredSignal>((cat) => ({
      priority: cat.score,
      title: CATEGORY_TITLES[cat.id] ?? cat.name,
      detail: `${cat.claim} (Business Intelligence Score: ${cat.score}/100).`,
    }))

  if (positive.length === 0 && insights.categories.length > 0) {
    const strongest = [...insights.categories].sort((a, b) => b.score - a.score)[0]
    return [{
      title: CATEGORY_TITLES[strongest.id] ?? strongest.name,
      detail: `${strongest.claim} (Business Intelligence Score: ${strongest.score}/100).`,
    }]
  }

  if (positive.length === 0) {
    return [{
      title: 'Limited favorable evidence',
      detail: 'Not enough scored categories show a strong upside signal yet; collect more ground-truth data before scaling.',
    }]
  }

  return positive.slice(0, 2)
}

function buildRisks(data: NeighborhoodData | null, profile: UserProfile): Signal[] {
  if (!data) return []

  const insights = computeInsights(data, profile, 'conservative')
  const scoreDrivenRisks = insights.categories
    .filter(cat => cat.signal === 'negative' || cat.score < 40)
    .sort((a, b) => a.score - b.score)
    .map<ScoredSignal>((cat) => ({
      priority: 100 - cat.score,
      title: CATEGORY_TITLES[cat.id] ?? cat.name,
      detail: `${cat.claim} (Business Intelligence Score: ${cat.score}/100).`,
    }))

  const missingDataRisks = CRITICAL_MISSING_DATA_CHECKS
    .filter(check => check.isMissing(data))
    .map<ScoredSignal>((check) => ({
      priority: 90,
      title: check.title,
      detail: check.detail,
    }))

  const combined = [...scoreDrivenRisks, ...missingDataRisks]
    .sort((a, b) => b.priority - a.priority)

  if (combined.length === 0) {
    const weakerSignals = insights.categories
      .filter(cat => cat.signal === 'neutral')
      .sort((a, b) => a.score - b.score)
      .slice(0, 1)
      .map<ScoredSignal>((cat) => ({
        priority: 45,
        title: `${CATEGORY_TITLES[cat.id] ?? cat.name} requires validation`,
        detail: `${cat.claim} (Business Intelligence Score: ${cat.score}/100).`,
      }))

    if (weakerSignals.length > 0) return weakerSignals

    return [{
      title: 'No dominant risk detected',
      detail: 'No high-severity downside signal is currently dominant, but continue monitoring for data drift and execution risk.',
    }]
  }

  return combined.slice(0, 2)
}

function buildSummary(profile: UserProfile, data: NeighborhoodData | null, riskScore: RiskScore | null): string {
  if (!data) {
    return `Preparing a location report for ${profile.business_type} in ${profile.neighborhood}.`
  }

  const totalSignals =
    data.inspection_stats.total +
    data.permit_count +
    data.license_count +
    (data.news.length || 0) +
    (data.politics.length || 0) +
    (data.reviews?.length || 0) +
    (data.traffic?.length || 0)

  const posture = riskScore
    ? riskScore.overall_score <= 4
      ? 'favorable'
      : riskScore.overall_score <= 7
        ? 'mixed'
        : 'higher-risk'
    : 'mixed'

  return `${profile.neighborhood} looks ${posture} for a ${profile.business_type.toLowerCase()} launch based on ${totalSignals} local signals. Prioritize quick validation on the highlighted risks while leveraging the strongest demand/compliance advantages.`
}

function safeNumber(value: number | undefined): string {
  return typeof value === 'number' ? `${value}` : 'N/A'
}

export default function LocationReportPanel({ profile, neighborhoodData, riskScore, loading, agentInfo }: Props) {
  const advantages = buildAdvantages(neighborhoodData, profile)
  const risks = buildRisks(neighborhoodData, profile)
  const summary = buildSummary(profile, neighborhoodData, riskScore)

  const handleDownloadPdf = () => {
    if (loading) return

    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const marginX = 44
    const topMargin = 48
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const contentWidth = pageWidth - marginX * 2
    let y = topMargin

    const ensureSpace = (minHeight = 30) => {
      if (y + minHeight > pageHeight - 44) {
        doc.addPage()
        y = topMargin
      }
    }

    const addHeading = (text: string) => {
      ensureSpace(28)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(text, marginX, y)
      y += 18
    }

    const addParagraph = (text: string, size = 10) => {
      const lines = doc.splitTextToSize(text, contentWidth)
      ensureSpace(lines.length * (size + 3) + 6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(size)
      doc.text(lines, marginX, y)
      y += lines.length * (size + 3) + 6
    }

    const addBullet = (text: string) => {
      const wrapped = doc.splitTextToSize(text, contentWidth - 14)
      ensureSpace(wrapped.length * 13 + 4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('•', marginX, y)
      doc.text(wrapped, marginX + 12, y)
      y += wrapped.length * 13 + 4
    }

    const dateLabel = new Date().toLocaleString()
    const rating = neighborhoodData?.metrics?.avg_review_rating
    const stats = neighborhoodData?.inspection_stats
    const passRate = stats && stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : null
    const failRate = stats && stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : null
    const congestedCount = (neighborhoodData?.traffic || []).filter((t) => {
      const level = (t.metadata?.congestion_level as string | undefined)?.toLowerCase()
      return level === 'heavy' || level === 'blocked'
    }).length

    const detailedAdvantages = [
      passRate !== null && stats
        ? `Regulatory baseline: ${stats.passed} of ${stats.total} inspections passed (${passRate}%), which may support smoother launch operations.`
        : null,
      typeof rating === 'number' && rating > 0
        ? `Demand signal: local review sentiment averages ${rating.toFixed(1)}/5 across ${neighborhoodData?.reviews?.length || 0} records.`
        : null,
      neighborhoodData?.cctv?.cameras.length
        ? `Street activity: ${neighborhoodData.cctv.cameras.length} nearby CCTV points report ${neighborhoodData.cctv.density} traffic density with ~${neighborhoodData.cctv.avg_pedestrians} average pedestrians.`
        : null,
      neighborhoodData && neighborhoodData.permit_count > 0
        ? `Investment velocity: ${neighborhoodData.permit_count} active permits suggest current reinvestment in the area.`
        : null,
    ].filter((v): v is string => Boolean(v))

    const detailedRisks = [
      failRate !== null && stats
        ? `Compliance exposure: ${stats.failed} failed inspections out of ${stats.total} (${failRate}%) may indicate tighter enforcement expectations.`
        : null,
      neighborhoodData && neighborhoodData.license_count > 0
        ? `Competitive pressure: ${neighborhoodData.license_count} active licenses increase the need for differentiation and pricing discipline.`
        : null,
      congestedCount > 0
        ? `Mobility friction: ${congestedCount} congested traffic zones may affect logistics, delivery times, and customer access.`
        : null,
      typeof rating === 'number' && rating > 0 && rating < 3.8
        ? `Consumer expectation risk: average rating at ${rating.toFixed(1)}/5 can imply stricter quality benchmarks for new entrants.`
        : null,
    ].filter((v): v is string => Boolean(v))

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Alethia Report Summary', marginX, y)
    y += 22

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`${profile.business_type} • ${profile.neighborhood}`, marginX, y)
    y += 14
    doc.text(`Generated: ${dateLabel}`, marginX, y)
    y += 16

    addHeading('Executive Summary')
    addParagraph(summary)

    addHeading('Agent Intelligence')
    if (agentInfo) {
      addParagraph(`Agents deployed: ${agentInfo.agents_deployed} | Neighborhoods analyzed: ${agentInfo.neighborhoods.length} | Data points: ${agentInfo.data_points}`)
      if (agentInfo.agent_summaries.length > 0) {
        addParagraph('Top contributing agents:')
        agentInfo.agent_summaries.slice(0, 8).forEach((agent) => {
          addBullet(`${agent.name}: ${agent.data_points} points${agent.sources?.length ? ` (${agent.sources.join(', ')})` : ''}`)
        })
      }
    } else {
      addParagraph('Agent summary unavailable for this run. Pipeline metrics are shown from loaded neighborhood signals.')
    }

    addHeading('Detailed Advantages')
    if (detailedAdvantages.length > 0) {
      detailedAdvantages.forEach(addBullet)
    } else {
      addBullet('No strong upside concentration detected; proceed with controlled pilot testing.')
    }

    addHeading('Detailed Risks')
    if (detailedRisks.length > 0) {
      detailedRisks.forEach(addBullet)
    } else {
      addBullet('No single dominant risk detected; continue validation for category-specific constraints.')
    }

    addHeading('Data Snapshot')
    addBullet(`Food inspections: ${safeNumber(neighborhoodData?.inspection_stats.total)} total`)
    addBullet(`Building permits: ${safeNumber(neighborhoodData?.permit_count)}`)
    addBullet(`Business licenses: ${safeNumber(neighborhoodData?.license_count)}`)
    addBullet(`Intel items: ${(neighborhoodData?.news.length || 0) + (neighborhoodData?.politics.length || 0)}`)
    addBullet(`Community signals: ${(neighborhoodData?.reddit?.length || 0) + (neighborhoodData?.tiktok?.length || 0)}`)
    addBullet(`Market signals: ${(neighborhoodData?.reviews?.length || 0) + (neighborhoodData?.realestate?.length || 0)}`)
    addBullet(`CCTV cameras: ${safeNumber(neighborhoodData?.cctv?.cameras.length)}`)
    if (riskScore) {
      addBullet(`Risk score: ${riskScore.overall_score}/10 (confidence ${(riskScore.confidence * 100).toFixed(0)}%)`)
    }

    const fileName = `report-summary-${profile.neighborhood.toLowerCase().replaceAll(' ', '-')}-${profile.business_type.toLowerCase().replaceAll(' ', '-')}.pdf`
    doc.save(fileName)
  }

  return (
    <section className="h-full flex flex-col border border-white/[0.06] bg-white/[0.02]">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-white/35">Report Summary</p>
          <h3 className="text-sm font-semibold text-white mt-1">{profile.business_type} • {profile.neighborhood}</h3>
        </div>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={loading}
          className="text-[10px] font-mono uppercase tracking-wider border border-white/20 px-2.5 py-1.5 text-white/75 hover:text-white hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          Download PDF
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="text-xs text-white/40 font-mono">Generating report from live pipeline signals…</div>
        ) : (
          <>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-300/70 mb-2">Advantages</p>
              <div className="space-y-2">
                {advantages.map((item) => (
                  <div key={item.title} className="border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                    <p className="text-xs font-semibold text-emerald-300">{item.title}</p>
                    <p className="text-[11px] text-white/65 mt-1 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300/70 mb-2">Risks</p>
              <div className="space-y-2">
                {risks.map((item) => (
                  <div key={item.title} className="border border-amber-500/20 bg-amber-500/[0.05] p-3">
                    <p className="text-xs font-semibold text-amber-200">{item.title}</p>
                    <p className="text-[11px] text-white/65 mt-1 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
