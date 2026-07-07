import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  CloudUpload,
  GitBranch,
  Loader2,
  RotateCcw,
  Send,
  TerminalSquare,
} from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  getOpenListTaskCenterDetail,
  listOpenListTaskCenterLogs,
  replaceOpenListManualMagnet,
  retryOpenListAdultBatch,
  reuseOriginalOpenListManualMagnet,
} from '@/lib/api/task-center'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type { MagnetIngestTaskStatus } from '@/types/magnet-ingest'
import type {
  OpenListTaskCenterAttempt,
  OpenListTaskCenterDetail,
  OpenListTaskCenterLog,
  OpenListTaskCenterProductType,
} from '@/types/task-center'

type PageStatus = 'loading' | 'success' | 'error'

type PageState = {
  status: PageStatus
  detail: OpenListTaskCenterDetail | null
  message: string | null
}

type RetrySubmitAction = 'reuse' | 'replace'

const DETAIL_POLL_INTERVAL_MS = 2000
const LOG_PAGE_SIZE = 100
const supportedTaskTypes = new Set(['movie', 'series', 'anime', 'adult'])

const terminalStatuses = new Set<MagnetIngestTaskStatus>([
  'SUCCEEDED',
  'PARTIAL_SUCCESS',
  'FAILED',
  'INTERRUPTED',
])

const recoverableStatuses = new Set<MagnetIngestTaskStatus>([
  'FAILED',
  'INTERRUPTED',
  'PARTIAL_SUCCESS',
])

const taskStatusCopy: Record<MagnetIngestTaskStatus, string> = {
  PENDING: '等待中',
  SUBMITTED: '已提交',
  DOWNLOADING: '下载中',
  ORGANIZING: '整理中',
  SUCCEEDED: '已完成',
  PARTIAL_SUCCESS: '部分完成',
  FAILED: '失败',
  INTERRUPTED: '已中断',
}

const productTypeCopy: Record<OpenListTaskCenterProductType, string> = {
  MOVIE: '电影入库',
  SERIES: '剧集入库',
  ANIME: '动漫整季入库',
  ADULT: 'Adult 批量入库',
}

const stageOrder = ['created', 'submitted', 'downloading', 'organizing', 'done']

const stageCopy = [
  { key: 'created', label: '任务创建' },
  { key: 'submitted', label: '提交 OpenList' },
  { key: 'downloading', label: '离线下载' },
  { key: 'organizing', label: '文件整理' },
  { key: 'done', label: '完成收束' },
]

function normalizeTaskType(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized && supportedTaskTypes.has(normalized) ? normalized : null
}

function isTerminalStatus(status: MagnetIngestTaskStatus) {
  return terminalStatuses.has(status)
}

function formatTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function taskIdentity(detail: OpenListTaskCenterDetail) {
  return `${detail.task_type}:${detail.id}`
}

function isSameTask(
  current: OpenListTaskCenterDetail | null,
  incoming: OpenListTaskCenterDetail,
) {
  return current !== null && taskIdentity(current) === taskIdentity(incoming)
}

function firstLogId(logs: OpenListTaskCenterLog[]) {
  return logs.length > 0 ? logs[0].id : null
}

function lastLogId(logs: OpenListTaskCenterLog[]) {
  return logs.length > 0 ? logs[logs.length - 1].id : null
}

function mergeLogs(
  current: OpenListTaskCenterLog[],
  incoming: OpenListTaskCenterLog[],
) {
  const byId = new Map<number, OpenListTaskCenterLog>()
  for (const log of current) {
    byId.set(log.id, log)
  }
  for (const log of incoming) {
    byId.set(log.id, log)
  }
  return Array.from(byId.values()).sort((left, right) => left.id - right.id)
}

function getTerminalStage(detail: OpenListTaskCenterDetail) {
  if (detail.status === 'SUCCEEDED' || detail.status === 'PARTIAL_SUCCESS') {
    return 'done'
  }
  if (detail.status === 'FAILED' || detail.status === 'INTERRUPTED') {
    return detail.stage || 'done'
  }
  return detail.stage
}

