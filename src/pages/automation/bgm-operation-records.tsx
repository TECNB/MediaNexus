import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Image, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useElapsedNow } from '@/lib/use-elapsed-time'
import type { BgmOperation, BgmOperationEntry } from '@/types/bgm-wishlist'
import type { ResourcePublishPageState } from '@/types/resources'
import { BgmPoster } from './bgm-poster'

const busyStates = ['QUEUED', 'RUNNING']
const taskActive = ['PENDING', 'SUBMITTED', 'DOWNLOADING', 'ORGANIZING']
const labels: Record<string, string> = { QUEUED: '搜索资源', RUNNING: '处理中', WAITING: '需要处理', SUCCEEDED: '本轮处理结束', PARTIAL_SUCCESS: '部分成功', INTERRUPTED: '执行中断', SEARCHING: '搜索资源', CREATING: '创建入库任务', WAITING_RESOURCE: '待补充资源', WAITING_CONFIRMATION: '待确认', DEFERRED: '暂不处理', CREATED: '已创建', SKIPPED: '已跳过', FAILED: '处理失败', PENDING: '已创建', SUBMITTED: '已提交', DOWNLOADING: '下载中', ORGANIZING: '整理中', UNKNOWN: '状态待核实' }
const notices: Record<string, string> = { PENDING: '消息正在发送，结果待核实。', SENT: '已发送消息（企业微信已受理）。', FAILED: '消息发送失败，请在本站处理。', DISABLED: '企业微信通知未开启。' }

export function hasActiveBgmOperation(operation: BgmOperation) {
  return busyStates.includes(operation.status) || operation.entries.some((entry) => entry.task && taskActive.includes(entry.task.status))
}
function timestamp(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value))
}
function publishState(operation: BgmOperation, entry: BgmOperationEntry): ResourcePublishPageState | undefined {
  const identity = entry.item.identity
  if (!identity) return undefined
  const item = { id: String(identity.tmdbId), title: identity.title, original_title: identity.originalTitle, year: identity.year, overview: '', poster: entry.item.coverUrl, tmdb_id: identity.tmdbId, imdb_id: null, status: '', ...(identity.mediaType === 'SERIES' ? { tvdb_id: null, network: null, series_type: null } : {}) }
  return { mediaType: identity.mediaType === 'MOVIE' ? 'movie' : 'series', item, submittedTerm: identity.title, qualityTag: operation.source.quality, seasonNumber: identity.seasonNumber, seasonOptions: identity.seasonNumber ? [identity.seasonNumber] : [], taskProductType: 'ANIME', releaseSource: 'prowlarr', bgmOperation: { operationId: operation.id, subjectId: entry.item.subjectId } }
}
function Notice({ value }: { value: string | null }) {
  return value ? <p className="mt-2 text-xs text-slate-500" role="status">{notices[value] ?? '消息发送结果待核实。'}</p> : null
}
function Step({ number, title, done, active, children }: { number: number; title: string; done?: boolean; active?: boolean; children?: React.ReactNode }) {
  return <li className="relative min-w-0 pl-9 pb-5 last:pb-0"><span className={`absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? 'bg-emerald-50 text-emerald-700' : active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-400'}`}>{done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : number}</span><h4 className={`mb-2 text-sm font-semibold ${active || done ? 'text-slate-950' : 'text-slate-400'}`}>{title}</h4>{children}</li>
}

