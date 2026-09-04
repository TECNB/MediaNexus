import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  getQuarkTaskCenterDetail,
  retryQuarkTaskCenter,
  updateQuarkTaskSubscription,
} from '@/lib/api/task-center'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type {
  QuarkTaskCenterChild,
  QuarkTaskCenterDetail,
} from '@/types/quark-task-center'

const POLL_INTERVAL_MS = 5000

const statusCopy: Record<string, string> = {
  IN_PROGRESS: '进行中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
  PARTIAL_SUCCESS: '部分完成',
  UNKNOWN: '状态未知',
  INTERRUPTED: '已中断',
  PENDING: '等待中',
  PROCESSING: '处理中',
  SUBMITTED: '已提交处理',
}

const stageCopy: Record<string, string> = {
  created: '任务创建',
  queued: '排队中',
  processing: '处理中',
  submitted: '已提交处理',
  completed: '完成收束',
  failed: '失败收束',
}

function formatTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN')
}

function statusTone(status: string) {
  if (status === 'SUCCEEDED') return 'bg-emerald-50 text-emerald-700'
  if (['FAILED', 'PARTIAL_SUCCESS', 'UNKNOWN', 'INTERRUPTED'].includes(status)) return 'bg-rose-50 text-rose-700'
  return 'bg-sky-50 text-sky-700'
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-100 px-4 py-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function ChildCard({
  taskId,
  child,
  onRetry,
  onSubscription,
}: {
  taskId: string
  child: QuarkTaskCenterChild
  onRetry: (childId: string) => void
  onSubscription: (child: QuarkTaskCenterChild) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const canRetry = ['FAILED', 'PARTIAL', 'UNKNOWN', 'INTERRUPTED'].includes(child.status)
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-950">{child.task_name}</span>
            <span className="mt-1 block truncate text-xs text-slate-500">{child.save_path}{child.version_label ? ` · ${child.version_label}` : ''}</span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn('rounded-full px-3 py-1 font-semibold', statusTone(child.status))}>{statusCopy[child.status] ?? child.status}</span>
          <span className="text-slate-500">文件 {child.processed_file_count}/{child.planned_file_count}</span>
          <label className="inline-flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={child.subscription_enabled} onChange={() => onSubscription(child)} />
            自动更新
          </label>
          {canRetry ? <Button type="button" size="sm" variant="outline" onClick={() => onRetry(child.id)}><RotateCcw className="h-3.5 w-3.5" />重试</Button> : null}
        </div>
      </div>
      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            <p>已命名：{child.renamed_file_count}</p>
            <p>已忽略：{child.ignored_file_count}</p>
            <p>失败/未知：{child.failed_file_count}/{child.unknown_file_count}</p>
          </div>
          {child.failure_reason ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{child.failure_reason}</p> : null}
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">来源文件</th><th className="px-3 py-2">目标名称</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">说明</th></tr></thead>
              <tbody>
                {child.files.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">暂未记录文件级明细</td></tr> : child.files.map((file) => <tr key={file.id} className="border-t border-slate-100"><td className="max-w-[240px] truncate px-3 py-2 text-slate-700">{file.source_name ?? '-'}</td><td className="max-w-[280px] truncate px-3 py-2 text-slate-700">{file.target_name ?? '-'}</td><td className="px-3 py-2 text-slate-600">{file.status}</td><td className="max-w-[200px] truncate px-3 py-2 text-rose-600">{file.failure_reason ?? '-'}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="break-all text-xs text-slate-400">来源：{child.source_url}</p>
          <p className="text-xs text-slate-400">最近更新：{formatTime(child.updated_at)}</p>
        </div>
      ) : null}
      <span className="sr-only">{taskId}</span>
    </article>
  )
}

