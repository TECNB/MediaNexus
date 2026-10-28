import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Clock3,
  Play,
  Users,
  CalendarRange,
  Hash,
  Loader2,
  RefreshCw,
  Terminal,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DateControl } from '@/components/ui/form-control'
import { getEmbyWatchRankings } from '@/lib/api/emby-watch-rankings'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type {
  EmbyMediaWatchRankingItem,
  EmbyUserWatchRankingItem,
  EmbyWatchRankingData,
  EmbyWatchRankingPeriod,
  EmbyWebhookRecentEvent,
} from '@/types/emby-watch-rankings'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

const DEFAULT_LIMIT = 20
const WATCH_ZONE = 'Asia/Shanghai'

function getTodayDateInput() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WATCH_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getCurrentMonthInput() {
  return getTodayDateInput().slice(0, 7)
}

function parseLimit(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT
  }
  return Math.trunc(parsed)
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 分钟'
  }

  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  const parts: string[] = []
  if (days > 0) {
    parts.push(`${days} 天`)
  }
  if (hours > 0) {
    parts.push(`${hours} 小时`)
  }
  if (minutes > 0) {
    parts.push(`${minutes} 分钟`)
  }
  if (parts.length === 0) {
    parts.push(`${remainingSeconds} 秒`)
  }

  return parts.join(' ')
}

function formatCompactDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0m'
  }

  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return `${Math.floor(seconds)}s`
}

function splitEpisodeLabel(value: string | null) {
  if (!value) {
    return { title: '-', episodeLabel: null }
  }

  const match = value.match(/^(.*?)\s+(S\d{2,}E\d{2,})$/i)
  if (!match) {
    return { title: value, episodeLabel: null }
  }

  return { title: match[1], episodeLabel: match[2].toUpperCase() }
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatTerminalTime(value: string | null) {
  if (!value) {
    return '--:--:--'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '--:--:--'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function getInitials(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return '?'
  }
  return trimmed.slice(0, 2).toUpperCase()
}

function getAvatarTone(index: number) {
  const tones = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700',
    'bg-violet-100 text-violet-700',
  ]

  return tones[index % tones.length]
}

function SummaryPanel({ data }: { data: EmbyWatchRankingData }) {
  const metrics = [
    { label: '活跃用户', value: data.summary.active_user_count, icon: Users },
    { label: '播放次数', value: data.summary.total_play_count, icon: Play },
    { label: '总观看时长', value: formatDuration(data.summary.total_watch_seconds), icon: Clock3 },
    { label: '跟踪中的会话', value: data.webhook_status.active_session_count, icon: Activity },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon }) => (
        <div className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200" key={label}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{label}</p>
            <Icon aria-hidden="true" className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-4 break-words text-2xl font-semibold text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  )
}

