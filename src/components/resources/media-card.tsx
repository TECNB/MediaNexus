import { useState } from 'react'
import { ChevronDown, Clapperboard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type {
  MovieQualityProfile,
  MovieSearchItem,
  SearchableResourceItem,
  SeriesSearchItem,
} from '@/types/resources'

export type MediaCardAddStatus = 'idle' | 'loading' | 'success' | 'error'

type MediaCardProps = {
  item: SearchableResourceItem
  addStatus?: MediaCardAddStatus
  addMessage?: string | null
  qualityProfiles?: MovieQualityProfile[]
  selectedQualityProfileId?: number
  onQualityProfileChange?: (
    item: MovieSearchItem,
    qualityProfileId: number,
  ) => void
  onAddMovie?: (item: MovieSearchItem, qualityProfileId: number) => void
}

function isSeriesSearchItem(
  item: SearchableResourceItem,
): item is SeriesSearchItem {
  return 'tvdb_id' in item
}

export function MediaCard({
  item,
  addStatus = 'idle',
  addMessage = null,
  qualityProfiles = [],
  selectedQualityProfileId,
  onQualityProfileChange,
  onAddMovie,
}: MediaCardProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const isSeriesItem = isSeriesSearchItem(item)
  const canAddMovie = !isSeriesItem && Boolean(onAddMovie)
  const isAddLoading = addStatus === 'loading'
  const isAddSuccess = addStatus === 'success'
  const hasQualityProfiles = qualityProfiles.length > 0
  const hasSelectedQualityProfile =
    typeof selectedQualityProfileId === 'number'
  const isQualitySelectDisabled =
    !canAddMovie || isAddLoading || isAddSuccess || !hasQualityProfiles
  const isAddDisabled =
    !canAddMovie ||
    isAddLoading ||
    isAddSuccess ||
    !hasQualityProfiles ||
    !hasSelectedQualityProfile
  const posterSrc = item.poster?.trim()
  const originalTitle = item.original_title?.trim()
  const overview = item.overview?.trim()
  const showOriginalTitle = Boolean(originalTitle && originalTitle !== item.title)
  const network = isSeriesItem ? item.network?.trim() : null
  const seriesType = isSeriesItem ? item.series_type?.trim() : null
  const metaLabel = network || seriesType

  const addFeedbackTone =
    addStatus === 'error' ? 'text-rose-500' : 'text-emerald-600'
  const addButtonTitle = !canAddMovie
    ? '暂未实现'
    : !hasQualityProfiles
      ? '质量档位未加载'
      : undefined

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
            {metaLabel ? (
              <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                {metaLabel}
              </p>
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
              value={selectedQualityProfileId ?? ''}
              onChange={(event) => {
                if (isSeriesItem) {
                  return
                }

                if (!event.target.value) {
                  return
                }

                const nextQualityProfileId = Number(event.target.value)

                if (Number.isFinite(nextQualityProfileId)) {
                  onQualityProfileChange?.(item, nextQualityProfileId)
                }
              }}
              disabled={isQualitySelectDisabled}
              aria-label={`${item.title} 质量档位`}
              className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/60 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {hasQualityProfiles ? (
                qualityProfiles.map((qualityProfile) => (
                  <option key={qualityProfile.id} value={qualityProfile.id}>
                    {qualityProfile.name}
                  </option>
                ))
              ) : (
                <option value="">质量档位</option>
              )}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          <Button
            type="button"
            disabled={isAddDisabled}
            title={addButtonTitle}
            onClick={() => {
              if (
                !isSeriesItem &&
                typeof selectedQualityProfileId === 'number'
              ) {
                onAddMovie?.(item, selectedQualityProfileId)
              }
            }}
            className="h-9 w-full rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-none hover:bg-slate-800 sm:w-auto"
          >
            添加
          </Button>
        </div>

        {addMessage ? (
          <p className={`text-xs font-medium ${addFeedbackTone}`}>
            {addMessage}
          </p>
        ) : null}
      </div>
    </article>
  )
}
