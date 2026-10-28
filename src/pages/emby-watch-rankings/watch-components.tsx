import { useEffect, useState } from 'react'
import { Film, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMediaLibraryPoster } from '@/lib/api/media-library'
import { isJavaRequestCanceledError } from '@/lib/java-api'

export function WatchPoster({ category, itemId, title }: { category: string; itemId: string | null; title: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const allowed = category === 'movie' || category === 'series'
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null
    setUrl(null)
    setFailed(false)
    if (allowed && itemId) {
      void getMediaLibraryPoster(itemId, controller.signal).then(blob => {
        if (controller.signal.aborted) return
        if (!blob.size) { setFailed(true); return }
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      }).catch(error => {
        if (!controller.signal.aborted && !isJavaRequestCanceledError(error)) setFailed(true)
      })
    }
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [allowed, itemId])
  return <div className="flex h-[72px] w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
    {!allowed ? <ShieldCheck aria-label={category === 'adult' ? '私密观看，无海报' : '分类待确认，无海报'} className="h-5 w-5" /> : url && !failed ? <img alt={`${title} 海报`} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} src={url} /> : <Film aria-label="暂无海报" className="h-5 w-5" />}
  </div>
}

export function WatchLoading() {
  return <p className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500" role="status"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />正在加载观看记录…</p>
}

export function WatchError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700" role="alert"><span>{message}</span><Button onClick={retry} size="sm" type="button" variant="outline">重试</Button></div>
}

export function WatchPagination({ page, pageSize, total, loading, onPage }: { page: number; pageSize: number; total: number; loading: boolean; onPage: (page: number) => void }) {
  if (total <= pageSize && page <= 1) return null
  return <nav aria-label="观看记录分页" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-1 pt-4 text-xs text-slate-500">
    <span>第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页 · 共 {total} 条</span><div className="flex gap-2"><Button disabled={loading || page <= 1} onClick={() => onPage(page - 1)} size="sm" type="button" variant="outline">上一页</Button><Button disabled={loading || page * pageSize >= total} onClick={() => onPage(page + 1)} size="sm" type="button" variant="outline">下一页</Button></div>
  </nav>
}
