interface Props {
  sources: { name: string; count: number; active: boolean }[]
}

export default function DataSourceBadge({ sources }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((s) => (
        <div
          key={s.name}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
            s.active
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-gray-800 text-gray-500 border-gray-700'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${s.active ? 'bg-green-400' : 'bg-gray-600'}`} />
          {s.name}
          {s.count > 0 && <span className="text-gray-500">({s.count})</span>}
        </div>
      ))}
    </div>
  )
}
