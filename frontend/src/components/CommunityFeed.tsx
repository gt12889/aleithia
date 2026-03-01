import type { Document } from '../types/index.ts'

function parseViewCount(raw: string): number {
  if (!raw) return 0
  const cleaned = raw.trim().toUpperCase().replace(/,/g, '')
  const match = cleaned.match(/^([\d.]+)\s*([KMB])?$/)
  if (!match) return parseInt(cleaned, 10) || 0
  const num = parseFloat(match[1])
  const suffix = match[2]
  if (suffix === 'K') return Math.round(num * 1_000)
  if (suffix === 'M') return Math.round(num * 1_000_000)
  if (suffix === 'B') return Math.round(num * 1_000_000_000)
  return Math.round(num)
}

function isCountOnlyText(raw: string): boolean {
  if (!raw) return false
  return /^\s*\d[\d,.\s]*[KMB]?\s*$/i.test(raw)
}

function cleanTikTokContent(raw: string): string {
  const text = (raw || '').trim()
  if (!text) return ''
  if (isCountOnlyText(text)) return ''
  if (text.includes('\n[Transcript]')) {
    const [firstLine, ...rest] = text.split('\n')
    if (isCountOnlyText(firstLine)) {
      return rest.join('\n').trim()
    }
  }
  return text
}

function transcriptHeadline(raw: string): string {
  const text = cleanTikTokContent(raw)
  if (!text) return ''
  const transcriptPart = text.includes('[Transcript]') ? text.split('[Transcript]')[1] : text
  const compact = transcriptPart.replace(/\s+/g, ' ').trim()
  if (!compact) return ''

  const endMatch = compact.match(/^(.*?[.!?])(\s|$)/)
  const sentence = endMatch ? endMatch[1].trim() : compact
  const trimmed = sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence
  return trimmed.replace(/^[\d,.\s]+[KMB]?\s*/i, '').trim()
}

interface Props {
  reddit: Document[]
  tiktok: Document[]
  neighborhood?: string
  businessType?: string
}

