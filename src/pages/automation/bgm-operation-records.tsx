import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Image, Loader2 } from 'lucide-react'

import { ReleaseEpisodeCoverage } from '@/components/resources/release-episode-coverage'
import { ReleaseReviewBadges, ReleaseReviewDetails } from '@/components/resources/release-review'
import { Button } from '@/components/ui/button'
import { listOpenListTaskCenterLogs } from '@/lib/api/task-center'
import { useElapsedNow } from '@/lib/use-elapsed-time'
import { cn } from '@/lib/utils'
import type { BgmOperation, BgmOperationTask } from '@/types/bgm-wishlist'
import { BgmPoster } from './bgm-poster'
import { BgmCandidateDialog, type BgmCandidateActions } from './bgm-candidate-dialog'

const busyStates = ['QUEUED', 'RUNNING']
const taskStages = [
  { status: 'PENDING', label: '等待后台处理' },
  { status: 'SUBMITTED', label: '提交 OpenList', current: '正在提交到 OpenList' },
  { status: 'DOWNLOADING', label: '离线下载', current: '正在离线下载' },
  { status: 'ORGANIZING', label: '文件整理', current: '正在整理文件' },
  { status: 'SUCCEEDED', label: '处理完成' },
]
const taskActive = taskStages.slice(0, -1).map(({ status }) => status)
const taskOutcome: Record<string, string> = { FAILED: '入库失败', INTERRUPTED: '任务已中断', PARTIAL_SUCCESS: '部分完成' }
const labels: Record<string, string> = { QUEUED: '搜索资源', RUNNING: '处理中', WAITING: '需要处理', SUCCEEDED: '本轮处理结束', PARTIAL_SUCCESS: '部分成功', INTERRUPTED: '执行中断', SEARCHING: '搜索资源', CREATING: '创建入库任务', WAITING_RESOURCE: '待补充资源', WAITING_CONFIRMATION: '待确认', DEFERRED: '暂不处理', CREATED: '已创建', SKIPPED: '已跳过', FAILED: '处理失败', PENDING: '已创建', SUBMITTED: '已提交', DOWNLOADING: '下载中', ORGANIZING: '整理中', UNKNOWN: '状态待核实' }
const notices: Record<string, string> = { PENDING: '消息正在发送，结果待核实。', SENT: '已发送消息（企业微信已受理）。', FAILED: '消息发送失败，请在本站处理。', DISABLED: '企业微信通知未开启。' }

export function hasActiveBgmOperation(operation: BgmOperation) {
  return busyStates.includes(operation.status) || operation.entries.some((entry) => entry.task && taskActive.includes(entry.task.status))
}
function timestamp(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value))
}
function Notice({ value }: { value: string | null }) {
  return value ? <p className="mt-2 text-xs text-slate-500" role="status">{notices[value] ?? '消息发送结果待核实。'}</p> : null
}

function taskStatusLabel(task: BgmOperationTask) {
  const stage = taskStages.find(({ status }) => status === task.status)
  return stage?.current ?? stage?.label ?? taskOutcome[task.status] ?? '任务状态待核实'
}

function CurrentTaskActivity({ taskType, taskId, stage }: { taskType: string; taskId: string; stage: string }) {
  const [activity, setActivity] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function refreshActivity() {
      try {
        const { logs } = await listOpenListTaskCenterLogs(taskType, taskId, { limit: 1 }, controller.signal)
        if (!controller.signal.aborted) setActivity(logs[0]?.stage === stage ? logs[0].message : null)
      } catch {
        if (!controller.signal.aborted) setActivity(null)
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refreshActivity, 5000)
      }
    }
    void refreshActivity()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [taskType, taskId, stage])

  return activity ? <p className="mt-1 break-words text-xs text-slate-600">最新进展：{activity}</p> : null
}

function TaskProgress({ task }: { task: BgmOperationTask }) {
  const stageIndex = taskStages.findIndex(({ status }) => status === task.status)
  const active = stageIndex >= 0 && task.status !== 'SUCCEEDED'
  return <>
    <p className="text-sm font-semibold text-slate-950" role="status">{active ? '当前阶段：' : ''}{taskStatusLabel(task)}</p>
    {active && task.stage && <CurrentTaskActivity key={`${task.taskType}:${task.taskId}:${task.stage}`} taskType={task.taskType} taskId={task.taskId} stage={task.stage} />}
    {stageIndex >= 0 && <ol aria-label="入库任务进度" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {taskStages.map(({ status, label }, index) => {
        const completed = index < stageIndex || task.status === 'SUCCEEDED'
        const current = active && index === stageIndex
        return <li key={status} aria-current={current ? 'step' : undefined} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="h-3 w-3 text-slate-400" aria-hidden="true" />}
          <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1', current ? 'bg-slate-950 font-semibold text-white' : completed ? 'text-emerald-800' : 'text-slate-500')}>
            {completed && <><Check className="h-3 w-3" aria-hidden="true" /><span className="sr-only">已完成：</span></>}
            {!completed && !current && <span className="sr-only">待开始：</span>}
            {label}
          </span>
        </li>
      })}
    </ol>}
    {task.error && <p className="mt-2 break-words text-sm text-amber-700">{task.error}</p>}
    <Notice value={task.notification} />
    <Button asChild size="sm" className="mt-3" variant="outline"><Link to={`/tasks/${task.taskType.toLowerCase()}/${encodeURIComponent(task.taskId)}`}>{stageIndex < 0 ? '前往任务中心处理' : '查看任务'}</Link></Button>
  </>
}

