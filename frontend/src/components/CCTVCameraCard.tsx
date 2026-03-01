import type { CCTVCamera } from '../types/index.ts'
import { api } from '../api.ts'

/** Crosshair SVG for HUD overlay */
const CrosshairSvg = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none text-white/20"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
  >
    <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="0.3" />
    <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.3" />
    <circle cx="50" cy="50" r="4" fill="none" stroke="currentColor" strokeWidth="0.2" />
  </svg>
)

interface Props {
  cam: CCTVCamera
  cctvDensity: string
  onClick: () => void
  isSelected?: boolean
}

export default function CCTVCameraCard({ cam, cctvDensity, onClick, isSelected }: Props) {
  const status = cam.density_level === 'high' ? 'LIVE' : cam.density_level === 'medium' ? 'MOD' : 'IDLE'
  const flowTag = `${cam.vehicles}v / ${cam.pedestrians}p`

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative bg-[#06080d] p-0 cursor-pointer transition-all overflow-hidden ${
        isSelected ? 'ring-1 ring-[#2B95D6]/60' : 'hover:ring-1 hover:ring-white/20'
      }`}
    >
      <div className="relative aspect-video bg-black/60 overflow-hidden cctv-scanline">
        <img
          src={api.cctvFrameUrl(cam.camera_id)}
          alt={`Camera ${cam.camera_id}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent && !parent.querySelector('.fallback')) {
              const fb = document.createElement('div')
              fb.className = 'fallback absolute inset-0 flex items-center justify-center'
              fb.innerHTML = '<span class="text-[10px] font-mono text-white/15">NO SIGNAL</span>'
              parent.appendChild(fb)
            }
          }}
        />
        <CrosshairSvg />
        {/* HUD overlays — monospaced */}
        <div className="absolute top-1 left-1 font-mono text-[9px] text-white/80 tracking-wider">
          <span className="text-white/50">CAM-</span>
          <span className="text-white/90">{cam.camera_id.replace(/^.*\//, '').slice(-8)}</span>
        </div>
        <div className="absolute top-1 right-1 font-mono text-[8px]">
          <span
            className={`px-1 py-0.5 ${
              status === 'LIVE' ? 'bg-green-500/60 text-white' :
              status === 'MOD' ? 'bg-amber-500/50 text-white' :
              'bg-white/20 text-white/70'
            }`}
          >
            {status}
          </span>
        </div>
        <div className="absolute bottom-1 left-1 right-1 flex justify-between items-end font-mono text-[8px] text-white/50">
          <span>{cam.density_level ?? cctvDensity}</span>
          <span className="text-white/60">{flowTag}</span>
        </div>
      </div>
    </button>
  )
}
