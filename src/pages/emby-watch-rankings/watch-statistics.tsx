import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { CalendarRange, Clock3, Eye, EyeOff, Film, Play, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateControl } from '@/components/ui/form-control'
import { getEmbyWatchRankings } from '@/lib/api/emby-watch-rankings'
import { cn } from '@/lib/utils'
import type { EmbyWatchRankingParams, EmbyWatchRankingPeriod } from '@/types/emby-watch-rankings'
import { todayInShanghai, watchDuration, watchTime } from './watch-format'
import { WatchError, WatchLoading } from './watch-components'
import { usePrivateWatchTitles, useWatchQuery } from './use-watch-query'
import { TrackedWatchActivity, UserWatchActivity } from './user-activity'
import { MediaWatchRankings } from './media-rankings'

function StatisticsRange({ range, pageSize }: { range: EmbyWatchRankingParams; pageSize: number }) {
  const [tab, setTab] = useState<'users' | 'media'>('users')
  const [mediaVisited, setMediaVisited] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()
  const load = useCallback((signal: AbortSignal) => getEmbyWatchRankings({ ...range, limit: pageSize }, signal), [range, pageSize])
  const query = useWatchQuery(load, true, refresh)
  const summary = query.data?.summary
  const view = { range, pageSize, reveal, refresh }
  const privateTitles = usePrivateWatchTitles(query.data?.webhook_status.recent_events.filter(event => event.category === 'adult').map(event => event.item_id) ?? [], reveal)
  const metrics = summary ? [
    { label: '已结算观看用户', value: summary.active_user_count, Icon: Users },
    { label: '实际观看时长', value: watchDuration(summary.total_watch_seconds), Icon: Clock3 },
    { label: '看过的作品', value: summary.total_work_count, Icon: Film },
    { label: '有效播放次数', value: summary.total_play_count, Icon: Play },
  ] : []
  const selectTab = (index: number) => {
    setTab(index === 0 ? 'users' : 'media')
    if (index === 1) setMediaVisited(true)
  }

  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-slate-500">{range.period === 'month' ? range.month : range.date} · 北京时间</span>
      <div className="flex flex-wrap gap-2"><Button aria-pressed={reveal} onClick={() => setReveal(value => !value)} type="button" variant="outline">{reveal ? <Eye aria-hidden="true" className="h-4 w-4" /> : <EyeOff aria-hidden="true" className="h-4 w-4" />}{reveal ? '收起私密内容' : '查看私密片名'}</Button><Button aria-label="刷新观看统计和明细" disabled={query.loading} onClick={() => setRefresh(value => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" className={cn('h-4 w-4', query.loading && 'animate-spin')} />刷新</Button></div>
    </div>
    {query.loading && <WatchLoading />}{query.error && <WatchError message={query.error} retry={query.retry} />}
    {summary && <>
      <dl className="grid min-w-0 grid-cols-2 gap-y-5 rounded-2xl bg-white py-6 ring-1 ring-slate-200 lg:grid-cols-4">{metrics.map(({ label, value, Icon }) => <div className="min-w-0 border-r border-slate-100 px-5 last:border-r-0" key={label}><dt className="flex items-center justify-between gap-2 text-xs text-slate-500">{label}<Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-700/70" /></dt><dd className="mt-4 break-words text-xl font-semibold text-slate-900 sm:text-2xl">{value}</dd></div>)}</dl>
      <p className="text-xs leading-6 text-slate-500">自然日口径 {summary.calendar_session_count} 次 · 历史口径 {summary.legacy_session_count} 次（旧记录按结束日入账，不重建暂停分段）。总览覆盖所选范围的全部已结算记录。</p>
    </>}
    <p className="flex items-start gap-2 text-xs leading-6 text-slate-500"><ShieldCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />私密观看保留统计贡献，片名仅在主动展开后读取；Adult 始终无海报。进行中估算与已结算排行分开展示。</p>
    <div aria-label="观看排行榜" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-flex" role="tablist" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : tab === 'users' ? 1 : 0
      selectTab(next)
      tabs.current[next]?.focus()
    }}>{([['users', '谁在看，看了什么', Users], ['media', '大家都在看什么', Film]] as const).map(([key, label, Icon], index) => <button aria-controls={`${id}-panel-${key}`} aria-selected={tab === key} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-emerald-600 sm:px-5', tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')} id={`${id}-tab-${key}`} key={key} onClick={() => selectTab(index)} ref={element => { tabs.current[index] = element }} role="tab" tabIndex={tab === key ? 0 : -1} type="button"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}</button>)}</div>
    <div aria-labelledby={`${id}-tab-users`} className="min-w-0 space-y-5" hidden={tab !== 'users'} id={`${id}-panel-users`} role="tabpanel" tabIndex={0}>
      <UserWatchActivity key={`users:${pageSize}`} {...view} /><TrackedWatchActivity key={`activity:${pageSize}`} {...view} />
    </div>
    <div aria-labelledby={`${id}-tab-media`} className="min-w-0" hidden={tab !== 'media'} id={`${id}-panel-media`} role="tabpanel" tabIndex={0}><MediaWatchRankings {...view} enabled={mediaVisited} /></div>
    {query.data && <details className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"><summary className="cursor-pointer text-sm font-medium text-slate-600 focus-visible:outline-emerald-600">最近播放事件 · 采集状态</summary><p className="my-4 text-xs text-slate-500">以下为全局最近事件，用于核对采集；不是所选范围的完整观看时间线。Webhook {query.data.webhook_status.secret_configured ? '已配置' : '未配置'}。</p>{privateTitles.error && <p role="alert" className="mb-3 text-xs text-rose-700">{privateTitles.error}</p>}<ul className="space-y-3 text-xs leading-6 text-slate-500">{query.data.webhook_status.recent_events.map((event, index) => <li className="break-words" key={`${event.item_id}-${event.event_time}-${index}`}>{watchTime(event.event_time)} · {event.user_name} · {event.category === 'unknown' ? '分类待确认' : event.category === 'adult' ? privateTitles.titles[event.item_id] || '私密观看' : event.item_name} · {event.event === 'playback.stop' ? '播放结束' : '播放开始'}{event.watch_seconds !== null && ` · 观看 ${watchDuration(event.watch_seconds)}`}</li>)}</ul>{!query.data.webhook_status.recent_events.length && <p className="text-sm text-slate-500">暂无最近播放事件。</p>}</details>}
    {query.data && <footer className="text-right text-xs leading-6 text-slate-400">最近结算 {watchTime(summary?.last_watched_at ?? null)} · 数据生成于 {watchTime(query.data.generated_at)}</footer>}
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
  return <section aria-labelledby="watch-statistics-title" className="min-w-0 space-y-5">
    <div className="border-b border-slate-200 pb-5"><p className="text-xs font-semibold tracking-widest text-emerald-800/60">观看动向 / 使用概览</p><h2 className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-2xl font-semibold text-slate-900" id="watch-statistics-title">观看统计<span className="text-sm font-normal text-slate-400">看见每个人的一天。</span></h2><p className="mt-2 text-sm text-slate-500">从用户到作品，从观看时长到完整轨迹。</p></div>
    <div className="flex flex-wrap items-end gap-3"><div className="inline-flex rounded-xl bg-slate-100 p-1">{(['day', 'month'] as const).map(value => <button aria-pressed={period === value} className={cn('min-h-11 rounded-lg px-5 text-sm font-medium focus-visible:outline-emerald-600', period === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')} key={value} onClick={() => { if (value === 'month' && period === 'day' && date) setMonth(date.slice(0, 7)); setPeriod(value) }} type="button">{value === 'day' ? '按日' : '按月'}</button>)}</div>
      {period === 'month' ? <label className="min-w-0 space-y-1 text-xs text-slate-500"><span>统计月份</span><DateControl getTodayValue={() => todayInShanghai().slice(0, 7)} aria-label="统计月份" icon={<CalendarRange aria-hidden="true" className="h-4 w-4" />} onChange={event => setMonth(event.target.value)} type="month" value={month} /></label> : <label className="min-w-0 space-y-1 text-xs text-slate-500"><span>统计日期</span><DateControl getTodayValue={todayInShanghai} aria-label="统计日期" onChange={event => setDate(event.target.value)} type="date" value={date} /></label>}
      <label className="space-y-1 text-xs text-slate-500"><span className="block">每页数量</span><select aria-label="排行每页数量" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-emerald-600" onChange={event => setPageSize(Number(event.target.value))} value={pageSize}>{[10, 20, 50].map(size => <option key={size} value={size}>{size} 条</option>)}</select></label>
    </div>
    {valid ? <StatisticsRange key={scope} pageSize={pageSize} range={range} /> : <p role="status" className="rounded-xl bg-white p-6 text-sm text-slate-500">请选择有效的统计{period === 'month' ? '月份' : '日期'}。</p>}
  </section>
}
