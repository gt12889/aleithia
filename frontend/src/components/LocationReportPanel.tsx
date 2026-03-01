import { useMemo } from 'react'
import type { NeighborhoodData, RiskScore, UserProfile } from '../types/index.ts'

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

interface ReportSection {
  icon: string
  title: string
  body: string
  severity: 'positive' | 'neutral' | 'warning'
}

function buildReport(data: NeighborhoodData, profile: UserProfile, riskScore: RiskScore | null): ReportSection[] {
  const sections: ReportSection[] = []
  const biz = profile.business_type.toLowerCase()
  const nb = profile.neighborhood

  // 1. Executive Summary
  const totalDataPoints =
    data.inspection_stats.total +
    data.permit_count +
    data.license_count +
    data.news.length +
    data.politics.length +
    (data.reddit?.length || 0) +
    (data.tiktok?.length || 0) +
    (data.reviews?.length || 0) +
    (data.realestate?.length || 0) +
    (data.traffic?.length || 0)

  // Compute opportunity the same way as RiskCard: average of scored category values
  const REPORT_CATEGORIES = [
    { sources: ['food_inspections'] },
    { sources: ['building_permits', 'business_licenses'] },
    { sources: ['reviews'] },
    { sources: ['public_data'] },
    { sources: ['news', 'politics'] },
    { sources: ['cctv', 'traffic'] },
  ]

  function computeCatScore(factors: RiskScore['factors'], sources: string[]): number | null {
    const matching = factors.filter(f => sources.includes(f.source))
    if (matching.length === 0) return null
    let total = 0
    for (const f of matching) {
      if (f.severity === 'low') total += 85
      else if (f.severity === 'medium') total += 50
      else total += 20
    }
    return Math.round(total / matching.length)
  }

  let opportunity = 0
  let confidence = 0
  if (riskScore) {
    const scoredValues = REPORT_CATEGORIES
      .map(c => computeCatScore(riskScore.factors, c.sources))
      .filter((v): v is number => v !== null)
    opportunity = scoredValues.length > 0
      ? Math.round(scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length)
      : 0
    confidence = Math.round(riskScore.confidence * 100)
  }

  sections.push({
    icon: '◉',
    title: 'Executive Summary',
    body: `Analyzed ${totalDataPoints} data points across ${nb} for a ${biz}. ${
      riskScore
        ? `Overall opportunity score: ${opportunity}/100 with ${confidence}% confidence.`
        : 'Risk assessment pending.'
    }`,
    severity: opportunity >= 65 ? 'positive' as const : opportunity >= 40 ? 'neutral' as const : 'warning' as const,
  })

  // 2. Competitive Landscape
  if (data.licenses.length > 0) {
    const topLicenses = data.licenses.slice(0, 3)
    const names = topLicenses
      .map(l => {
        const raw = (l.metadata?.raw_record || {}) as Record<string, string>
        return raw.doing_business_as_name || raw.legal_name
      })
      .filter(Boolean)

    const competitorLine = names.length > 0
      ? `Key competitors include ${names.join(', ')}.`
      : ''

    sections.push({
      icon: '⬡',
      title: 'Competitive Landscape',
      body: `${data.license_count} active business licenses in the area. ${competitorLine} ${
        data.license_count > 20
          ? 'High density suggests strong commercial demand but also competition.'
          : data.license_count > 5
          ? 'Moderate density indicates a healthy market with room for differentiation.'
          : 'Low business density — opportunity to establish market presence early.'
      }`,
      severity: data.license_count > 30 ? 'warning' : data.license_count > 5 ? 'positive' : 'neutral',
    })
  }

  // 3. Reviews & Reputation
  if (data.reviews && data.reviews.length > 0) {
    const ratings = data.reviews
      .map(r => (r.metadata?.rating as number) || 0)
      .filter(r => r > 0)
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null

    const topReview = data.reviews.find(r => ((r.metadata?.rating as number) || 0) >= 4)
    const topName = topReview?.title || ''

    sections.push({
      icon: '★',
      title: 'Market Reputation',
      body: `${data.reviews.length} business reviews analyzed${avgRating ? ` with avg rating ${avgRating}/5` : ''}. ${
        topName ? `Top-rated: "${topName}" (${(topReview?.metadata?.rating as number)?.toFixed(1)}★).` : ''
      } ${
        avgRating && Number(avgRating) >= 4
          ? 'High customer satisfaction in area suggests strong consumer expectations.'
          : avgRating && Number(avgRating) < 3.5
          ? 'Below-average ratings indicate service gaps — potential opportunity to differentiate.'
          : ''
      }`,
      severity: avgRating && Number(avgRating) >= 4 ? 'positive' : 'neutral',
    })
  }

  // 4. Regulatory & Inspections
  if (data.inspection_stats.total > 0) {
    const passRate = Math.round((data.inspection_stats.passed / data.inspection_stats.total) * 100)
    sections.push({
      icon: '⚑',
      title: 'Regulatory Environment',
      body: `${data.inspection_stats.total} food inspections recorded: ${data.inspection_stats.passed} passed, ${data.inspection_stats.failed} failed (${passRate}% pass rate). ${
        passRate >= 80
          ? 'Strong compliance environment — regulators are active but fair.'
          : passRate >= 60
          ? 'Moderate compliance concerns — prepare for thorough inspections.'
          : 'High failure rate — invest in compliance training before opening.'
      }`,
      severity: passRate >= 80 ? 'positive' : passRate >= 60 ? 'neutral' : 'warning',
    })
  }

  // 5. Construction & Development
  if (data.permit_count > 0) {
    const permits = data.permits || []
    const recentPermit = permits[0]
    const raw = recentPermit ? ((recentPermit.metadata?.raw_record || {}) as Record<string, string>) : null
    const totalCost = permits.reduce((sum, p) => {
      const r = (p.metadata?.raw_record || {}) as Record<string, string>
      return sum + (Number(r.reported_cost) || 0)
    }, 0)

    sections.push({
      icon: '▲',
      title: 'Development Activity',
      body: `${data.permit_count} active building permits${totalCost > 0 ? ` totaling $${Math.round(totalCost / 1000)}K in investment` : ''}. ${
        raw ? `Most recent: ${raw.work_type || raw.permit_type || 'construction'} at ${[raw.street_number, raw.street_direction, raw.street_name].filter(Boolean).join(' ')}.` : ''
      } ${
        data.permit_count > 10
          ? 'Heavy construction — expect temporary disruptions but long-term upside.'
          : 'Moderate development signals neighborhood improvement.'
      }`,
      severity: data.permit_count > 15 ? 'warning' : 'positive',
    })
  }

  // 6. News & Political Climate
  if (data.news.length > 0 || data.politics.length > 0) {
    const topNews = data.news[0]
    const topPol = data.politics[0]

    let body = ''
    if (topNews) {
      const meta = topNews.metadata || {}
      body += `Latest: "${topNews.title}"${(meta.source_name as string) ? ` (${meta.source_name})` : ''}. `
    }
    if (topPol) {
      body += `Recent legislation: "${topPol.title}". `
    }
    if (data.politics.length > 3) {
      body += `${data.politics.length} active legislative items — monitor for zoning or licensing changes.`
    }

    sections.push({
      icon: '◈',
      title: 'Intel & Policy',
      body,
      severity: data.politics.length > 5 ? 'warning' : 'neutral',
    })
  }

  // 7. Community Buzz
  const communityCount = (data.reddit?.length || 0) + (data.tiktok?.length || 0)
  if (communityCount > 0) {
    const topReddit = data.reddit?.[0]
    const topTiktok = data.tiktok?.[0]

    let body = `${communityCount} social media mentions detected. `
    if (topReddit) {
      const meta = topReddit.metadata || {}
      body += `Reddit: "${topReddit.title || topReddit.content?.slice(0, 60)}" (${(meta.score as number) || 0} upvotes). `
    }
    if (topTiktok) {
      body += `TikTok: ${topTiktok.title || 'local content creator post'}. `
    }
    body += communityCount > 5
      ? 'Strong social presence indicates neighborhood visibility.'
      : 'Growing social awareness.'

    sections.push({
      icon: '◎',
      title: 'Community Signal',
      body,
      severity: communityCount > 5 ? 'positive' : 'neutral',
    })
  }

  // 8. Real Estate
  if (data.realestate && data.realestate.length > 0) {
    const topListing = data.realestate[0]
    sections.push({
      icon: '⊞',
      title: 'Commercial Real Estate',
      body: `${data.realestate.length} active listings. ${
        topListing ? `Featured: "${topListing.title}".` : ''
      } ${
        data.realestate.length > 5
          ? 'High availability — negotiate lease terms aggressively.'
          : 'Limited supply — act quickly on suitable spaces.'
      }`,
      severity: data.realestate.length > 5 ? 'positive' : 'neutral',
    })
  }

  // 9. Timing Recommendation
  const hasPoliticalActivity = data.politics.length > 3
  const hasConstruction = data.permit_count > 10
  const hasPositiveBuzz = communityCount > 3

  let timingAdvice = ''
  if (hasConstruction) {
    timingAdvice = `Consider waiting 2–3 months for nearby construction to complete before signing a lease. `
  }
  if (hasPoliticalActivity) {
    timingAdvice += `Monitor ${data.politics.length} active legislative items — outdoor dining and zoning changes could affect operations. `
  }
  if (hasPositiveBuzz) {
    timingAdvice += `Community interest is rising now — entering the market soon could capitalize on organic awareness. `
  }
  if (!timingAdvice) {
    timingAdvice = `No major timing concerns detected. Market conditions appear stable for entry within the next 1–3 months.`
  }

  sections.push({
    icon: '⏱',
    title: 'Timing & Next Steps',
    body: timingAdvice.trim(),
    severity: hasConstruction || hasPoliticalActivity ? 'neutral' : 'positive',
  })

  return sections
}

