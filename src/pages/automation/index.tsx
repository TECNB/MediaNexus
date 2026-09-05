import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react'

import { OperationalLogPanel } from '@/components/operation-log/operational-log-panel'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { getJavaErrorMessage, isJavaRequestCanceledError } from '@/lib/java-api'
import {
  getJavdbAutomationOverview,
  getJavdbAutomationRun,
  listJavdbAutomationRuns,
  startJavdbDryRun,
  startJavdbExecution,
  updateJavdbAutomationConfig,
  updateJavdbCookie,
} from '@/lib/api/javdb-automation'
import { cn } from '@/lib/utils'
import type {
  JavdbAutomationConfig,
  JavdbAutomationOverview,
  JavdbAutomationRun,
  JavdbAutomationRunItem,
  UpdateJavdbAutomationConfigPayload,
} from '@/types/javdb-automation'

type PageStatus = 'loading' | 'success' | 'error'
type ActionStatus = 'idle' | 'working' | 'success' | 'error'

const HISTORY_PAGE_SIZE = 20

const statusCopy: Record<string, string> = {
  RUNNING: '运行中',
  SUCCEEDED: '成功',
  PARTIAL_SUCCESS: '部分成功',
  FAILED: '失败',
  INTERRUPTED: '已中断',
  SKIPPED: '已跳过',
}

const stageCopy: Record<string, string> = {
  CREATED: '已创建',
  FETCHING_RANKINGS: '抓取榜单',
  CHECKING_EMBY: '检查 Emby',
  FETCHING_DETAILS: '抓取详情',
  SUBMITTING_ADULT_TASKS: '创建 Adult 任务',
  SUCCEEDED: '已完成',
  PARTIAL_SUCCESS: '部分完成',
  FAILED: '失败',
  INTERRUPTED: '已中断',
  SKIPPED: '已跳过',
}

const itemStatusCopy: Record<string, string> = {
  ALREADY_IN_EMBY: '已在 Emby',
  HISTORY_SUBMITTED: '历史已提交',
  ADULT_IN_PROGRESS: 'Adult 处理中',
  READY_TO_SUBMIT: '待提交',
  SUBMITTED: '已提交',
  NO_MAGNET: '无磁力',
  DETAIL_FAILED: '详情失败',
  SUBMIT_FAILED: '提交失败',
}

const periodCopy: Record<string, string> = {
  daily: '日榜',
  weekly: '周榜',
  monthly: '月榜',
}

const reasonCopy: Record<string, string> = {
  NEW: '本次新增',
  CROSS_RANK_DUPLICATE: '跨榜重复已合并',
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function statusTone(status: string) {
  if (status === 'SUCCEEDED' || status === 'SUBMITTED') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }
  if (
    status === 'FAILED' ||
    status === 'INTERRUPTED' ||
    status === 'PARTIAL_SUCCESS' ||
    status === 'DETAIL_FAILED' ||
    status === 'SUBMIT_FAILED'
  ) {
    return 'bg-rose-50 text-rose-700 ring-rose-200'
  }
  if (status === 'RUNNING' || status === 'READY_TO_SUBMIT') {
    return 'bg-sky-50 text-sky-700 ring-sky-200'
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

function getConfigForm(config: JavdbAutomationConfig): UpdateJavdbAutomationConfigPayload {
  return {
    enabled: config.enabled,
    daily_enabled: config.daily_enabled,
    weekly_enabled: config.weekly_enabled,
    monthly_enabled: config.monthly_enabled,
    cracked_only: config.cracked_only,
    subtitle_only: config.subtitle_only,
    limit_per_ranking: config.limit_per_ranking,
    schedule_time: config.schedule_time,
  }
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="whitespace-nowrap text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function RunBadge({ status }: { status: string }) {
  return (
    <span className={cn('rounded-md px-2 py-1 text-xs font-semibold ring-1', statusTone(status))}>
      {statusCopy[status] ?? status}
    </span>
  )
}

function ItemStatus({ item }: { item: JavdbAutomationRunItem }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn('rounded-md px-2 py-1 text-xs font-semibold ring-1', statusTone(item.status))}>
        {itemStatusCopy[item.status] ?? item.status}
      </span>
      {item.reason === 'CROSS_RANK_DUPLICATE' ? (
        <span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
          跨榜重复已合并
        </span>
      ) : null}
    </div>
  )
}

