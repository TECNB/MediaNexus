import { Lightbulb, Loader2, Server, TerminalSquare } from 'lucide-react'

import type { SystemLogEntry } from '@/data/mock-magnet-ingest'
import {
  OperationalLogPanel,
  type OperationalLogStatus,
} from '@/components/operation-log/operational-log-panel'
import { cn } from '@/lib/utils'
import type {
  MagnetIngestNodeStatus,
  MagnetIngestTaskLog,
} from '@/types/magnet-ingest'

type SystemLogsCardProps = {
  logs: SystemLogEntry[]
}

type TaskLogsCardProps = {
  logs: MagnetIngestTaskLog[]
  status: OperationalLogStatus
  error: string | null
  selectedTaskId: string | null
  emptySelectionMessage?: string
}

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

export function SystemLogsCard({ logs }: SystemLogsCardProps) {
  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        系统日志
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
            <span>实时监控</span>
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
            实时监控已启用。
          </p>
        </div>
      </div>
    </section>
  )
}

export function TaskLogsCard(props: TaskLogsCardProps) {
  return (
    <OperationalLogPanel
      logs={props.logs}
      status={props.status}
      error={props.error}
      hasSelection={Boolean(props.selectedTaskId)}
      emptySelectionMessage={
        props.emptySelectionMessage ?? '选择任务后查看执行日志。'
      }
      scrollKey={props.selectedTaskId}
      stageLabels={taskStageLabel}
      terminalStages={terminalTaskLogStages}
    />
  )
}

type NodeStatusCardProps = {
  data: MagnetIngestNodeStatus | null
  status: 'loading' | 'success' | 'error'
}

function formatBytes(value: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function NodeStatusCard({ data, status }: NodeStatusCardProps) {
  const hasCapacity =
    data?.used_bytes !== null &&
    data?.used_bytes !== undefined &&
    data?.total_bytes !== null &&
    data?.total_bytes !== undefined &&
    data.total_bytes > 0
  const usagePercent = hasCapacity
    ? Math.min(100, Math.max(0, (data.used_bytes! / data.total_bytes!) * 100))
    : 0
  const isOnline = status === 'success' && data?.online === true

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        节点状态
      </p>

      <div
        aria-busy={status === 'loading'}
        className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-shell"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Server className="h-5 w-5" />
            </div>

            <div>
              <p className="text-lg font-semibold text-slate-950">
                {data?.provider ?? 'PikPak'} API
              </p>
              <p className="text-sm text-slate-500">OpenList 存储节点</p>
            </div>
          </div>

          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
              status === 'loading'
                ? 'bg-slate-100 text-slate-600'
                : isOnline
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700',
            )}
          >
            {status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  isOnline ? 'bg-emerald-500' : 'bg-rose-500',
                )}
              />
            )}
            {status === 'loading' ? '检测中' : isOnline ? '在线' : '不可用'}
          </span>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-500">
            {status === 'loading' ? (
              <span>正在读取云盘空间...</span>
            ) : hasCapacity ? (
              <>
                <span>云盘空间: {Math.round(usagePercent)}% 已用</span>
                <span>
                  {formatBytes(data.used_bytes!)} / {formatBytes(data.total_bytes!)}
                </span>
              </>
            ) : (
              <span>云盘空间暂时无法获取</span>
            )}
          </div>

          <div className="h-2 rounded-full bg-slate-100">
            <div
              role={hasCapacity ? 'progressbar' : undefined}
              aria-label={hasCapacity ? '云盘空间使用率' : undefined}
              aria-valuemin={hasCapacity ? 0 : undefined}
              aria-valuemax={hasCapacity ? 100 : undefined}
              aria-valuenow={hasCapacity ? Math.round(usagePercent) : undefined}
              className={cn(
                'h-full rounded-full transition-[width]',
                status === 'loading'
                  ? 'animate-pulse bg-slate-300'
                  : 'bg-slate-900',
              )}
              style={{ width: status === 'loading' ? '35%' : `${usagePercent}%` }}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
          <span className="text-slate-400">数据来源</span>
          <span className="font-semibold text-slate-900">OpenList</span>
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
          <p className="text-lg font-semibold text-slate-950">小提示</p>
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
