import { useCallback, useEffect, useId, useState } from 'react'
import { ArrowDownWideNarrow, ChevronDown, Film, ShieldCheck } from 'lucide-react'
import { getWatchMedia, getWatchViewers } from '@/lib/api/emby-watch-rankings'
import { cn } from '@/lib/utils'
import type { EmbyMediaWatchRankingItem, WatchCategory, WatchSort } from '@/types/emby-watch-rankings'
import type { WatchViewProps } from './user-activity'
import { WatchError, WatchLoading, WatchPagination, WatchPoster } from './watch-components'
import { episodeLabel, watchDuration } from './watch-format'
import { usePrivateWatchTitles, useWatchQuery } from './use-watch-query'

const categoryNames = {
  movie: '电影',
  series: '电视剧 / 动漫',
  adult: 'Adult',
  unknown: '分类待确认',
} satisfies Record<WatchCategory, string>

function WorkViewers({ mediaId, category, range, pageSize, refresh }: WatchViewProps & { mediaId: string; category: WatchCategory }) {
  const [page, setPage] = useState(1)
  const load = useCallback(
    (signal: AbortSignal) => getWatchViewers({ ...range, media_id: mediaId, category, page, page_size: pageSize }, signal),
    [mediaId, category, range, page, pageSize],
  )
  const query = useWatchQuery(load, true, refresh)
  return <div aria-busy={query.loading} className="space-y-3 border-t border-border bg-muted/50 p-4">
    <h5 className="text-xs font-semibold text-muted-foreground">观看用户与各自时长</h5>
    {query.loading && <WatchLoading />}
    {query.error && <WatchError message={query.error} retry={query.retry} />}
    {query.data && <>
      <ul className="space-y-3">{query.data.items.map(viewer => <li className="flex flex-wrap items-center justify-between gap-2 text-xs" key={viewer.emby_user_id}>
        <span className="min-w-0 break-words font-medium text-foreground">{viewer.user_name}</span>
        <span className="text-muted-foreground">{watchDuration(viewer.watch_seconds)} · {viewer.play_count} 次播放</span>
      </li>)}</ul>
      {!query.data.items.length && <p className="text-xs text-muted-foreground">所选范围暂无观看用户。</p>}
      <WatchPagination loading={query.loading} onPage={setPage} page={page} pageSize={pageSize} total={query.data.total} />
    </>}
  </div>
}

