import type { Document } from '../types/index.ts'

interface Props {
  data: Document[]
}

const CONGESTION_STYLES: Record<string, { border: string; text: string; label: string }> = {
  free: { border: 'border-green-500/20', text: 'text-green-400/70', label: 'Free flow' },
  moderate: { border: 'border-yellow-500/20', text: 'text-yellow-400/70', label: 'Moderate' },
  heavy: { border: 'border-orange-500/20', text: 'text-orange-400/70', label: 'Heavy' },
  blocked: { border: 'border-red-500/20', text: 'text-red-400/70', label: 'Blocked' },
}

export default function TrafficCard({ data }: Props) {
  if (data.length === 0) return null

  const congested = data.filter((d) => {
    const level = (d.metadata?.congestion_level as string) || ''
    return level === 'heavy' || level === 'blocked'
  })

  const allFree = data.every((d) => {
    const level = (d.metadata?.congestion_level as string) || 'free'
    return level === 'free'
  })

  return (
    <div className="border border-white/[0.06] bg-white/[0.01] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-mono font-medium uppercase tracking-wider text-white/30">Traffic Flow</h3>
        <span className="text-[10px] font-mono text-white/15">
          {congested.length > 0 ? `${congested.length} congested` : `${data.length} zones`}
        </span>
      </div>

      {allFree ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-green-500/10 bg-green-500/[0.03]">
          <div className="w-2 h-2 rounded-full bg-green-400/60" />
          <span className="text-xs font-mono text-green-400/60">All clear — traffic flowing freely</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {data.slice(0, 6).map((doc) => {
            const level = (doc.metadata?.congestion_level as string) || 'free'
            const speed = (doc.metadata?.current_speed as number) || 0
            const freeFlow = (doc.metadata?.free_flow_speed as number) || 0
            const neighborhood = doc.geo?.neighborhood || doc.title || 'Unknown'
            const style = CONGESTION_STYLES[level] || CONGESTION_STYLES.free

            return (
              <div key={doc.id} className={`border ${style.border} bg-white/[0.01] px-3 py-2`}>
                <div className="text-xs font-medium text-white/60 truncate">{neighborhood}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${style.border} ${style.text}`}>
                    {style.label}
                  </span>
                  {speed > 0 && freeFlow > 0 && (
                    <span className="text-[10px] font-mono text-white/20">
                      {speed}/{freeFlow} mph
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
