import { useState } from 'react'
import { Clapperboard } from 'lucide-react'

import type { AnimeSearchItem } from '@/types/anime'

type AnimeCardProps = {
  item: AnimeSearchItem
}

export function AnimeCard({ item }: AnimeCardProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const coverSrc = item.cover?.trim()
  const weekLabel = item.week_label?.trim()
  const sourceLabel = weekLabel ? `Mikan · ${weekLabel}` : 'Mikan'
  const shouldShowScore = typeof item.score === 'number' && item.score > 0

  return (
    <article className="group space-y-3">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[22px] bg-slate-200">
        {coverSrc && !hasImageError ? (
          <img
            src={coverSrc}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
            onError={() => setHasImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-100 text-slate-400">
            <Clapperboard className="h-8 w-8" />
            <span className="text-xs font-medium tracking-[0.18em] text-slate-500">
              POSTER
            </span>
          </div>
        )}

        {item.exists ? (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(16,185,129,0.24)]">
            已订阅
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-slate-900">
              {item.title}
            </h3>
            <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              {sourceLabel}
            </p>
          </div>

          {shouldShowScore ? (
            <span className="shrink-0 pt-0.5 text-xs font-semibold text-amber-500">
              {item.score?.toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
