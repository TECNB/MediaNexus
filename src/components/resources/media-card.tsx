import { useState } from 'react'
import { ChevronDown, Clapperboard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { MovieSearchItem } from '@/types/resources'

type MediaCardProps = {
  item: MovieSearchItem
}

const MEDIA_QUALITY_OPTIONS = ['4K UHD', '1080P', '4K Restored'] as const

type MediaQuality = (typeof MEDIA_QUALITY_OPTIONS)[number]

export function MediaCard({ item }: MediaCardProps) {
  const [selectedQuality, setSelectedQuality] = useState<MediaQuality>('1080P')
  const [hasImageError, setHasImageError] = useState(false)
  const posterSrc = item.poster?.trim()
  const originalTitle = item.original_title?.trim()
  const overview = item.overview?.trim()
  const showOriginalTitle = Boolean(originalTitle && originalTitle !== item.title)

  return (
    <article className="group space-y-3">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[22px] bg-slate-200">
        {posterSrc && !hasImageError ? (
          <img
            src={posterSrc}
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
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-slate-900">
              {item.title}
            </h3>
            {showOriginalTitle ? (
              <p className="truncate text-xs text-slate-400">{originalTitle}</p>
            ) : null}
          </div>
          <span className="shrink-0 pt-0.5 text-xs font-medium text-slate-400">
            {item.year ?? '待定'}
          </span>
        </div>

        <p
          className="overflow-hidden text-sm leading-6 text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical]"
          style={{ WebkitLineClamp: 3 }}
        >
          {overview || '暂无简介'}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <select
              value={selectedQuality}
              onChange={(event) =>
                setSelectedQuality(event.target.value as MediaQuality)
              }
              aria-label={`${item.title} 清晰度`}
              className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/60"
            >
              {MEDIA_QUALITY_OPTIONS.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          <Button
            type="button"
            disabled
            title="暂未实现"
            className="h-9 w-full rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-none hover:bg-slate-800 sm:w-auto"
          >
            + 入库
          </Button>
        </div>
      </div>
    </article>
  )
}
