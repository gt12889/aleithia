import { useEffect, useState } from 'react'
import { MemoryGraph } from '@supermemory/memory-graph'
import type { DocumentWithMemories } from '@supermemory/memory-graph'
import { api } from '../api.ts'

interface Props {
  onBack: () => void
}

export default function MemoryGraphPage({ onBack }: Props) {
  const [documents, setDocuments] = useState<DocumentWithMemories[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    api
      .graph({ page: 1, limit: 500 })
      .then((data) => {
        setDocuments((data as { documents?: DocumentWithMemories[] }).documents ?? [])
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)))
        setIsLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-[#06080d] text-white flex flex-col">
      <nav className="flex items-center justify-between px-10 py-5 bg-[#06080d]/95 backdrop-blur-md border-b border-white/[0.06] shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="text-lg font-semibold tracking-tight text-white uppercase hover:text-white/80 transition-colors cursor-pointer"
        >
          Alethia
        </button>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors cursor-pointer"
        >
          Back
        </button>
      </nav>
      <div className="flex-1 min-h-[60vh] w-full">
        <MemoryGraph
          documents={documents}
          isLoading={isLoading}
          error={error}
          variant="console"
        />
      </div>
    </div>
  )
}