function Step({ number, title, done, active, children }: { number: number; title: string; done?: boolean; active?: boolean; children?: React.ReactNode }) {
  return <li className="relative min-w-0 pl-9 pb-5 last:pb-0"><span className={`absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? 'bg-emerald-50 text-emerald-700' : active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-400'}`}>{done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : number}</span><h4 className={`mb-2 text-sm font-semibold ${active || done ? 'text-slate-950' : 'text-slate-400'}`}>{title}</h4>{children}</li>
}

export function BgmOperationRecords({ operations, focusedId, working, onConfirm, onSupply, onSearch, onDefer }: BgmCandidateActions & { operations: BgmOperation[]; focusedId: string | null; working: boolean; onSearch: (id: string, subjectId: number) => void; onDefer: (id: string, subjectId: number) => void }) {
  const [picker, setPicker] = useState<{ operationId: string; subjectId: number } | null>(null)
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const now = useElapsedNow(operations.some(hasActiveBgmOperation))
  const pickerOperation = operations.find((operation) => operation.id === picker?.operationId)
  const pickerEntry = pickerOperation?.entries.find((entry) => entry.item.subjectId === picker?.subjectId)
  if (!operations.length) return <p className="py-5 text-sm text-slate-500">暂无操作记录，点击作品上的入库按钮开始。</p>
  return <div className="space-y-4">{pickerOperation && pickerEntry && <BgmCandidateDialog key={`${pickerOperation.id}:${pickerEntry.item.subjectId}`} operation={pickerOperation} entry={pickerEntry} working={working || busyStates.includes(pickerOperation.status)} onConfirm={onConfirm} onSupply={onSupply} onClose={() => setPicker(null)} />}{operations.map((operation, index) => {
    const busy = busyStates.includes(operation.status)
    const singleTask = operation.action === 'SINGLE' ? operation.entries[0]?.task : null
    const expanded = closed[operation.id] === undefined ? index === 0 || operation.id === focusedId : !closed[operation.id]
    return <section key={operation.id} id={`operation-${operation.id}`} className="min-w-0 rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4"><div className="min-w-0"><h3 className="text-sm font-semibold text-slate-950">{operation.action === 'DAILY' ? '每日自动入库' : operation.action === 'LATEST' ? '最新优先入库' : operation.action === 'SINGLE' ? operation.entries[0]?.item.title || '单部入库' : `批量入库 · ${operation.entries.length} 部`}</h3><p className="mt-1 text-xs text-slate-500">{timestamp(operation.startedAt)} · {operation.triggerType === 'SCHEDULED' ? '定时自动化' : '手动触发'} · {operation.source.quality} · {singleTask ? taskStatusLabel(singleTask) : labels[operation.status] ?? operation.status}</p></div><Button size="sm" variant="outline" aria-expanded={expanded} onClick={() => setClosed((current) => ({ ...current, [operation.id]: expanded }))}>{expanded ? '收起' : '展开'}</Button></div>
      {expanded && <div className="space-y-5 border-t border-slate-100 p-4">{operation.reason && <p role="alert" className="text-sm text-amber-700">{operation.reason.message}</p>}{!operation.entries.length && <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />正在搜索资源，结果会保留在记录中。</p>}{operation.entries.map((entry) => {
        const selected = entry.selected ?? entry.candidates[0]
        const searching = entry.status === 'SEARCHING'
        const elapsed = Math.max(0, Math.floor(((busy ? now : Date.parse(operation.updatedAt)) - Date.parse(entry.startedAt)) / 1000))
        const task = entry.task
        return <article key={entry.item.subjectId} className="min-w-0"><div className="mb-4 flex gap-3"><div className="w-11 shrink-0">{entry.item.coverUrl ? <BgmPoster url={entry.item.coverUrl} title={entry.item.title} /> : <div className="flex aspect-[2/3] items-center justify-center rounded-lg bg-slate-50"><Image className="h-5 w-5 text-slate-300" aria-label="暂无封面" /></div>}</div><div className="min-w-0"><p className="break-words text-sm font-semibold">{entry.item.title}</p><p className="mt-1 text-xs text-slate-500">{entry.item.identity?.seasonNumber ? `第 ${entry.item.identity.seasonNumber} 季 · ` : ''}{task ? taskStatusLabel(task) : labels[entry.status] ?? entry.status}</p></div></div>
          <ol className="ml-1 border-l border-slate-100">
            <Step number={1} title="搜索资源" active={searching} done={!searching && entry.searches.length > 0 && entry.searches.every((query) => query.status === 'SUCCEEDED')}>
              <p className="text-xs text-slate-500">{searching ? `正在查询 · 已耗时 ${elapsed} 秒` : entry.searches.length ? `已完成 ${entry.searches.filter((query) => query.status === 'SUCCEEDED').length} / ${entry.searches.length} 组查询` : entry.status === 'SKIPPED' ? '未查询' : '尚未开始查询'}</p>
              {entry.searches.length > 0 && <ul className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">{entry.searches.map((query) => <li key={query.query} className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1 text-xs"><span className="min-w-0 break-all text-slate-700">{query.query}</span><span className="text-slate-500">{query.status === 'RUNNING' ? '查询中' : query.status === 'FAILED' ? '查询失败' : `${(query.elapsedMs / 1000).toFixed(1)} 秒 · ${query.resultCount ?? 0} 条`}</span></li>)}</ul>}
              {entry.status === 'WAITING_RESOURCE' && <><p className="mt-2 text-sm text-amber-700">{entry.reason?.message}</p><Notice value={entry.notification} /><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={working || busy} onClick={() => setPicker({ operationId: operation.id, subjectId: entry.item.subjectId })}>{entry.candidates.length ? `查看已有候选（${entry.candidates.length}）／补充来源` : '搜索并补充来源'}</Button><Button size="sm" variant="outline" disabled={working || busy} onClick={() => onSearch(operation.id, entry.item.subjectId)}>重新搜索</Button><Button size="sm" variant="ghost" disabled={working || busy} onClick={() => onDefer(operation.id, entry.item.subjectId)}>暂不处理</Button></div></>}
              {['FAILED', 'INTERRUPTED'].includes(entry.status) && !task && <div className="mt-2"><p className="text-sm text-amber-700">{entry.reason?.message}</p><Button className="mt-2" size="sm" variant="outline" disabled={working || busy} onClick={() => onSearch(operation.id, entry.item.subjectId)}>重新搜索</Button></div>}
            </Step>
            <Step number={2} title="选择发布" active={entry.status === 'WAITING_CONFIRMATION' || entry.status === 'CREATING'} done={!!entry.selected}>
              {selected ? <div className="space-y-2"><p className="break-words text-sm text-slate-800">{selected.release.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <ReleaseReviewBadges release={selected.release} seasonNumber={entry.item.identity?.seasonNumber} />
                  <ReleaseEpisodeCoverage release={selected.release} tmdbId={entry.item.identity?.tmdbId} seasonNumber={entry.item.identity?.mediaType === 'SERIES' ? entry.item.identity.seasonNumber : null} />
                  {entry.selected && selected.release.resolution_tags.some((quality) => parseInt(quality) > parseInt(operation.source.quality)) &&
                    <span className="text-xs text-slate-600">已升至{selected.release.resolution_tags.includes('2160p') ? '4K' : '1080p'}</span>}
                </div>
                <ReleaseReviewDetails release={selected.release} seasonNumber={entry.item.identity?.seasonNumber}>{entry.status === 'WAITING_CONFIRMATION' && entry.reason && <p>待确认原因：{entry.reason.message}</p>}</ReleaseReviewDetails></div> : <p className="text-xs text-slate-400">尚未选择发布。</p>}
              {entry.status === 'WAITING_CONFIRMATION' && <>{!selected && entry.reason && <p className="mt-2 text-sm text-amber-700">{entry.reason.message}</p>}<Notice value={entry.notification} /><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={working || busy} onClick={() => setPicker({ operationId: operation.id, subjectId: entry.item.subjectId })}>查看候选并选择（{entry.candidates.length}）</Button><Button size="sm" variant="outline" disabled={working || busy} onClick={() => onDefer(operation.id, entry.item.subjectId)}>暂不处理</Button></div></>}
              {entry.status === 'DEFERRED' && <><p className="mt-2 text-xs text-slate-500">已暂不处理。</p><Button className="mt-2" size="sm" variant="outline" disabled={working || busy} onClick={() => onSearch(operation.id, entry.item.subjectId)}>重新搜索</Button></>}
              {entry.status === 'SKIPPED' && entry.reason && <p className="mt-2 text-sm text-amber-700">{entry.reason?.message}</p>}
            </Step>
            <Step number={3} title="入库任务" active={!!task && taskActive.includes(task.status) || entry.status === 'CREATING'} done={task?.status === 'SUCCEEDED'}>
              {task ? <TaskProgress task={task} /> : <p className="text-xs text-slate-400">{entry.status === 'CREATING' ? '正在创建后台任务…' : '尚未创建入库任务，本次检查不消耗创建额度。'}</p>}
            </Step>
          </ol>
        </article>
      })}</div>}
    </section>
  })}</div>
}