export function QuarkTaskCenterDetailPage() {
  const { taskId } = useParams()
  const [detail, setDetail] = useState<QuarkTaskCenterDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busyChildId, setBusyChildId] = useState<string | null>(null)

  const loadDetail = useCallback(async (silent = false) => {
    if (!taskId) {
      setStatus('error')
      setMessage('任务地址无效。')
      return
    }
    if (!silent) setStatus('loading')
    try {
      const nextDetail = await getQuarkTaskCenterDetail(taskId, undefined, 100)
      setDetail(nextDetail)
      setStatus('success')
      setMessage(null)
    } catch (error) {
      if (isJavaRequestCanceledError(error)) return
      setStatus('error')
      setMessage(error instanceof Error && error.message.trim() ? error.message : 'Quark 任务详情加载失败，请稍后重试。')
    }
  }, [taskId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!detail?.is_active) return
    const timer = window.setTimeout(() => void loadDetail(true), POLL_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [detail, loadDetail])

  const retry = useCallback(async (childIds: string[] = []) => {
    if (!taskId) return
    setActionMessage(null)
    try {
      const result = await retryQuarkTaskCenter(taskId, childIds)
      setActionMessage(result.message)
      await loadDetail(true)
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '重试提交失败，请稍后重试。')
    }
  }, [loadDetail, taskId])

  const toggleSubscription = useCallback(async (child: QuarkTaskCenterChild) => {
    if (!taskId) return
    setBusyChildId(child.id)
    setActionMessage(null)
    try {
      const result = await updateQuarkTaskSubscription(taskId, child.id, !child.subscription_enabled)
      setActionMessage(result.message)
      await loadDetail(true)
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '自动更新设置失败，请稍后重试。')
    } finally {
      setBusyChildId(null)
    }
  }, [loadDetail, taskId])

  const copyShareUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setActionMessage('分享链接已复制。')
    } catch {
      setActionMessage('当前浏览器不支持自动复制，请手动选择链接。')
    }
  }, [])

  if (status === 'loading' && !detail) {
    return <PageContainer title="Quark 入库任务" description="正在加载任务详情…"><div className="flex items-center gap-2 rounded-2xl bg-white p-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />加载中…</div></PageContainer>
  }
  if (!detail) {
    return <PageContainer title="Quark 入库任务" description="无法读取任务详情。"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700"><AlertTriangle className="mb-2 h-5 w-5" />{message ?? '任务详情加载失败。'}</div></PageContainer>
  }

  const progress = detail.progress
  const canRetryAll = detail.children.some((child) => ['FAILED', 'PARTIAL', 'UNKNOWN', 'INTERRUPTED'].includes(child.status))
  return (
    <PageContainer title={detail.title} description="查看本次 Quark 入库的季度/版本处理进度、文件明细和运行日志。">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline"><Link to="/tasks"><ArrowLeft className="h-4 w-4" />返回任务中心</Link></Button>
        <div className="flex items-center gap-2">
          {canRetryAll ? <Button type="button" variant="outline" onClick={() => void retry()}><RotateCcw className="h-4 w-4" />重试未完成项</Button> : null}
          <Button type="button" variant="outline" onClick={() => void loadDetail()}><RefreshCw className="h-4 w-4" />刷新</Button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-shell">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', statusTone(detail.status))}>{statusCopy[detail.status] ?? detail.status}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{stageCopy[detail.stage] ?? detail.stage}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{detail.subscription_enabled ? '自动更新' : '一次性入库'}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="季度/版本" value={`${progress.completed_units}/${progress.planned_units}`} />
          <Stat label="文件总数" value={progress.total_files} />
          <Stat label="已处理" value={progress.processed_files} />
          <Stat label="失败/未知" value={`${progress.failed_files}/${progress.unknown_files}`} />
        </div>
        <p className="mt-4 text-sm text-slate-600">{detail.progress_summary}</p>
        {detail.error_message ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{detail.error_message}</p> : null}
        {detail.share_urls.length > 0 ? <div className="mt-4 space-y-2"><p className="text-xs font-semibold text-slate-500">分享链接</p>{detail.share_urls.map((url) => <div key={url} className="flex items-center gap-2"><input readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" /><Button type="button" size="sm" variant="outline" onClick={() => void copyShareUrl(url)}><Clipboard className="h-3.5 w-3.5" />复制</Button></div>)}</div> : null}
      </section>

      {actionMessage ? <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700">{actionMessage}</div> : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><CheckCircle2 className="h-4 w-4" />季度/版本执行单元</div>
        {detail.children.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">历史任务没有可展示的季度/版本明细。</div> : detail.children.map((child) => <div key={child.id} className={busyChildId === child.id ? 'opacity-60' : ''}><ChildCard taskId={detail.id} child={child} onRetry={(childId) => void retry([childId])} onSubscription={(currentChild) => void toggleSubscription(currentChild)} /></div>)}
      </section>

      <section className="rounded-2xl bg-slate-950 p-5 text-slate-100">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">运行日志</h2><span className="text-xs text-slate-400">{detail.logs.length} 条</span></div>
        <div className="mt-4 max-h-[420px] space-y-2 overflow-auto font-mono text-xs">
          {detail.logs.length === 0 ? <p className="text-slate-500">暂无日志。</p> : detail.logs.map((log) => <div key={log.id} className="border-b border-slate-800 pb-2"><div className="flex flex-wrap gap-2 text-slate-400"><span>{formatTime(log.created_at)}</span><span>{log.stage}</span><span className={log.level === 'ERROR' ? 'text-rose-300' : log.level === 'WARN' ? 'text-amber-300' : 'text-emerald-300'}>{log.level}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-slate-200">{log.message}{log.detail ? `：${log.detail}` : ''}</p></div>)}
        </div>
      </section>
    </PageContainer>
  )
}
