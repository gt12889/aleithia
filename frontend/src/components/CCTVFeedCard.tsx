import type { CCTVData } from '../types/index.ts'

const API_BASE = import.meta.env.VITE_MODAL_URL || '/api/data'

interface Props {
  cctv: CCTVData
}

export default function CCTVFeedCard({ cctv }: Props) {
  if (!cctv?.cameras?.length) return null

  return (
    <div className="border border-white/[0.06] bg-white/[0.01] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-mono font-medium uppercase tracking-wider text-white/30">
          Live CCTV — Foot Traffic
        </h3>
        <span className="text-[10px] font-mono text-white/15">
          {cctv.cameras.length} cameras · {cctv.density} density
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cctv.cameras.slice(0, 6).map((cam) => (
          <div
            key={cam.camera_id}
            className="border border-white/[0.06] bg-white/[0.02] overflow-hidden rounded"
          >
            <div className="aspect-video bg-black/40 relative">
              <img
                src={`${API_BASE}/cctv/frame/${encodeURIComponent(cam.camera_id)}`}
                alt={`Camera ${cam.camera_id}`}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <div className="px-2 py-1.5 flex items-center justify-between text-[10px] font-mono">
              <span className="text-white/40 truncate">{cam.camera_id}</span>
              <span className="text-white/30 shrink-0 ml-1">
                P:{cam.pedestrians} V:{cam.vehicles}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-4 text-[10px] font-mono text-white/25">
        <span>Avg pedestrians: {Math.round(cctv.avg_pedestrians)}</span>
        <span>Avg vehicles: {Math.round(cctv.avg_vehicles)}</span>
      </div>
    </div>
  )
}
