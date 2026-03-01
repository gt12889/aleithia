import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const API_BASE = import.meta.env.VITE_MODAL_URL || '/api/data'

type HeatmapLayer = 'regulatory' | 'business' | 'sentiment'

const LAYER_CONFIG: Record<HeatmapLayer, {
  label: string
  color: string
  property: string
  stops: [number, string][]
}> = {
  regulatory: {
    label: 'Regulatory',
    color: '#ef4444',
    property: 'active_permits',
    stops: [
      [0, 'rgba(239,68,68,0)'],
      [5, 'rgba(239,68,68,0.3)'],
      [20, 'rgba(239,68,68,0.6)'],
      [50, 'rgba(239,68,68,0.9)'],
    ],
  },
  business: {
    label: 'Business',
    color: '#3b82f6',
    property: 'business_activity',
    stops: [
      [0, 'rgba(59,130,246,0)'],
      [10, 'rgba(59,130,246,0.3)'],
      [50, 'rgba(59,130,246,0.6)'],
      [100, 'rgba(59,130,246,0.9)'],
    ],
  },
  sentiment: {
    label: 'Sentiment',
    color: '#22c55e',
    property: 'avg_review_rating',
    stops: [
      [0, 'rgba(239,68,68,0.6)'],
      [2.5, 'rgba(234,179,8,0.5)'],
      [4, 'rgba(34,197,94,0.4)'],
      [5, 'rgba(34,197,94,0.8)'],
    ],
  },
}

// Chicago center coordinates
const CHICAGO_CENTER: [number, number] = [-87.6298, 41.8781]
const DEFAULT_ZOOM = 11

interface Props {
  activeNeighborhood?: string
  geojsonUrl?: string
}