function getStageIndex(detail: OpenListTaskCenterDetail) {
  const stage = getTerminalStage(detail)
  const index = stageOrder.indexOf(stage)
  return index >= 0 ? index : 0
}

function StatusPill({ status }: { status: MagnetIngestTaskStatus }) {
  const isTerminal = isTerminalStatus(status)
  const isFailure = status === 'FAILED' || status === 'INTERRUPTED'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
        isFailure
          ? 'bg-rose-50 text-rose-600'
          : isTerminal
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-slate-100 text-slate-700',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isFailure
            ? 'bg-rose-500'
            : isTerminal
              ? 'bg-emerald-500'
              : 'bg-slate-500',
        )}
      />
      {taskStatusCopy[status] ?? status}
    </span>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">
        {value}
      </p>
    </div>
  )
}

function AttemptSourceLabel({
  attempt,
  attempts,
}: {
  attempt: OpenListTaskCenterAttempt
  attempts: OpenListTaskCenterAttempt[]
}) {
  if (!attempt.retry_of_task_type || !attempt.retry_of_task_id) {
    return null
  }

  const sourceIndex = attempts.findIndex(
    (candidate) =>
      candidate.task_type === attempt.retry_of_task_type &&
      candidate.id === attempt.retry_of_task_id,
  )

  if (sourceIndex < 0) {
    return null
  }

  return (
    <span className="text-xs font-medium text-slate-500">
      来源：第 {sourceIndex + 1} 次
    </span>
  )
}

