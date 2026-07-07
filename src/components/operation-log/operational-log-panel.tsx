import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type UIEvent,
} from 'react'
import { Loader2, Maximize2, TerminalSquare, X } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type OperationalLogEntry = {
  id: number | string
  level: string
  stage: string
  message: string
  detail: string | null
  created_at: string | null
}

export type OperationalLogStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'

type OperationalLogActionTone =
  | 'idle'
  | 'active'
  | 'success'
  | 'warning'
  | 'error'

type OperationalLogPanelProps<TLog extends OperationalLogEntry> = {
  logs: TLog[]
  status: OperationalLogStatus
  error?: string | null
  hasSelection?: boolean
  title?: string
  monitorLabel?: string
  emptySelectionMessage?: string
  emptyLogsMessage?: string
  loadingMessage?: string
  errorFallbackMessage?: string
  stageLabels?: Record<string, string>
  terminalStages?: ReadonlySet<string>
  scrollKey?: number | string | null
  className?: string
  contentClassName?: string
  expandedContentClassName?: string
  beforeLogs?: ReactNode
  scrollContainerRef?: MutableRefObject<HTMLDivElement | null>
  onLogsScroll?: (event: UIEvent<HTMLDivElement>) => void
}

const defaultTerminalStages = new Set(['succeeded', 'failed', 'interrupted'])

const defaultStageLabels: Record<string, string> = {
  created: '已创建',
  submitted: '已提交',
  downloading: '下载中',
  organizing: '整理中',
  succeeded: '已完成',
  failed: '失败',
  interrupted: '已中断',
}

const currentActionToneClassName = {
  idle: 'text-zinc-400',
  active: 'text-sky-200',
  success: 'text-emerald-200',
  warning: 'text-amber-200',
  error: 'text-rose-200',
} satisfies Record<OperationalLogActionTone, string>

const currentActionDotClassName = {
  idle: 'bg-zinc-500',
  active: 'bg-sky-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-rose-400',
} satisfies Record<OperationalLogActionTone, string>

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

function formatLogStage(stage: string, stageLabels: Record<string, string>) {
  return stageLabels[stage] ?? stage
}

function getLogLevelClassName(level: string) {
  if (level === 'ERROR') {
    return 'text-rose-300'
  }

  if (level === 'WARN') {
    return 'text-amber-300'
  }

  if (level === 'DEBUG') {
    return 'text-sky-300'
  }

  return 'text-emerald-300'
}

function getCurrentAction<TLog extends OperationalLogEntry>({
  logs,
  status,
  error,
  hasSelection,
  emptySelectionMessage,
  stageLabels,
  terminalStages,
}: Required<
  Pick<
    OperationalLogPanelProps<TLog>,
    | 'logs'
    | 'status'
    | 'hasSelection'
    | 'emptySelectionMessage'
    | 'stageLabels'
    | 'terminalStages'
  >
> &
  Pick<OperationalLogPanelProps<TLog>, 'error'>) {
  if (!hasSelection) {
    return {
      stage: '未选择',
      message: emptySelectionMessage,
      detail: null,
      tone: 'idle' as OperationalLogActionTone,
      active: false,
    }
  }

  if (status === 'loading') {
    return {
      stage: '加载中',
      message: '正在加载任务日志...',
      detail: null,
      tone: 'active' as OperationalLogActionTone,
      active: true,
    }
  }

  if (status === 'error') {
    return {
      stage: '加载失败',
      message: error ?? '任务日志加载失败',
      detail: null,
      tone: 'error' as OperationalLogActionTone,
      active: false,
    }
  }

  if (logs.length === 0) {
    return {
      stage: '等待日志',
      message: '任务尚未写入日志。',
      detail: null,
      tone: 'idle' as OperationalLogActionTone,
      active: false,
    }
  }

  const latestLog = logs[logs.length - 1]
  const tone: OperationalLogActionTone =
    latestLog.level === 'ERROR'
      ? 'error'
      : latestLog.level === 'WARN'
        ? 'warning'
        : terminalStages.has(latestLog.stage)
          ? 'success'
          : 'active'

  return {
    stage: formatLogStage(latestLog.stage, stageLabels),
    message: latestLog.message,
    detail: latestLog.detail,
    tone,
    active: tone === 'active',
  }
}

