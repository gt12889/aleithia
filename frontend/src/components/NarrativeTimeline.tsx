import { useMemo } from 'react'
import type { NeighborhoodData } from '../types/index.ts'

interface TimelineEvent {
  timestamp: Date
  source: string
  sourceColor: string
  headline: string
  detail?: string
}

const SOURCE_COLORS: Record<string, string> = {
  'CCTV': 'text-cyan-400',
  'Reddit': 'text-orange-400',
  'TikTok': 'text-pink-400',
  'City Council': 'text-yellow-400',
  'Permits': 'text-blue-400',
  'News': 'text-emerald-400',
  'License': 'text-violet-400',
  'Inspection': 'text-red-400',
  'Reviews': 'text-amber-400',
  'Traffic': 'text-teal-400',
  'Real Estate': 'text-indigo-400',
}

const SOURCE_DOT_COLORS: Record<string, string> = {
  'CCTV': 'bg-cyan-400',
  'Reddit': 'bg-orange-400',
  'TikTok': 'bg-pink-400',
  'City Council': 'bg-yellow-400',
  'Permits': 'bg-blue-400',
  'News': 'bg-emerald-400',
  'License': 'bg-violet-400',
  'Inspection': 'bg-red-400',
  'Reviews': 'bg-amber-400',
  'Traffic': 'bg-teal-400',
  'Real Estate': 'bg-indigo-400',
}