function AttemptChain({ detail }: { detail: OpenListTaskCenterDetail }) {
  const attempts = detail.attempt_chain.attempts

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <GitBranch className="h-4 w-4" />
        任务尝试链
      </div>
      <div className="mt-4 space-y-3">
        {attempts.map((attempt, index) => (
          <Link
            key={`${attempt.task_type}:${attempt.id}`}
            to={attempt.detail_path}
            className={cn(
              'block rounded-2xl border px-4 py-3 transition',
              attempt.is_current
                ? 'border-slate-950 bg-slate-50'
                : 'border-slate-100 bg-white hover:border-slate-300',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">
                第 {index + 1} 次
              </span>
              {attempt.is_current ? (
                <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-white">
                  当前
                </span>
              ) : null}
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">
              {attempt.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                {productTypeCopy[attempt.product_type]} ·{' '}
                {taskStatusCopy[attempt.status] ?? attempt.status}
              </span>
              <AttemptSourceLabel attempt={attempt} attempts={attempts} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function canRetryManualMagnet(detail: OpenListTaskCenterDetail) {
  return (
    (detail.source_type === 'MANUAL_MAGNET' ||
      detail.source_type === 'PROWLARR_RELEASE') &&
    detail.task_type !== 'ADULT' &&
    recoverableStatuses.has(detail.status)
  )
}

function canSelectProwlarrRelease(detail: OpenListTaskCenterDetail) {
  return (
    (detail.task_type === 'MOVIE' ||
      detail.task_type === 'SERIES' ||
      detail.task_type === 'ANIME') &&
    recoverableStatuses.has(detail.status)
  )
}

function canRetryAdultBatch(detail: OpenListTaskCenterDetail) {
  return (
    detail.task_type === 'ADULT' && recoverableStatuses.has(detail.status)
  )
}

function parseAdultBatchLinks(value: string) {
  return value
    .split(/\r?\n/)
    .map((link) => link.trim())
    .filter(Boolean)
}

export function TaskCenterDetailPage() {
  const { taskType, taskId } = useParams()
  const navigate = useNavigate()
  const normalizedTaskType = normalizeTaskType(taskType)
  const [isPageVisible, setIsPageVisible] = useState(
    () => document.visibilityState === 'visible',
  )
  const [pageState, setPageState] = useState<PageState>({
    status: 'loading',
    detail: null,
    message: null,
  })
  const [retryMagnet, setRetryMagnet] = useState('')
  const [retryError, setRetryError] = useState<string | null>(null)
  const [retrySubmitAction, setRetrySubmitAction] =
    useState<RetrySubmitAction | null>(null)
  const [adultBatchLinks, setAdultBatchLinks] = useState('')
  const [adultBatchError, setAdultBatchError] = useState<string | null>(null)
  const [isAdultBatchSubmitting, setIsAdultBatchSubmitting] = useState(false)
  const initializedAdultBatchTaskRef = useRef<string | null>(null)
  const activeLoadControllerRef = useRef<AbortController | null>(null)
  const latestLoadRequestIdRef = useRef(0)
  const detailRef = useRef<OpenListTaskCenterDetail | null>(null)
  const logScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const initialLogScrollTaskRef = useRef<string | null>(null)
  const loadingOlderLogsRef = useRef(false)
  const [isLoadingOlderLogs, setIsLoadingOlderLogs] = useState(false)

  useEffect(() => {
    detailRef.current = pageState.detail
  }, [pageState.detail])

  const loadDetail = useCallback(
    async (silent = false) => {
      if (!normalizedTaskType || !taskId) {
        setPageState({
          status: 'error',
          detail: null,
          message: '任务地址无效。',
        })
        return
      }

      activeLoadControllerRef.current?.abort()
      const controller = new AbortController()
      activeLoadControllerRef.current = controller
      latestLoadRequestIdRef.current += 1
      const requestId = latestLoadRequestIdRef.current

      setPageState((current) => ({
        status: silent && current.detail ? current.status : 'loading',
        detail: current.detail,
        message: null,
      }))

      try {
        const previousDetail = detailRef.current
        const shouldPreserveLogs =
          silent &&
          previousDetail !== null &&
          previousDetail.id === taskId &&
          previousDetail.task_type.toLowerCase() === normalizedTaskType
        const detail = await getOpenListTaskCenterDetail(
          normalizedTaskType,
          taskId,
          controller.signal,
          shouldPreserveLogs ? 0 : LOG_PAGE_SIZE,
        )
        if (latestLoadRequestIdRef.current !== requestId) {
          return
        }
        const nextDetail =
          shouldPreserveLogs && isSameTask(previousDetail, detail)
            ? {
                ...detail,
                logs: previousDetail.logs,
                logs_has_older: previousDetail.logs_has_older,
                logs_has_newer: previousDetail.logs_has_newer,
                last_warning_or_error_log:
                  previousDetail.last_warning_or_error_log,
              }
            : detail
        detailRef.current = nextDetail
        setPageState({
          status: 'success',
          detail: nextDetail,
          message: null,
        })

        const afterId =
          shouldPreserveLogs && previousDetail
            ? lastLogId(previousDetail.logs)
            : null
        const logParams = shouldPreserveLogs
          ? afterId !== null
            ? { afterId, limit: LOG_PAGE_SIZE }
            : { limit: LOG_PAGE_SIZE }
          : null
        if (logParams !== null) {
          const container = logScrollContainerRef.current
          const shouldStickToBottom = container
            ? container.scrollHeight - container.scrollTop - container.clientHeight < 80
            : false
          const logPage = await listOpenListTaskCenterLogs(
            normalizedTaskType,
            taskId,
            logParams,
            controller.signal,
          )
          if (
            latestLoadRequestIdRef.current !== requestId ||
            logPage.logs.length === 0
          ) {
            return
          }
          setPageState((current) => {
            if (!current.detail || !isSameTask(current.detail, detail)) {
              return current
            }
            const mergedDetail = {
              ...current.detail,
              logs: mergeLogs(current.detail.logs, logPage.logs),
              logs_has_older:
                current.detail.logs.length > 0
                  ? current.detail.logs_has_older
                  : logPage.has_older,
              logs_has_newer: logPage.has_newer,
            }
            detailRef.current = mergedDetail
            return {
              status: 'success',
              detail: mergedDetail,
              message: null,
            }
          })
          if (shouldStickToBottom) {
            window.requestAnimationFrame(() => {
              const currentContainer = logScrollContainerRef.current
              if (currentContainer) {
                currentContainer.scrollTop = currentContainer.scrollHeight
              }
            })
          }
        }
      } catch (error) {
        if (
          isJavaRequestCanceledError(error) ||
          latestLoadRequestIdRef.current !== requestId
        ) {
          return
        }
        setPageState({
          status: 'error',
          detail: null,
          message:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '任务详情加载失败，请稍后重试。',
        })
      } finally {
        if (latestLoadRequestIdRef.current === requestId) {
          activeLoadControllerRef.current = null
        }
      }
    },
    [normalizedTaskType, taskId],
  )

  useEffect(() => {
    void loadDetail()

    return () => {
      latestLoadRequestIdRef.current += 1
      activeLoadControllerRef.current?.abort()
      activeLoadControllerRef.current = null
    }
  }, [loadDetail])

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible'
      setIsPageVisible(visible)
      if (visible && pageState.detail?.is_active) {
        void loadDetail(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadDetail, pageState.detail?.is_active])

  useEffect(() => {
    if (
      pageState.status !== 'success' ||
      !pageState.detail?.is_active ||
      !isPageVisible
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadDetail(true)
    }, DETAIL_POLL_INTERVAL_MS)

    return () => window.clearTimeout(timeoutId)
  }, [isPageVisible, loadDetail, pageState.detail, pageState.status])

  useEffect(() => {
    const detail = pageState.detail
    const container = logScrollContainerRef.current
    if (!detail || !container) {
      return
    }
    const key = taskIdentity(detail)
    if (initialLogScrollTaskRef.current === key) {
      return
    }
    initialLogScrollTaskRef.current = key
    window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
    })
  }, [pageState.detail])

  const loadOlderLogs = useCallback(async () => {
    const currentDetail = detailRef.current
    if (
      !normalizedTaskType ||
      !taskId ||
      !currentDetail ||
      !currentDetail.logs_has_older ||
      loadingOlderLogsRef.current
    ) {
      return
    }
    const beforeId = firstLogId(currentDetail.logs)
    if (beforeId === null) {
      return
    }

    const container = logScrollContainerRef.current
    const previousScrollHeight = container?.scrollHeight ?? 0
    const previousScrollTop = container?.scrollTop ?? 0
    loadingOlderLogsRef.current = true
    setIsLoadingOlderLogs(true)
    try {
      const logPage = await listOpenListTaskCenterLogs(
        normalizedTaskType,
        taskId,
        { beforeId, limit: LOG_PAGE_SIZE },
      )
      setPageState((current) => {
        if (!current.detail || !isSameTask(current.detail, currentDetail)) {
          return current
        }
        const mergedDetail = {
          ...current.detail,
          logs: mergeLogs(logPage.logs, current.detail.logs),
          logs_has_older: logPage.has_older,
        }
        detailRef.current = mergedDetail
        return {
          status: 'success',
          detail: mergedDetail,
          message: null,
        }
      })
      window.requestAnimationFrame(() => {
        const currentContainer = logScrollContainerRef.current
        if (!currentContainer) {
          return
        }
        currentContainer.scrollTop =
          currentContainer.scrollHeight - previousScrollHeight + previousScrollTop
      })
    } catch (error) {
      if (!isJavaRequestCanceledError(error)) {
        setPageState((current) => ({
          ...current,
          message:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '历史日志加载失败，请稍后重试。',
        }))
      }
    } finally {
      loadingOlderLogsRef.current = false
      setIsLoadingOlderLogs(false)
    }
  }, [normalizedTaskType, taskId])

  const handleLogsScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (event.currentTarget.scrollTop <= 24) {
        void loadOlderLogs()
      }
    },
    [loadOlderLogs],
  )

  useEffect(() => {
    const detail = pageState.detail
    if (!detail || !canRetryAdultBatch(detail)) {
      return
    }
    const taskKey = `${detail.task_type}:${detail.id}`
    if (initializedAdultBatchTaskRef.current === taskKey) {
      return
    }
    initializedAdultBatchTaskRef.current = taskKey
    setAdultBatchLinks(detail.batch_download_links?.join('\n') ?? '')
    setAdultBatchError(null)
  }, [pageState.detail])

  const handleReuseOriginalMagnet = async () => {
    const currentDetail = pageState.detail
    if (!currentDetail) {
      return
    }
    setRetryError(null)
    setRetrySubmitAction('reuse')
    try {
      const response = await reuseOriginalOpenListManualMagnet(
        currentDetail.task_type,
        currentDetail.id,
      )
      navigate(response.detail_path)
    } catch (error) {
      setRetryError(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : '创建重试任务失败，请稍后重试。',
      )
    } finally {
      setRetrySubmitAction(null)
    }
  }

  const handleReplaceMagnet = async () => {
    const currentDetail = pageState.detail
    if (!currentDetail) {
      return
    }
    const magnet = retryMagnet.trim()
    if (!magnet.toLowerCase().startsWith('magnet:?')) {
      setRetryError('magnet 链接需以 magnet:? 开头。')
      return
    }
    if (!/[?&]xt=urn:btih:[a-z0-9]+/i.test(magnet)) {
      setRetryError('magnet 链接缺少 btih hash。')
      return
    }

    setRetryError(null)
    setRetrySubmitAction('replace')
    try {
      const response = await replaceOpenListManualMagnet(
        currentDetail.task_type,
        currentDetail.id,
        magnet,
      )
      navigate(response.detail_path)
    } catch (error) {
      setRetryError(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : '创建重试任务失败，请稍后重试。',
      )
    } finally {
      setRetrySubmitAction(null)
    }
  }

  const handleAdultBatchRetry = async () => {
    const currentDetail = pageState.detail
    if (!currentDetail || !canRetryAdultBatch(currentDetail)) {
      return
    }
    const downloadLinks = parseAdultBatchLinks(adultBatchLinks)
    if (downloadLinks.length === 0) {
      setAdultBatchError('请至少填写一条 magnet 或 ed2k 下载链接。')
      return
    }
    if (downloadLinks.length > 50) {
      setAdultBatchError('单批最多提交 50 条下载链接。')
      return
    }
    const invalidLink = downloadLinks.find((link) => {
      const normalized = link.toLowerCase()
      if (normalized.startsWith('ed2k://')) {
        return false
      }
      return !(
        normalized.startsWith('magnet:?') &&
        /[?&]xt=urn:btih:[a-z0-9]+/i.test(link)
      )
    })
    if (invalidLink) {
      setAdultBatchError(
        invalidLink.toLowerCase().startsWith('magnet:?')
          ? 'magnet 链接缺少 btih hash。'
          : '下载链接需以 magnet:? 或 ed2k:// 开头。',
      )
      return
    }

    setAdultBatchError(null)
    setIsAdultBatchSubmitting(true)
    try {
      const response = await retryOpenListAdultBatch(
        currentDetail.id,
        downloadLinks,
      )
      navigate(response.detail_path)
    } catch (error) {
      setAdultBatchError(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : '整批重新提交失败，请稍后重试。',
      )
    } finally {
      setIsAdultBatchSubmitting(false)
    }
  }

  if (pageState.status === 'loading') {
    return (
      <PageContainer
        title="入库任务日志"
        description="正在读取 OpenList 入库任务状态与实时日志。"
      >
        <div className="rounded-[28px] bg-white px-8 py-16 text-center shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            正在加载任务快照…
          </p>
        </div>
      </PageContainer>
    )
  }

  if (pageState.status === 'error' || !pageState.detail) {
    return (
      <PageContainer
        title="入库任务日志"
        description="任务详情暂时无法读取。"
      >
        <div className="rounded-[28px] bg-white px-8 py-12 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          <p className="mt-4 text-lg font-semibold text-slate-950">读取失败</p>
          <p className="mt-2 text-sm text-slate-500">
            {pageState.message ?? '入库任务日志加载失败，请稍后重试。'}
          </p>
          <Link
            to="/tasks"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回任务中心
          </Link>
        </div>
      </PageContainer>
    )
  }

  const detail = pageState.detail
  const activeStageIndex = getStageIndex(detail)
  const isPolling = !isTerminalStatus(detail.status)
  const showManualMagnetRetry = canRetryManualMagnet(detail)
  const showReleaseSelection = canSelectProwlarrRelease(detail)
  const showAdultBatchRetry = canRetryAdultBatch(detail)
  const retrySubmitting = retrySubmitAction !== null

  return (
    <PageContainer
      title="入库任务日志"
      description="跟踪 OpenList 入库任务状态与实时日志。"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Link
                  to="/tasks"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-slate-950"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回任务中心
                </Link>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  {detail.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {productTypeCopy[detail.product_type]} · {detail.task_type}
                </p>
              </div>
              <StatusPill status={detail.status} />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <StatBlock label="当前阶段" value={detail.stage || '未记录'} />
              <StatBlock label="整理结果" value={detail.progress_summary} />
              <StatBlock
                label="更新时间"
                value={formatTime(detail.updated_at)}
              />
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  进度明细
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  当前阶段：{detail.stage}
                </p>
              </div>
              <p className="text-2xl font-semibold text-slate-950">
                {isTerminalStatus(detail.status) ? '100%' : '进行中'}
              </p>
            </div>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-950 transition-all"
                style={{
                  width: `${Math.max(
                    16,
                    ((activeStageIndex + 1) / stageCopy.length) * 100,
                  )}%`,
                }}
              />
            </div>

            <div className="mt-6 space-y-4">
              {stageCopy.map((stage, index) => {
                const isDone = index <= activeStageIndex

                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-slate-950" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300" />
                    )}
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isDone ? 'text-slate-950' : 'text-slate-400',
                      )}
                    >
                      {stage.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {showManualMagnetRetry ? (
            <section className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    处理此任务
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">
                    恢复此任务
                  </h3>
                </div>
                <StatusPill status={detail.status} />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  失败证据
                </p>
                <p className="mt-2 break-words text-sm leading-6 text-slate-700">
                  {detail.error_message ||
                    detail.last_warning_or_error_log?.message ||
                    '暂无错误信息。'}
                </p>
                {detail.last_warning_or_error_log?.detail ? (
                  <p className="mt-2 break-words font-mono text-xs leading-5 text-slate-500">
                    {detail.last_warning_or_error_log.detail}
                  </p>
                ) : null}
              </div>

              {retryError ? (
                <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {retryError}
                </div>
              ) : null}

              {showReleaseSelection ? (
                <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-950">
                    重新选择发布资源
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    重新搜索并选择发布来源；确认后会创建同一尝试链中的新任务。
                  </p>
                  <Link
                    to={`/resources/publish?retry_task_type=${detail.task_type.toLowerCase()}&retry_task_id=${encodeURIComponent(detail.id)}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重新选择发布资源
                  </Link>
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div>
                  <label
                    htmlFor="manual-magnet-retry"
                    className="text-sm font-semibold text-slate-950"
                  >
                    {showReleaseSelection ? '手动提供 magnet' : '新 magnet'}
                  </label>
                  <textarea
                    id="manual-magnet-retry"
                    value={retryMagnet}
                    onChange={(event) => setRetryMagnet(event.target.value)}
                    rows={4}
                    className="mt-2 min-h-[112px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950"
                    placeholder="magnet:?xt=urn:btih:..."
                    disabled={retrySubmitting}
                  />
                </div>
                <div className="flex flex-col gap-3 lg:pt-7">
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-center rounded-xl"
                    onClick={handleReuseOriginalMagnet}
                    disabled={retrySubmitting}
                  >
                    {retrySubmitAction === 'reuse' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    沿用当前 magnet
                  </Button>
                  <Button
                    type="button"
                    className="justify-center rounded-xl"
                    onClick={handleReplaceMagnet}
                    disabled={retrySubmitting}
                  >
                    {retrySubmitAction === 'replace' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {showReleaseSelection
                      ? '手动 magnet 重试'
                      : '使用新 magnet'}
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {showAdultBatchRetry ? (
            <section className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    处理此任务
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">
                    Adult 整批重新提交
                  </h3>
                </div>
                <StatusPill status={detail.status} />
              </div>

              <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                本期会把下方全部链接作为一个新批次重新提交，不提供单条失败链接重试。你可以删除死种或替换来源，原任务和统计不会被修改。
              </div>

              {detail.batch_download_links === null ? (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  该历史任务没有保存完整原始链接，无法自动回填。请手动填写希望重新提交的完整批次；系统不会根据 hash 拼造链接。
                </div>
              ) : null}

              {adultBatchError ? (
                <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {adultBatchError}
                </div>
              ) : null}

              <label
                htmlFor="adult-batch-retry"
                className="mt-5 block text-sm font-semibold text-slate-950"
              >
                新批次下载链接（每行一条，最多 50 条）
              </label>
              <textarea
                id="adult-batch-retry"
                value={adultBatchLinks}
                onChange={(event) => setAdultBatchLinks(event.target.value)}
                rows={10}
                className="mt-2 min-h-[240px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950"
                placeholder={'magnet:?xt=urn:btih:...\ned2k://|file|...'}
                disabled={isAdultBatchSubmitting}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={handleAdultBatchRetry}
                  disabled={isAdultBatchSubmitting}
                >
                  {isAdultBatchSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  整批重新提交
                </Button>
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-[#111214] shadow-[0_24px_50px_rgba(15,23,42,0.2)]">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
              </div>
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                <TerminalSquare className="h-3.5 w-3.5" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                {isPolling ? '轮询中' : '已停止'}
              </span>
            </div>

            <div
              ref={logScrollContainerRef}
              onScroll={handleLogsScroll}
              className="task-log-scrollbar max-h-[420px] min-h-[260px] overflow-y-auto px-4 py-4 font-mono text-[12px] leading-6"
            >
              {detail.logs_has_older ? (
                <div className="flex justify-center pb-3">
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-2 rounded-full border border-zinc-700 px-3 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={loadOlderLogs}
                    disabled={isLoadingOlderLogs}
                  >
                    {isLoadingOlderLogs ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    加载更早日志
                  </button>
                </div>
              ) : null}
              {detail.logs.length > 0 ? (
                detail.logs.map((log) => (
                  <div key={log.id} className="text-zinc-300">
                    <span className="text-zinc-600">
                      [{formatTime(log.created_at)}]
                    </span>{' '}
                    <span
                      className={cn(
                        'font-semibold',
                        log.level === 'ERROR'
                          ? 'text-rose-300'
                          : log.level === 'WARN'
                            ? 'text-amber-300'
                            : 'text-emerald-300',
                      )}
                    >
                      {log.level}
                    </span>{' '}
                    <span className="text-zinc-600">[{log.stage}]</span>{' '}
                    <span>{log.message}</span>
                    {log.detail ? (
                      <span className="block break-all pl-4 text-zinc-500">
                        {log.detail}
                      </span>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-zinc-500">暂无日志。</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-950">
                <CloudUpload className="h-5 w-5" />
              </div>
              <StatusPill status={detail.status} />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-950">
              OpenList 入库
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              任务会在 OpenList 离线下载完成后整理媒体文件和字幕，并把结果写回日志。
            </p>
          </section>

          <AttemptChain detail={detail} />

          {detail.error_message ? (
            <section className="rounded-[28px] bg-rose-50 p-5 text-rose-700">
              <p className="text-sm font-semibold">错误信息</p>
              <p className="mt-2 break-words text-sm leading-6">
                {detail.error_message}
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </PageContainer>
  )
}
