import Spline from '@splinetool/react-spline'
import type { Application } from '@splinetool/runtime'

interface Props {
  onGetStarted: () => void
}

function tuneScene(app: Application) {
  const a = app as Record<string, any>
  const scene = a._scene

  scene?.traverseVisibleEntity?.((entity: any) => {
    if (entity.type === 'ParticleSystem') {
      entity.data.speed *= 0.5
      entity.data.birthRatePerSec = Math.max(1, entity.data.birthRatePerSec * 0.5)
      entity.data.noiseStrength *= 0.5
    }
  })
}

export default function LandingPage({ onGetStarted }: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Spline
          scene="https://prod.spline.design/Mt-87SuFLZp8yZiy/scene.splinecode"
          onLoad={(app) => tuneScene(app)}
        />
      </div>

      <div className="absolute inset-0 z-10 bg-gradient-to-b from-gray-950/70 via-gray-950/40 to-gray-950/80 pointer-events-none" />

      <div className="relative z-20 min-h-screen flex flex-col">
        <nav className="flex items-center justify-between px-8 py-6">
          <span className="text-2xl font-bold tracking-tight text-white">
            Alethia
          </span>
          <button
            onClick={onGetStarted}
            className="px-5 py-2 text-sm font-medium rounded-full border border-white/20 text-white/90 hover:bg-white/10 backdrop-blur-sm transition-colors cursor-pointer"
          >
            Get Started
          </button>
        </nav>

        <div className="flex-1 flex items-center justify-center px-8">
          <div className="max-w-2xl text-center">
            <h1 className="text-6xl sm:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
              Chicago business intelligence in{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                seconds
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-300/90 mb-10 max-w-xl mx-auto leading-relaxed">
              9 live data sources fused into one city graph. Get risk scores,
              opportunity briefs, and neighborhood insights — before you sign
              the lease.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onGetStarted}
                className="px-8 py-3.5 text-base font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-colors cursor-pointer"
              >
                Analyze a Neighborhood
              </button>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 text-base font-semibold rounded-xl border border-white/15 text-white/90 hover:bg-white/10 backdrop-blur-sm transition-colors"
              >
                View Source
              </a>
            </div>
          </div>
        </div>

        <footer className="px-8 py-6 text-center">
          <p className="text-sm text-gray-500">
            Built at HackIllinois 2026 — Powered by Chicago Open Data, Reddit,
            Yelp, and more
          </p>
        </footer>
      </div>
    </div>
  )
}