function normalizeTerm(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[/_]+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function relevanceScore(video: Document, neighborhood?: string, businessType?: string): number {
  const metadata = video.metadata || {}
  const targetNeighborhood = normalizeTerm(neighborhood || '')
  const targetBusiness = normalizeTerm(businessType || '')

  const queryBusinessType = normalizeTerm(String(metadata.query_business_type || ''))
  const queryNeighborhood = normalizeTerm(String(metadata.query_neighborhood || ''))
  const queryScope = normalizeTerm(String(metadata.query_scope || ''))
  const queryText = normalizeTerm(String(metadata.search_query || ''))
  const geoNeighborhood = normalizeTerm(String(video.geo?.neighborhood || ''))
  const combinedText = normalizeTerm(`${video.title || ''} ${video.content || ''}`)

  // Hard reject explicit mismatches.
  if (targetBusiness && queryBusinessType && queryBusinessType !== targetBusiness) {
    return -1
  }
  if (targetNeighborhood && queryNeighborhood && queryNeighborhood !== targetNeighborhood) {
    return -1
  }
  if (targetNeighborhood && geoNeighborhood && geoNeighborhood !== targetNeighborhood) {
    return -1
  }
  // Priority 1: business type relevance.
  let businessScore = 0
  if (!targetBusiness) {
    businessScore = 1
  } else if (queryBusinessType === targetBusiness) {
    businessScore = 4
  } else if (queryText.includes(targetBusiness) || combinedText.includes(targetBusiness)) {
    businessScore = 3
  } else {
    return -1
  }

  // Priority 2: neighborhood relevance.
  let neighborhoodScore = 0
  if (!targetNeighborhood) {
    neighborhoodScore = 0
  } else if (queryNeighborhood === targetNeighborhood || geoNeighborhood === targetNeighborhood) {
    neighborhoodScore = 2
  } else if (queryScope === 'city') {
    neighborhoodScore = 1
  } else if (combinedText.includes(targetNeighborhood)) {
    neighborhoodScore = 1
  } else if (queryScope === 'local') {
    return -1
  }

  return businessScore * 100 + neighborhoodScore * 10
}

export default function CommunityFeed({ reddit, tiktok, neighborhood, businessType }: Props) {
  const filteredTikTok = tiktok
    .map((video) => ({ video, relevance: relevanceScore(video, neighborhood, businessType) }))
    .filter((entry) => entry.relevance >= 0)
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance
      const viewsA = parseViewCount(String(a.video.metadata?.views || ''))
      const viewsB = parseViewCount(String(b.video.metadata?.views || ''))
      return viewsB - viewsA
    })
    .map((entry) => entry.video)
  const hasContent = reddit.length > 0 || filteredTikTok.length > 0

  if (!hasContent) {
    return (
      <div className="border border-white/[0.06] p-8 text-center text-xs font-mono text-white/20 uppercase tracking-wider">
        No community data available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reddit.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-mono font-medium uppercase tracking-wider text-white/30">Reddit Discussions</h3>
            <span className="text-[10px] font-mono text-white/15">{reddit.length} posts</span>
          </div>
          {reddit.map((post) => {
            const subreddit = (post.metadata?.subreddit as string) || ''
            const score = (post.metadata?.score as number) || 0
            const numComments = (post.metadata?.num_comments as number) || 0

            return (
              <div key={post.id} className="border border-white/[0.06] bg-white/[0.01] p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">{post.title}</h4>
                    {post.content && (
                      <p className="text-xs text-white/30 leading-relaxed mb-2">
                        {post.content.substring(0, 200)}
                        {post.content.length > 200 && '...'}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-white/15">
                      <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                      {subreddit && (
                        <span className="px-2 py-0.5 border border-green-500/20 text-green-400/60">
                          r/{subreddit}
                        </span>
                      )}
                      {score > 0 && <span>{score} pts</span>}
                      {numComments > 0 && <span>{numComments} comments</span>}
                    </div>
                  </div>
                  {post.url && (
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono uppercase tracking-wider text-white/25 hover:text-white/50 ml-4 shrink-0 transition-colors"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tiktok.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-mono font-medium uppercase tracking-wider text-white/30">TikTok</h3>
            <span className="text-[10px] font-mono text-white/15">{filteredTikTok.length} videos</span>
          </div>
          {filteredTikTok.length === 0 && (
            <div className="border border-white/[0.06] bg-white/[0.01] p-4 text-[10px] font-mono uppercase tracking-wider text-white/25">
              No relevant TikTok videos for this profile yet
            </div>
          )}
          {filteredTikTok.map((video) => {
            const creator = (video.metadata?.creator as string) || ''
            const query = (video.metadata?.search_query as string) || ''
            const views = parseViewCount((video.metadata?.views as string) || '')
            const hashtags = (video.metadata?.hashtags as string[]) || []
            const rawTitle = (video.title || '').trim()
            const transcriptTitle = transcriptHeadline(video.content)
            const hasMeaningfulTitle = rawTitle && !isCountOnlyText(rawTitle) && rawTitle.toLowerCase() !== 'tiktok video'
            const titleText = hasMeaningfulTitle
              ? rawTitle
              : transcriptTitle || (creator ? `@${creator}` : '') || (query ? `TikTok: ${query}` : 'TikTok video')
            const contentText = cleanTikTokContent(video.content)

            return (
              <div key={video.id} className="border border-white/[0.06] bg-white/[0.01] p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">{titleText}</h4>
                    {contentText && (
                      <p className="text-xs text-white/30 leading-relaxed mb-2">
                        {contentText.substring(0, 150)}
                        {contentText.length > 150 && '...'}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-white/15 flex-wrap">
                      <span>{new Date(video.timestamp).toLocaleDateString()}</span>
                      {creator && <span>@{creator}</span>}
                      {views > 0 && <span>{views.toLocaleString()} views</span>}
                      {hashtags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 border border-pink-500/20 text-pink-400/60">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {video.url && (
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono uppercase tracking-wider text-white/25 hover:text-white/50 ml-4 shrink-0 transition-colors"
                    >
                      Watch
                    </a>
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