export default function MapView({ activeNeighborhood, geojsonUrl }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [activeLayer, setActiveLayer] = useState<HeatmapLayer>('regulatory')
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  // Initialize the map
  useEffect(() => {
    if (!mapContainerRef.current) return

    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      setMapError('Set VITE_MAPBOX_TOKEN in your .env file')
      return
    }

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: CHICAGO_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 0,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load', () => {
      // Always fetch GeoJSON from modal volume
      const sourceUrl = `${API_BASE}/geo`
      console.log('Fetching GeoJSON from:', sourceUrl) // Debug: check URL being fetched

      // Try fetching the GeoJSON; if it fails, use an empty collection
      fetch(sourceUrl)
        .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
        .then((geojson) => {
          console.log('Loaded GeoJSON:', geojson) // Debug: print API response
          addSourceAndLayers(map, geojson)
        })
        .catch(() => {
          // Fallback: empty feature collection so layers still exist
          addSourceAndLayers(map, { type: 'FeatureCollection', features: [] })
        })

      setMapReady(true)
    })

    map.on('error', (e) => {
      console.error('Mapbox error:', e)
      setMapError('Map failed to load — check your token')
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [geojsonUrl])

  // Add the GeoJSON source + all three heatmap/circle layers
  function addSourceAndLayers(map: mapboxgl.Map, geojson: GeoJSON.FeatureCollection) {
    map.addSource('neighborhoods', {
      type: 'geojson',
      data: geojson,
    })

    // Find the first symbol layer in the style to insert layers before it
    const firstSymbolLayer = map.getStyle().layers?.find(l => l.type === 'symbol')?.id

    for (const [key, config] of Object.entries(LAYER_CONFIG)) {
      const layerId = `heatmap-${key}`

      // Heatmap layer
      map.addLayer({
        id: layerId,
        type: 'heatmap',
        source: 'neighborhoods',
        paint: {
          'heatmap-weight': [
            'interpolate', ['linear'],
            ['get', config.property],
            0, 0,
            config.stops[config.stops.length - 1][0] as number, 1,
          ],
          'heatmap-intensity': 1.2,
          'heatmap-radius': 40,
          'heatmap-opacity': key === 'regulatory' ? 0.8 : 0,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, config.stops[1][1],
            0.5, config.stops[2][1],
            1, config.stops[3][1],
          ],
        },
      }, firstSymbolLayer)

      // Circle layer for individual points (visible at higher zoom)
      map.addLayer({
        id: `points-${key}`,
        type: 'circle',
        source: 'neighborhoods',
        minzoom: 12,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'],
            ['get', config.property],
            0, 4,
            (config.stops[config.stops.length - 1][0] as number), 14,
          ],
          'circle-color': config.color,
          'circle-opacity': key === 'regulatory' ? 0.7 : 0,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': key === 'regulatory' ? 0.4 : 0,
        },
      }, firstSymbolLayer)
    }

    // Popup on hover
    map.on('mouseenter', 'points-regulatory', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'points-regulatory', () => { map.getCanvas().style.cursor = '' })

    for (const key of Object.keys(LAYER_CONFIG)) {
      map.on('click', `points-${key}`, (e) => {
        if (!e.features?.[0]) return
        const props = e.features[0].properties || {}
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number]

        popupRef.current?.remove()
        popupRef.current = new mapboxgl.Popup({ closeButton: false, className: 'alethia-popup' })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:system-ui;font-size:13px;color:#e2e8f0;line-height:1.5">
              <strong style="color:#818cf8">${props.neighborhood || 'Unknown'}</strong><br/>
              Permits: ${props.active_permits ?? '—'}<br/>
              Reviews: ${props.review_count ?? '—'}<br/>
              Activity: ${props.business_activity ?? '—'}
            </div>
          `)
          .addTo(map)
      })
    }
  }

  // Switch visible layer when activeLayer changes
  const switchLayer = useCallback((layer: HeatmapLayer) => {
    const map = mapRef.current
    if (!map || !mapReady) return

    for (const key of Object.keys(LAYER_CONFIG) as HeatmapLayer[]) {
      const visible = key === layer
      const hId = `heatmap-${key}`
      const pId = `points-${key}`

      if (map.getLayer(hId)) {
        map.setPaintProperty(hId, 'heatmap-opacity', visible ? 0.8 : 0)
      }
      if (map.getLayer(pId)) {
        map.setPaintProperty(pId, 'circle-opacity', visible ? 0.7 : 0)
        map.setPaintProperty(pId, 'circle-stroke-opacity', visible ? 0.4 : 0)
      }
    }
  }, [mapReady])

  useEffect(() => {
    switchLayer(activeLayer)
  }, [activeLayer, switchLayer])

  // Fly to active neighborhood when it changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !activeNeighborhood) return

    // Query the source to find the matching feature
    const features = map.querySourceFeatures('neighborhoods', {
      filter: ['==', ['get', 'neighborhood'], activeNeighborhood],
    })

    if (features.length > 0) {
      const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number]
      map.flyTo({ center: coords, zoom: 13, duration: 1200 })
    }
  }, [activeNeighborhood, mapReady])

  return (
    <div className="border border-white/[0.06] bg-white/[0.01] overflow-hidden h-full flex flex-col">
      <div className="flex gap-0 p-0 border-b border-white/[0.06]">
        {(Object.keys(LAYER_CONFIG) as HeatmapLayer[]).map((layer) => (
          <button
            key={layer}
            onClick={() => setActiveLayer(layer)}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer border-b-2 -mb-px ${
              activeLayer === layer
                ? 'border-white text-white/70'
                : 'border-transparent text-white/20 hover:text-white/40'
            }`}
          >
            {LAYER_CONFIG[layer].label}
          </button>
        ))}
      </div>

      <div ref={mapContainerRef} className="flex-1 relative min-h-[300px]">
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center space-y-2">
              <div className="text-red-400/60 text-sm font-mono">{mapError}</div>
              <code className="text-[10px] text-white/15 block font-mono">
                echo "VITE_MAPBOX_TOKEN=pk.your_token" &gt; .env
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
