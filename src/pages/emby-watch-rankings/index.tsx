import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CalendarRange,
  Hash,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { getEmbyWatchRankings } from '@/lib/api/emby-watch-rankings'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { useAuth } from '@/lib/use-auth'
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

function ForbiddenWatchRankingsPage() {
  const navigate = useNavigate()

  return (
    <PageContainer
      title="无权限"
      description="Emby 观看活跃与排行统计仅管理员可见。"
    >
      <div className="rounded-2xl bg-white p-8 shadow-shell ring-1 ring-slate-200">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-slate-950">
                你没有访问观看统计的权限
              </p>
              <p className="mt-1 text-sm text-slate-500">
                该页面用于管理员查看 Emby 使用活跃情况。
              </p>
            </div>
            <Button onClick={() => navigate('/resources')} type="button">
              返回资源搜索
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

function SummaryPanel({ data }: { data: EmbyWatchRankingData }) {
  const summaryLabel = data.period === 'month' ? '月统计概览' : '日统计概览'

  return (
    <div className="rounded-2xl bg-white p-6 shadow-shell ring-1 ring-slate-200">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-slate-400">
          {summaryLabel}
        </p>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.6875rem] font-semibold text-slate-500">
          {data.timezone}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <p className="text-xs text-slate-500">活跃用户</p>
          <p className="mt-1 text-3xl font-semibold text-slate-950">
            {data.summary.active_user_count}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">播放次数</p>
          <p className="mt-1 text-3xl font-semibold text-slate-950">
            {data.summary.total_play_count}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-slate-500">总观看时长</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {formatDuration(data.summary.total_watch_seconds)}
          </p>
        </div>
        <div className="col-span-2 rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">最近观看</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatDateTime(data.summary.last_watched_at)}
          </p>
        </div>
      </div>
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
          {users.map((user, index) => (
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
                {formatCompactDuration(user.watch_seconds)}
              </td>
              <td className="py-4 pr-4 text-slate-500">
                {user.play_count} 次
              </td>
              <td className="py-4 pr-4 text-slate-500">
                {period === 'month'
                  ? formatDateTime(user.last_watched_at)
                  : formatTime(user.last_watched_at)}
              </td>
              <td className="max-w-[240px] truncate py-4 text-slate-500">
                {user.last_item_name ?? '-'}
              </td>
            </tr>
          ))}
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
  return (
    <div className="rounded-2xl bg-white p-6 shadow-shell ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="pb-3 pr-3 font-semibold">Rank</th>
              <th className="pb-3 pr-3 font-semibold">Title</th>
              <th className="pb-3 text-right font-semibold">Watch Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr
                className="transition-colors hover:bg-slate-50/80"
                key={item.media_id}
              >
                <td className="py-3 pr-3 font-medium text-slate-400">
                  {item.rank}
                </td>
                <td className="max-w-[220px] truncate py-3 pr-3 font-semibold text-slate-950">
                  {item.title}
                </td>
                <td className="py-3 text-right font-semibold text-slate-950">
                  {formatCompactDuration(item.watch_seconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function EmbyWatchRankingPageContent() {
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
        setData(rankingData)
        setStatus('success')
      } catch (error) {
        if (isJavaRequestCanceledError(error)) {
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
    <PageContainer
      title="Emby 观看活跃与排行统计"
      description="查看朋友们是否在使用媒体服务，以及按天或按月聚合的用户和作品观看排行。"
    >
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-shell ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold text-slate-500 md:w-[180px]">
          <button
            className={cn(
              'h-9 rounded-lg transition-colors',
              period === 'day'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'hover:text-slate-700',
            )}
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
            onClick={() => handlePeriodChange('month')}
            type="button"
          >
            按月
          </button>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {period === 'month' ? (
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <CalendarRange className="h-4 w-4 text-slate-400" />
              <input
                className="bg-transparent font-medium text-slate-950 outline-none"
                onChange={(event) => setMonth(event.target.value)}
                type="month"
                value={month}
              />
            </label>
          ) : (
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <input
                className="bg-transparent font-medium text-slate-950 outline-none"
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
            </label>
          )}
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <Hash className="h-4 w-4 text-slate-400" />
            <input
              className="w-16 bg-transparent text-center font-medium text-slate-950 outline-none"
              min="1"
              onChange={(event) => setLimitDraft(event.target.value)}
              type="number"
              value={limitDraft}
            />
          </label>
          <Button
            className="h-10"
            onClick={() => setRefreshIndex((value) => value + 1)}
            type="button"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
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
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          <div className="space-y-8 xl:col-span-8">
            <div className="rounded-2xl bg-white p-6 shadow-shell ring-1 ring-slate-200">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    用户观看排行
                  </h2>
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

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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

          <div className="space-y-8 xl:col-span-4">
            <SummaryPanel data={data} />
            <WebhookMonitor data={data} />
            <div className="relative overflow-hidden rounded-2xl bg-slate-100 p-5 ring-1 ring-slate-200">
              <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-slate-950/5 blur-xl" />
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Lightbulb className="h-4 w-4" />
                Pro Tip
              </h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                排行数据基于 Emby Webhooks 实时入库。配置
                playback.start 与 playback.stop 后，观看时长会在停止播放时更新。
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {data ? (
        <footer className="text-right text-xs text-slate-400">
          数据每次播放停止后更新 · Generated at {formatDateTime(data.generated_at)}
        </footer>
      ) : null}
    </PageContainer>
  )
}

export function EmbyWatchRankingsPage() {
  const { user } = useAuth()

  if (user?.role !== 'ADMIN') {
    return <ForbiddenWatchRankingsPage />
  }

  return <EmbyWatchRankingPageContent />
}
