import { useState } from 'react'
import type { UserProfile } from '../types/index.ts'

const NEIGHBORHOODS = [
  'Albany Park', 'Andersonville', 'Avondale', 'Boystown', 'Bridgeport',
  'Bronzeville', 'Bucktown', 'Chinatown', 'Edgewater', 'Gold Coast',
  'Humboldt Park', 'Hyde Park', 'Lakeview', 'Lincoln Park', 'Lincoln Square',
  'Little Village', 'Logan Square', 'Loop', 'Near North Side', 'Old Town',
  'Pilsen', 'River North', 'Rogers Park', 'South Loop', 'Streeterville',
  'Ukrainian Village', 'Uptown', 'West Loop', 'West Town', 'Wicker Park',
]

const BUSINESS_TYPES = [
  'Restaurant', 'Coffee Shop', 'Bar / Nightlife', 'Retail Store',
  'Grocery / Convenience', 'Salon / Barbershop', 'Fitness Studio',
  'Professional Services', 'Food Truck', 'Bakery',
]

interface Props {
  onSubmit: (profile: UserProfile) => void
}

export default function OnboardingForm({ onSubmit }: Props) {
  const [businessType, setBusinessType] = useState('')
  const [neighborhood, setNeighborhood] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (businessType && neighborhood) {
      onSubmit({ business_type: businessType, neighborhood })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tight mb-3">
            <span className="text-indigo-400">Alethia</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Chicago business intelligence in seconds, not weeks.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What type of business?
            </label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Select business type...</option>
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Which neighborhood?
            </label>
            <select
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Select neighborhood...</option>
              {NEIGHBORHOODS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!businessType || !neighborhood}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Analyze
          </button>

          <p className="text-center text-xs text-gray-500">
            Powered by 9 live data sources across Chicago
          </p>
        </form>
      </div>
    </div>
  )
}
