import { useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  Clapperboard,
  CloudUpload,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  OpenListQualityTag,
  SearchableResourceItem,
  SeriesSearchItem,
} from '@/types/resources'

export type MediaCardAddStatus = 'idle' | 'loading' | 'success' | 'error'
export type MediaCardSeasonStatus =
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'

type MediaCardProps = {
  item: SearchableResourceItem
  taskProductType?: 'SERIES' | 'ANIME'
  addStatus?: MediaCardAddStatus
  addMessage?: string | null
  qualityTags?: OpenListQualityTag[]
  selectedQualityTag?: OpenListQualityTag
  seasonOptions?: number[]
  selectedSeasonNumber?: number | null
  seasonStatus?: MediaCardSeasonStatus
  seasonMessage?: string | null
  onQualityTagChange?: (
    item: SearchableResourceItem,
    qualityTag: OpenListQualityTag,
  ) => void
  onSeasonNumberChange?: (
    item: SeriesSearchItem,
    seasonNumber: number,
  ) => void
  onOpenListIngest?: (
    item: SearchableResourceItem,
    qualityTag: OpenListQualityTag,
    seasonNumber: number | null,
  ) => void
  onViewMore?: (
    item: SearchableResourceItem,
    qualityTag: OpenListQualityTag,
    seasonNumber: number | null,
  ) => void
}

function isSeriesSearchItem(
  item: SearchableResourceItem,
): item is SeriesSearchItem {
  return 'tvdb_id' in item
}

function getSeasonLabel(seasonNumber: number) {
  return `S${String(seasonNumber).padStart(2, '0')}`
}