function RunSummary({ run }: { run: JavdbAutomationRun }) {
  const checked = run.unique_movies
  const skipped = run.already_in_emby + run.history_duplicates + run.active_duplicates
  const ready = Math.max(0, checked - skipped)

  return (
    <div className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {run.execution_mode === 'DRY_RUN' ? '试运行' : '正式运行'}
            </p>
            <RunBadge status={run.status} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {run.trigger_type === 'SCHEDULED' ? '定时触发' : '管理员手动触发'} ·{' '}
            {formatDateTime(run.started_at)}
          </p>
          {run.stage ? (
            <p className="mt-1 text-xs text-slate-400">
              当前阶段：{stageCopy[run.stage] ?? run.stage}
            </p>
          ) : null}
        </div>
        {run.status === 'RUNNING' ? <Loader2 className="h-5 w-5 animate-spin text-sky-500" /> : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryStat label="榜单条目 → 唯一影片" value={checked} />
        <SummaryStat label="唯一影片 → 待处理" value={ready} />
        <SummaryStat label="待处理 → 已提交影片" value={run.submitted_count} />
      </div>
      <p className="mt-2 text-xs text-slate-400">跨榜去重 {run.duplicate_entries_removed} · 已跳过 {skipped}</p>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <span>榜单条目：{run.ranking_entries}</span>
        <span>Emby 已有：{run.already_in_emby}</span>
        <span>历史已提交：{run.history_duplicates}</span>
        <span>Adult 处理中：{run.active_duplicates}</span>
        <span>Adult 任务：{run.adult_task_count}</span>
        <span>结束：{formatDateTime(run.finished_at)}</span>
      </div>
      {run.error_message ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{run.error_message}</span>
        </div>
      ) : null}
    </div>
  )
}