function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffMins < 60) return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffWeeks === 1) return '1 week ago'
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`
  if (diffMonths === 1) return '1 month ago'
  return `${diffMonths} months ago`
}

function parseTimestamp(ts: string | undefined): Date | null {
  if (!ts) return null
  const d = new Date(ts)
  return isNaN(d.getTime()) ? null : d
}

function buildEvents(data: NeighborhoodData): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // CCTV
  if (data.cctv?.cameras) {
    for (const cam of data.cctv.cameras) {
      const camAny = cam as unknown as Record<string, unknown>
      const ts = parseTimestamp((camAny.last_updated as string) || (camAny.timestamp as string))
      const pedestrians = (camAny.pedestrian_count as number) ?? (camAny.pedestrians as number) ?? 0
      const loc = (camAny.location as string) || (camAny.name as string) || 'camera'
      if (ts) {
        events.push({
          timestamp: ts,
          source: 'CCTV',
          sourceColor: SOURCE_COLORS['CCTV'],
          headline: `${pedestrians} pedestrians detected near ${loc}`,
          detail: `${data.cctv?.density || 'unknown'} foot traffic density`,
        })
      }
    }
  }

  // Reddit
  if (data.reddit) {
    for (const post of data.reddit) {
      const ts = parseTimestamp(post.timestamp)
      if (ts) {
        const meta = post.metadata || {}
        const score = (meta.score as number) || 0
        const comments = (meta.num_comments as number) || 0
        events.push({
          timestamp: ts,
          source: 'Reddit',
          sourceColor: SOURCE_COLORS['Reddit'],
          headline: post.title || (post.content?.slice(0, 80) + '…') || 'Reddit post',
          detail: score > 0 || comments > 0 ? `${score} upvotes, ${comments} comments` : undefined,
        })
      }
    }
  }

  // TikTok
  if (data.tiktok) {
    for (const post of data.tiktok) {
      const ts = parseTimestamp(post.timestamp)
      if (ts) {
        events.push({
          timestamp: ts,
          source: 'TikTok',
          sourceColor: SOURCE_COLORS['TikTok'],
          headline: post.title || (post.content?.slice(0, 80) + '…') || 'TikTok post',
        })
      }
    }
  }

  // Politics / City Council
  for (const item of data.politics) {
    const ts = parseTimestamp(item.timestamp)
    if (ts) {
      const meta = item.metadata || {}
      events.push({
        timestamp: ts,
        source: 'City Council',
        sourceColor: SOURCE_COLORS['City Council'],
        headline: item.title || 'Legislative item',
        detail: (meta.sponsor as string) ? `Sponsor: ${meta.sponsor}` : undefined,
      })
    }
  }

  // Permits
  for (const permit of data.permits || []) {
    const ts = parseTimestamp(permit.timestamp)
    if (ts) {
      const raw = (permit.metadata?.raw_record || {}) as Record<string, string>
      const addr = [raw.street_number, raw.street_direction, raw.street_name].filter(Boolean).join(' ')
      const cost = raw.reported_cost ? `Reported cost: $${Number(raw.reported_cost).toLocaleString()}` : undefined
      events.push({
        timestamp: ts,
        source: 'Permits',
        sourceColor: SOURCE_COLORS['Permits'],
        headline: `${raw.work_type || raw.permit_type || 'Permit'} at ${addr || 'nearby location'}`,
        detail: cost,
      })
    }
  }

  // News
  for (const article of data.news) {
    const ts = parseTimestamp(article.timestamp)
    if (ts) {
      const meta = article.metadata || {}
      events.push({
        timestamp: ts,
        source: 'News',
        sourceColor: SOURCE_COLORS['News'],
        headline: article.title || 'News article',
        detail: (meta.source_name as string) ? `— ${meta.source_name}` : undefined,
      })
    }
  }

  // Licenses
  for (const license of data.licenses || []) {
    const ts = parseTimestamp(license.timestamp)
    if (ts) {
      const raw = (license.metadata?.raw_record || {}) as Record<string, string>
      const name = raw.doing_business_as_name || raw.legal_name || 'Business'
      const desc = raw.license_description || 'License'
      const status = raw.license_status || ''
      events.push({
        timestamp: ts,
        source: 'License',
        sourceColor: SOURCE_COLORS['License'],
        headline: `${name} — ${desc}`,
        detail: status ? status.toUpperCase() : undefined,
      })
    }
  }

  // Inspections
  for (const insp of data.inspections || []) {
    const ts = parseTimestamp(insp.timestamp)
    if (ts) {
      const raw = (insp.metadata?.raw_record || {}) as Record<string, string>
      const name = raw.dba_name || raw.aka_name || 'Establishment'
      const result = raw.results || ''
      events.push({
        timestamp: ts,
        source: 'Inspection',
        sourceColor: SOURCE_COLORS['Inspection'],
        headline: `${name} — ${raw.inspection_type || 'Inspection'}`,
        detail: result || undefined,
      })
    }
  }

  // Reviews
  if (data.reviews) {
    for (const review of data.reviews) {
      const ts = parseTimestamp(review.timestamp)
      if (ts) {
        const meta = review.metadata || {}
        const rating = (meta.rating as number) || 0
        events.push({
          timestamp: ts,
          source: 'Reviews',
          sourceColor: SOURCE_COLORS['Reviews'],
          headline: review.title || (review.content?.slice(0, 80) + '…') || 'Review',
          detail: rating > 0 ? `${rating}★` : undefined,
        })
      }
    }
  }

  // Traffic
  if (data.traffic) {
    for (const t of data.traffic) {
      const ts = parseTimestamp(t.timestamp)
      if (ts) {
        const meta = t.metadata || {}
        events.push({
          timestamp: ts,
          source: 'Traffic',
          sourceColor: SOURCE_COLORS['Traffic'],
          headline: t.title || 'Traffic update',
          detail: (meta.congestion_level as string) ? `Congestion: ${meta.congestion_level}` : undefined,
        })
      }
    }
  }

  // Real estate
  if (data.realestate) {
    for (const re of data.realestate) {
      const ts = parseTimestamp(re.timestamp)
      if (ts) {
        events.push({
          timestamp: ts,
          source: 'Real Estate',
          sourceColor: SOURCE_COLORS['Real Estate'],
          headline: re.title || (re.content?.slice(0, 80) + '…') || 'Listing',
        })
      }
    }
  }

  // Sort by most recent first
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return events
}

interface Props {
  data: NeighborhoodData
  neighborhood: string
  maxEvents?: number
}

export default function NarrativeTimeline({ data, neighborhood, maxEvents = 25 }: Props) {
  const events = useMemo(() => buildEvents(data).slice(0, maxEvents), [data, maxEvents])

  if (events.length === 0) {
    return (
      <div className="border border-white/[0.06] bg-white/[0.01] p-6">
        <div className="text-[10px] font-mono uppercase tracking-wider text-white/20">No timeline events</div>
      </div>
    )
  }

  return (
    <div className="border border-white/[0.06] bg-white/[0.01] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-white/30">What's Happening</h3>
          <span className="text-xs font-mono text-white/50">{neighborhood}</span>
        </div>
        <span className="text-[10px] font-mono text-white/15">{events.length} events</span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-white/[0.06]" />

        <div className="space-y-4">
          {events.map((event, i) => (
            <div key={i} className="relative pl-6">
              {/* Dot */}
              <div className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-[#06080d] ${SOURCE_DOT_COLORS[event.source] || 'bg-white/30'}`} />

              {/* Time + Source */}
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono text-white/20">{timeAgo(event.timestamp)}</span>
                <span className={`text-[10px] font-mono uppercase tracking-wider ${event.sourceColor}`}>[{event.source}]</span>
              </div>

              {/* Headline */}
              <div className="text-xs text-white/70 leading-relaxed">{event.headline}</div>

              {/* Detail */}
              {event.detail && (
                <div className="text-[10px] font-mono text-white/25 mt-0.5">{event.detail}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
