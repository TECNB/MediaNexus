import { Lightbulb, Server, TerminalSquare } from 'lucide-react'

import type { SystemLogEntry } from '@/data/mock-magnet-ingest'
import { cn } from '@/lib/utils'

type SystemLogsCardProps = {
  logs: SystemLogEntry[]
}

const logToneClassName = {
  default: 'text-zinc-300',
  success: 'text-emerald-400',
  accent: 'text-sky-400',
  muted: 'text-zinc-500',
} satisfies Record<NonNullable<SystemLogEntry['tone']>, string>

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
