import { useEffect, useRef, useState } from 'react'

type HeatmapLayer = 'regulatory' | 'business' | 'sentiment'

const LAYER_CONFIG: Record<HeatmapLayer, { label: string; color: string }> = {
  regulatory: { label: 'Regulatory Density', color: '#ef4444' },
  business: { label: 'Business Activity', color: '#3b82f6' },
  sentiment: { label: 'Sentiment', color: '#22c55e' },
}

interface Props {
  activeNeighborhood?: string
}

export default function MapView({ activeNeighborhood }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [activeLayer, setActiveLayer] = useState<HeatmapLayer>('regulatory')
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    // Mapbox will be initialized when token is available
    // For now, show a styled placeholder
    setMapLoaded(true)
  }, [])

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden h-full flex flex-col">
      {/* Layer toggle */}
      <div className="flex gap-1 p-2 border-b border-gray-800">
        {(Object.keys(LAYER_CONFIG) as HeatmapLayer[]).map((layer) => (
          <button
            key={layer}
            onClick={() => setActiveLayer(layer)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeLayer === layer
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {LAYER_CONFIG[layer].label}
          </button>
        ))}
      </div>

      {/* Map container */}
      <div ref={mapContainerRef} className="flex-1 relative min-h-[300px]">
        {/* Placeholder map visualization */}
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <div className="relative w-full h-full overflow-hidden">
            {/* Grid background */}
            <div className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            {/* Neighborhood dots */}
            {[
              { name: 'Lincoln Park', x: 52, y: 30 },
              { name: 'Wicker Park', x: 42, y: 35 },
              { name: 'Logan Square', x: 38, y: 28 },
              { name: 'West Loop', x: 48, y: 45 },
              { name: 'Loop', x: 53, y: 48 },
              { name: 'Pilsen', x: 47, y: 58 },
              { name: 'Hyde Park', x: 60, y: 70 },
              { name: 'River North', x: 50, y: 40 },
              { name: 'Chinatown', x: 52, y: 60 },
              { name: 'Uptown', x: 55, y: 20 },
              { name: 'Rogers Park', x: 56, y: 10 },
              { name: 'Bridgeport', x: 48, y: 62 },
              { name: 'Lakeview', x: 54, y: 25 },
              { name: 'South Loop', x: 54, y: 55 },
              { name: 'Bronzeville', x: 56, y: 58 },
            ].map((dot) => (
              <div
                key={dot.name}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeNeighborhood === dot.name
                      ? 'w-5 h-5 ring-2 ring-white'
                      : ''
                  }`}
                  style={{
                    backgroundColor: LAYER_CONFIG[activeLayer].color,
                    opacity: activeNeighborhood === dot.name ? 1 : 0.5 + Math.random() * 0.5,
                    boxShadow: `0 0 ${8 + Math.random() * 12}px ${LAYER_CONFIG[activeLayer].color}`,
                  }}
                />
                <div className="absolute left-1/2 -translate-x-1/2 -top-6 bg-gray-800 text-xs text-gray-300 px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {dot.name}
                </div>
              </div>
            ))}

            {/* Label */}
            <div className="absolute bottom-3 left-3 text-xs text-gray-500">
              Chicago, IL — {LAYER_CONFIG[activeLayer].label}
            </div>

            {mapLoaded && !mapContainerRef.current?.querySelector('canvas') && (
              <div className="absolute top-3 right-3 text-xs text-gray-600 bg-gray-800/80 px-2 py-1 rounded">
                Add MAPBOX_TOKEN for full map
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