function RunItemCard({ item }: { item: JavdbAutomationRunItem }) {
  const selected = item.candidates.find((candidate) => candidate.infohash === item.selected_infohash)
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
              {item.code}
            </span>
            <ItemStatus item={item} />
            {selected?.is_cracked ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">破解</span> : null}
            {selected?.has_subtitle ? <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">中文字幕</span> : null}
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">{item.title || '未命名影片'}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {item.appearances.map((appearance) => (
              <span key={`${appearance.period}-${appearance.rank}`} className="rounded-md bg-slate-50 px-2 py-1">
                {periodCopy[appearance.period] ?? appearance.period} #{appearance.rank}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.detail_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={item.detail_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                JAVDB 详情
              </a>
            </Button>
          ) : null}
          {item.adult_task_id ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`/tasks/adult/${encodeURIComponent(item.adult_task_id)}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                查看 Adult 任务
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {item.reason ? <p className="mt-3 text-xs text-slate-500">查重结果：{reasonCopy[item.reason] ?? item.reason}</p> : null}
      {item.error_message ? <p className="mt-2 text-xs text-rose-600">{item.error_message}</p> : null}
      {item.selected_reason ? <p className="mt-2 text-xs text-slate-500">选择原因：{item.selected_reason}</p> : null}

      {item.candidates.length > 0 ? (
        <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">
            查看磁力候选（{item.candidates.length}）
          </summary>
          <div className="mt-3 space-y-2">
            {item.candidates.map((candidate, index) => (
              <div key={`${candidate.infohash ?? candidate.magnet}-${index}`} className="rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-700">候选 {index + 1}</span>
                  {candidate.is_cracked ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">破解</span> : null}
                  {candidate.has_subtitle ? <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">中文字幕</span> : null}
                  {item.selected_infohash === candidate.infohash ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">已选择</span> : null}
                </div>
                {candidate.original_name ? <p className="mt-2 break-all font-mono text-slate-500">{candidate.original_name}</p> : null}
                <a href={candidate.magnet} className="mt-1 block break-all font-mono text-[11px] text-slate-400 hover:text-slate-700">
                  {candidate.magnet}
                </a>
                {candidate.infohash ? <p className="mt-1 break-all text-slate-400">Infohash：{candidate.infohash}</p> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  )
}

function RunDetails({ run }: { run: JavdbAutomationRun }) {
  const [itemFilter, setItemFilter] = useState('ALL')
  const filteredItems = useMemo(
    () => run.items.filter((item) => itemFilter === 'ALL' || item.status === itemFilter),
    [itemFilter, run.items],
  )

  const filterOptions = useMemo(() => {
    const statuses = Array.from(new Set(run.items.map((item) => item.status)))
    return ['ALL', ...statuses]
  }, [run.items])

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="space-y-5">
        <RunSummary run={run} />
        <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">结果明细</p>
            <p className="mt-1 text-sm text-slate-500">按日榜、周榜、月榜顺序排列；同榜按 JAVDB 返回排名，跨榜重复保留首次出现位置。</p>
          </div>
          <select
            aria-label="结果明细筛选"
            value={itemFilter}
            onChange={(event) => setItemFilter(event.currentTarget.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/70"
          >
            {filterOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? '全部结果' : itemStatusCopy[status] ?? status}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => <RunItemCard key={item.code} item={item} />)
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">暂无符合条件的结果。</p>
          )}
        </div>
        </section>
      </div>

      <div className="xl:sticky xl:top-5">
        <OperationalLogPanel
          logs={run.logs}
          status={run.logs.length > 0 ? 'success' : 'empty'}
          hasSelection
          title="操作日志"
          monitorLabel="JAVDB 自动化"
          emptyLogsMessage="暂无自动化日志"
          stageLabels={stageCopy}
          terminalStages={new Set(['SUCCEEDED', 'PARTIAL_SUCCESS', 'FAILED', 'INTERRUPTED', 'SKIPPED'])}
        />
      </div>
    </div>
  )
}

export function AutomationPage() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState<JavdbAutomationOverview | null>(null)
  const [selectedRun, setSelectedRun] = useState<JavdbAutomationRun | null>(null)
  const [history, setHistory] = useState<{ items: JavdbAutomationRun[]; total: number; page: number; page_size: number } | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading')
  const [pageError, setPageError] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [cookieValue, setCookieValue] = useState('')
  const [configForm, setConfigForm] = useState<UpdateJavdbAutomationConfigPayload | null>(null)

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await getJavdbAutomationOverview(signal)
      setOverview(data)
      setConfigForm((current) => current ?? getConfigForm(data.config))
      setPageStatus('success')
      setPageError(null)
    } catch (error) {
      if (isJavaRequestCanceledError(error)) {
        return
      }
      setPageStatus('error')
      setPageError(getJavaErrorMessage(error) ?? (error instanceof Error ? error.message : '自动化总览加载失败'))
    }
  }, [])

  const loadHistory = useCallback(async (page: number) => {
    try {
      const data = await listJavdbAutomationRuns(page, HISTORY_PAGE_SIZE)
      setHistory(data)
    } catch (error) {
      setActionMessage(getJavaErrorMessage(error) ?? (error instanceof Error ? error.message : '运行历史加载失败'))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadOverview(controller.signal)
    return () => controller.abort()
  }, [loadOverview])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadOverview()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [loadOverview])

  useEffect(() => {
    void loadHistory(historyPage)
  }, [historyPage, loadHistory])

  useEffect(() => {
    if (overview?.current_run && selectedRun?.id !== overview.current_run.id) {
      void getJavdbAutomationRun(overview.current_run.id)
        .then(setSelectedRun)
        .catch(() => setSelectedRun(overview.current_run))
    }
  }, [overview, selectedRun])

  const refreshSelectedRun = useCallback(async (runId: string) => {
    try {
      setSelectedRun(await getJavdbAutomationRun(runId))
    } catch (error) {
      setActionMessage(getJavaErrorMessage(error) ?? (error instanceof Error ? error.message : '运行详情加载失败'))
    }
  }, [])

  const waitForAdultTaskAndNavigate = useCallback(async (runId: string) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const run = await getJavdbAutomationRun(runId)
        setSelectedRun(run)
        const taskId = run.items.find((item) => item.adult_task_id)?.adult_task_id
        if (taskId) {
          navigate(`/tasks/adult/${encodeURIComponent(taskId)}`)
          return
        }
        if (run.status !== 'RUNNING') {
          return
        }
      } catch {
        return
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
    }
  }, [navigate])

  useEffect(() => {
    if (!selectedRun) {
      return
    }
    if (selectedRun.status === 'RUNNING') {
      const timer = window.setInterval(() => {
        void refreshSelectedRun(selectedRun.id)
      }, 5000)
      return () => window.clearInterval(timer)
    }
    void loadHistory(1)
  }, [loadHistory, refreshSelectedRun, selectedRun?.id, selectedRun?.status])

  async function handleSaveConfig() {
    if (!configForm) {
      return
    }
    setActionStatus('working')
    setActionMessage(null)
    try {
      const config = await updateJavdbAutomationConfig(configForm)
      setConfigForm(getConfigForm(config))
      setOverview((current) => (current ? { ...current, config } : current))
      setActionStatus('success')
      setActionMessage('自动化配置已保存。')
    } catch (error) {
      setActionStatus('error')
      setActionMessage(getJavaErrorMessage(error) ?? (error instanceof Error ? error.message : '配置保存失败'))
    }
  }

  async function handleCookieUpdate() {
    if (!cookieValue.trim()) {
      setActionStatus('error')
      setActionMessage('请输入 JAVDB Cookie。')
      return
    }
    setActionStatus('working')
    setActionMessage(null)
    try {
      const credential = await updateJavdbCookie(cookieValue.trim())
      setCookieValue('')
      setOverview((current) =>
        current
          ? {
              ...current,
              config: {
                ...current.config,
                credential_configured: credential.credential_configured,
                credential_valid: credential.credential_valid,
                last_validated_at: credential.last_validated_at,
              },
            }
          : current,
      )
      setActionStatus(credential.credential_valid ? 'success' : 'error')
      setActionMessage(credential.credential_valid ? 'Cookie 验证成功。' : 'Cookie 验证失败，请更新后重试。')
    } catch (error) {
      setActionStatus('error')
      setActionMessage(getJavaErrorMessage(error) ?? (error instanceof Error ? error.message : 'Cookie 更新失败'))
    }
  }

  async function handleRun(mode: 'DRY_RUN' | 'EXECUTE') {
    if (mode === 'EXECUTE' && !window.confirm('立即运行会重新抓取榜单并创建 Adult-JAV 任务，确认继续吗？')) {
      return
    }
    setActionStatus('working')
    setActionMessage(null)
    try {
      if (!configForm) {
        return
      }
      const run = mode === 'DRY_RUN'
        ? await startJavdbDryRun(configForm)
        : await startJavdbExecution(configForm)
      setSelectedRun(run)
      setActionStatus('success')
      setActionMessage(mode === 'DRY_RUN' ? '试运行已启动，历史记录会保留。' : '立即运行已启动，Adult 任务将在任务中心继续处理。')
      setHistoryPage(1)
      await Promise.all([loadOverview(), loadHistory(1), refreshSelectedRun(run.id)])
      if (mode === 'EXECUTE') {
        setActionMessage('立即运行已启动，创建 Adult 任务后将自动跳转到任务日志。')
        void waitForAdultTaskAndNavigate(run.id)
      }
    } catch (error) {
      setActionStatus('error')
      setActionMessage(getJavaErrorMessage(error) ?? (error instanceof Error ? error.message : '运行请求失败'))
    }
  }

  const config = overview?.config
  const currentRun = overview?.current_run
  const historyMaxPage = history ? Math.max(1, Math.ceil(history.total / history.page_size)) : 1
  const canRun = actionStatus !== 'working' && !currentRun

  return (
    <PageContainer
      title="自动化"
      description="管理员控制 JAVDB 有码日榜、周榜和月榜同步；抓取结果会进入审计历史，Adult 下载、整理和入库仍在任务中心完成。"
    >
      <div className="space-y-6">
        <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className={cn('rounded-2xl p-3', config?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                {config?.enabled ? <CheckCircle2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950">JAVDB 自动化</h2>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', config?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                    {config?.enabled ? '已启用' : '已关闭'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  下次运行：每日 {config?.schedule_time ?? '--:--'}（{config?.timezone ?? 'Asia/Shanghai'}）
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  最近运行：{overview?.latest_run ? formatDateTime(overview.latest_run.started_at) : '暂无'}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadOverview()} disabled={pageStatus === 'loading'}>
              <RefreshCw className={cn('h-4 w-4', pageStatus === 'loading' ? 'animate-spin' : null)} />
              刷新状态
            </Button>
          </div>
        </section>

        {pageError ? (
          <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pageError}</span>
          </div>
        ) : null}

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">JAVDB</p>
                <p className="mt-1 text-sm text-slate-500">仅支持有码日榜、周榜和月榜。</p>
              </div>
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', config?.credential_valid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                {config?.credential_valid ? 'Cookie 已验证' : config?.credential_configured ? 'Cookie 待验证' : '未配置 Cookie'}
              </span>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-slate-500">Cookie</span>
                <span className="font-medium text-slate-800">{config?.credential_configured ? '已配置（原值不可读取）' : '未配置'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-slate-500">最近验证</span>
                <span className="text-right font-medium text-slate-800">{formatDateTime(config?.last_validated_at ?? null)}</span>
              </div>
              <p className="text-xs text-slate-400">更新 Cookie 后会立即验证日榜访问。</p>
              <label className="block text-sm font-medium text-slate-700" htmlFor="javdb-cookie">
                覆盖 Cookie
              </label>
              <textarea
                id="javdb-cookie"
                value={cookieValue}
                onChange={(event) => setCookieValue(event.currentTarget.value)}
                autoComplete="off"
                rows={3}
                placeholder="粘贴新的 JAVDB Cookie"
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/70"
              />
              <Button type="button" variant="outline" onClick={() => void handleCookieUpdate()} disabled={actionStatus === 'working'}>
                {actionStatus === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                更新并验证
              </Button>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">配置</p>
              <p className="mt-1 text-sm text-slate-500">每日执行一次，错过停机时间不会补跑。</p>
            </div>
            {configForm ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ['daily_enabled', '有码日榜'],
                    ['weekly_enabled', '有码周榜'],
                    ['monthly_enabled', '有码月榜'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={configForm[key]}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked
                          setConfigForm((current) => current ? { ...current, [key]: checked } : current)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ['cracked_only', '只保留破解版本'],
                    ['subtitle_only', '只保留字幕版本'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={configForm[key]}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked
                          setConfigForm((current) => current ? { ...current, [key]: checked } : current)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>每榜数量（1-50）</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={configForm.limit_per_ranking}
                      onChange={(event) => {
                        const value = Number(event.currentTarget.value)
                        setConfigForm((current) => current ? { ...current, limit_per_ranking: value } : current)
                      }}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/70"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>每日执行时间（Asia/Shanghai）</span>
                    <input
                      type="time"
                      value={configForm.schedule_time}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setConfigForm((current) => current ? { ...current, schedule_time: value } : current)
                      }}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/70"
                    />
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={configForm.enabled}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked
                      setConfigForm((current) => current ? { ...current, enabled: checked } : current)
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  启用每日自动运行
                </label>
                <Button type="button" onClick={() => void handleSaveConfig()} disabled={actionStatus === 'working'}>
                  {actionStatus === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存配置
                </Button>
              </div>
            ) : (
              <div className="mt-5 h-40 animate-pulse rounded-xl bg-slate-100" />
            )}
          </section>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">运行控制</p>
              <p className="mt-1 text-sm text-slate-500">试运行会写入历史但不会创建 Adult 任务；立即运行会重新抓取并查重。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handleRun('DRY_RUN')} disabled={!canRun}>
                {currentRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                试运行
              </Button>
              <Button type="button" onClick={() => void handleRun('EXECUTE')} disabled={!canRun}>
                {currentRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                立即运行
              </Button>
            </div>
          </div>
          {actionMessage ? (
            <p className={cn('mt-4 rounded-xl px-3 py-2 text-sm', actionStatus === 'error' ? 'bg-rose-50 text-rose-700' : actionStatus === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600')}>
              {actionMessage}
            </p>
          ) : null}
        </section>

        {selectedRun ? (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">运行详情</p>
            </div>
            <RunDetails run={selectedRun} />
          </section>
        ) : null}

        <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">最近同步历史</p>
              <p className="mt-1 text-sm text-slate-500">运行日志、明细、候选和查重记录长期保留。</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="h-4 w-4" />
              {history?.total ?? 0} 次运行
            </div>
          </div>
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {history?.items.length ? history.items.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => void refreshSelectedRun(run.id)}
                className={cn('flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between', selectedRun?.id === run.id ? 'bg-slate-50' : null)}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <RunBadge status={run.status} />
                  <span className="text-sm font-medium text-slate-800">{run.execution_mode === 'DRY_RUN' ? '试运行' : '正式运行'}</span>
                  <span className="text-xs text-slate-400">{run.trigger_type === 'SCHEDULED' ? '定时' : '手动'}</span>
                </span>
                <span className="text-xs text-slate-500">{formatDateTime(run.started_at)} · 新增 {run.submitted_count}</span>
              </button>
            )) : (
              <p className="px-4 py-8 text-center text-sm text-slate-500">暂无运行记录。</p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>第 {history?.page ?? historyPage} / {historyMaxPage} 页</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}>
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={historyPage >= historyMaxPage} onClick={() => setHistoryPage((page) => Math.min(historyMaxPage, page + 1))}>
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  )
}
