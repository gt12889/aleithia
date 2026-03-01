import { useState } from 'react'
import type { RiskScore } from '../types/index.ts'

interface Props {
  score: RiskScore
}

const CATEGORIES: { key: string; label: string; sources: string[] }[] = [
  { key: 'regulatory', label: 'Regulatory', sources: ['food_inspections'] },
  { key: 'economic', label: 'Economic', sources: ['building_permits', 'business_licenses'] },
  { key: 'market', label: 'Market', sources: ['reviews'] },
  { key: 'demographic', label: 'Demographic', sources: ['public_data'] },
  { key: 'community', label: 'Community', sources: ['news', 'politics'] },
  { key: 'safety', label: 'Safety', sources: ['cctv', 'traffic'] },
]

function computeCategoryScore(factors: RiskScore['factors'], sources: string[]): { value: number | null; detail: string | null } {
  const matching = factors.filter(f => sources.includes(f.source))
  if (matching.length === 0) return { value: null, detail: null }

  // Compute score from factor percentages and severities
  let total = 0
  for (const f of matching) {
    if (f.severity === 'low') total += 85
    else if (f.severity === 'medium') total += 50
    else total += 20
  }
  const avg = Math.round(total / matching.length)

  // Build detail string from factor descriptions
  const detail = matching.map(f => f.description || f.label).join(' ')

  return { value: avg, detail }
}

function signalLabel(value: number): { icon: string; text: string; class: string } {
  if (value >= 70) return { icon: '✓', text: 'FAVORABLE', class: 'text-emerald-400/70' }
  if (value >= 40) return { icon: '→', text: 'MODERATE', class: 'text-amber-400/70' }
  return { icon: '✗', text: 'CONCERNING', class: 'text-red-400/70' }
}

function scoreColor(value: number): string {
  if (value >= 70) return 'text-emerald-400'
  if (value >= 40) return 'text-amber-400'
  return 'text-red-400'
}

export default function RiskCard({ score }: Props) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  const scored = CATEGORIES.map(cat => {
    const { value, detail } = computeCategoryScore(score.factors, cat.sources)
    return { ...cat, value, detail }
  })

  const scoredCount = scored.filter(s => s.value !== null).length
  // Overall opportunity = weighted average of scored categories
  const scoredValues = scored.filter(s => s.value !== null).map(s => s.value!)
  const opportunity = scoredValues.length > 0
    ? Math.round(scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length)
    : 0

  return (
    <div className="border border-white/[0.06] bg-white/[0.01] p-5 h-full flex flex-col">
      <div className="text-[10px] font-mono uppercase tracking-wider text-white/30 mb-3">
        Risk Assessment Score
      </div>

      {/* Overall Opportunity */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-white/20">Overall Opportunity</span>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-3xl font-bold font-mono ${scoreColor(opportunity)}`}>
          {opportunity}
        </span>
        <span className="text-sm font-mono text-white/20">/ 100</span>
      </div>
      <div className="text-[10px] font-mono text-white/15 mb-4">
        {scoredCount} of {CATEGORIES.length} categories scored
      </div>

      {/* Category breakdown */}
      <div className="space-y-1 flex-1">
        {scored.map(cat => {
          const isExpanded = expandedCat === cat.key
          if (cat.value === null) {
            return (
              <div key={cat.key} className="py-1.5 flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/10">— NO DATA</span>
                <span className="text-[10px] font-mono text-white/15">{cat.label}</span>
              </div>
            )
          }

          const signal = signalLabel(cat.value)

          return (
            <div key={cat.key}>
              <button
                onClick={() => setExpandedCat(isExpanded ? null : cat.key)}
                className="w-full py-1.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-mono uppercase tracking-wider ${signal.class}`}>
                    {signal.icon} {signal.text}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/40">{cat.label}</span>
                  <span className={`text-sm font-bold font-mono ${scoreColor(cat.value)}`}>
                    {cat.value}
                  </span>
                  <span className="text-[8px] text-white/15 ml-1">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && cat.detail && (
                <div className="ml-4 mb-2 pl-3 border-l border-white/[0.06]">
                  <div className="text-[10px] text-white/30 leading-relaxed py-1">
                    {cat.detail}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        cat.value >= 70 ? 'bg-emerald-500/50' : cat.value >= 40 ? 'bg-amber-500/50' : 'bg-red-500/50'
                      }`}
                      style={{ width: `${cat.value}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Confidence */}
      <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[10px] font-mono text-white/15">
          CONF {Math.round(score.confidence * 100)}%
        </span>
        <span className="text-[10px] font-mono text-white/15">
          {score.factors.length} signals
        </span>
      </div>
    </div>
  )
}
