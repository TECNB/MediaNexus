import { useEffect, useState } from 'react'
import { getPrivateWatchTitles } from '@/lib/api/emby-watch-rankings'
import { isJavaRequestCanceledError } from '@/lib/java-api'

export function useWatchQuery<T>(load: (signal: AbortSignal) => Promise<T>, enabled = true, refresh = 0) {
  const [result, setResult] = useState<{ owner: typeof load; data: T } | null>(null)
  const [failure, setFailure] = useState<{ owner: typeof load; message: string } | null>(null)
  const [retryIndex, setRetryIndex] = useState(0)
  const [loading, setLoading] = useState(enabled)
  useEffect(() => {
    if (!enabled) return
    let pending: AbortController | null = null
    async function read() {
      if (pending || document.visibilityState !== 'visible') return
      const controller = new AbortController()
      pending = controller
      setLoading(true)
      try {
        const data = await load(controller.signal)
        if (controller.signal.aborted) return
        setResult({ owner: load, data })
        setFailure(null)
      } catch (error) {
        if (controller.signal.aborted || isJavaRequestCanceledError(error)) return
        setFailure({ owner: load, message: error instanceof Error ? error.message : '观看记录加载失败。' })
      } finally {
        if (pending === controller) {
          pending = null
          setLoading(false)
        }
      }
    }
    function visibilityChanged() {
      if (document.visibilityState === 'visible') void read()
      else {
        pending?.abort()
        pending = null
        setLoading(false)
      }
    }
    void read()
    const timer = window.setInterval(() => void read(), 5000)
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibilityChanged)
      pending?.abort()
    }
  }, [load, enabled, retryIndex, refresh])
  return {
    data: result?.owner === load ? result.data : null,
    error: failure?.owner === load ? failure.message : null,
    loading: enabled && result?.owner !== load && (loading || failure?.owner !== load),
    retry: () => setRetryIndex(index => index + 1),
  }
}

export function usePrivateWatchTitles(ids: string[], reveal: boolean) {
  const key = [...new Set(ids)].sort().join(',')
  const [titles, setTitles] = useState<{ key: string; entries: Record<string, string | null> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setTitles(null)
    setError(null)
    if (reveal && key) {
      void getPrivateWatchTitles(key.split(','), controller.signal).then(items => {
        if (!controller.signal.aborted) setTitles({ key, entries: Object.fromEntries(items.map(item => [item.item_id, item.title])) })
      }).catch(cause => {
        if (!controller.signal.aborted && !isJavaRequestCanceledError(cause)) setError(cause instanceof Error ? cause.message : '私密片名加载失败。')
      })
    }
    return () => controller.abort()
  }, [key, reveal])
  return { titles: reveal && titles?.key === key ? titles.entries : {}, error: reveal ? error : null }
}