function OperationalLogCurrentAction<TLog extends OperationalLogEntry>(
  props: Required<
    Pick<
      OperationalLogPanelProps<TLog>,
      | 'logs'
      | 'status'
      | 'hasSelection'
      | 'emptySelectionMessage'
      | 'stageLabels'
      | 'terminalStages'
    >
  > &
    Pick<OperationalLogPanelProps<TLog>, 'error'>,
) {
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

function OperationalLogContent<TLog extends OperationalLogEntry>({
  logs,
  status,
  error,
  hasSelection,
  emptySelectionMessage,
  emptyLogsMessage,
  loadingMessage,
  errorFallbackMessage,
  className,
  beforeLogs,
  scrollContainerRef,
  onLogsScroll,
  scrollKey,
}: Required<
  Pick<
    OperationalLogPanelProps<TLog>,
    | 'logs'
    | 'status'
    | 'hasSelection'
    | 'emptySelectionMessage'
    | 'emptyLogsMessage'
    | 'loadingMessage'
    | 'errorFallbackMessage'
  >
> &
  Pick<
    OperationalLogPanelProps<TLog>,
    | 'error'
    | 'className'
    | 'beforeLogs'
    | 'scrollContainerRef'
    | 'onLogsScroll'
    | 'scrollKey'
  >) {
  const logScrollRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)

  useEffect(() => {
    shouldStickToBottomRef.current = true
  }, [hasSelection, scrollKey])

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
  }, [logs, hasSelection, scrollKey, status])

  function setLogScrollRef(element: HTMLDivElement | null) {
    logScrollRef.current = element

    if (scrollContainerRef) {
      scrollContainerRef.current = element
    }
  }

  function handleLogScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget
    const distanceToBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight
    shouldStickToBottomRef.current = distanceToBottom < 48
    onLogsScroll?.(event)
  }

  return (
    <div
      ref={setLogScrollRef}
      onScroll={handleLogScroll}
      className={cn(
        'task-log-scrollbar max-h-[420px] min-h-[260px] overflow-y-auto px-4 py-4 font-mono text-[12px] leading-6',
        className,
      )}
    >
      {beforeLogs}

      {!hasSelection ? (
        <p className="text-zinc-500">{emptySelectionMessage}</p>
      ) : null}

      {hasSelection && status === 'loading' ? (
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {loadingMessage}
        </div>
      ) : null}

      {hasSelection && status === 'error' ? (
        <p className="text-rose-300">{error ?? errorFallbackMessage}</p>
      ) : null}

      {hasSelection && status === 'empty' ? (
        <p className="text-zinc-500">{emptyLogsMessage}</p>
      ) : null}

      {hasSelection && status === 'success' && logs.length === 0 ? (
        <p className="text-zinc-500">{emptyLogsMessage}</p>
      ) : null}

      {hasSelection && status === 'success'
        ? logs.map((entry) => (
            <div key={entry.id} className="text-zinc-300">
              <span className="text-zinc-600">
                [{formatLogTime(entry.created_at)}]
              </span>{' '}
              <span className={cn('font-semibold', getLogLevelClassName(entry.level))}>
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

export function OperationalLogPanel<TLog extends OperationalLogEntry>({
  logs,
  status,
  error = null,
  hasSelection = true,
  title = '任务日志',
  monitorLabel = '任务监控',
  emptySelectionMessage = '选择任务后查看执行日志。',
  emptyLogsMessage = '暂无日志',
  loadingMessage = '正在加载日志...',
  errorFallbackMessage = '任务日志加载失败',
  stageLabels = defaultStageLabels,
  terminalStages = defaultTerminalStages,
  className,
  contentClassName,
  expandedContentClassName,
  beforeLogs,
  scrollContainerRef,
  onLogsScroll,
  scrollKey,
}: OperationalLogPanelProps<TLog>) {
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

  const actionProps = {
    logs,
    status,
    error,
    hasSelection,
    emptySelectionMessage,
    stageLabels,
    terminalStages,
  }

  return (
    <section className={cn('space-y-3', className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        {title}
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
            <span>{monitorLabel}</span>
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`放大${title}`}
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

        <OperationalLogCurrentAction {...actionProps} />
        <OperationalLogContent
          logs={logs}
          status={status}
          error={error}
          hasSelection={hasSelection}
          emptySelectionMessage={emptySelectionMessage}
          emptyLogsMessage={emptyLogsMessage}
          loadingMessage={loadingMessage}
          errorFallbackMessage={errorFallbackMessage}
          className={contentClassName}
          beforeLogs={beforeLogs}
          scrollContainerRef={scrollContainerRef}
          onLogsScroll={onLogsScroll}
          scrollKey={scrollKey}
        />
      </div>

      {isExpanded ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
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
                  {title}
                </p>
              </div>

              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`关闭${title}`}
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

            <OperationalLogCurrentAction {...actionProps} />
            <OperationalLogContent
              logs={logs}
              status={status}
              error={error}
              hasSelection={hasSelection}
              emptySelectionMessage={emptySelectionMessage}
              emptyLogsMessage={emptyLogsMessage}
              loadingMessage={loadingMessage}
              errorFallbackMessage={errorFallbackMessage}
              className={cn(
                'h-full max-h-none min-h-0 flex-1 px-5 py-5 text-[13px]',
                expandedContentClassName,
              )}
              beforeLogs={beforeLogs}
              onLogsScroll={onLogsScroll}
              scrollKey={scrollKey}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
