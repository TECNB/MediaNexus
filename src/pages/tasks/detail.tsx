import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  CloudUpload,
  Loader2,
  TerminalSquare,
} from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { getOpenListTaskCenterDetail } from '@/lib/api/task-center'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type { MagnetIngestTaskStatus } from '@/types/magnet-ingest'
import type {
  OpenListTaskCenterDetail,
  OpenListTaskCenterProductType,
} from '@/types/task-center'

type PageStatus = 'loading' | 'success' | 'error'

type PageState = {
  status: PageStatus
  detail: OpenListTaskCenterDetail | null
  message: string | null
}

const DETAIL_POLL_INTERVAL_MS = 2000
const supportedTaskTypes = new Set(['movie', 'series', 'anime', 'adult'])

const terminalStatuses = new Set<MagnetIngestTaskStatus>([
  'SUCCEEDED',
  'PARTIAL_SUCCESS',
  'FAILED',
  'INTERRUPTED',
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

export function TaskCenterDetailPage() {
  const { taskType, taskId } = useParams()
  const normalizedTaskType = normalizeTaskType(taskType)
  const [isPageVisible, setIsPageVisible] = useState(
    () => document.visibilityState === 'visible',
  )
  const [pageState, setPageState] = useState<PageState>({
    status: 'loading',
    detail: null,
    message: null,
  })
  const activeLoadControllerRef = useRef<AbortController | null>(null)
  const latestLoadRequestIdRef = useRef(0)

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
        const detail = await getOpenListTaskCenterDetail(
          normalizedTaskType,
          taskId,
          controller.signal,
        )
        if (latestLoadRequestIdRef.current !== requestId) {
          return
        }
        setPageState({
          status: 'success',
          detail,
          message: null,
        })
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

          <section className="overflow-hidden rounded-[28px] bg-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <TerminalSquare className="h-4 w-4" />
                实时任务日志
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                {isPolling ? '轮询中' : '已停止'}
              </span>
            </div>

            <div className="max-h-[420px] overflow-auto px-5 pb-5 font-mono text-xs leading-6">
              {detail.logs.length > 0 ? (
                detail.logs.map((log) => (
                  <div key={log.id} className="text-slate-300">
                    <span className="text-slate-500">
                      [{formatTime(log.created_at)}]
                    </span>{' '}
                    <span className="text-sky-300">{log.level}</span>{' '}
                    <span className="text-emerald-300">{log.stage}</span>{' '}
                    <span>{log.message}</span>
                    {log.detail ? (
                      <span className="text-slate-500"> · {log.detail}</span>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-slate-500">暂无日志。</p>
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
