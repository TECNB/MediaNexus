import { useEffect, useRef, useState } from 'react'
import {
  Lightbulb,
  Loader2,
  Maximize2,
  Server,
  TerminalSquare,
  X,
} from 'lucide-react'

import type { SystemLogEntry } from '@/data/mock-magnet-ingest'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AnimeMagnetIngestTaskLog } from '@/types/magnet-ingest'

type SystemLogsCardProps = {
  logs: SystemLogEntry[]
}

type TaskLogsStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

type TaskLogsCardProps = {
  logs: AnimeMagnetIngestTaskLog[]
  status: TaskLogsStatus
  error: string | null
  selectedTaskId: string | null
}

type TaskLogsContentProps = TaskLogsCardProps & {
  className?: string
}

type TaskCurrentActionTone = 'idle' | 'active' | 'success' | 'warning' | 'error'

const logToneClassName = {
  default: 'text-zinc-300',
  success: 'text-emerald-400',
  accent: 'text-sky-400',
  muted: 'text-zinc-500',
} satisfies Record<NonNullable<SystemLogEntry['tone']>, string>

const taskStageLabel: Record<string, string> = {
  created: '已创建',
  submitted: '已提交',
  downloading: '下载中',
  organizing: '整理中',
  succeeded: '已完成',
  failed: '失败',
  interrupted: '已中断',
}

const terminalTaskLogStages = new Set(['succeeded', 'failed', 'interrupted'])

const currentActionToneClassName = {
  idle: 'text-zinc-400',
  active: 'text-sky-200',
  success: 'text-emerald-200',
  warning: 'text-amber-200',
  error: 'text-rose-200',
} satisfies Record<TaskCurrentActionTone, string>

const currentActionDotClassName = {
  idle: 'bg-zinc-500',
  active: 'bg-sky-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-rose-400',
} satisfies Record<TaskCurrentActionTone, string>

function formatLogTime(value: string | null) {
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

function formatTaskStage(stage: string) {
  return taskStageLabel[stage] ?? stage
}

function getCurrentAction(props: TaskLogsCardProps) {
  const { logs, status, error, selectedTaskId } = props

  if (!selectedTaskId) {
    return {
      stage: '未选择',
      message: '选择动漫任务后查看当前动作。',
      detail: null,
      tone: 'idle' as TaskCurrentActionTone,
      active: false,
    }
  }

  if (status === 'loading') {
    return {
      stage: '加载中',
      message: '正在加载任务日志...',
      detail: null,
      tone: 'active' as TaskCurrentActionTone,
      active: true,
    }
  }

  if (status === 'error') {
    return {
      stage: '加载失败',
      message: error ?? '任务日志加载失败',
      detail: null,
      tone: 'error' as TaskCurrentActionTone,
      active: false,
    }
  }

  if (logs.length === 0) {
    return {
      stage: '等待日志',
      message: '任务尚未写入日志。',
      detail: null,
      tone: 'idle' as TaskCurrentActionTone,
      active: false,
    }
  }

  const latestLog = logs[logs.length - 1]
  const tone: TaskCurrentActionTone =
    latestLog.level === 'ERROR'
      ? 'error'
      : latestLog.level === 'WARN'
        ? 'warning'
        : terminalTaskLogStages.has(latestLog.stage)
          ? 'success'
          : 'active'

  return {
    stage: formatTaskStage(latestLog.stage),
    message: latestLog.message,
    detail: latestLog.detail,
    tone,
    active: tone === 'active',
  }
}

export function SystemLogsCard({ logs }: SystemLogsCardProps) {
  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        System Logs
      </p>

      <div className="overflow-hidden rounded-[28px] border border-slate-900 bg-[#111214] shadow-[0_24px_50px_rgba(15,23,42,0.2)]">
        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
          </div>

          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            <TerminalSquare className="h-3.5 w-3.5" />
            <span>Live Monitor</span>
          </div>
        </div>

        <div className="space-y-2 px-4 py-4 font-mono text-[12px] leading-6">
          {logs.map((record) => (
            <p
              key={record.id}
              className={cn(logToneClassName[record.tone ?? 'default'])}
            >
              <span className="text-zinc-600">[{record.timestamp}]</span>{' '}
              {record.message}
            </p>
          ))}

          <p className="flex items-center gap-2 text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active monitoring enabled.
          </p>
        </div>
      </div>
    </section>
  )
}

