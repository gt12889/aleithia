import type { Document } from '../types/index.ts'

interface Props {
  reddit: Document[]
  tiktok: Document[]
}

export default function CommunityFeed({ reddit, tiktok }: Props) {
  const hasContent = reddit.length > 0 || tiktok.length > 0

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
            <span className="text-[10px] font-mono text-white/15">{tiktok.length} videos</span>
          </div>
          {tiktok.map((video) => {
            const creator = (video.metadata?.creator as string) || ''
            const views = (video.metadata?.view_count as number) || 0
            const hashtags = (video.metadata?.hashtags as string[]) || []

            return (
              <div key={video.id} className="border border-white/[0.06] bg-white/[0.01] p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">{video.title}</h4>
                    {video.content && (
                      <p className="text-xs text-white/30 leading-relaxed mb-2">
                        {video.content.substring(0, 150)}
                        {video.content.length > 150 && '...'}
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
