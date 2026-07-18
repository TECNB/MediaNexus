import { X } from 'lucide-react'

import {
  getResourceSearchHistoryEntryKey,
  type ResourceSearchHistoryEntry,
} from '@/lib/resource-search-history'

type SearchHistoryProps = {
  entries: ResourceSearchHistoryEntry[]
  searchDisabled?: boolean
  onSelect: (entry: ResourceSearchHistoryEntry) => void
  onRemove: (entry: ResourceSearchHistoryEntry) => void
  onClear: () => void
}

function getContextLabel(entry: ResourceSearchHistoryEntry) {
  switch (entry.category) {
    case 'movie':
      return '电影'
    case 'tv':
      return '电视剧'
    case 'anime':
      return entry.animeMode === 'follow-subscription'
        ? '动漫 · 追更'
        : '动漫 · 整季'
  }
}

export function SearchHistory({
  entries,
  searchDisabled = false,
  onSelect,
  onRemove,
  onClear,
}: SearchHistoryProps) {
  if (entries.length === 0) {
    return null
  }

  return (
    <section
      aria-label="最近搜索"
      className="w-full max-w-[720px] rounded-[22px] border border-slate-200/70 bg-white/70 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.025)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-slate-500">
          最近搜索
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-slate-400 transition hover:text-slate-700"
        >
          清空历史
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2" role="list">
        {entries.map((entry) => (
          <div
            key={getResourceSearchHistoryEntryKey(entry)}
            role="listitem"
            className="group flex min-w-0 items-center overflow-hidden rounded-full border border-slate-200 bg-white transition hover:border-slate-300"
          >
            <button
              type="button"
              disabled={searchDisabled}
              onClick={() => onSelect(entry)}
              className="flex min-w-0 items-center gap-1.5 py-1.5 pl-2.5 pr-1 text-left disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {getContextLabel(entry)}
              </span>
              <span className="max-w-[12rem] truncate text-xs font-medium text-slate-700">
                {entry.keyword}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry)}
              aria-label={`删除搜索历史：${entry.keyword}`}
              className="mr-1 rounded-full p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