function TaskCurrentAction(props: TaskLogsCardProps) {
  const action = getCurrentAction(props)

  return (
    <div className="border-b border-white/5 px-4 py-3" aria-live="polite">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5',
            currentActionToneClassName[action.tone],
          )}
        >
          {action.active ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                currentActionDotClassName[action.tone],
              )}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] font-medium text-zinc-500">
              当前动作
            </span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              {action.stage}
            </span>
          </div>
          <p
            className={cn(
              'mt-1 break-words text-sm font-medium',
              currentActionToneClassName[action.tone],
            )}
          >
            {action.message}
          </p>
          {action.detail ? (
            <p className="mt-1 break-all font-mono text-[11px] leading-5 text-zinc-500">
              {action.detail}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function TaskLogsContent({
  logs,
  status,
  error,
  selectedTaskId,
  className,
}: TaskLogsContentProps) {
  const logScrollRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)

  useEffect(() => {
    shouldStickToBottomRef.current = true
  }, [selectedTaskId])

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return
    }

    const element = logScrollRef.current
    if (!element) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [logs, selectedTaskId, status])

  function handleLogScroll() {
    const element = logScrollRef.current
    if (!element) {
      return
    }

    const distanceToBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight
    shouldStickToBottomRef.current = distanceToBottom < 48
  }

  return (
    <div
      ref={logScrollRef}
      onScroll={handleLogScroll}
      className={cn(
        'task-log-scrollbar max-h-[420px] min-h-[260px] overflow-y-auto px-4 py-4 font-mono text-[12px] leading-6',
        className,
      )}
    >
      {!selectedTaskId ? (
        <p className="text-zinc-500">选择动漫任务后查看执行日志。</p>
      ) : null}

      {selectedTaskId && status === 'loading' ? (
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在加载日志...
        </div>
      ) : null}

      {selectedTaskId && status === 'error' ? (
        <p className="text-rose-300">{error ?? '任务日志加载失败'}</p>
      ) : null}

      {selectedTaskId && status === 'empty' ? (
        <p className="text-zinc-500">暂无日志</p>
      ) : null}

      {selectedTaskId && status === 'success'
        ? logs.map((entry) => (
            <div key={entry.id} className="text-zinc-300">
              <span className="text-zinc-600">
                [{formatLogTime(entry.created_at)}]
              </span>{' '}
              <span
                className={cn(
                  'font-semibold',
                  entry.level === 'ERROR'
                    ? 'text-rose-300'
                    : entry.level === 'WARN'
                      ? 'text-amber-300'
                      : 'text-emerald-300',
                )}
              >
                {entry.level}
              </span>{' '}
              <span className="text-zinc-600">[{entry.stage}]</span>{' '}
              <span>{entry.message}</span>
              {entry.detail ? (
                <span className="block break-all pl-4 text-zinc-500">
                  {entry.detail}
                </span>
              ) : null}
            </div>
          ))
        : null}
    </div>
  )
}

export function TaskLogsCard(props: TaskLogsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!isExpanded) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isExpanded])

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        Task Logs
      </p>

      <div className="overflow-hidden rounded-[28px] border border-slate-900 bg-[#111214] shadow-[0_24px_50px_rgba(15,23,42,0.2)]">
        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
          </div>

          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            <TerminalSquare className="h-3.5 w-3.5" />
            <span>Task Monitor</span>
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="放大 Task Logs"
                    onClick={() => {
                      setIsExpanded(true)
                    }}
                    className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>放大日志</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <TaskCurrentAction {...props} />
        <TaskLogsContent {...props} />
      </div>

      {isExpanded ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Task Logs"
          className="fixed inset-0 z-50 bg-slate-950/60 p-4 backdrop-blur-sm md:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsExpanded(false)
            }
          }}
        >
          <div className="mx-auto flex h-[min(760px,calc(100vh-4rem))] max-w-6xl flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-[#111214] shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.04] px-5 py-4">
              <div className="flex items-center gap-3">
                <TerminalSquare className="h-4 w-4 text-zinc-500" />
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">
                  Task Logs
                </p>
              </div>

              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="关闭 Task Logs"
                      onClick={() => {
                        setIsExpanded(false)
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>关闭</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <TaskCurrentAction {...props} />
            <TaskLogsContent
              {...props}
              className="h-full max-h-none min-h-0 flex-1 px-5 py-5 text-[13px]"
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function NodeStatusCard() {
  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        Node Status
      </p>

      <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-shell">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Server className="h-5 w-5" />
            </div>

            <div>
              <p className="text-lg font-semibold text-slate-950">PikPak API</p>
              <p className="text-sm text-slate-500">Singapore Region</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            在线
          </span>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>云盘空间: 78% 已用</span>
            <span>7.8 TB / 10 TB</span>
          </div>

          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-full w-[78%] rounded-full bg-slate-900" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
          <span className="text-slate-400">UPTIME</span>
          <span className="font-semibold text-slate-900">24d 18h 12m</span>
        </div>
      </div>
    </section>
  )
}

export function ProTipCard() {
  return (
    <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 p-5 shadow-shell">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Lightbulb className="h-5 w-5" />
        </div>

        <div>
          <p className="text-lg font-semibold text-slate-950">Pro Tip</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            可以使用快捷键
            {' '}
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
              Cmd + V
            </span>
            {' '}
            直接在任意位置粘贴磁链并进行自动识别。
          </p>
        </div>
      </div>
    </section>
  )
}
