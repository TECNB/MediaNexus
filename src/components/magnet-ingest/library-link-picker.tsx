import { CheckCircle2, Clapperboard, Search } from 'lucide-react'

import type { MagnetLibraryItem } from '@/data/mock-magnet-ingest'
import { magnetCategoryLabel } from '@/data/mock-magnet-ingest'
import { cn } from '@/lib/utils'

type LibraryLinkPickerProps = {
  keyword: string
  items: MagnetLibraryItem[]
  selectedItem: MagnetLibraryItem | null
  isShowingRecommendations: boolean
  onKeywordChange: (value: string) => void
  onSelectItem: (item: MagnetLibraryItem) => void
}

export function LibraryLinkPicker({
  keyword,
  items,
  selectedItem,
  isShowingRecommendations,
  onKeywordChange,
  onSelectItem,
}: LibraryLinkPickerProps) {
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
            <div className="h-16 w-12 overflow-hidden rounded-2xl bg-white/10">
              <img
                src={selectedItem.poster}
                alt={selectedItem.title}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">
                {selectedItem.title}
              </p>
              <p className="truncate text-sm text-white/70">
                {selectedItem.subtitle}
              </p>
            </div>

            <CheckCircle2 className="h-5 w-5 shrink-0 text-white" />
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Clapperboard className="h-4 w-4 shrink-0 text-slate-400" />
            <span>尚未绑定媒体库项目，请从下方搜索结果中选择一个目标条目。</span>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          type="search"
          value={keyword}
          autoComplete="off"
          placeholder="搜索电影、剧集或动漫库项目..."
          aria-label="搜索媒体库项目"
          onChange={(event) => onKeywordChange(event.target.value)}
          className="h-12 w-full rounded-[20px] border border-slate-200 bg-white pl-11 pr-28 text-sm text-slate-900 shadow-shell outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200/60"
        />

        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
          Local Filter
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-shell">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {isShowingRecommendations ? '推荐库项目' : '匹配结果'}
          </p>
          <p className="text-xs text-slate-400">{items.length} items</p>
        </div>

        {items.length > 0 ? (
          <div className="max-h-[440px] divide-y divide-slate-100 overflow-y-auto">
            {items.map((item) => {
              const isSelected = selectedItem?.id === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    'flex w-full items-center gap-4 px-4 py-4 text-left transition-colors',
                    isSelected
                      ? 'bg-slate-950 text-white'
                      : 'bg-white hover:bg-slate-50',
                  )}
                >
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {item.title}
                      </p>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                          isSelected
                            ? 'bg-white/10 text-white/80'
                            : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {magnetCategoryLabel[item.category]}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'mt-1 truncate text-sm',
                        isSelected ? 'text-white/70' : 'text-slate-500',
                      )}
                    >
                      {item.originalTitle}
                    </p>
                    <p
                      className={cn(
                        'mt-1 text-xs',
                        isSelected ? 'text-white/60' : 'text-slate-400',
                      )}
                    >
                      {item.subtitle}
                    </p>
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
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-slate-900">未找到匹配项目</p>
            <p className="mt-2 text-sm text-slate-500">
              试试中文名、英文名或年份关键词。当前仅使用本地 mock 数据进行筛选。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