const severityBorder = {
  positive: 'border-emerald-500/20',
  neutral: 'border-white/[0.06]',
  warning: 'border-amber-500/20',
}

const severityIcon = {
  positive: 'text-emerald-400/60',
  neutral: 'text-white/20',
  warning: 'text-amber-400/60',
}

export default function LocationReportPanel({ profile, neighborhoodData, riskScore, loading, agentInfo: _agentInfo }: Props) {
  const report = useMemo(() => {
    if (!neighborhoodData) return []
    return buildReport(neighborhoodData, profile, riskScore)
  }, [neighborhoodData, profile, riskScore])

  return (
    <section className="h-full flex flex-col border border-white/[0.06] bg-white/[0.02]">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-white/35">Intelligence Report</p>
          <h3 className="text-sm font-semibold text-white mt-1">{profile.business_type} • {profile.neighborhood}</h3>
        </div>
        {report.length > 0 && (
          <span className="text-[10px] font-mono text-white/15 mt-1">{report.length} sections</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            <div className="h-16 bg-white/[0.02] animate-pulse rounded" />
            <div className="h-12 bg-white/[0.02] animate-pulse rounded" />
            <div className="h-20 bg-white/[0.02] animate-pulse rounded" />
            <div className="text-[10px] text-white/20 font-mono text-center mt-4">
              Generating intelligence report from live pipeline…
            </div>
          </div>
        ) : report.length === 0 ? (
          <div className="text-xs text-white/30 font-mono">No data available for report generation.</div>
        ) : (
          report.map((section, i) => (
            <div key={i} className={`border-l-2 ${severityBorder[section.severity]} pl-3 py-1`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`text-xs ${severityIcon[section.severity]}`}>{section.icon}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">{section.title}</span>
              </div>
              <div className="text-[11px] text-white/55 leading-relaxed">{section.body}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
