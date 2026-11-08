import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { confirmBgmCandidate, deferBgmOperation, getBgmOperation, getBgmWishlist, listBgmOperations, listBgmSources, refreshBgmWishlist, saveBgmSource, searchBgmOperation, submitBgmOperation, supplyBgmOperation, updateBgmIdentity } from '@/lib/api/bgm-wishlist'
import { getJavaErrorMessage, isJavaRequestCanceledError } from '@/lib/java-api'
import type { BgmItem, BgmOperation, BgmOperations, BgmSource, BgmWishlist } from '@/types/bgm-wishlist'
import { AutomationNavigation } from './navigation'
import { BgmConfig, type BgmConfigForm } from './bgm-config'
import { BgmDirectoryPicker } from './bgm-directory-picker'
import { BgmPoster } from './bgm-poster'
import { BgmOperationRecords, hasActiveBgmOperation } from './bgm-operation-records'

const blankForm: BgmConfigForm = { account: '', ownerId: null, enabled: false, count: 3, time: '09:00', quality: '1080p', firstScope: 'future' }
function sourceForm(source: BgmSource): BgmConfigForm {
  return { account: source.bgmUsername, ownerId: source.ownerUserId, enabled: source.enabled, count: source.targetCount, time: source.scheduleTime, quality: source.quality, firstScope: source.initialScope === 'INCLUDE_EXISTING' ? 'all' : 'future' }
}
function dateTime(value: string | null) {
  if (!value) return '暂无'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date)
}
function target(item: BgmItem) {
  if (!item.identity) return '目录待匹配'
  return item.identity.mediaType === 'MOVIE' ? `电影库 · ${item.identity.title}` : `动漫库 · ${item.identity.title} · 第 ${item.identity.seasonNumber ?? '待确认'} 季`
}
function library(item: BgmItem) {
  return item.libraryStatus === 'PRESENT' ? '已在库' : item.libraryStatus === 'ABSENT' ? '未在库' : '在库状态待确认'
}
function taskPath(task: NonNullable<BgmItem['activeTask']>) { return `/tasks/${encodeURIComponent(task.taskType.toLowerCase())}/${encodeURIComponent(task.taskId)}` }

