import { useCallback, useEffect, useRef, useState } from 'react'
import { Film, Monitor, Pause, Play, RefreshCw, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getEmbyPlaybackSessions } from '@/lib/api/emby-playback-sessions'
import { getMediaLibraryPoster } from '@/lib/api/media-library'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type {
  EmbyPlaybackSession,
  EmbyPlaybackSnapshot,
} from '@/types/emby-playback-sessions'

function formatTime(seconds: number | null) {
  if (seconds === null) return null
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = String(Math.floor(whole / 60) % 60).padStart(2, '0')
  const remainder = String(whole % 60).padStart(2, '0')
  return whole >= 3600
    ? `${String(Math.floor(whole / 3600)).padStart(2, '0')}:${minutes}:${remainder}`
    : `${minutes}:${remainder}`
}

function SessionPoster({ session }: { session: EmbyPlaybackSession }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  // Stable across polling responses; a changed image version reloads the authenticated blob.
  const candidates = JSON.stringify(session.posters)
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null
    setUrl(null)
    setFailed(false)
    async function load() {
      const posters: EmbyPlaybackSession['posters'] = JSON.parse(candidates)
      for (const poster of posters) {
        try {
          const blob = await getMediaLibraryPoster(
            poster.itemId,
            controller.signal,
            poster.imageTag,
          )
          if (controller.signal.aborted) return
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
          return
        } catch {
          if (controller.signal.aborted) return
        }
      }
    }
    void load()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [candidates])
  return (
    <div className="h-44 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-200 sm:h-48 sm:w-32">
      {url && !failed ? (
        <img
          src={url}
          alt={`${session.seriesName || session.title || '媒体'}海报`}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-800 to-slate-600 px-2 text-center text-white">
          <Film className="h-6 w-6 opacity-70" />
          <span className="text-xs">封面暂缺</span>
        </div>
      )}
    </div>
  )
}

export function LiveWatchingPanel() {
  const [snapshot, setSnapshot] = useState<EmbyPlaybackSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(true)
  const pending = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    if (pending.current || document.visibilityState !== 'visible') return
    const controller = new AbortController()
    pending.current = controller
    setLoading(true)
    try {
      const next = await getEmbyPlaybackSessions(controller.signal)
      if (controller.signal.aborted) return
      setSnapshot(next)
      setError(null)
      setStale(false)
    } catch (failure) {
      if (!controller.signal.aborted && !isJavaRequestCanceledError(failure)) {
        setError(
          failure instanceof Error ? failure.message : '实时观看刷新失败',
        )
        setStale(true)
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    function visibilityChanged() {
      if (document.visibilityState === 'visible') void load()
      else {
        pending.current?.abort()
        pending.current = null
        setLoading(false)
        setStale(true)
      }
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibilityChanged)
      pending.current?.abort()
      pending.current = null
    }
  }, [load])

  const sessions = snapshot?.sessions ?? []
  const playing = sessions.filter((session) => session.paused === false).length
  const paused = sessions.filter((session) => session.paused === true).length
  return (
    <section aria-labelledby="live-watching-title" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="live-watching-title"
            className="text-xl font-semibold tracking-tight text-slate-950"
          >
            实时观看
          </h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {snapshot
              ? `${sessions.length} 个播放会话 · ${playing} 播放中 · ${paused} 已暂停`
              : '正在获取播放会话'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          {loading ? '刷新中' : '刷新'}
        </Button>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
        <span>
          {snapshot
            ? `${stale ? '上次快照' : '采集时间'} · ${new Date(snapshot.collectedAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`
            : '尚无成功快照'}
        </span>
        <span>页面可见时每 5 秒刷新</span>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
        >
          {error}。
          {snapshot
            ? '保留上次快照，以下内容不代表当前播放状态。'
            : '暂时无法确认当前播放情况。'}
        </div>
      )}
      {!error && stale && snapshot && (
        <p role="status" className="text-sm text-amber-800">
          正在更新上次快照，以下内容不代表当前播放状态。
        </p>
      )}
      {!snapshot ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {error ? '无法获取播放会话，请重试' : '加载播放会话…'}
        </div>
      ) : !sessions.length ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center">
          <Users className="h-8 w-8 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-800">
            {stale ? '上次快照没有播放会话' : '当前没有播放会话'}
          </h3>
          <p className="text-sm text-slate-500">
            这里会展示正在播放或已暂停的视频会话。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {sessions.map((session) => {
            const percent =
              session.durationSeconds !== null &&
              session.durationSeconds > 0 &&
              session.positionSeconds !== null
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      (session.positionSeconds / session.durationSeconds) * 100,
                    ),
                  )
                : null
            const title = session.seriesName || session.title || '标题未知'
            const episode =
              session.type === 'Episode'
                ? `${session.seasonNumber === null ? '季数未知' : `第 ${session.seasonNumber} 季`} · ${session.episodeNumber === null ? '集数未知' : `第 ${session.episodeNumber}${session.episodeNumberEnd !== null && session.episodeNumberEnd !== session.episodeNumber ? `–${session.episodeNumberEnd}` : ''} 集`}`
                : session.type === 'Movie'
                  ? '电影'
                  : '视频'
            return (
              <article
                key={session.id}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <SessionPoster session={session} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {session.userName || '用户未知'}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                        stale || session.paused === null
                          ? 'bg-slate-100 text-slate-600'
                          : session.paused
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700',
                      )}
                    >
                      {session.paused === null ? (
                        <Monitor className="h-3 w-3" />
                      ) : session.paused ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      {stale
                        ? '上次快照'
                        : session.paused === null
                          ? '状态未知'
                          : session.paused
                            ? '已暂停'
                            : '播放中'}
                    </span>
                  </div>
                  <p className="mt-2 flex items-start gap-1 text-xs text-slate-500">
                    <Monitor className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="break-words">
                      {session.deviceName || '设备未知'} ·{' '}
                      {session.client || '客户端未知'}
                    </span>
                  </p>
                  <h3 className="mt-4 break-words text-base font-semibold text-slate-950">
                    {title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">{episode}</p>
                  <div className="mt-auto space-y-2 pt-4">
                    <p className="break-words font-mono text-sm font-semibold tabular-nums text-slate-950">
                      {formatTime(session.positionSeconds) ?? '位置未知'}{' '}
                      <span className="font-normal text-slate-500">
                        / {formatTime(session.durationSeconds) ?? '总时长未知'}
                      </span>
                    </p>
                    {percent !== null && (
                      <div
                        role="progressbar"
                        aria-label={`${session.userName || '用户'}在${session.deviceName || '设备'}观看${title}的进度`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.floor(percent)}
                        aria-valuetext={`${formatTime(session.positionSeconds)}，总时长 ${formatTime(session.durationSeconds)}`}
                        className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                      >
                        <div
                          className={cn(
                            'h-full rounded-full',
                            session.paused ? 'bg-amber-500' : 'bg-emerald-600',
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-slate-500">
                      播放位置 / 总时长
                      {percent !== null ? ` · ${Math.floor(percent)}%` : ''}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <p className="text-xs leading-5 text-slate-500">
        播放信息以 Emby 和客户端上报为准；未上报的外部播放器不会出现在这里。
      </p>
    </section>
  )
}
