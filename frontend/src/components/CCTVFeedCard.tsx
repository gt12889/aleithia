import { useState } from 'react'
import type { CCTVData } from '../types/index.ts'
import CCTVCameraCard from './CCTVCameraCard.tsx'
import CCTVCameraDrawer from './CCTVCameraDrawer.tsx'

interface Props {
  cctv: CCTVData
}

export default function CCTVFeedCard({ cctv }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!cctv?.cameras?.length) return null

  const cameras = cctv.cameras.slice(0, 4)
  const selectedCamera = selectedId ? cctv.cameras.find((c) => c.camera_id === selectedId) : null

  return (
    <div className="border border-white/[0.06] bg-white/[0.02]">
      {/* Header — CCTV specifically */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
            CCTV — Live Detection
          </span>
        </div>
        <span className="text-[10px] font-mono text-white/20">
          {cctv.cameras.length} camera{cctv.cameras.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Camera grid — mini HUD cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.04]">
        {cameras.map((cam) => (
          <CCTVCameraCard
            key={cam.camera_id}
            cam={cam}
            cctvDensity={cctv.density}
            onClick={() => setSelectedId(selectedId === cam.camera_id ? null : cam.camera_id)}
            isSelected={selectedId === cam.camera_id}
          />
        ))}
      </div>

      {/* Drawer on click (Palantir secondary context) */}
      <CCTVCameraDrawer
        open={!!selectedCamera}
        onClose={() => setSelectedId(null)}
        camera={selectedCamera ?? null}
        cctv={cctv}
      />
    </div>
  )
}
