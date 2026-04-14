/**
 * Minimal loading indicator shown while Dashboard data is fetched.
 */

interface Props {
  neighborhood: string
}

export default function LoadingFlow({ neighborhood }: Props) {
  return (
    <div className="border border-white/[0.06] p-8 sm:p-12 flex flex-col items-center justify-center gap-6 py-32">
      <div className="w-10 h-10 border-2 border-white/10 border-t-cyan-400/70 rounded-full animate-spin" />
      <p className="text-sm text-white/40 font-mono uppercase tracking-wider">
        Analyzing {neighborhood}
      </p>
    </div>
  )
}