function MediaRankingRow({ item, title, expanded, onExpand, ...view }: WatchViewProps & {
  item: EmbyMediaWatchRankingItem
  title: string
  expanded: boolean
  onExpand: () => void
}) {
  const detailId = useId()
  const episode = episodeLabel(item.season_number, item.episode_number)
  const ordinary = item.category === 'movie' || item.category === 'series'
  return <li className="min-w-0">
    <button
      aria-controls={detailId}
      aria-expanded={expanded}
      className="flex min-h-24 w-full items-center gap-3 px-4 py-5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-ring"
      onClick={onExpand}
      type="button"
    >
      <span className="w-5 shrink-0 self-start pt-1 text-sm tabular-nums text-muted-foreground">{item.rank}</span>
      {ordinary ? <WatchPoster category={item.category} itemId={item.poster_item_id} title={title} /> : <ShieldCheck aria-hidden="true" className="h-6 w-6 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1">
        <strong className="block break-words text-sm font-semibold leading-6 text-foreground">{title}</strong>
        {item.content_label && ordinary && <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs text-primary">{item.content_label}</span>}
        {episode && ordinary && <code className="text-xs text-muted-foreground">最近 {episode}</code>}
        <span className="mt-1 block text-xs leading-6 text-muted-foreground">{item.viewer_count} 人观看 · {item.play_count} 次播放</span>
        <span className="block text-xs font-semibold leading-6 text-primary">{watchDuration(item.watch_seconds)}</span>
      </span>
      <ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} />
    </button>
    <div hidden={!expanded} id={detailId}>{expanded && <WorkViewers {...view} category={item.category} mediaId={item.media_id} />}</div>
  </li>
}

function CategoryRanking({ category, sort, enabled, ...view }: WatchViewProps & {
  category: WatchCategory
  sort: WatchSort
  enabled: boolean
}) {
  const [pagination, setPagination] = useState({ sort, page: 1 })
  const page = pagination.sort === sort ? pagination.page : 1
  const [expanded, setExpanded] = useState<string[]>([])
  const load = useCallback(
    (signal: AbortSignal) => getWatchMedia({ ...view.range, category, sort, page, page_size: view.pageSize }, signal),
    [view.range, category, sort, page, view.pageSize],
  )
  const query = useWatchQuery(load, enabled, view.refresh)
  const privateTitles = usePrivateWatchTitles(
    query.data?.items.filter(item => item.category === 'adult').map(item => item.media_id) ?? [],
    view.reveal,
  )
  return <section aria-busy={query.loading} aria-label={`${categoryNames[category]}观看排行`} className="min-w-0 overflow-hidden rounded-2xl bg-card ring-1 ring-border">
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
      <h4 className="text-sm font-semibold text-foreground">{categoryNames[category]}</h4>
      {category === 'adult' ? <ShieldCheck aria-label="始终无海报" className="h-4 w-4 text-muted-foreground" /> : query.data && <span className="text-xs text-muted-foreground">共 {query.data.total} 部作品</span>}
    </div>
    {query.loading && <WatchLoading />}
    {query.error && <WatchError message={query.error} retry={query.retry} />}
    {privateTitles.error && <p className="px-5 py-3 text-xs text-rose-700" role="alert">{privateTitles.error}</p>}
    {query.data && <>
      <ol className="divide-y divide-border">{query.data.items.map(item => {
        const title = item.category === 'unknown' ? '分类待确认' : item.category === 'adult' ? privateTitles.titles[item.media_id] || '私密观看' : item.title
        return <MediaRankingRow
          {...view}
          expanded={expanded.includes(item.media_id)}
          item={item}
          key={item.media_id}
          onExpand={() => setExpanded(previous => previous.includes(item.media_id) ? previous.filter(id => id !== item.media_id) : [...previous, item.media_id])}
          title={title}
        />
      })}</ol>
      {!query.data.items.length && <p className="px-5 py-10 text-center text-sm text-muted-foreground">所选范围暂无已结算观看记录。</p>}
      <div className="px-4 pb-4"><WatchPagination loading={query.loading} onPage={nextPage => setPagination({ sort, page: nextPage })} page={page} pageSize={view.pageSize} total={query.data.total} /></div>
    </>}
  </section>
}

export function MediaWatchRankings({ enabled, ...view }: WatchViewProps & { enabled: boolean }) {
  const [visited, setVisited] = useState(enabled)
  const [sort, setSort] = useState<WatchSort>('duration')
  const [unknownOpen, setUnknownOpen] = useState(false)
  useEffect(() => { if (enabled) setVisited(true) }, [enabled])
  const canLoad = enabled || visited
  return <section className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><Film aria-hidden="true" className="h-4 w-4 text-primary" />作品观看排行</h3></div>
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground"><ArrowDownWideNarrow aria-hidden="true" className="h-4 w-4" /><span className="sr-only">作品排行排序</span><select className="min-h-11 bg-transparent text-sm focus-visible:outline-ring" onChange={event => setSort(event.target.value as WatchSort)} value={sort}><option value="duration">按观看时长</option><option value="viewers">按观看人数</option><option value="plays">按播放次数</option></select></label>
    </div>
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">{(['movie', 'series', 'adult'] as const).map(category => <CategoryRanking {...view} category={category} enabled={canLoad} key={`${category}:${view.pageSize}`} sort={sort} />)}</div>
    <details className="rounded-2xl border border-border bg-muted/50 p-4" onToggle={event => setUnknownOpen(event.currentTarget.open)}>
      <summary className="min-h-8 cursor-pointer text-sm font-medium text-muted-foreground focus-visible:outline-ring">分类待确认的观看作品</summary>
      <CategoryRanking {...view} key={`unknown:${view.pageSize}`} category="unknown" enabled={canLoad && unknownOpen} sort={sort} />
    </details>
  </section>
}
