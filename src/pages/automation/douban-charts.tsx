import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Film, History, Loader2, Play, RefreshCw, Star } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { getDoubanChart, getDoubanChartOperation, getDoubanCharts, getDoubanChartSeasons, listDoubanChartOperations, refreshDoubanChart, saveDoubanChartLimits, searchDoubanChartCatalog, setDoubanChartAutomation, setDoubanChartExclusion, stopDoubanChartOperation, submitDoubanChartOperation, updateDoubanChartIdentity } from '@/lib/api/douban-charts'
import { getJavaErrorMessage, isJavaRequestCanceledError } from '@/lib/java-api'
import { useAuth } from '@/lib/use-auth'
import { cn } from '@/lib/utils'
import type { BgmCatalogCandidate, BgmSeason } from '@/types/bgm-wishlist'
import type { DoubanChartBoard, DoubanChartCandidate, DoubanChartId, DoubanChartIdentityInput, DoubanChartOperations, DoubanChartOverview, DoubanChartSettings } from '@/types/douban-charts'
import { BgmOperationRecords, hasActiveBgmOperation } from './bgm-operation-records'
import { BgmPoster } from './bgm-poster'
import { AutomationNavigation } from './navigation'
import { DoubanChartProgress } from './douban-chart-progress'

const panel = 'min-w-0 rounded-2xl bg-white p-4 shadow-shell ring-1 ring-slate-200 sm:p-5'
const control = 'min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500'
const running = ['QUEUED', 'RUNNING', 'STOPPING', 'STOP_REQUESTED']
function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '暂无'
}
function errorMessage(error: unknown) { return getJavaErrorMessage(error) || '请求失败，请稍后重试。' }

function ChartLimits({ initial, admin }: { initial: DoubanChartSettings; admin: boolean }) {
  const [settings, setSettings] = useState(initial)
  const [checks, setChecks] = useState(initial.dailyCheckLimit?.toString() ?? '')
  const [creates, setCreates] = useState(initial.dailyCreateLimit?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const saveController = useRef<AbortController | null>(null)
  const generation = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      const version = generation.current
      try {
        const result = await getDoubanCharts(controller.signal)
        if (!controller.signal.aborted && version === generation.current && !saveController.current) { setSettings(result.settings); setError(null) }
      } catch (caught) {
        if (!controller.signal.aborted) setError(`统计更新失败，以下为上次读取结果：${errorMessage(caught)}`)
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 15000)
      }
    }
    timer = setTimeout(refresh, 15000)
    return () => { controller.abort(); clearTimeout(timer); saveController.current?.abort() }
  }, [])
  async function save() {
    if (!admin || saveController.current) return
    const controller = new AbortController()
    saveController.current = controller
    generation.current += 1
    setSaving(true); setError(null); setMessage(null)
    try {
      const result = await saveDoubanChartLimits({ dailyCheckLimit: checks === '' ? null : Number(checks), dailyCreateLimit: creates === '' ? null : Number(creates) }, controller.signal)
      if (!controller.signal.aborted) { setSettings(result); setMessage('已保存各榜单共享业务上限。') }
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorMessage(caught))
    } finally {
      if (!controller.signal.aborted) { generation.current += 1; saveController.current = null; setSaving(false) }
    }
  }
  const reached = settings.dailyCheckLimit !== null && settings.checkedToday >= settings.dailyCheckLimit || settings.dailyCreateLimit !== null && settings.createdToday >= settings.dailyCreateLimit
  return <section className={panel} aria-label="共享业务限额与调度">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">每日调度与共享业务上限</h2><p className="mt-2 break-words text-sm text-slate-600">每日 {settings.scheduleTime} · {settings.timezone} · 下次 {dateTime(settings.nextRunAt)}（北京时间）</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">榜单每日更新，不受入库开关影响</span></div>
    <p className="mt-3 text-sm text-slate-700">今日已检查 {settings.checkedToday.toLocaleString('zh-CN')} / {settings.dailyCheckLimit?.toLocaleString('zh-CN') ?? '不限'} 部 · 已创建任务 {settings.createdToday.toLocaleString('zh-CN')} / {settings.dailyCreateLimit?.toLocaleString('zh-CN') ?? '不限'} 个</p>
    {reached && <p role="status" className="mt-2 text-sm text-amber-800">今日共享业务上限已达到；后续目标将记录限额原因，不代表无资源。</p>}
    {admin && <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void save() }}>
      <label className="grid min-w-0 gap-1 text-sm">每日检查上限<input className={cn(control, 'w-40 max-w-full')} type="number" min={1} step={1} value={checks} disabled={saving} placeholder="不限" onChange={(event) => setChecks(event.target.value)} /></label>
      <label className="grid min-w-0 gap-1 text-sm">每日创建上限<input className={cn(control, 'w-40 max-w-full')} type="number" min={1} step={1} value={creates} disabled={saving} placeholder="不限" onChange={(event) => setCreates(event.target.value)} /></label>
      <Button className="min-h-11" type="submit" disabled={saving}>{saving ? '保存中…' : '保存共享上限'}</Button>
    </form>}
    <p className="mt-3 text-xs leading-5 text-slate-500">留空表示不限制，各榜单共用统计；不是成员额度。管理员免额度规则、外部请求限速与安全检查始终保留。创建任务不等于已入库。</p>
    {error && <p role="alert" className="mt-3 break-words text-sm text-rose-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-800">{message}</p>}
  </section>
}

