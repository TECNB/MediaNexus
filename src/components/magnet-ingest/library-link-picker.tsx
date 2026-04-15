import { CheckCircle2, Clapperboard, Loader2, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MovieSearchItem } from '@/types/resources'

type MovieSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

type LibraryLinkPickerProps = {
  keyword: string
  items: MovieSearchItem[]
  selectedItem: MovieSearchItem | null
  searchStatus: MovieSearchStatus
  searchError: string | null
  searchDisabled?: boolean
  onKeywordChange: (value: string) => void
  onSearchSubmit: () => void
  onSelectItem: (item: MovieSearchItem) => void
  onClearSelection: () => void
}

function PosterThumbnail({
  poster,
  title,
  inverted = false,
}: {
  poster: string | null
  title: string
  inverted?: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl',
        inverted ? 'bg-white/10' : 'bg-slate-100',
      )}
    >
      {poster ? (
        <img src={poster} alt={title} className="h-full w-full object-cover" />
      ) : (
        <Clapperboard
          className={cn(
            'h-4 w-4',
            inverted ? 'text-white/60' : 'text-slate-400',
          )}
        />
      )}
    </div>
  )
}

function getMovieMeta(item: MovieSearchItem) {
  const parts = [item.original_title, item.year ? String(item.year) : null].filter(
    Boolean,
  )

  return parts.length > 0 ? parts.join(' · ') : '电影'
}

export function LibraryLinkPicker({
  keyword,
  items,
  selectedItem,
  searchStatus,
  searchError,
  searchDisabled = false,
  onKeywordChange,
  onSearchSubmit,
  onSelectItem,
  onClearSelection,
}: LibraryLinkPickerProps) {
  function renderSearchResults() {
    switch (searchStatus) {
      case 'loading':
        return (
          <div className="px-6 py-16 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
            <p className="mt-3 text-base font-semibold text-slate-900">
              正在搜索电影
            </p>
            <p className="mt-2 text-sm text-slate-500">
              已连接媒体库电影搜索接口，请稍候。
            </p>
          </div>
        )

      case 'error':
        return (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-slate-900">搜索失败</p>
            <p className="mt-2 text-sm text-slate-500">
              {searchError ?? '电影搜索失败，请稍后重试。'}
            </p>
          </div>
        )

      case 'empty':
        return (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-slate-900">未找到匹配电影</p>
            <p className="mt-2 text-sm text-slate-500">
              试试中文名、英文名或年份关键词。
            </p>
          </div>
        )

      case 'success':
        return (
          <div className="max-h-[440px] divide-y divide-slate-100 overflow-y-auto">
            {items.map((item) => {
              const isSelected = selectedItem?.id === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    'flex w-full items-center gap-4 px-4 py-4 text-left transition-colors',
                    isSelected
                      ? 'bg-slate-950 text-white'
                      : 'bg-white hover:bg-slate-50',
                  )}
                >
                  <PosterThumbnail
                    poster={item.poster}
                    title={item.title}
                    inverted={isSelected}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      {item.year ? (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                            isSelected
                              ? 'bg-white/10 text-white/80'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {item.year}
                        </span>
                      ) : null}
                    </div>

                    <p
                      className={cn(
                        'mt-1 truncate text-sm',
                        isSelected ? 'text-white/70' : 'text-slate-500',
                      )}
                    >
                      {item.original_title || '暂无原始标题'}
                    </p>

                    {item.overview ? (
                      <p
                        className={cn(
                          'mt-1 truncate text-xs',
                          isSelected ? 'text-white/60' : 'text-slate-400',
                        )}
                      >
                        {item.overview}
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    {isSelected ? (
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-slate-200 bg-white" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )

      case 'idle':
      default:
        return (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-slate-900">搜索并选择电影</p>
            <p className="mt-2 text-sm text-slate-500">
              输入关键词后，点击搜索按钮或按回车发起查询。
            </p>
          </div>
        )
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-[22px] border px-4 py-4 transition-colors',
          selectedItem
            ? 'border-slate-900 bg-slate-950 text-white'
            : 'border-dashed border-slate-300 bg-slate-50/80 text-slate-500',
        )}
      >
        <p
          className={cn(
            'text-[11px] font-semibold uppercase tracking-[0.24em]',
            selectedItem ? 'text-white/70' : 'text-slate-400',
          )}
        >
          Current Binding
        </p>

        {selectedItem ? (
          <div className="mt-3 flex items-center gap-4">
            <PosterThumbnail
              poster={selectedItem.poster}
              title={selectedItem.title}
              inverted
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">
                {selectedItem.title}
              </p>
              <p className="truncate text-sm text-white/70">
                {getMovieMeta(selectedItem)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white" />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
                className="h-9 rounded-full border border-white/15 px-3 text-xs font-semibold text-white hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                清除选择
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Clapperboard className="h-4 w-4 shrink-0 text-slate-400" />
            <span>尚未绑定电影项目，请从下方搜索结果中选择一个目标条目。</span>
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()

          if (searchDisabled) {
            return
          }

          onSearchSubmit()
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          type="search"
          value={keyword}
          autoComplete="off"
          placeholder="搜索电影标题或年份..."
          aria-label="搜索媒体库电影"
          onChange={(event) => onKeywordChange(event.target.value)}
          className="h-12 w-full rounded-[20px] border border-slate-200 bg-white pl-11 pr-28 text-sm text-slate-900 shadow-shell outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200/60"
        />

        <Button
          type="submit"
          size="sm"
          disabled={searchDisabled}
          className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white shadow-none hover:bg-slate-800"
        >
          {searchStatus === 'loading' ? '搜索中...' : '搜索'}
        </Button>
      </form>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-shell">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Search Results
          </p>
          <p className="text-xs text-slate-400">
            {searchStatus === 'success' ? `${items.length} items` : 'movie only'}
          </p>
        </div>

        {renderSearchResults()}
      </div>
    </div>
  )
}
