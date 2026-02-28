import { useState } from 'react'
import type { RiskScore } from '../types/index.ts'

interface Props {
  score: RiskScore
}

const severityColors = {
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
}

function scoreColor(score: number): string {
  if (score <= 3) return 'text-green-400'
  if (score <= 6) return 'text-yellow-400'
  return 'text-red-400'
}

function scoreBg(score: number): string {
  if (score <= 3) return 'bg-green-500'
  if (score <= 6) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function RiskCard({ score }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-6 text-left hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">{score.neighborhood}</h3>
            <p className="text-sm text-gray-400">{score.business_type}</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${scoreColor(score.overall_score)}`}>
              {score.overall_score.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">/ 10 risk</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
          <div
            className={`h-2 rounded-full ${scoreBg(score.overall_score)} transition-all`}
            style={{ width: `${score.overall_score * 10}%` }}
          />
        </div>

        <p className="text-sm text-gray-400">{score.summary}</p>

        <div className="flex items-center mt-3 text-xs text-gray-500">
          <span>Confidence: {(score.confidence * 100).toFixed(0)}%</span>
          <span className="mx-2">|</span>
          <span>{score.factors.length} factors</span>
          <span className="ml-auto">{expanded ? 'collapse' : 'expand'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-3 border-t border-gray-800 pt-4">
          {score.factors.map((factor, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${severityColors[factor.severity]}`}>
                    {factor.severity}
                  </span>
                  <span className="text-xs text-gray-500">{factor.source}</span>
                </div>
                <p className="text-sm text-gray-300">{factor.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{factor.description}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold">{factor.pct}%</div>
                <div className="w-16 bg-gray-800 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full ${scoreBg(factor.pct / 10)}`}
                    style={{ width: `${factor.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
