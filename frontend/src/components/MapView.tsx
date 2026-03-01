import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const API_BASE = import.meta.env.VITE_MODAL_URL || '/api/data'

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
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

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
      const sourceUrl = `${API_BASE}/geo`

      fetch(sourceUrl)
        .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
        .then((geojson) => addSourceAndLayers(map, geojson))
        .catch(() => addSourceAndLayers(map, { type: 'FeatureCollection', features: [] }))

      setMapReady(true)
    })

    map.on('error', (e) => {
      console.error('Mapbox error:', e)
      setMapError('Map failed to load — check your token')
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [geojsonUrl])

  function addSourceAndLayers(map: mapboxgl.Map, geojson: GeoJSON.FeatureCollection) {
    map.addSource('neighborhoods', { type: 'geojson', data: geojson })

    const firstSymbolLayer = map.getStyle().layers?.find(l => l.type === 'symbol')?.id

    // Single heatmap gradient — white glow on dark map
    map.addLayer({
      id: 'heatmap',
      type: 'heatmap',
      source: 'neighborhoods',
      maxzoom: 15,
      paint: {
        'heatmap-weight': [
          'interpolate', ['linear'],
          ['coalesce', ['get', 'norm_regulatory'], 0],
          0, 0, 10, 0.15, 30, 0.35, 50, 0.55, 75, 0.8, 100, 1,
        ],
        'heatmap-intensity': [
          'interpolate', ['linear'], ['zoom'],
          8, 2, 11, 3, 14, 4,
        ],
        'heatmap-radius': [
          'interpolate', ['linear'], ['zoom'],
          8, 40, 11, 70, 14, 100,
        ],
        'heatmap-opacity': 0.85,
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,    'rgba(0,0,0,0)',
          0.1,  'rgba(255,255,255,0.08)',
          0.2,  'rgba(255,255,255,0.15)',
          0.35, 'rgba(255,255,255,0.25)',
          0.5,  'rgba(255,255,255,0.35)',
          0.65, 'rgba(255,255,255,0.45)',
          0.8,  'rgba(255,255,255,0.55)',
          1,    'rgba(255,255,255,0.65)',
        ],
      },
    }, firstSymbolLayer)

    // Circle dots — dark with subtle border
    map.addLayer({
      id: 'points',
      type: 'circle',
      source: 'neighborhoods',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 7, 15, 10],
        'circle-color': '#111111',
        'circle-opacity': 0.9,
        'circle-stroke-color': 'rgba(255,255,255,0.25)',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 1, 15, 1.5],
        'circle-stroke-opacity': 1,
      },
    }, firstSymbolLayer)

    // Neighborhood labels
    map.addLayer({
      id: 'labels',
      type: 'symbol',
      source: 'neighborhoods',
      minzoom: 11,
      layout: {
        'text-field': ['get', 'neighborhood'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9, 14, 12],
        'text-offset': [0, -1.5],
        'text-anchor': 'bottom',
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#ffffff',
        'text-opacity': 0.7,
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
      },
    })

    // Cursor + popup
    map.on('mouseenter', 'points', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'points', () => { map.getCanvas().style.cursor = '' })

    map.on('click', 'points', (e) => {
      if (!e.features?.[0]) return
      const props = e.features[0].properties || {}
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number]

      popupRef.current?.remove()
      popupRef.current = new mapboxgl.Popup({ closeButton: false, className: 'alethia-popup' })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:system-ui;font-size:13px;color:#fff;background:#1a1d24;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
            <strong style="color:#fff;font-size:13px">${props.neighborhood || 'Unknown'}</strong>
          </div>`)
        .addTo(map)
    })
  }

  // Fly to active neighborhood
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !activeNeighborhood) return

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

const style = document.createElement('style')
style.textContent = `
  .alethia-popup.mapboxgl-popup .mapboxgl-popup-content {
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    margin: 0 !important;
  }
  .alethia-popup.mapboxgl-popup .mapboxgl-popup-tip {
    border-top-color: #1a1d24 !important;
  }
`
document.head.appendChild(style)