export function BgmWishlistPage() {
  const [sources, setSources] = useState<BgmSource[] | null>(null)
  const [sourceId, setSourceId] = useState('')
  const [wishlist, setWishlist] = useState<BgmWishlist | null>(null)
  const [form, setForm] = useState<BgmConfigForm>(blankForm)
  const [adding, setAdding] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<number[]>([])
  const [matchItem, setMatchItem] = useState<BgmItem | null>(null)
  const [page, setPage] = useState(1)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [historyPage, setHistoryPage] = useState(1)
  const [history, setHistory] = useState<BgmOperations | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)
  const recordsRef = useRef<HTMLDivElement>(null)
  const [focusedId, setFocusedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('operation'))
  const matchRef = useRef<HTMLDivElement>(null)
  const source = sources?.find((entry) => entry.id === sourceId)

  useEffect(() => { if (matchItem) matchRef.current?.focus() }, [matchItem])

  useEffect(() => {
    const controller = new AbortController()
    listBgmSources(controller.signal).then((data) => { setSources(data); setSourceId((current) => current || data[0]?.id || '') }).catch((caught) => { if (!isJavaRequestCanceledError(caught)) setError(getJavaErrorMessage(caught) || '来源读取失败') })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    setWishlist(null); setSelected([]); setMatchItem(null); setHistory(null); setHistoryPage(1); setQuery(''); setKind('all'); setStatus('all'); setPage(1)
    if (!sourceId) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    getBgmWishlist(sourceId, controller.signal).then((data) => { setWishlist(data); setError(null) }).catch((caught) => { if (!isJavaRequestCanceledError(caught)) setError(getJavaErrorMessage(caught) || '清单读取失败') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [sourceId])
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('operation')
    if (!id) return
    const controller = new AbortController()
    getBgmOperation(id, controller.signal).then((operation) => {
      if (controller.signal.aborted) return
      setSourceId(operation.source.id); setFocusedId(id); setHistoryOpen(true)
    }).catch((caught) => { if (!isJavaRequestCanceledError(caught)) setHistoryError(getJavaErrorMessage(caught) || '关联记录读取失败') })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!sourceId || !historyOpen) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      try {
        const data = await listBgmOperations(sourceId, historyPage, controller.signal)
        if (focusedId && !data.items.some((operation) => operation.id === focusedId)) {
          const focused = await getBgmOperation(focusedId, controller.signal)
          if (focused.source.id === sourceId) data.items = [focused, ...data.items]
        }
        if (controller.signal.aborted) return
        setHistory(data); setHistoryError(null)
        timer = setTimeout(() => void poll(), data.items.some(hasActiveBgmOperation) ? 2000 : 10000)
      } catch (caught) {
        if (!controller.signal.aborted && !isJavaRequestCanceledError(caught)) {
          setHistoryError(getJavaErrorMessage(caught) || '记录更新失败，保留已有结果。')
          timer = setTimeout(() => void poll(), 5000)
        }
      }
    }
    void poll()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [sourceId, historyOpen, historyPage, historyVersion, focusedId])
  const filtered = useMemo(() => (wishlist?.items ?? []).filter((item) => {
    const matchesQuery = `${item.title} ${item.originalTitle ?? ''} ${item.subjectId}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesKind = kind === 'all' || (kind === 'unknown' ? !item.identity : item.identity?.mediaType === kind)
    const matchesStatus = status === 'all' || (status === 'ready' ? item.eligible : status === 'active' ? !!item.activeTask : status === 'unknown' ? !item.identity || item.libraryStatus === 'UNKNOWN' : item.libraryStatus === status)
    return matchesQuery && matchesKind && matchesStatus
  }).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || b.subjectId - a.subjectId), [wishlist, query, kind, status])
  const pageItems = filtered.slice((page - 1) * 12, page * 12)
  async function save() {
    if (!form.ownerId) return
    setWorking(true); setError(null); setMessage(null)
    try {
      const saved = await saveBgmSource({ bgmUsername: form.account.trim(), ownerUserId: form.ownerId, enabled: form.enabled, scheduleTime: form.time, targetCount: form.count, quality: form.quality, initialScope: form.firstScope === 'all' ? 'INCLUDE_EXISTING' : 'NEW_ONLY' }, adding ? undefined : sourceId)
      setSources((current) => [...(current ?? []).filter((entry) => entry.id !== saved.id), saved])
      setSourceId(saved.id); setAdding(false); setConfigOpen(false); setMessage('配置已保存，保存配置不会立即创建任务。')
      if (!adding) setWishlist((current) => current ? { ...current, source: saved } : current)
    } catch (caught) { setError(getJavaErrorMessage(caught) || '配置保存失败') } finally { setWorking(false) }
  }
  async function refresh() {
    setWorking(true); setError(null); setMessage(null)
    try { const data = await refreshBgmWishlist(sourceId); setWishlist(data); setSelected([]); setMessage(data.refreshStatus === 'SUCCESS' ? '想看清单已刷新。' : null) } catch (caught) { setError(getJavaErrorMessage(caught) || '刷新失败，保留上次清单。') } finally { setWorking(false) }
  }
  async function saveMatch(choice: { kind: 'movie' | 'series'; tmdbId: number; season: number | null }) {
    if (!matchItem) return
    setWorking(true); setError(null)
    try {
      const item = await updateBgmIdentity(sourceId, matchItem.subjectId, { mediaType: choice.kind === 'movie' ? 'MOVIE' : 'SERIES', tmdbId: choice.tmdbId, seasonNumber: choice.season })
      setWishlist((current) => current ? { ...current, items: current.items.map((entry) => entry.subjectId === item.subjectId ? item : entry) } : current); setMatchItem(null); setMessage('目录匹配已保存并重新检查。')
    } catch (caught) { setError(getJavaErrorMessage(caught) || '保存匹配失败') } finally { setWorking(false) }
  }
  function showOperation(operation: BgmOperation) {
    setFocusedId(operation.id); setHistoryOpen(true); setHistoryPage(1)
    setHistory((current) => ({ items: [operation, ...(current?.items ?? []).filter((entry) => entry.id !== operation.id)], total: Math.max(current?.total ?? 0, 1), page: 1, pageSize: 20 }))
    setSelected([]); setHistoryVersion((value) => value + 1)
    requestAnimationFrame(() => { recordsRef.current?.focus(); recordsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) })
  }
  async function startOperation(ids?: number[]) {
    setWorking(true); setError(null); setMessage(null)
    try { showOperation(await submitBgmOperation(sourceId, ids)) }
    catch (caught) {
      setError(`${getJavaErrorMessage(caught) || '提交请求失败'}。受理结果未确认，请查看操作记录后再试。`)
      setHistoryOpen(true); setHistoryVersion((value) => value + 1)
    } finally { setWorking(false) }
  }
  async function updateOperation(request: Promise<BgmOperation>) {
    setWorking(true); setError(null)
    try { showOperation(await request) }
    catch (caught) { setError(getJavaErrorMessage(caught) || '操作失败，请查看当前记录。'); setHistoryVersion((value) => value + 1) }
    finally { setWorking(false) }
  }
  async function saveCandidate(request: Promise<BgmOperation>) {
    setWorking(true); setError(null)
    try {
      const operation = await request
      setHistory((current) => current ? { ...current, items: current.items.map((entry) => entry.id === operation.id ? operation : entry) } : current)
      setHistoryVersion((value) => value + 1)
    } catch (caught) {
      setHistoryVersion((value) => value + 1)
      throw caught
    } finally { setWorking(false) }
  }
  return <PageContainer title="自动化" description="管理 BGM 想看来源与入库任务。">
    <div className="space-y-6">
      <AutomationNavigation active="bgm" />
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
      <section className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
        <label className="min-w-52 flex-1 text-sm font-medium">BGM 想看来源<select className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2" value={sourceId} disabled={working || !sources?.length} onChange={(e) => { setSourceId(e.target.value); setAdding(false); setConfigOpen(false) }}><option value="">{sources === null ? '正在读取来源' : '请选择来源'}</option>{sources?.map((entry) => <option key={entry.id} value={entry.id}>{entry.bgmUsername} · 归属 {entry.ownerUsername}</option>)}</select></label>
        <Button variant="outline" type="button" disabled={working} onClick={() => { setAdding(true); setForm(blankForm); setConfigOpen(true) }}>添加来源</Button>
        <Button variant="outline" type="button" disabled={!source || working} onClick={() => void refresh()}>{working ? '请求处理中…' : '刷新想看'}</Button>
      </section>
      {source && !adding && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">归属 {source.ownerUsername} · 自动化{source.enabled ? `已开启，每日 ${source.scheduleTime}（北京时间）` : '已关闭'} · 最近完整读取 {dateTime(wishlist?.lastSuccessAt ?? null)}</p><div className="flex gap-2"><Button variant="outline" type="button" onClick={() => setHistoryOpen(!historyOpen)}>{historyOpen ? '收起操作记录' : '操作记录'}</Button><Button variant="outline" type="button" onClick={() => { setForm(sourceForm(source)); setConfigOpen(!configOpen) }}>{configOpen ? '收起配置' : '自动化配置'}</Button></div></div>}
      {wishlist && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['想看作品', wishlist.items.length], ['符合初步条件', wishlist.items.filter((item) => item.eligible).length], ['已在库', wishlist.items.filter((item) => item.libraryStatus === 'PRESENT').length], ['待匹配／检查', wishlist.items.filter((item) => !item.identity || item.libraryStatus === 'UNKNOWN').length]].map(([label, count]) => <div key={label} className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{count}</p></div>)}</div>}
      {configOpen && <BgmConfig value={form} onChange={setForm} onSave={() => void save()} saving={working} isNew={adding} chooseFirstScope={adding || !source?.baselineInitialized} />}
      {matchItem && <div ref={matchRef} tabIndex={-1}><BgmDirectoryPicker key={matchItem.subjectId} title={matchItem.title} saving={working} onClose={() => setMatchItem(null)} onChoose={(choice) => void saveMatch(choice)} /></div>}
      {historyOpen && source && <section ref={recordsRef} tabIndex={-1} aria-label="操作记录" className="min-w-0 scroll-mt-24 space-y-3 rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200"><h2 className="font-semibold">操作记录</h2>{historyError && <p role="alert" className="text-sm text-amber-700">{historyError}</p>}{!history ? <p className="text-sm text-slate-500">正在读取记录…</p> : <><BgmOperationRecords key={sourceId} operations={history.items} focusedId={focusedId} working={working} onConfirm={(id, subjectId, key) => saveCandidate(confirmBgmCandidate(id, subjectId, key))} onSupply={(id, subjectId, identity, release) => saveCandidate(supplyBgmOperation(id, subjectId, identity, release))} onSearch={(id, subjectId) => void updateOperation(searchBgmOperation(id, subjectId))} onDefer={(id, subjectId) => void updateOperation(deferBgmOperation(id, subjectId))} /><div className="flex items-center gap-3 text-sm"><Button size="sm" variant="outline" disabled={historyPage <= 1 || working} onClick={() => setHistoryPage(historyPage - 1)}>上一页</Button><span>第 {history.page} 页 · 共 {history.total} 条</span><Button size="sm" variant="outline" disabled={history.page * history.pageSize >= history.total || working} onClick={() => setHistoryPage(historyPage + 1)}>下一页</Button></div></>}</section>}

      {loading && <p className="text-sm text-slate-500">正在读取想看清单…</p>}
      {wishlist?.refreshStatus === 'FAILED' && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">上次刷新失败：{wishlist.refreshError || '读取未完成'}。显示上次有效清单；本次不能据此执行入库。</p>}
      {wishlist?.refreshStatus === 'NEVER' && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">尚未读取想看清单，请先刷新。</p>}
      {wishlist && <section className="space-y-4 rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">想看清单 <span className="text-slate-400">{wishlist.items.length}</span></h2><p className="mt-1 text-sm text-slate-500">按 BGM 收藏更新时间排列；已在库不代表季度集数完整。</p></div><Button type="button" disabled={working || !wishlist.items.length} onClick={() => void startOperation()}>最新优先入库 {source?.targetCount ?? 3} 项</Button></div>
        <div className="flex flex-wrap gap-3"><label className="text-sm">搜索名称／BGM ID <input className="rounded-lg border border-slate-200 p-2" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} /></label><label className="text-sm">类型 <select className="rounded-lg border border-slate-200 p-2" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1) }}><option value="all">全部</option><option value="MOVIE">电影</option><option value="SERIES">剧集型动漫</option><option value="unknown">待匹配</option></select></label><label className="text-sm">状态 <select className="rounded-lg border border-slate-200 p-2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="all">全部</option><option value="ready">符合初步条件</option><option value="PRESENT">已在库</option><option value="ABSENT">未在库</option><option value="unknown">待确认</option><option value="active">任务处理中</option></select></label></div>
        <div className="flex flex-wrap items-center gap-3 text-sm"><label><input type="checkbox" checked={pageItems.length > 0 && pageItems.every((item) => selected.includes(item.subjectId))} onChange={(e) => setSelected((current) => e.target.checked ? Array.from(new Set([...current, ...pageItems.map((item) => item.subjectId)])) : current.filter((id) => !pageItems.some((item) => item.subjectId === id)))} /> 选择本页</label><span>已选 {selected.length} 项</span><Button type="button" size="sm" variant="outline" disabled={working || !selected.length} onClick={() => void startOperation(selected)}>勾选批量入库</Button></div>
        {filtered.length === 0 ? <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{wishlist.refreshStatus === 'NEVER' ? '读取后显示作品。' : '没有符合条件的作品。'}</p> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{pageItems.map((item) => { const operation = history?.items.find((entry) => entry.entries.some((record) => record.item.subjectId === item.subjectId)); const record = operation?.entries.find((entry) => entry.item.subjectId === item.subjectId); const task = record?.task ?? item.activeTask ?? item.associatedTask; const pending = operation && ['QUEUED', 'RUNNING', 'WAITING'].includes(operation.status); return <article key={item.subjectId} className="min-w-0 rounded-xl border border-slate-200 p-2"><div className="relative"><BgmPoster url={item.coverUrl} title={item.title} /><label className="absolute left-2 top-2 rounded bg-white p-1"><input type="checkbox" aria-label={`选择 ${item.title}`} checked={selected.includes(item.subjectId)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, item.subjectId] : current.filter((id) => id !== item.subjectId))} /></label></div><h3 className="mt-2 font-semibold text-slate-950">{item.title || item.originalTitle || `BGM #${item.subjectId}`}</h3><p className="mt-1 text-xs text-slate-500">{item.year ?? '年份未知'} · BGM #{item.subjectId}</p><p className="mt-2 text-xs text-slate-600">{target(item)}</p><p className="mt-1 text-xs font-medium text-slate-700">{library(item)}</p>{task && <p className="mt-1 text-xs text-slate-600">任务状态快照：{task.status}</p>}{item.reasons.map((reason) => <p key={reason.code} className="mt-1 text-xs text-amber-700">{reason.message}</p>)}<p className="mt-1 text-xs text-slate-400">{item.releaseStatus === 'NOT_CHECKED' ? '发布资源未查询' : item.releaseStatus}</p><div className="mt-3 flex flex-wrap gap-2">{!task && item.eligible && <Button type="button" size="sm" disabled={working} onClick={() => pending ? showOperation(operation) : void startOperation([item.subjectId])}>{pending ? record?.status === 'WAITING_CONFIRMATION' ? '待确认 · 查看记录' : record?.status === 'WAITING_RESOURCE' ? '待补充资源' : '查看进行中的记录' : item.identity?.mediaType === 'MOVIE' ? '电影入库' : '整季入库'}</Button>}<Button type="button" size="sm" variant="outline" onClick={() => setMatchItem(item)}>纠正匹配</Button>{task && <Button asChild size="sm" variant="outline"><Link to={taskPath(task)}>查看任务／恢复</Link></Button>}</div></article> })}</div>}
        <div className="flex items-center justify-between text-sm text-slate-500"><span>共 {filtered.length} 部 · 已选 {selected.length} 项</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button><span>{page} / {Math.max(1, Math.ceil(filtered.length / 12))}</span><Button size="sm" variant="outline" disabled={page >= Math.ceil(filtered.length / 12)} onClick={() => setPage(page + 1)}>下一页</Button></div></div>
      </section>}
    </div>
  </PageContainer>
}
