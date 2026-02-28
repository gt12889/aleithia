import { useState } from 'react'
import type { UserProfile, RiskScore, ChatMessage } from '../types/index.ts'
import RiskCard from './RiskCard.tsx'
import ChatPanel from './ChatPanel.tsx'
import MapView from './MapView.tsx'
import Timer from './Timer.tsx'
import DataSourceBadge from './DataSourceBadge.tsx'

// Demo risk data — will be replaced by API calls
function getMockRiskScore(profile: UserProfile): RiskScore {
  return {
    neighborhood: profile.neighborhood,
    business_type: profile.business_type,
    overall_score: 6.2,
    confidence: 0.78,
    summary: `Opening a ${profile.business_type.toLowerCase()} in ${profile.neighborhood} carries moderate risk. Strong foot traffic and positive sentiment offset by recent regulatory changes and rising competition.`,
    factors: [
      {
        label: '3 new zoning regulations in this ward',
        pct: 40,
        source: 'politics',
        severity: 'high',
        description: 'City Council passed new restaurant zoning ordinances affecting this area in the last 90 days.',
      },
      {
        label: '12 new restaurant permits in 90 days',
        pct: 25,
        source: 'public_data',
        severity: 'medium',
        description: 'Rising competition with 12 new business license applications for similar establishments.',
      },
      {
        label: 'Positive neighborhood sentiment trending up',
        pct: 15,
        source: 'reddit',
        severity: 'low',
        description: 'Reddit and social media sentiment about this neighborhood is 72% positive, up 8% from last month.',
      },
      {
        label: 'High foot traffic from CTA data',
        pct: 10,
        source: 'public_data',
        severity: 'low',
        description: 'Nearby CTA stations show 15K+ daily riders. Strong walk-in potential.',
      },
      {
        label: 'Average review rating: 4.1/5',
        pct: 10,
        source: 'reviews',
        severity: 'low',
        description: 'Existing restaurants in the area maintain strong ratings. High bar for quality.',
      },
    ],
  }
}

interface Props {
  profile: UserProfile
  onReset: () => void
}

export default function Dashboard({ profile, onReset }: Props) {
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(true)

  // Simulate analysis on mount
  useState(() => {
    setTimeout(() => {
      setRiskScore(getMockRiskScore(profile))
      setAnalyzing(false)
    }, 2500)
  })

  const dataSources = [
    { name: 'Socrata', count: 459, active: true },
    { name: 'Census', count: 1332, active: true },
    { name: 'Legistar', count: 80, active: true },
    { name: 'RSS News', count: 10, active: true },
    { name: 'Real Estate', count: 8, active: true },
    { name: 'Yelp', count: 0, active: false },
    { name: 'Reddit', count: 0, active: false },
  ]

  const handleChat = (message: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: message, timestamp: new Date() }])
    setChatLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const responses: Record<string, string> = {
        'What permits do I need?': `For a ${profile.business_type.toLowerCase()} in ${profile.neighborhood}, you'll need:\n\n1. Business License ($250-$500)\n2. Food Service Sanitation Certificate\n3. Building Permit (if renovating)\n4. Sign Permit ($100)\n5. Liquor License (if applicable, $4,400/yr)\n\nBased on recent Legistar data, processing times are averaging 4-6 weeks for this ward.`,
        'How is foot traffic in this area?': `${profile.neighborhood} has strong pedestrian traffic based on CTA ridership data:\n\n- Nearest L station: 15,200 daily riders\n- Bus routes in area: 3 lines, 8,400 combined daily riders\n- Peak hours: 7-9 AM, 5-7 PM\n\nYelp data shows businesses in this area average 4.1/5 rating with high review velocity, indicating active consumer traffic.`,
        'What are the zoning restrictions?': `Based on current Chicago Zoning data for ${profile.neighborhood}:\n\n- Zoning classification: B3-2 (Community Shopping District)\n- Restaurant use: Permitted\n- Maximum building height: 50 ft\n- Required parking: 1 space per 4 seats\n\nNote: City Council introduced 3 new zoning amendments for this ward in the last 90 days. Review recommended.`,
      }

      const response = responses[message] || `Based on our analysis of ${profile.neighborhood} for a ${profile.business_type.toLowerCase()}, here's what the data shows:\n\nWe've analyzed 1,889 data points across 9 sources including city permits, Census demographics, political activity, and local sentiment. The overall risk score of ${riskScore?.overall_score.toFixed(1) ?? '6.2'}/10 suggests moderate risk with strong opportunities.\n\nWould you like me to dive deeper into a specific area?`

      setMessages((prev) => [...prev, { role: 'assistant', content: response, timestamp: new Date() }])
      setChatLoading(false)
    }, 1500)
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-indigo-400">Alethia</h1>
          <div className="h-4 w-px bg-gray-700" />
          <span className="text-sm text-gray-400">
            {profile.business_type} in <strong className="text-gray-200">{profile.neighborhood}</strong>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Timer running={analyzing} />
          <button
            onClick={onReset}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            New Search
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Map + Risk */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          {/* Data sources */}
          <DataSourceBadge sources={dataSources} />

          {/* Map */}
          <div className="h-[350px]">
            <MapView activeNeighborhood={profile.neighborhood} />
          </div>

          {/* Risk card */}
          {analyzing ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Analyzing {profile.neighborhood} across 9 data sources...</p>
              <p className="text-xs text-gray-600 mt-2">
                What costs $5K-$15K in billable hours is about to happen in seconds
              </p>
            </div>
          ) : riskScore ? (
            <RiskCard score={riskScore} />
          ) : null}

          {/* Cost comparison */}
          {!analyzing && (
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 text-center">
              <div className="flex items-center justify-center gap-8">
                <div>
                  <div className="text-xs text-gray-500">Traditional research</div>
                  <div className="text-lg font-bold text-red-400 line-through">$5,000 - $15,000</div>
                  <div className="text-xs text-gray-600">2-3 weeks</div>
                </div>
                <div className="text-2xl text-gray-600">vs</div>
                <div>
                  <div className="text-xs text-gray-500">Alethia</div>
                  <div className="text-lg font-bold text-green-400">Free</div>
                  <div className="text-xs text-gray-600">2.5 seconds</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Chat */}
        <div className="w-96 border-l border-gray-800 p-4">
          <ChatPanel messages={messages} onSend={handleChat} loading={chatLoading} />
        </div>
      </div>
    </div>
  )
}
