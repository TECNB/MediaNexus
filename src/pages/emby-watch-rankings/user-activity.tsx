import { useCallback, useState } from 'react'
import { ChevronDown, Clock3, ShieldCheck, Users } from 'lucide-react'
import { getWatchActivity, getWatchSessions, getWatchUsers, getWatchWorks } from '@/lib/api/emby-watch-rankings'
import type { EmbyWatchRankingParams, WatchSession, WatchCategory, EmbyMediaWatchRankingItem } from '@/types/emby-watch-rankings'
import { cn } from '@/lib/utils'
import { episodeLabel, watchDuration, watchTime } from './watch-format'
import { WatchError, WatchLoading, WatchPagination, WatchPoster } from './watch-components'
import { usePrivateWatchTitles, useWatchQuery } from './use-watch-query'

export type WatchViewProps = { range: EmbyWatchRankingParams; pageSize: number; reveal: boolean; refresh: number }

function SessionRow({ session, title }: { session: WatchSession; title: string }) {
  const episode = episodeLabel(session.season_number, session.episode_number)
  const settled = session.state === 'settled'
  return <li className="relative min-w-0 border-l border-slate-200 pb-5 pl-5 last:pb-0">
    <span aria-hidden="true" className={cn('absolute -left-1 top-1.5 h-2 w-2 rounded-full ring-4 ring-white', settled ? 'bg-slate-300' : 'bg-emerald-500')} />
    <div className="flex flex-wrap items-center gap-2"><strong className="break-words text-sm font-medium text-slate-800">{title}</strong>{episode && <code className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">{episode}</code>}{!settled && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{session.state === 'playing' ? '播放中 · 估算' : session.state === 'paused' ? '已暂停 · 估算' : '状态待确认 · 估算冻结'}</span>}</div>
    <p className="mt-1 text-xs leading-6 text-slate-500">{watchTime(session.start_time)} — {settled ? watchTime(session.stop_time) : session.observed_at ? `截至 ${watchTime(session.observed_at)}` : '结束时间未知'}</p>
    <p className="text-xs leading-6 text-slate-600">{settled ? '观看' : '估算观看'} {watchDuration(session.range_watch_seconds)}{session.watch_seconds !== session.range_watch_seconds && <> · 整次 {watchDuration(session.watch_seconds)}</>} · {session.device_name || '设备未知'}{session.client_name && ` / ${session.client_name}`}</p>
    {settled && session.stop_time_source === 'superseded' && <p className="mt-1 text-xs text-amber-700">结束时间由后续播放推定</p>}
    {settled && session.stop_time_source === 'unknown' && <p className="mt-1 text-xs text-slate-500">结束时间来源未记录</p>}
    {session.accounting_basis === 'legacy' && <p className="mt-1 text-xs text-amber-700">历史口径 · 整次观看按结束日入账</p>}
    {session.category === 'unknown' && <p className="mt-1 text-xs text-slate-500">分类待确认 · 暂不展示片名与海报</p>}
  </li>
}

export function SessionList({ sessions, reveal }: { sessions: WatchSession[]; reveal: boolean }) {
  const privateTitles = usePrivateWatchTitles(sessions.filter(item => item.category === 'adult').map(item => item.item_id), reveal)
  return <>{privateTitles.error && <p className="mb-3 text-xs text-rose-700" role="alert">{privateTitles.error}</p>}<ol className="ml-1 min-w-0">{sessions.map(session => <SessionRow key={session.id} session={session} title={session.category === 'unknown' ? '分类待确认' : session.category === 'adult' ? privateTitles.titles[session.item_id] || '私密观看' : session.title} />)}</ol></>
}

function UserSessions({ userId, mediaId, category, range, pageSize, reveal, refresh }: WatchViewProps & { userId: string; mediaId?: string; category?: WatchCategory }) {
  const [page, setPage] = useState(1)
  const load = useCallback((signal: AbortSignal) => getWatchSessions(userId, { ...range, page, page_size: pageSize, media_id: mediaId, category }, signal), [userId, mediaId, category, range, page, pageSize])
  const query = useWatchQuery(load, true, refresh)
  return <div aria-busy={query.loading} className="min-w-0 space-y-4">
    {query.loading && <WatchLoading />}{query.error && <WatchError message={query.error} retry={query.retry} />}
    {query.data && <><SessionList sessions={query.data.items} reveal={reveal} />{!query.data.items.length && <p className="py-4 text-sm text-slate-500">所选范围暂无播放记录。</p>}<WatchPagination loading={query.loading} onPage={setPage} page={page} pageSize={pageSize} total={query.data.total} /></>}
  </div>
}

function WorkRow({ item, title, userId, ...view }: WatchViewProps & { item: EmbyMediaWatchRankingItem; title: string; userId: string }) {
  const [open, setOpen] = useState(false)
  const episode = episodeLabel(item.season_number, item.episode_number)
  return <li className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <button aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50 focus-visible:outline-emerald-600" onClick={() => setOpen(value => !value)} type="button">
      <WatchPoster category={item.category} itemId={item.poster_item_id} title={title} />
      <span className="min-w-0 flex-1"><strong className="block break-words text-sm font-medium text-slate-800">{title}</strong><span className="mt-1 block text-xs leading-6 text-slate-500">{item.category === 'movie' ? '电影' : item.category === 'series' ? '电视剧 / 动漫' : item.category === 'adult' ? 'Adult · 无海报' : '分类待确认'}{item.content_label && ` · ${item.content_label}`} · {item.play_count} 次播放{episode && <> · 最近 {episode}</>}</span><span className="block text-xs font-medium text-emerald-800">{watchDuration(item.watch_seconds)}</span></span>
      <ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
    </button>
    {open && <div className="border-t border-slate-100 p-4"><UserSessions {...view} category={item.category} mediaId={item.media_id} userId={userId} /></div>}
  </li>
}

function UserWorks({ userId, ...view }: WatchViewProps & { userId: string }) {
  const [page, setPage] = useState(1)
  const load = useCallback((signal: AbortSignal) => getWatchWorks(userId, { ...view.range, page, page_size: view.pageSize }, signal), [userId, view.range, page, view.pageSize])
  const query = useWatchQuery(load, true, view.refresh)
  const privateTitles = usePrivateWatchTitles(query.data?.items.filter(item => item.category === 'adult').map(item => item.media_id) ?? [], view.reveal)
  return <div aria-busy={query.loading} className="min-w-0 space-y-3">{query.loading && <WatchLoading />}{query.error && <WatchError message={query.error} retry={query.retry} />}{privateTitles.error && <p className="text-xs text-rose-700" role="alert">{privateTitles.error}</p>}
    {query.data && <><ul className="space-y-3">{query.data.items.map(item => <WorkRow {...view} item={item} key={`${item.category}:${item.media_id}`} title={item.category === 'unknown' ? '分类待确认' : item.category === 'adult' ? privateTitles.titles[item.media_id] || '私密观看' : item.title} userId={userId} />)}</ul>{!query.data.items.length && <p className="py-4 text-sm text-slate-500">暂无已结算作品；进行中记录见时间线。</p>}<WatchPagination loading={query.loading} onPage={setPage} page={page} pageSize={view.pageSize} total={query.data.total} /></>}
  </div>
}

export function UserWatchActivity(view: WatchViewProps) {
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string[]>([])
  const load = useCallback((signal: AbortSignal) => getWatchUsers({ ...view.range, page, page_size: view.pageSize }, signal), [view.range, page, view.pageSize])
  const query = useWatchQuery(load, true, view.refresh)
  const privateTitles = usePrivateWatchTitles(query.data?.items.filter(user => user.last_category === 'adult').flatMap(user => user.last_item_id ? [user.last_item_id] : []) ?? [], view.reveal)
  return <section aria-busy={query.loading} className="min-w-0 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-semibold text-slate-900">用户观看排行</h3><p className="mt-1 text-xs text-slate-500">按已结束有效播放时长排序 · 展开查看作品和播放时间线</p></div><Users aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700" /></div>
    {query.loading && <WatchLoading />}{query.error && <WatchError message={query.error} retry={query.retry} />}{privateTitles.error && <p className="px-5 pt-3 text-xs text-rose-700" role="alert">{privateTitles.error}</p>}
    {query.data && <><ol className="divide-y divide-slate-100">{query.data.items.map(user => {
      const open = expanded.includes(user.emby_user_id)
      const lastTitle = user.last_category === 'unknown' ? '分类待确认' : user.last_category === 'adult' ? (user.last_item_id && privateTitles.titles[user.last_item_id]) || '私密观看' : user.last_item_name || '内容未知'
      const episode = episodeLabel(user.last_season_number, user.last_episode_number)
      return <li key={user.emby_user_id}>
        <button aria-expanded={open} className={cn('flex w-full flex-wrap items-center gap-3 px-5 py-5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-emerald-600', open && 'bg-emerald-50/50')} onClick={() => setExpanded(previous => open ? previous.filter(id => id !== user.emby_user_id) : [...previous, user.emby_user_id])} type="button">
          <span className="w-5 text-xs tabular-nums text-slate-400">{String(user.rank).padStart(2, '0')}</span><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">{user.user_name.slice(0, 1)}</span>
          <span className="min-w-0 flex-1"><strong className="block break-words text-sm font-semibold text-slate-800">{user.user_name}</strong><span className="mt-1 block text-xs text-slate-500">{user.work_count} 部作品 · {user.play_count} 次播放</span></span>
          <span className="order-last w-full min-w-0 pl-8 text-xs leading-6 text-slate-500 sm:order-none sm:w-48 sm:pl-0">最近观看 · {watchTime(user.last_watched_at)}<span className="block break-words text-slate-700">{lastTitle} {episode && <code className="rounded bg-emerald-50 px-1 text-emerald-800">{episode}</code>}</span></span>
          <strong className="text-sm font-semibold text-slate-800">{watchDuration(user.watch_seconds)}</strong><ChevronDown aria-hidden="true" className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
        {open && <div className="grid min-w-0 gap-7 border-t border-slate-100 p-5 xl:grid-cols-2"><section className="min-w-0"><h4 className="mb-4 text-sm font-medium text-slate-600">所选范围的全部作品</h4><UserWorks {...view} userId={user.emby_user_id} /></section><section className="min-w-0"><h4 className="mb-4 flex flex-wrap justify-between gap-2 text-sm font-medium text-slate-600">逐次播放时间线<span className="text-xs font-normal text-slate-400">北京时间</span></h4><UserSessions {...view} userId={user.emby_user_id} /><p className="mt-5 text-xs leading-6 text-slate-400">时间段包含暂停，观看时长扣除暂停；跨日记录同时显示所选范围贡献和整次时长。</p></section></div>}
      </li>
    })}</ol>{!query.data.items.length && <p className="p-8 text-center text-sm text-slate-500">所选范围暂无已结算观看记录。</p>}<div className="px-5 pb-4"><WatchPagination loading={query.loading} onPage={setPage} page={page} pageSize={view.pageSize} total={query.data.total} /></div></>}
  </section>
}

export function TrackedWatchActivity(view: WatchViewProps) {
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const load = useCallback((signal: AbortSignal) => getWatchActivity({ ...view.range, page, page_size: view.pageSize }, signal), [view.range, page, view.pageSize])
  const query = useWatchQuery(load, true, view.refresh)
  return <section className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200" aria-busy={query.loading}><div className="mb-4 flex items-center gap-2"><Clock3 aria-hidden="true" className="h-4 w-4 text-emerald-700" /><h3 className="text-sm font-semibold text-slate-800">进行中与待确认的动向</h3></div><p className="mb-5 flex items-start gap-2 text-xs leading-6 text-slate-500"><ShieldCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />估算仅供了解动向，不进入正式排行；核验失败时冻结在最后已知时间。暂停时长不持续增长。</p>
    {query.loading && <WatchLoading />}{query.error && <WatchError message={query.error} retry={query.retry} />}{query.data && <>{!query.data.items.length ? <p className="text-sm text-slate-500">所选范围暂无跟踪中的播放。</p> : <ul className="space-y-5">{query.data.items.map(session => <li className="min-w-0 rounded-xl border border-slate-100 p-4" key={session.id}><button className="mb-3 min-h-10 text-sm font-semibold text-emerald-800 hover:underline focus-visible:outline-emerald-600" onClick={() => setSelectedUser(selectedUser === session.emby_user_id ? null : session.emby_user_id)} type="button" aria-expanded={selectedUser === session.emby_user_id}>{session.user_name} · 查看完整动向</button><SessionList sessions={[session]} reveal={view.reveal} />{selectedUser === session.emby_user_id && <div className="mt-5 border-t border-slate-100 pt-5"><UserSessions {...view} userId={session.emby_user_id} /></div>}</li>)}</ul>}<WatchPagination loading={query.loading} onPage={setPage} page={page} pageSize={view.pageSize} total={query.data.total} /></>}
  </section>
}
