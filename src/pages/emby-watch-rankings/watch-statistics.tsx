import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { CalendarRange, Eye, EyeOff, Film, RefreshCw, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateControl, SelectControl } from '@/components/ui/form-control'
import { getEmbyWatchRankings } from '@/lib/api/emby-watch-rankings'
import { cn } from '@/lib/utils'
import type { EmbyWatchRankingParams, EmbyWatchRankingPeriod } from '@/types/emby-watch-rankings'
import { todayInShanghai, watchDuration, watchTime } from './watch-format'
import { WatchError, WatchLoading } from './watch-components'
import { usePrivateWatchTitles, useWatchQuery } from './use-watch-query'
import { TrackedWatchActivity, UserWatchActivity } from './user-activity'
import { MediaWatchRankings } from './media-rankings'

function RecentWatchEvents({ range, reveal, refresh }: { range: EmbyWatchRankingParams; reveal: boolean; refresh: number }) {
  const [open, setOpen] = useState(false)
  const load = useCallback((signal: AbortSignal) => getEmbyWatchRankings({ ...range, limit: 1 }, signal), [range])
  const query = useWatchQuery(load, open, refresh)
  const events = query.data?.webhook_status.recent_events ?? []
  const privateTitles = usePrivateWatchTitles(events.filter(event => event.category === 'adult').map(event => event.item_id), reveal && open)

  return <details className="rounded-2xl bg-card p-5 ring-1 ring-border" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium text-muted-foreground focus-visible:outline-ring">最近播放事件</summary>
    {open && <div className="mt-4">
      {query.loading && <WatchLoading />}
      {query.error && <WatchError message={query.error} retry={query.retry} />}
      {privateTitles.error && <p role="alert" className="mb-3 text-xs text-rose-700">{privateTitles.error}</p>}
      {query.data && <ul className="space-y-3 text-xs leading-6 text-muted-foreground">{events.map((event, index) => <li className="break-words" key={`${event.item_id}-${event.event_time}-${index}`}>{watchTime(event.event_time)} · {event.user_name} · {event.category === 'unknown' ? '分类待确认' : event.category === 'adult' ? privateTitles.titles[event.item_id] || '私密观看' : event.item_name} · {event.event === 'playback.stop' ? '播放结束' : '播放开始'}{event.watch_seconds !== null && ` · 观看 ${watchDuration(event.watch_seconds)}`}</li>)}</ul>}
      {query.data && !events.length && <p className="text-sm text-muted-foreground">暂无最近播放事件。</p>}
    </div>}
  </details>
}

function StatisticsRange({ range, pageSize }: { range: EmbyWatchRankingParams; pageSize: number }) {
  const [tab, setTab] = useState<'users' | 'media'>('users')
  const [mediaVisited, setMediaVisited] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()
  const view = { range, pageSize, reveal, refresh }
  const selectTab = (index: number) => {
    setTab(index === 0 ? 'users' : 'media')
    if (index === 1) setMediaVisited(true)
  }

  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div aria-label="观看排行榜" className="grid w-full grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:inline-flex sm:w-auto" role="tablist" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : tab === 'users' ? 1 : 0
        selectTab(next)
        tabs.current[next]?.focus()
      }}>{([['users', '谁在看，看了什么', Users], ['media', '大家都在看什么', Film]] as const).map(([key, label, Icon], index) => <button aria-controls={`${id}-panel-${key}`} aria-selected={tab === key} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-ring sm:px-5', tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')} id={`${id}-tab-${key}`} key={key} onClick={() => selectTab(index)} ref={element => { tabs.current[index] = element }} role="tab" tabIndex={tab === key ? 0 : -1} type="button"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}</button>)}</div>
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        <Button aria-pressed={reveal} onClick={() => setReveal(value => !value)} type="button" variant="outline">{reveal ? <Eye aria-hidden="true" className="h-4 w-4" /> : <EyeOff aria-hidden="true" className="h-4 w-4" />}{reveal ? '收起私密内容' : '查看私密片名'}</Button>
        <Button aria-label="刷新观看统计和明细" onClick={() => setRefresh(value => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" className="h-4 w-4" />刷新</Button>
      </div>
    </div>
    <div aria-labelledby={`${id}-tab-users`} className="min-w-0 space-y-4" hidden={tab !== 'users'} id={`${id}-panel-users`} role="tabpanel" tabIndex={0}>
      <UserWatchActivity key={`users:${pageSize}`} {...view} /><TrackedWatchActivity key={`activity:${pageSize}`} {...view} />
    </div>
    <div aria-labelledby={`${id}-tab-media`} className="min-w-0" hidden={tab !== 'media'} id={`${id}-panel-media`} role="tabpanel" tabIndex={0}><MediaWatchRankings {...view} enabled={mediaVisited} /></div>
    <RecentWatchEvents range={range} reveal={reveal} refresh={refresh} />
  </div>
}

export function WatchStatisticsPanel() {
  const [period, setPeriod] = useState<EmbyWatchRankingPeriod>('day')
  const [date, setDate] = useState(todayInShanghai)
  const [month, setMonth] = useState(() => todayInShanghai().slice(0, 7))
  const [pageSize, setPageSize] = useState(20)
  const range = useMemo<EmbyWatchRankingParams>(() => period === 'month' ? { period, month } : { period, date }, [period, date, month])
  const scope = `${period}:${period === 'month' ? month : date}`
  const valid = period === 'month' ? /^\d{4}-\d{2}$/.test(month) : /^\d{4}-\d{2}-\d{2}$/.test(date)

  return <section aria-labelledby="watch-statistics-title" className="min-w-0 space-y-4">
    <h2 className="text-xl font-semibold text-foreground" id="watch-statistics-title">观看统计</h2>
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-border lg:flex-row lg:items-center lg:justify-between lg:gap-8">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div aria-label="统计周期" className="inline-flex shrink-0 rounded-xl bg-muted p-1">{(['day', 'month'] as const).map(value => <button aria-pressed={period === value} className={cn('min-h-10 rounded-lg px-4 text-sm font-medium focus-visible:outline-ring', period === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')} key={value} onClick={() => { if (value === 'month' && period === 'day' && date) setMonth(date.slice(0, 7)); setPeriod(value) }} type="button">{value === 'day' ? '按日' : '按月'}</button>)}</div>
        <label className="min-w-0 w-full space-y-1.5 text-xs text-muted-foreground sm:w-48">
          <span className="sr-only">{period === 'month' ? '统计月份' : '统计日期'}</span>
          <DateControl getTodayValue={period === 'month' ? () => todayInShanghai().slice(0, 7) : todayInShanghai} aria-label={period === 'month' ? '统计月份' : '统计日期'} icon={period === 'month' ? <CalendarRange aria-hidden="true" className="h-4 w-4" /> : undefined} onChange={event => period === 'month' ? setMonth(event.target.value) : setDate(event.target.value)} type={period === 'month' ? 'month' : 'date'} value={period === 'month' ? month : date} />
        </label>
      </div>
      <label className="flex shrink-0 items-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <span>每页数量</span>
        <SelectControl aria-label="排行每页数量" wrapperClassName="w-24" onChange={event => setPageSize(Number(event.target.value))} value={pageSize}>{[10, 20, 50].map(size => <option key={size} value={size}>{size} 条</option>)}</SelectControl>
      </label>
    </div>
    {valid ? <StatisticsRange key={scope} pageSize={pageSize} range={range} /> : <p role="status" className="rounded-xl bg-card p-6 text-sm text-muted-foreground">请选择有效的统计{period === 'month' ? '月份' : '日期'}。</p>}
  </section>
}