export function MediaCard({
  item,
  taskProductType,
  addStatus = 'idle',
  addMessage = null,
  qualityTags = [],
  selectedQualityTag,
  seasonOptions = [],
  selectedSeasonNumber = null,
  seasonStatus,
  seasonMessage = null,
  onQualityTagChange,
  onSeasonNumberChange,
  onOpenListIngest,
  onViewMore,
}: MediaCardProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const isSeriesItem = isSeriesSearchItem(item)
  const isAddLoading = addStatus === 'loading'
  const isAddSuccess = addStatus === 'success'
  const hasQualityTags = qualityTags.length > 0
  const activeQualityTag = selectedQualityTag ?? qualityTags[0]
  const activeSeasonStatus = seasonStatus ?? (isSeriesItem ? 'loading' : null)
  const activeSeasonNumber =
    isSeriesItem &&
    activeSeasonStatus === 'success' &&
    typeof selectedSeasonNumber === 'number' &&
    seasonOptions.includes(selectedSeasonNumber)
      ? selectedSeasonNumber
      : null
  const isIngestDisabled =
    !onOpenListIngest ||
    isAddLoading ||
    isAddSuccess ||
    !activeQualityTag ||
    (isSeriesItem && typeof activeSeasonNumber !== 'number')
  const isViewMoreDisabled =
    !onViewMore ||
    !activeQualityTag ||
    (isSeriesItem && typeof activeSeasonNumber !== 'number')
  const posterSrc = item.poster?.trim()
  const originalTitle = item.original_title?.trim()
  const overview = item.overview?.trim()
  const showOriginalTitle = Boolean(
    originalTitle && originalTitle !== item.title,
  )
  const network = isSeriesItem ? item.network?.trim() : null
  const seriesType = isSeriesItem ? item.series_type?.trim() : null
  const mediaTypeLabel = isSeriesItem
    ? taskProductType === 'ANIME'
      ? 'ANIME'
      : 'SERIES'
    : 'MOVIE'
  const ingestActionLabel = isSeriesItem
    ? taskProductType === 'ANIME'
      ? '动漫整季入库'
      : '剧集入库'
    : '电影入库'
  const mediaMeta = [
    showOriginalTitle ? originalTitle : null,
    item.year ? String(item.year) : null,
    network || seriesType,
  ].filter(Boolean)
  const addFeedbackTone =
    addStatus === 'error' ? 'text-rose-500' : 'text-emerald-600'
  const seasonStatusLabel =
    activeSeasonStatus === 'loading'
      ? '加载中…'
      : activeSeasonStatus === 'empty'
        ? '暂无季数'
        : activeSeasonStatus === 'error'
          ? '加载失败'
          : null

  return (
    <article className="group overflow-hidden rounded-[24px] bg-white p-3 shadow-[0_20px_40px_rgba(15,23,42,0.035)] md:grid md:grid-cols-[minmax(150px,42%)_minmax(0,1fr)] md:gap-5">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[18px] bg-slate-100">
        <span className="absolute left-3 top-3 z-10 rounded-md bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
          {mediaTypeLabel}
        </span>

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
            <Clapperboard className="h-9 w-9" />
            <span className="text-xs font-medium tracking-[0.18em] text-slate-500">
              POSTER
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col pt-5 md:pt-1">
        <div className="min-w-0">
          <h3
            className="overflow-hidden text-lg font-semibold leading-tight text-slate-950 [display:-webkit-box] [-webkit-box-orient:vertical]"
            style={{ WebkitLineClamp: 2 }}
          >
            {item.title}
          </h3>
          {mediaMeta.length > 0 ? (
            <p className="mt-2 truncate text-xs font-medium text-slate-400">
              {mediaMeta.join(' · ')}
            </p>
          ) : null}
        </div>

        <p
          className="mt-4 min-h-[4.5rem] overflow-hidden text-sm leading-6 text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical]"
          style={{ WebkitLineClamp: 3 }}
        >
          {overview || '暂无简介'}
        </p>

        <div className="mt-auto space-y-3 pt-5">
          <div
            className={cn(
              'grid gap-3',
              isSeriesItem ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            {isSeriesItem ? (
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  目标季
                </span>
                <div className="relative">
                  <select
                    value={activeSeasonNumber ?? ''}
                    onChange={(event) => {
                      const nextSeasonNumber = Number(event.target.value)
                      if (Number.isInteger(nextSeasonNumber)) {
                        onSeasonNumberChange?.(item, nextSeasonNumber)
                      }
                    }}
                    disabled={
                      isAddLoading ||
                      isAddSuccess ||
                      activeSeasonStatus !== 'success'
                    }
                    aria-label={`${item.title} 目标季`}
                    className="h-10 w-full appearance-none rounded-xl bg-slate-100 px-3 pr-8 text-xs font-semibold text-slate-700 outline-none transition hover:bg-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {activeSeasonStatus === 'success' ? (
                      seasonOptions.map((seasonNumber) => (
                        <option key={seasonNumber} value={seasonNumber}>
                          {getSeasonLabel(seasonNumber)}
                        </option>
                      ))
                    ) : (
                      <option value="">{seasonStatusLabel}</option>
                    )}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>
              </label>
            ) : null}

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                分辨率
              </span>
              <div className="relative">
                <select
                  value={activeQualityTag ?? ''}
                  onChange={(event) => {
                    const nextQualityTag =
                      event.target.value as OpenListQualityTag
                    if (qualityTags.includes(nextQualityTag)) {
                      onQualityTagChange?.(item, nextQualityTag)
                    }
                  }}
                  disabled={isAddLoading || isAddSuccess || !hasQualityTags}
                  aria-label={`${item.title} 分辨率`}
                  className="h-10 w-full appearance-none rounded-xl bg-slate-100 px-3 pr-8 text-xs font-semibold text-slate-700 outline-none transition hover:bg-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {hasQualityTags ? (
                    qualityTags.map((qualityTag) => (
                      <option key={qualityTag} value={qualityTag}>
                        {qualityTag}
                      </option>
                    ))
                  ) : (
                    <option value="">分辨率</option>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </label>
          </div>

          {isSeriesItem && seasonMessage ? (
            <p
              className={cn(
                'text-xs font-medium',
                activeSeasonStatus === 'error'
                  ? 'text-rose-500'
                  : 'text-slate-400',
              )}
            >
              {seasonMessage}
            </p>
          ) : null}

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Button
              type="button"
              disabled={isIngestDisabled}
              onClick={() => {
                if (activeQualityTag) {
                  onOpenListIngest?.(item, activeQualityTag, activeSeasonNumber)
                }
              }}
              className="h-10 whitespace-nowrap rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white shadow-none hover:bg-slate-800"
            >
              {isAddLoading ? (
                '入库中…'
              ) : (
                <span className="inline-flex items-center gap-2">
                  <CloudUpload className="h-3.5 w-3.5" />
                  {ingestActionLabel}
                </span>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isViewMoreDisabled}
              onClick={() => {
                if (activeQualityTag) {
                  onViewMore?.(item, activeQualityTag, activeSeasonNumber)
                }
              }}
              className="h-10 rounded-xl border-slate-200 px-3 text-xs font-semibold text-slate-700 shadow-none hover:bg-slate-100"
            >
              查看更多
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {addMessage ? (
            <p className={`text-xs font-medium ${addFeedbackTone}`}>
              {addMessage}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