function ChartIdentityPicker({ candidate, saving, onSave, onClose }: { candidate: DoubanChartCandidate; saving: boolean; onSave: (input: DoubanChartIdentityInput) => void; onClose: () => void }) {
  const [query, setQuery] = useState(candidate.subject.title)
  const [results, setResults] = useState<BgmCatalogCandidate[]>([])
  const [selected, setSelected] = useState<BgmCatalogCandidate | null>(null)
  const [seasons, setSeasons] = useState<BgmSeason[]>([])
  const [season, setSeason] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchController = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); return () => searchController.current?.abort() }, [])
  useEffect(() => {
    if (selected?.mediaType !== 'SERIES') return
    const controller = new AbortController()
    setLoading(true); setError(null)
    getDoubanChartSeasons(selected.tmdbId, controller.signal).then((data) => {
      if (!controller.signal.aborted) setSeasons(data.filter((entry) => entry.seasonNumber > 0))
    }).catch((caught) => { if (!controller.signal.aborted) setError(errorMessage(caught)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [selected])
  async function search() {
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    setLoading(true); setError(null); setResults([]); setSelected(null); setSeasons([]); setSeason(''); setSearched(false)
    try {
      const data = await searchDoubanChartCatalog(query.trim(), candidate.subject.mediaType, controller.signal)
      if (!controller.signal.aborted) { setResults(data); setSearched(true) }
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorMessage(caught))
    } finally { if (!controller.signal.aborted) setLoading(false) }
  }
  return <section className={panel} aria-label={`纠正 ${candidate.subject.title} 的目录匹配`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="min-w-0 break-words font-semibold">选择真实目录 · {candidate.subject.title}</h3><Button className="min-h-11" variant="outline" disabled={saving} onClick={onClose}>关闭</Button></div>
    <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void search() }}><label className="grid min-w-0 flex-1 gap-1 text-sm">{candidate.subject.mediaType === 'MOVIE' ? '电影' : '电视剧'}目录名称<input ref={inputRef} className={cn(control, 'w-full')} value={query} disabled={saving} onChange={(event) => { searchController.current?.abort(); setLoading(false); setQuery(event.target.value); setResults([]); setSelected(null); setSeasons([]); setSeason(''); setSearched(false) }} /></label><Button className="min-h-11 self-end" type="submit" variant="outline" disabled={loading || saving || !query.trim()}>搜索目录</Button></form>
    {loading && <p role="status" className="mt-3 text-sm text-slate-600">正在读取目录…</p>}{error && <p role="alert" className="mt-3 break-words text-sm text-rose-700">{error}</p>}
    {searched && !results.length && <p role="status" className="mt-3 text-sm text-slate-600">没有找到同类型目录，请修改名称后重试。</p>}
    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{results.map((item) => <button type="button" key={`${item.mediaType}:${item.tmdbId}`} disabled={saving} aria-pressed={selected?.tmdbId === item.tmdbId} className={cn(control, 'block w-full break-words text-left', selected?.tmdbId === item.tmdbId && 'border-slate-950 bg-slate-50')} onClick={() => { if (selected?.tmdbId === item.tmdbId) return; setSelected(item); setSeasons([]); setSeason(''); setError(null) }}>{item.title} · {item.year ?? '年份未知'}{item.originalTitle ? ` · ${item.originalTitle}` : ''} · TMDB {item.tmdbId}</button>)}</div>
    {selected?.mediaType === 'SERIES' && <label className="mt-4 grid gap-1 text-sm">目标季（必须明确选择）<select className={cn(control, 'w-full')} value={season} disabled={loading || saving} onChange={(event) => setSeason(event.target.value)}><option value="">请选择真实目标季</option>{seasons.map((item) => <option key={item.seasonNumber} value={item.seasonNumber}>{item.name} · 第 {item.seasonNumber} 季 · {item.episodeCount ?? '未知'} 集 · 首播 {item.airDate || '日期未提供'}</option>)}</select></label>}
    {selected?.mediaType === 'SERIES' && !loading && !error && !seasons.length && <p role="status" className="mt-2 text-sm text-amber-800">此目录暂无可选正片季，不能保存。请搜索并选择其他真实目录。</p>}
    <Button className="mt-4 min-h-11" disabled={loading || saving || !selected || selected.mediaType === 'SERIES' && season === ''} onClick={() => { if (selected) onSave({ mediaType: selected.mediaType, tmdbId: selected.tmdbId, seasonNumber: selected.mediaType === 'SERIES' ? Number(season) : null }) }}>{saving ? '保存中…' : '保存目录匹配'}</Button>
  </section>
}

function CandidateCard({ candidate, chartId, label, admin, working, onExclude, onCorrect }: { candidate: DoubanChartCandidate; chartId: DoubanChartId; label: string; admin: boolean; working: boolean; onExclude: () => void; onCorrect: (button: HTMLButtonElement) => void }) {
  const { subject, current, identity } = candidate
  const rank = current ? subject.rank : candidate.lastRank
  const rankLabel = chartId === 'movie_hot_gaia' || chartId === 'tv_hot' ? '热门位置' : 'TOP'
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5">
    <div className="relative"><BgmPoster url={subject.coverUrl} title={subject.title} /><span className={cn('absolute left-2 top-2 rounded-lg px-2 py-1 text-xs font-semibold shadow-sm', current ? 'bg-slate-950/90 text-white' : 'bg-white/95 text-slate-700')} aria-label={`${label} · ${current ? '' : '末次'}${rankLabel} ${rank ?? '未知'}`}>{current ? '' : '末次 '}{rank === null ? '榜位未知' : `${rankLabel} ${rank}`}</span></div>
    <h3 className="mt-3 break-words text-sm font-semibold leading-5 text-slate-950">{subject.title}</h3>
    <p className="mt-1 text-xs text-slate-500">{subject.year ?? '年份未知'} · {subject.mediaType === 'MOVIE' ? '电影' : '电视剧'}</p>
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"><span className="inline-flex items-center gap-1 font-semibold text-amber-800"><Star aria-hidden="true" className="h-3.5 w-3.5" />{subject.score?.toFixed(1) ?? '评分未知'}</span><span className="text-slate-600">{subject.votes === null ? '评分人数未知' : `${subject.votes.toLocaleString('zh-CN')} 人评分`}</span></div>
    <DoubanChartProgress candidate={candidate} />
    {candidate.excluded && <p className="mt-2 text-xs font-semibold text-slate-700">已人工排除</p>}
    {!current && <p className="mt-2 text-xs text-slate-600">最后在榜 {dateTime(candidate.lastSeenAt)}</p>}
    <p className="mt-2 break-words text-xs leading-5 text-slate-700">{candidate.reason?.message || (current ? '当前在榜候选，执行时核验资格与资源。' : '曾属本榜，保留后续检查资格；执行时重新核验。')}</p>
    <p className="mt-2 text-xs text-slate-500">检查于 {dateTime(subject.observedAt)}</p>
    <details className="mt-3"><summary className="min-h-11 cursor-pointer rounded py-3 text-xs text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">检查详情</summary><div className="space-y-2 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-600">
      <p>首次在榜 {dateTime(candidate.firstSeenAt)}</p><p className="break-words">目录目标：{identity ? `${identity.title}${identity.mediaType === 'SERIES' ? ` · 第 ${identity.seasonNumber ?? '待确认'} 季` : ' · 电影'}` : '待匹配'}</p>
      {subject.mediaType === 'SERIES' && (candidate.observations.length ? candidate.observations.map((observation, index) => <p key={`${observation.checkedAt}:${index}`}>{dateTime(observation.checkedAt)} · 豆瓣榜单：{observation.progress || '未提供更新进度'}</p>) : <p>暂无进度检查记录。</p>)}
    </div></details>
    {admin && <div className="mt-2 flex flex-wrap gap-2"><Button className="min-h-11 whitespace-normal text-left" size="sm" variant="outline" disabled={working} onClick={(event) => onCorrect(event.currentTarget)}>纠正匹配</Button><Button className="min-h-11" size="sm" variant="ghost" disabled={working} onClick={onExclude}>{candidate.excluded ? '解除排除' : '排除'}</Button></div>}
  </article>
}

function ChartBoardPanel({ initial, admin, focusedId, onFocus }: { initial: DoubanChartBoard; admin: boolean; focusedId: string | null; onFocus: (id: string) => void }) {
  const [board, setBoard] = useState(initial)
  const [history, setHistory] = useState<DoubanChartOperations | null>(null)
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [boardReadError, setBoardReadError] = useState<string | null>(null)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [match, setMatch] = useState<DoubanChartCandidate | null>(null)
  const recordsRef = useRef<HTMLElement>(null)
  const returnMatchFocus = useRef(false)
  const matchButtonRef = useRef<HTMLButtonElement | null>(null)
  const pollController = useRef<AbortController | null>(null)
  const actionController = useRef<AbortController | null>(null)
  const [recordsFocusVersion, setRecordsFocusVersion] = useState(0)
  useEffect(() => () => actionController.current?.abort(), [])
  useEffect(() => {
    if (focusedId) recordsRef.current?.focus()
  }, [focusedId])
  useEffect(() => {
    if (!match && !working && returnMatchFocus.current) { matchButtonRef.current?.focus(); returnMatchFocus.current = false }
  }, [match, working])
  useEffect(() => {
    const controller = new AbortController()
    pollController.current = controller
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      let active = false
      try {
        const result = await getDoubanChart(initial.id, controller.signal)
        if (!controller.signal.aborted) { setBoard(result); setBoardReadError(null) }
      } catch (caught) { if (!controller.signal.aborted) setBoardReadError(`榜单更新失败，保留上次读取结果：${errorMessage(caught)}`) }
      try {
        const result = await listDoubanChartOperations(initial.id, page, controller.signal)
        const items = await Promise.all(result.items.map((operation) => hasActiveBgmOperation(operation) || running.includes(operation.status) ? getDoubanChartOperation(operation.id, controller.signal) : operation))
        if (focusedId && !items.some((operation) => operation.id === focusedId)) {
          const focused = await getDoubanChartOperation(focusedId, controller.signal)
          if (focused.chartId === initial.id) items.unshift(focused)
        }
        active = items.some((operation) => hasActiveBgmOperation(operation) || running.includes(operation.status))
        if (!controller.signal.aborted) { setHistory({ ...result, items }); setRecordsError(null) }
      } catch (caught) { if (!controller.signal.aborted) setRecordsError(`操作记录读取失败，已有记录可能不是最新：${errorMessage(caught)}`) }
      finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(refresh, active ? 4000 : 15000) }
      }
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [initial.id, page, version, focusedId])

  async function perform(action: string, execute: (signal: AbortSignal) => Promise<void>) {
    if (!admin || actionController.current) return
    pollController.current?.abort()
    const controller = new AbortController()
    actionController.current = controller
    setWorking(action); setError(null)
    try { await execute(controller.signal) }
    catch (caught) { if (!controller.signal.aborted) setError(errorMessage(caught)) }
    finally { if (!controller.signal.aborted) { actionController.current = null; setWorking(null); setVersion((value) => value + 1) } }
  }
  function closeMatch() { returnMatchFocus.current = true; setMatch(null) }
  async function run() {
    recordsRef.current?.focus(); recordsRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    await perform('run', async (signal) => {
      const operation = await submitDoubanChartOperation(board.id, signal)
      if (signal.aborted) return
      setHistory((current) => ({ items: [operation, ...(current?.items.filter((entry) => entry.id !== operation.id) ?? [])], total: Math.max(current?.total ?? 0, 1), page: 1, pageSize: 10 }))
      setRecordsFocusVersion((value) => value + 1)
      setPage(1); onFocus(operation.id)
    })
  }
  const operations = history?.items ?? []
  const visible = board.candidates.filter((candidate) => candidate.subject.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const busy = operations.some((operation) => running.includes(operation.status))
  return <div className="space-y-5">
    <section className={panel} aria-label={`${board.label}配置`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-lg font-semibold">{board.label}</h2><p className="mt-1 text-sm text-slate-600">{board.id === 'movie_hot_gaia' || board.id === 'tv_hot' ? '前 20' : '全量'} · 单榜一轮包含当前在榜及掉榜历史候选，不受页面搜索影响。</p></div><span className={cn('rounded-full px-3 py-1 text-xs font-medium', board.autoEnabled ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600')}>自动入库{board.autoEnabled ? '已开启' : '已关闭'}</span></div>
      <div className="mt-3 space-y-1 text-xs text-slate-600"><p>最近成功 {dateTime(board.lastSuccessAt)} · 最近尝试 {dateTime(board.lastAttemptAt)}（北京时间）</p><p>本榜下次调度 {dateTime(board.nextRunAt)}（北京时间）</p>{board.autoEnabled && <p>定时执行管理员 ID：{board.ownerUserId ?? '未绑定，等待管理员处理'}</p>}</div>
      {board.refreshStatus === 'NEVER' && <p role="status" className="mt-3 text-sm text-slate-600">尚未成功抓取榜单。</p>}
      {board.refreshStatus === 'REFRESHING' && <p role="status" className="mt-3 text-sm text-slate-600">榜单与历史进度正在后台更新，保留上次成功清单；结果会自动刷新。</p>}
      {(board.refreshStatus === 'FAILED' || board.refreshError) && <p role="alert" className="mt-3 break-words rounded-lg bg-amber-50 p-3 text-sm text-amber-900">榜单抓取失败：{board.refreshError || '来源暂不可用'}。保留最后成功清单；旧在榜仅供展示，不据此新增受理。历史候选须单独重新核验。</p>}
      {admin ? <div className="mt-4 flex flex-wrap gap-2"><Button className="min-h-11" disabled={!!working} onClick={() => void run()}><Play aria-hidden="true" className="mr-2 h-4 w-4" />{working === 'run' ? '正在定位操作…' : busy ? '查看进行中本榜一轮' : '执行本榜一轮'}</Button><Button className="min-h-11" variant="outline" disabled={!!working} onClick={() => void perform('refresh', async (signal) => { const result = await refreshDoubanChart(board.id, signal); if (!signal.aborted) setBoard(result) })}><RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />{working === 'refresh' ? '更新中…' : '刷新榜单'}</Button><Button className="min-h-11" variant="outline" aria-pressed={board.autoEnabled} disabled={!!working} onClick={() => void perform('automation', async (signal) => { const result = await setDoubanChartAutomation(board.id, !board.autoEnabled, signal); if (!signal.aborted) setBoard(result) })}>{board.autoEnabled ? '关闭本榜自动入库' : '开启本榜自动入库'}</Button></div> : <p className="mt-4 text-sm text-slate-600">只读模式：仅管理员可以配置、刷新、纠正、排除或执行。</p>}
      {working && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-600"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />正在处理，请稍候…</p>}
      {boardReadError && <p role="alert" className="mt-3 break-words text-sm text-rose-700">{boardReadError}</p>}
      {error && <p role="alert" className="mt-3 break-words text-sm text-rose-700">{error}</p>}
    </section>
    <section ref={recordsRef} tabIndex={-1} className={cn(panel, 'scroll-mt-6 focus:outline-none focus:ring-2 focus:ring-slate-500')} aria-label={`${board.label}操作记录`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">操作记录</h2><Button className="min-h-11" size="sm" variant="outline" disabled={!!working || loading} onClick={() => { setLoading(true); setVersion((value) => value + 1) }}>重新读取记录</Button></div>
      <p className="mb-4 text-xs leading-5 text-slate-500">记录保留当轮范围与原因；停止只停止新目标受理，不撤销已创建任务。失败或中断任务请通过原任务中心入口恢复，不重复创建。</p>
      {loading && <p role="status" className="mb-3 text-sm text-slate-600">正在读取操作记录…</p>}{recordsError && <p role="alert" className="mb-3 break-words text-sm text-rose-700">{recordsError}</p>}
      {admin && operations.filter((operation) => running.includes(operation.status)).map((operation) => <div className="mb-3 flex flex-wrap items-center gap-3" key={operation.id}><p className="min-w-0 break-words text-sm text-slate-600">{dateTime(operation.startedAt)} · {operation.status === 'STOPPING' || operation.status === 'STOP_REQUESTED' ? '正在停止受理' : '本榜一轮处理中'}</p><Button className="min-h-11" variant="outline" size="sm" disabled={!!working || operation.status === 'STOPPING' || operation.status === 'STOP_REQUESTED'} onClick={() => void perform('stop', async (signal) => { const updated = await stopDoubanChartOperation(operation.id, signal); if (!signal.aborted) setHistory((current) => current && ({ ...current, items: current.items.map((entry) => entry.id === updated.id ? updated : entry) })) })}>停止本轮</Button></div>)}
      <BgmOperationRecords key={recordsFocusVersion} operations={operations} focusedId={focusedId} working={!!working} canManage={() => false} />
      {history && history.total > history.pageSize && <div className="mt-4 flex flex-wrap items-center gap-3"><Button className="min-h-11" size="sm" variant="outline" disabled={page <= 1 || !!working || loading} onClick={() => { setLoading(true); setHistory(null); setPage((value) => value - 1) }}>上一页</Button><span className="text-sm text-slate-600">第 {page} 页 · 共 {history.total} 条</span><Button className="min-h-11" size="sm" variant="outline" disabled={page * history.pageSize >= history.total || !!working || loading} onClick={() => { setLoading(true); setHistory(null); setPage((value) => value + 1) }}>下一页</Button></div>}
    </section>
    {admin && match && <ChartIdentityPicker key={match.subject.id} candidate={match} saving={working === 'identity'} onClose={closeMatch} onSave={(input) => void perform('identity', async (signal) => { const result = await updateDoubanChartIdentity(board.id, match.subject.id, input, signal); if (!signal.aborted) { setBoard(result); closeMatch() } })} />}
    {match && error && <p role="alert" className="break-words text-sm text-rose-700">{error}</p>}
    <section className={panel} aria-label="榜单候选">
      <label className="mb-5 grid gap-2 text-sm font-medium">搜索本榜候选<input className={cn(control, 'w-full sm:max-w-sm')} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="按作品名称筛选（不影响执行范围）" /></label>
      <div className="space-y-6">{[true, false].map((current) => {
        const candidates = visible.filter((candidate) => candidate.current === current).sort((a, b) => (current ? (a.subject.rank ?? Infinity) - (b.subject.rank ?? Infinity) : (a.lastRank ?? Infinity) - (b.lastRank ?? Infinity)) || b.lastSeenAt.localeCompare(a.lastSeenAt))
        return <section key={String(current)}><h2 className="mb-3 flex items-center gap-2 font-semibold">{current ? <Film aria-hidden="true" className="h-4 w-4 text-slate-500" /> : <History aria-hidden="true" className="h-4 w-4 text-slate-500" />}{current ? '当前在榜' : '掉榜历史候选'}<span className="text-xs font-normal text-slate-500">{candidates.length} 部</span></h2>
          {candidates.length ? <div className="grid grid-cols-1 gap-3 min-[375px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{candidates.map((candidate) => <CandidateCard key={candidate.subject.id} candidate={candidate} chartId={board.id} label={board.label} admin={admin} working={!!working} onCorrect={(button) => { matchButtonRef.current = button; setMatch(candidate) }} onExclude={() => void perform('exclusion', async (signal) => { const result = await setDoubanChartExclusion(board.id, candidate.subject.id, !candidate.excluded, signal); if (!signal.aborted) setBoard(result) })} />)}</div> : <p className="text-sm text-slate-500">{query ? '没有符合搜索条件的候选。' : current ? '暂无当前在榜候选。' : '暂无掉榜历史候选；后续成功刷新后会保留曾属本榜的作品。'}</p>}
        </section>
      })}</div>
    </section>
  </div>
}

export function DoubanChartsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [overview, setOverview] = useState<DoubanChartOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const focusedId = params.get('operation')
  const requestedChart = params.get('chart')
  const [recoveredChart, setRecoveredChart] = useState<DoubanChartId | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null)
    getDoubanCharts(controller.signal).then((data) => { if (!controller.signal.aborted) setOverview(data) }).catch((caught) => { if (!isJavaRequestCanceledError(caught)) setError(errorMessage(caught)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [version])
  useEffect(() => {
    if (!focusedId) return
    const controller = new AbortController()
    getDoubanChartOperation(focusedId, controller.signal).then((operation) => { if (!controller.signal.aborted) setRecoveredChart(operation.chartId) }).catch((caught) => { if (!controller.signal.aborted) setError(`操作恢复失败：${errorMessage(caught)}`) })
    return () => controller.abort()
  }, [focusedId])
  const onFocus = useCallback((id: string) => { setParams((current) => { const next = new URLSearchParams(current); next.set('operation', id); return next }, { replace: true }) }, [setParams])
  const board = overview?.boards.find((entry) => entry.id === (recoveredChart || requestedChart)) ?? overview?.boards[0]
  return <PageContainer title="榜单入库" description="从公共榜单发现电影与电视剧，持续保留当前及历史候选，安全执行单榜一轮。">
    <AutomationNavigation active="charts" />
    <div className="mt-5 space-y-5">
      {loading && <p role="status" className="text-sm text-slate-600">正在加载榜单与配置…</p>}
      {error && <div role="alert" className={panel}><p className="break-words text-sm text-rose-700">{error}</p><Button className="mt-3 min-h-11" variant="outline" disabled={loading} onClick={() => setVersion((value) => value + 1)}>重试读取</Button></div>}
      {overview && <><ChartLimits initial={overview.settings} admin={user?.role === 'ADMIN'} /><nav className="flex flex-wrap gap-2" aria-label="选择豆瓣榜单">{overview.boards.map((entry) => <Button className="min-h-11" key={entry.id} variant={board?.id === entry.id ? 'default' : 'outline'} aria-current={board?.id === entry.id ? 'page' : undefined} onClick={() => { setRecoveredChart(null); setParams({ chart: entry.id }) }}>{entry.label}</Button>)}</nav>{board ? <ChartBoardPanel key={board.id} initial={board} admin={user?.role === 'ADMIN'} focusedId={focusedId} onFocus={onFocus} /> : <p className={panel}>暂无可读取榜单。</p>}</>}
    </div>
  </PageContainer>
}
