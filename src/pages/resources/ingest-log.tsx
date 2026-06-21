import { useEffect, useMemo, useState } from 'react'
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
import {
  getMovieMagnetIngestTask,
  getSeriesMagnetIngestTask,
  listMovieMagnetIngestTaskLogs,
  listSeriesMagnetIngestTaskLogs,
} from '@/lib/api/magnet-ingest'
import { cn } from '@/lib/utils'
import type {
  MagnetIngestTaskLog,
  MagnetIngestTaskStatus,
  MovieMagnetIngestTask,
  SeriesMagnetIngestTask,
} from '@/types/magnet-ingest'

type IngestLogMediaType = 'movie' | 'series'
type IngestLogTask = MovieMagnetIngestTask | SeriesMagnetIngestTask
type PageStatus = 'loading' | 'success' | 'error'

type PageState = {
  status: PageStatus
  task: IngestLogTask | null
  logs: MagnetIngestTaskLog[]
  message: string | null
}

const TASK_LOG_POLL_INTERVAL_MS = 2000

const TERMINAL_STATUSES = new Set<MagnetIngestTaskStatus>([
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

const dynamicRangeCopy: Record<string, string> = {
  dolby_vision: 'Dolby Vision',
  hdr10_plus: 'HDR10+',
  hdr10: 'HDR10',
  hdr: 'HDR',
  hlg: 'HLG',
  sdr: 'SDR',
}

const stageOrder = ['created', 'submitted', 'downloading', 'organizing', 'done']

const stageCopy = [
  { key: 'created', label: '任务创建' },
  { key: 'submitted', label: '提交 OpenList' },
  { key: 'downloading', label: '离线下载' },
  { key: 'organizing', label: '文件整理' },
  { key: 'done', label: '完成收束' },
]

function isSupportedMediaType(value: string | undefined): value is IngestLogMediaType {
  return value === 'movie' || value === 'series'
}

function isTerminalStatus(status: MagnetIngestTaskStatus) {
  return TERMINAL_STATUSES.has(status)
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

function getTaskTitle(mediaType: IngestLogMediaType, task: IngestLogTask) {
  if (mediaType === 'series') {
    const seriesTask = task as SeriesMagnetIngestTask
    return `${seriesTask.series_name} ${seriesTask.season_folder}`
  }

  const movieTask = task as MovieMagnetIngestTask
  return `${movieTask.title} (${movieTask.year})`
}

function getTerminalStage(task: IngestLogTask) {
  if (task.status === 'SUCCEEDED' || task.status === 'PARTIAL_SUCCESS') {
    return 'done'
  }
  if (task.status === 'FAILED' || task.status === 'INTERRUPTED') {
    return task.stage || 'done'
  }
  return task.stage
}

function getStageIndex(task: IngestLogTask) {
  const stage = getTerminalStage(task)
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

function StatBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
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

export function ResourceIngestLogPage() {
  const { mediaType, taskId } = useParams()
  const [pageState, setPageState] = useState<PageState>({
    status: 'loading',
    task: null,
    logs: [],
    message: null,
  })
  const supportedMediaType = isSupportedMediaType(mediaType) ? mediaType : null

  useEffect(() => {
    if (!supportedMediaType || !taskId) {
      setPageState({
        status: 'error',
        task: null,
        logs: [],
        message: '入库任务地址无效。',
      })
      return
    }

    const activeMediaType = supportedMediaType
    const activeTaskId = taskId
    let isDisposed = false
    let timeoutId: number | null = null

    async function loadSnapshot() {
      try {
        const [task, logs] =
          activeMediaType === 'movie'
            ? await Promise.all([
                getMovieMagnetIngestTask(activeTaskId),
                listMovieMagnetIngestTaskLogs(activeTaskId),
              ])
            : await Promise.all([
                getSeriesMagnetIngestTask(activeTaskId),
                listSeriesMagnetIngestTaskLogs(activeTaskId),
              ])

        if (isDisposed) {
          return
        }

        setPageState({
          status: 'success',
          task,
          logs,
          message: null,
        })

        if (!isTerminalStatus(task.status)) {
          timeoutId = window.setTimeout(loadSnapshot, TASK_LOG_POLL_INTERVAL_MS)
        }
      } catch (error) {
        if (isDisposed) {
          return
        }

        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '入库任务日志加载失败，请稍后重试。'

        setPageState({
          status: 'error',
          task: null,
          logs: [],
          message,
        })
      }
    }

    setPageState((currentState) => ({
      status: currentState.task ? 'success' : 'loading',
      task: currentState.task,
      logs: currentState.logs,
      message: null,
    }))
    void loadSnapshot()

    return () => {
      isDisposed = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [supportedMediaType, taskId])

  const taskTitle = useMemo(() => {
    if (!supportedMediaType || !pageState.task) {
      return '入库任务日志'
    }
    return getTaskTitle(supportedMediaType, pageState.task)
  }, [pageState.task, supportedMediaType])

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

  if (pageState.status === 'error' || !supportedMediaType || !pageState.task) {
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
            to="/resources"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回资源搜索
          </Link>
        </div>
      </PageContainer>
    )
  }

  const { task, logs } = pageState
  const activeStageIndex = getStageIndex(task)
  const isPolling = !isTerminalStatus(task.status)
  const resolutionTags = task.resolution_tags ?? []
  const dynamicRangeTags = task.dynamic_range_tags ?? []
  const primaryResolution = task.quality_tag ?? resolutionTags[0] ?? null
  const displayDynamicRangeTags = dynamicRangeTags.map(
    (tag) => dynamicRangeCopy[tag] ?? tag,
  )
  const primaryQuality = [
    primaryResolution,
    ...displayDynamicRangeTags,
  ].filter(Boolean).join(' / ')
  const displayResolutionTags =
    resolutionTags.length > 0
      ? resolutionTags
      : primaryResolution
        ? [primaryResolution]
        : []

  return (
    <PageContainer
      title="入库任务日志"
      description="跟踪资源卡片触发的 Prowlarr → OpenList 入库任务。"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Link
                  to="/resources"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-slate-950"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回资源搜索
                </Link>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  {taskTitle}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {supportedMediaType === 'movie' ? '电影入库' : '剧集入库'} ·{' '}
                  {task.original_title || '无原始标题'}
                </p>
              </div>
              <StatusPill status={task.status} />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <StatBlock label="分辨率" value={primaryQuality || '未记录'} />
              <StatBlock
                label="整理结果"
                value={`${task.organized_count} 个入库 · ${task.skipped_count} 个跳过`}
              />
              <StatBlock label="更新时间" value={formatTime(task.updated_at)} />
            </div>

            <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                保存路径
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">
                {task.save_path}
              </p>
            </div>
            {task.release_title ? (
              <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  发布资源
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                  {task.release_title}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {task.release_indexer || '未知索引器'}
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  进度明细
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  当前阶段：{task.stage}
                </p>
              </div>
              <p className="text-2xl font-semibold text-slate-950">
                {isTerminalStatus(task.status) ? '100%' : '进行中'}
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
              {logs.length > 0 ? (
                logs.map((log) => (
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
              <StatusPill status={task.status} />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-950">
              OpenList 入库
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              任务会在 OpenList 离线下载完成后整理媒体文件和字幕，并把结果写回日志。
            </p>
          </section>

          <section className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              发布标签
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {displayResolutionTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white"
                >
                  {tag}
                </span>
              ))}
              {displayDynamicRangeTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {tag}
                </span>
              ))}
              {displayResolutionTags.length === 0 &&
              dynamicRangeTags.length === 0 ? (
                <span className="text-sm text-slate-500">暂无标签</span>
              ) : null}
            </div>
          </section>

          {task.error_message ? (
            <section className="rounded-[28px] bg-rose-50 p-5 text-rose-700">
              <p className="text-sm font-semibold">错误信息</p>
              <p className="mt-2 break-words text-sm leading-6">
                {task.error_message}
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </PageContainer>
  )
}
