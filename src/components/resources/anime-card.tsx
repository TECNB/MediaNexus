import { useState } from 'react'
import { Clapperboard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SelectControl } from '@/components/ui/form-control'
import { cn } from '@/lib/utils'
import type {
  AnimeSearchItem,
  AnimeSubtitleGroup,
  AnimeSubscriptionPreview,
} from '@/types/anime'

export type AnimeCardLoadStatus = 'idle' | 'loading' | 'success' | 'error'
export type AnimeCardSubscribeStatus = 'idle' | 'loading' | 'success' | 'error'

type AnimeCardProps = {
  item: AnimeSearchItem
  groups?: AnimeSubtitleGroup[]
  groupsStatus?: AnimeCardLoadStatus
  groupsMessage?: string | null
  selectedGroupId?: string
  preview?: AnimeSubscriptionPreview | null
  previewStatus?: AnimeCardLoadStatus
  previewMessage?: string | null
  subscribeStatus?: AnimeCardSubscribeStatus
  subscribeMessage?: string | null
  onGroupChange?: (item: AnimeSearchItem, groupId: string) => void
  onSubscribe?: (item: AnimeSearchItem) => void
}

export function AnimeCard({
  item,
  groups = [],
  groupsStatus = 'idle',
  groupsMessage = null,
  selectedGroupId,
  preview = null,
  previewStatus = 'idle',
  previewMessage = null,
  subscribeStatus = 'idle',
  subscribeMessage = null,
  onGroupChange,
  onSubscribe,
}: AnimeCardProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const coverSrc = item.cover?.trim()
  const weekLabel = item.week_label?.trim()
  const sourceLabel = weekLabel ? `Mikan · ${weekLabel}` : 'Mikan'
  const shouldShowScore = typeof item.score === 'number' && item.score > 0
  const isGroupsLoading = groupsStatus === 'loading'
  const isPreviewLoading = previewStatus === 'loading'
  const isSubscribeLoading = subscribeStatus === 'loading'
  const isSubscribed = item.exists || subscribeStatus === 'success'
  const hasGroups = groups.length > 0
  const activeSelectedGroupId = selectedGroupId ?? groups[0]?.id ?? ''
  const hasPreview = previewStatus === 'success' && preview !== null
  const canSubscribe =
    !isSubscribed &&
    !isSubscribeLoading &&
    hasPreview &&
    preview.preview_count > 0
  const selectDisabled =
    isSubscribed || isGroupsLoading || isSubscribeLoading || !hasGroups
  const subscribeButtonLabel = isSubscribeLoading
    ? '正在订阅…'
    : isSubscribed
      ? item.exists
        ? '已订阅'
        : (subscribeMessage ?? '已触发下载')
      : '订阅'
  const feedbackTone =
    subscribeStatus === 'error' || previewStatus === 'error'
      ? 'text-rose-500'
      : 'text-emerald-600'

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

        {isSubscribed ? (
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

        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SelectControl
              value={activeSelectedGroupId}
              onChange={(event) => {
                if (event.target.value) {
                  onGroupChange?.(item, event.target.value)
                }
              }}
              disabled={selectDisabled}
              aria-label={`${item.title} 字幕组`}
              wrapperClassName="min-w-0 flex-1"
              className="h-9 text-xs text-slate-600"
            >
              {hasGroups ? (
                groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))
              ) : (
                <option value="">
                  {isGroupsLoading ? '字幕组加载中' : '字幕组'}
                </option>
              )}
            </SelectControl>

            <Button
              type="button"
              disabled={!canSubscribe}
              onClick={() => onSubscribe?.(item)}
              className="h-9 w-full rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-none hover:bg-slate-800 sm:w-auto"
            >
              {subscribeButtonLabel}
            </Button>
          </div>

          <div className="min-h-[18px] text-xs font-medium">
            {groupsStatus === 'error' && groupsMessage ? (
              <p className="text-rose-500">{groupsMessage}</p>
            ) : isPreviewLoading ? (
              <p className="text-slate-400">正在预览…</p>
            ) : hasPreview ? (
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <span className="text-slate-500">
                  预览 {preview.preview_count} 条
                  {typeof preview.season === 'number'
                    ? ` · 第 ${preview.season} 季`
                    : ''}
                </span>
                {preview.has_missing_episodes ? (
                  <span className="text-rose-500">
                    {preview.missing_summary ?? '缺集'}
                  </span>
                ) : null}
              </div>
            ) : previewStatus === 'error' && previewMessage ? (
              <p className="text-rose-500">{previewMessage}</p>
            ) : groupsStatus === 'success' && !hasGroups ? (
              <p className="text-slate-400">未找到中文字幕组</p>
            ) : null}
          </div>

          {subscribeMessage ? (
            <p className={cn('text-xs font-medium', feedbackTone)}>
              {subscribeMessage}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