function UserRankingTable({
  period,
  users,
}: {
  period: EmbyWatchRankingPeriod
  users: EmbyUserWatchRankingItem[]
}) {
  const maxWatchSeconds = Math.max(1, ...users.map((user) => user.watch_seconds))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="pb-3 pr-3 font-semibold">Rank</th>
            <th className="pb-3 pr-4 font-semibold">User</th>
            <th className="pb-3 pr-4 font-semibold">Watch Time</th>
            <th className="pb-3 pr-4 font-semibold">Play Counts</th>
            <th className="pb-3 pr-4 font-semibold">Last Seen Time</th>
            <th className="pb-3 font-semibold">Last Seen Content</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user, index) => {
            const { title, episodeLabel } = splitEpisodeLabel(
              user.last_item_name,
            )

            return (
              <tr
                className="transition-colors hover:bg-slate-50/80"
                key={user.emby_user_id}
              >
                <td className="py-4 pr-3 font-medium text-slate-400">
                  {user.rank}
                </td>
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                        getAvatarTone(index),
                      )}
                    >
                      {getInitials(user.user_name)}
                    </div>
                    <span className="font-semibold text-slate-950">
                      {user.user_name}
                    </span>
                  </div>
                </td>
                <td className="py-4 pr-4 font-semibold text-slate-950">
                  <span className="whitespace-nowrap">{formatCompactDuration(user.watch_seconds)}</span>
                  <div aria-hidden="true" className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, user.watch_seconds / maxWatchSeconds * 100))}%` }} />
                  </div>
                </td>
                <td className="py-4 pr-4 text-slate-500">
                  {user.play_count} 次
                </td>
                <td className="py-4 pr-4 text-slate-500">
                  {period === 'month'
                    ? formatDateTime(user.last_watched_at)
                    : formatTime(user.last_watched_at)}
                </td>
                <td className="max-w-[240px] py-4 text-slate-500">
                  <div
                    className="flex min-w-0 items-center gap-2"
                    title={user.last_item_name ?? undefined}
                  >
                    <span className="min-w-0 truncate">{title}</span>
                    {episodeLabel ? (
                      <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                        {episodeLabel}
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MediaRankingCard({
  title,
  items,
}: {
  title: string
  items: EmbyMediaWatchRankingItem[]
}) {
  const maxWatchSeconds = Math.max(1, ...items.map((item) => item.watch_seconds))

  return (
    <div className="min-w-0 rounded-2xl bg-white p-6 shadow-shell ring-1 ring-slate-200">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <ol className="mt-5 divide-y divide-slate-100">
        {items.map((item) => (
          <li className="flex items-start gap-3 py-4" key={item.media_id}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-500">
              {item.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950" title={item.title}>{item.title}</p>
              <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-slate-500">
                <span>{item.play_count} 次播放</span>
                <span>{formatCompactDuration(item.watch_seconds)}</span>
              </div>
              <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, item.watch_seconds / maxWatchSeconds * 100))}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-shell ring-1 ring-slate-200">
      {message}
    </div>
  )
}

function TerminalEventLine({ event }: { event: EmbyWebhookRecentEvent }) {
  const isStop = event.event === 'playback.stop'

  return (
    <div className="mb-1">
      <span className="text-slate-500">[{formatTerminalTime(event.event_time)}]</span>{' '}
      <span className="text-emerald-300">收到</span>{' '}
      <span className="text-sky-300">{event.event}</span> 事件 -{' '}
      <span className="text-sky-200">用户:</span> {event.user_name},{' '}
      <span className="text-sky-200">内容:</span> {event.item_name}
      {isStop && event.watch_seconds !== null ? (
        <>
          , <span className="text-sky-200">时长:</span>{' '}
          {formatCompactDuration(event.watch_seconds)}
        </>
      ) : null}
    </div>
  )
}

function WebhookMonitor({ data }: { data: EmbyWatchRankingData }) {
  const events = data.webhook_status.recent_events

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0D1117] shadow-shell ring-1 ring-[#30363D]">
      <div className="flex items-center gap-2 bg-[#161B22] px-4 py-2 text-[#8B949E]">
        <Terminal className="h-4 w-4" />
        <span className="text-xs font-semibold">
          Webhooks 实时监控
        </span>
        <div className="ml-auto flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ED6A5E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#F4BF4F]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#61C554]" />
        </div>
      </div>
      <div className="task-log-scrollbar h-[200px] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed text-[#C9D1D9]">
        <div className="mb-1">
          <span className="text-slate-500">[status]</span>{' '}
          <span className="text-sky-300">INFO</span> secret{' '}
          {data.webhook_status.secret_configured ? 'configured' : 'missing'},
          tracked sessions: {data.webhook_status.active_session_count}
        </div>
        {events.length > 0 ? (
          events.map((event, index) => (
            <TerminalEventLine
              event={event}
              key={`${event.event}-${event.event_time ?? index}-${event.item_name}`}
            />
          ))
        ) : (
          <div className="mt-2 text-slate-500">
            Waiting for incoming events...
          </div>
        )}
      </div>
    </div>
  )
}

export function WatchStatisticsPanel() {
  const [period, setPeriod] = useState<EmbyWatchRankingPeriod>('day')
  const [date, setDate] = useState(getTodayDateInput)
  const [month, setMonth] = useState(getCurrentMonthInput)
  const [limitDraft, setLimitDraft] = useState(String(DEFAULT_LIMIT))
  const [data, setData] = useState<EmbyWatchRankingData | null>(null)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const limit = useMemo(() => parseLimit(limitDraft), [limitDraft])

  const loadRankings = useCallback(
    async (signal?: AbortSignal) => {
      setStatus('loading')
      setErrorMessage(null)

      try {
        const rankingData = await getEmbyWatchRankings(
          period === 'month'
            ? { period, month, limit }
            : { period, date, limit },
          signal,
        )
        if (signal?.aborted) return
        setData(rankingData)
        setStatus('success')
      } catch (error) {
        if (signal?.aborted || isJavaRequestCanceledError(error)) {
          return
        }
        setStatus('error')
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Emby 观看统计加载失败，请稍后重试。',
        )
      }
    },
    [date, limit, month, period],
  )

  const handlePeriodChange = (nextPeriod: EmbyWatchRankingPeriod) => {
    if (nextPeriod === period) {
      return
    }
    if (nextPeriod === 'month' && period === 'day') {
      setMonth(date.slice(0, 7))
    }
    setPeriod(nextPeriod)
  }

  useEffect(() => {
    const controller = new AbortController()
    void loadRankings(controller.signal)

    return () => controller.abort()
  }, [loadRankings, refreshIndex])

  return (
    <section aria-labelledby="watch-statistics-title" aria-busy={status === 'loading'} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950" id="watch-statistics-title">观看统计</h2>
          <p className="mt-1 text-sm text-slate-500">Emby 观看活跃与排行统计</p>
        </div>
        {data ? <span className="text-xs text-slate-500">{data.period === 'month' ? data.month : data.date} · {data.timezone}</span> : null}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-shell ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold text-slate-500 md:w-[180px]">
          <button
            className={cn(
              'h-9 rounded-lg transition-colors',
              period === 'day'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'hover:text-slate-700',
            )}
            aria-pressed={period === 'day'}
            onClick={() => handlePeriodChange('day')}
            type="button"
          >
            按日
          </button>
          <button
            className={cn(
              'h-9 rounded-lg transition-colors',
              period === 'month'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'hover:text-slate-700',
            )}
            aria-pressed={period === 'month'}
            onClick={() => handlePeriodChange('month')}
            type="button"
          >
            按月
          </button>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {period === 'month' ? (
            <DateControl
              aria-label="统计月份"
              icon={<CalendarRange className="h-4 w-4" />}
              onChange={(event) => setMonth(event.target.value)}
              type="month"
              value={month}
              wrapperClassName="w-full md:w-auto"
              className="min-w-[9.5rem] bg-slate-50 shadow-none"
            />
          ) : (
            <DateControl
              aria-label="统计日期"
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
              wrapperClassName="w-full md:w-auto"
              className="min-w-[9.5rem] bg-slate-50 shadow-none"
            />
          )}
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <Hash className="h-4 w-4 text-slate-400" />
            <input
              className="w-16 bg-transparent text-center font-medium text-slate-950 outline-none"
              aria-label="排行数量"
              min="1"
              onChange={(event) => setLimitDraft(event.target.value)}
              type="number"
              value={limitDraft}
            />
          </label>
          <Button
            className="h-10"
            disabled={status === 'loading'}
            onClick={() => setRefreshIndex((value) => value + 1)}
            type="button"
            variant="outline"
          >
            <RefreshCw className={cn('h-4 w-4', status === 'loading' && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </div>

      {status === 'loading' && !data ? (
        <div className="flex items-center justify-center rounded-2xl bg-white p-12 text-sm text-slate-500 shadow-shell ring-1 ring-slate-200">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在加载 Emby 观看统计...
        </div>
      ) : null}

      {status === 'error' ? (
        <div
          className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-100"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-5">
          <SummaryPanel data={data} />
          <div className="space-y-5">
            <div className="rounded-2xl bg-white p-6 shadow-shell ring-1 ring-slate-200">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">
                    用户观看排行
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    根据已结束播放会话统计，正在播放中的会话会在停止后入账。
                  </p>
                </div>
                {status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : null}
              </div>
              {data.users.length > 0 ? (
                <UserRankingTable period={data.period} users={data.users} />
              ) : (
                <EmptyPanel
                  message={`${
                    data.period === 'month' ? '当月' : '当天'
                  }还没有有效用户观看记录。`}
                />
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {data.movies.length > 0 ? (
                <MediaRankingCard items={data.movies} title="电影排行" />
              ) : (
                <EmptyPanel
                  message={`${
                    data.period === 'month' ? '当月' : '当天'
                  }还没有电影观看记录。`}
                />
              )}
              {data.series.length > 0 ? (
                <MediaRankingCard items={data.series} title="电视剧/番剧排行" />
              ) : (
                <EmptyPanel
                  message={`${
                    data.period === 'month' ? '当月' : '当天'
                  }还没有剧集观看记录。`}
                />
              )}
            </div>
          </div>

          <details className="rounded-2xl bg-white shadow-shell ring-1 ring-slate-200">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-700 focus-visible:outline-emerald-600">
              Webhooks 实时监控
            </summary>
            <div className="px-5 pb-5"><WebhookMonitor data={data} /></div>
          </details>
        </div>
      ) : null}

      {data ? (
        <footer className="text-right text-xs text-slate-400">
          最近观看 {formatDateTime(data.summary.last_watched_at)} · 数据每次播放停止后更新 · Generated at {formatDateTime(data.generated_at)}
        </footer>
      ) : null}
    </section>
  )
}
