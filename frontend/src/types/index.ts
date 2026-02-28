export interface RiskFactor {
  label: string
  pct: number
  source: string
  severity: 'low' | 'medium' | 'high'
  description: string
}

export interface RiskScore {
  neighborhood: string
  business_type: string
  overall_score: number
  confidence: number
  factors: RiskFactor[]
  summary: string
}

export interface NeighborhoodMetrics {
  neighborhood: string
  regulatory_density: number
  business_activity: number
  sentiment: number
  risk_score: number
  active_permits: number
  crime_incidents_30d: number
  avg_review_rating: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface UserProfile {
  business_type: string
  neighborhood: string
}