export function BgmOperationRecords({ operations, focusedId, working, onConfirm, onSearch, onDefer }: { operations: BgmOperation[]; focusedId: string | null; working: boolean; onConfirm: (id: string, subjectId: number, candidateKey: string) => void; onSearch: (id: string, subjectId: number) => void; onDefer: (id: string, subjectId: number) => void }) {
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const now = useElapsedNow(operations.some(hasActiveBgmOperation))
  if (!operations.length) return <p className="py-5 text-sm text-slate-500">暂无操作记录，点击作品上的入库按钮开始。</p>
  return <div className="space-y-4">{operations.map((operation, index) => {
    const busy = busyStates.includes(operation.status)
    const expanded = closed[operation.id] === undefined ? index === 0 || operation.id === focusedId : !closed[operation.id]
    return <section key={operation.id} id={`operation-${operation.id}`} className="min-w-0 rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4"><div className="min-w-0"><h3 className="text-sm font-semibold text-slate-950">{operation.action === 'DAILY' ? '每日自动入库' : operation.action === 'LATEST' ? '最新优先入库' : operation.action === 'SINGLE' ? operation.entries[0]?.item.title || '单部入库' : `批量入库 · ${operation.entries.length} 部`}</h3><p className="mt-1 text-xs text-slate-500">{timestamp(operation.startedAt)} · {operation.triggerType === 'SCHEDULED' ? '定时自动化' : '手动触发'} · {operation.source.quality} · {labels[operation.status] ?? operation.status}</p></div><Button size="sm" variant="outline" aria-expanded={expanded} onClick={() => setClosed((current) => ({ ...current, [operation.id]: expanded }))}>{expanded ? '收起' : '展开'}</Button></div>
      {expanded && <div className="space-y-5 border-t border-slate-100 p-4">{operation.reason && <p role="alert" className="text-sm text-amber-700">{operation.reason.message}</p>}{!operation.entries.length && <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />正在搜索资源，结果会保留在记录中。</p>}{operation.entries.map((entry) => {
        const key = `${operation.id}:${entry.item.subjectId}`
        const selectedKey = choices[key] ?? entry.candidates[0]?.key ?? ''
        const selected = entry.selected ?? entry.candidates.find((candidate) => candidate.key === selectedKey)
        const searching = entry.status === 'SEARCHING'
        const elapsed = Math.max(0, Math.floor(((busy ? now : Date.parse(operation.updatedAt)) - Date.parse(entry.startedAt)) / 1000))
        const task = entry.task
        const failedTask = task && ['FAILED', 'INTERRUPTED', 'PARTIAL_SUCCESS', 'UNKNOWN'].includes(task.status)
        const state = publishState(operation, entry)
        return <article key={entry.item.subjectId} className="min-w-0"><div className="mb-4 flex gap-3"><div className="w-11 shrink-0">{entry.item.coverUrl ? <BgmPoster url={entry.item.coverUrl} title={entry.item.title} /> : <div className="flex aspect-[2/3] items-center justify-center rounded-lg bg-slate-50"><Image className="h-5 w-5 text-slate-300" aria-label="暂无封面" /></div>}</div><div className="min-w-0"><p className="break-words text-sm font-semibold">{entry.item.title}</p><p className="mt-1 text-xs text-slate-500">{entry.item.identity?.seasonNumber ? `第 ${entry.item.identity.seasonNumber} 季 · ` : ''}{task ? task.status === 'SUCCEEDED' ? '处理完成' : labels[task.status] ?? task.status : labels[entry.status] ?? entry.status}</p></div></div>
          <ol className="ml-1 border-l border-slate-100">
            <Step number={1} title="搜索资源" active={searching} done={!searching && entry.searches.length > 0 && entry.searches.every((query) => query.status === 'SUCCEEDED')}>
              <p className="text-xs text-slate-500">{searching ? `正在查询 · 已耗时 ${elapsed} 秒` : entry.searches.length ? `已完成 ${entry.searches.filter((query) => query.status === 'SUCCEEDED').length} / ${entry.searches.length} 组查询` : entry.reason?.message ?? '尚未开始查询'}</p>
              {entry.searches.length > 0 && <ul className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">{entry.searches.map((query) => <li key={query.query} className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1 text-xs"><span className="min-w-0 break-all text-slate-700">{query.query}</span><span className="text-slate-500">{query.status === 'RUNNING' ? '查询中' : query.status === 'FAILED' ? '查询失败' : `${(query.elapsedMs / 1000).toFixed(1)} 秒 · ${query.resultCount ?? 0} 条`}</span></li>)}</ul>}
              {entry.status === 'WAITING_RESOURCE' && <><p className="mt-2 text-sm text-amber-700">{entry.reason?.message}</p><Notice value={entry.notification} /><div className="mt-3 flex flex-wrap gap-2">{state && <Button asChild size="sm"><Link to="/resources/publish" state={state}>补充来源</Link></Button>}<Button size="sm" variant="outline" disabled={working || busy} onClick={() => onSearch(operation.id, entry.item.subjectId)}>重新搜索</Button><Button size="sm" variant="ghost" disabled={working || busy} onClick={() => onDefer(operation.id, entry.item.subjectId)}>暂不处理</Button></div></>}
              {['FAILED', 'INTERRUPTED'].includes(entry.status) && !task && <div className="mt-2"><p className="text-sm text-amber-700">{entry.reason?.message}</p><Button className="mt-2" size="sm" variant="outline" disabled={working || busy} onClick={() => onSearch(operation.id, entry.item.subjectId)}>重新搜索</Button></div>}
            </Step>
            <Step number={2} title="选择发布" active={entry.status === 'WAITING_CONFIRMATION' || entry.status === 'CREATING'} done={!!entry.selected}>
              {selected ? <><p className="break-words text-sm text-slate-800">{selected.release.title}</p><p className="mt-1 text-xs text-slate-500">{selected.release.resolution_tags.join(' / ')} · {selected.release.indexer ?? '来源未知'} · 做种 {selected.release.seeders ?? '未知'}</p>{selected.release.match_source && <p className="mt-1 break-words text-xs text-amber-700">{selected.release.match_source}{selected.release.match_query ? `：${selected.release.match_query}` : ''}</p>}{selected.release.seeders === null && <p className="mt-1 text-xs text-slate-500">可下载性未知。</p>}</> : <p className="text-xs text-slate-400">搜索结束后自动选择符合条件的发布。</p>}
              {entry.status === 'WAITING_CONFIRMATION' && <><p className="mt-2 text-sm text-amber-700">{entry.reason?.message}</p><Notice value={entry.notification} /><label className="mt-3 block text-xs text-slate-600">查看其他候选<select className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-sm" value={selectedKey} disabled={working || busy} onChange={(event) => setChoices((current) => ({ ...current, [key]: event.target.value }))}>{entry.candidates.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.release.title}</option>)}</select></label><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={working || busy || !selectedKey} onClick={() => onConfirm(operation.id, entry.item.subjectId, selectedKey)}>使用此发布继续</Button><Button size="sm" variant="outline" disabled={working || busy} onClick={() => onDefer(operation.id, entry.item.subjectId)}>暂不处理</Button></div></>}
              {entry.selected && <p className="mt-2 text-xs text-slate-500">{/[\u3400-\u9fff]/.test(entry.selected.release.title) ? '按推荐顺序选择标题含汉字的发布' : '已人工确认此发布'} · 字幕未经验证</p>}
              {entry.status === 'DEFERRED' && <><p className="mt-2 text-xs text-slate-500">已暂不处理。</p><Button className="mt-2" size="sm" variant="outline" disabled={working || busy} onClick={() => onSearch(operation.id, entry.item.subjectId)}>重新搜索</Button></>}
              {entry.status === 'SKIPPED' && entry.searches.length > 0 && <p className="mt-2 text-sm text-amber-700">{entry.reason?.message}</p>}
            </Step>
            <Step number={3} title="入库任务" active={!!task && taskActive.includes(task.status) || entry.status === 'CREATING'} done={task?.status === 'SUCCEEDED'}>
              {task ? <><div className="flex flex-wrap items-center gap-1 text-xs text-slate-600"><span>已创建</span><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{['DOWNLOADING', 'SUBMITTED'].includes(task.status) ? '下载中' : '离线下载'}</span><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{task.status === 'ORGANIZING' ? '整理中' : '文件整理'}</span><ChevronRight className="h-3 w-3" aria-hidden="true" /><span>{task.status === 'SUCCEEDED' ? '处理完成' : failedTask ? '需要处理' : '完成'}</span></div>{task.error && <p className="mt-2 break-words text-sm text-amber-700">{task.error}</p>}<Notice value={task.notification} /><Button asChild size="sm" className="mt-3" variant="outline"><Link to={`/tasks/${task.taskType.toLowerCase()}/${encodeURIComponent(task.taskId)}`}>{failedTask ? '前往任务中心处理' : '查看任务'}</Link></Button></> : <p className="text-xs text-slate-400">{entry.status === 'CREATING' ? '正在创建后台任务…' : '尚未创建入库任务，本次检查不消耗创建额度。'}</p>}
            </Step>
          </ol>
        </article>
      })}</div>}
    </section>
  })}</div>
}
