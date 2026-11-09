import { useState, type ReactNode } from 'react'

export function BgmPoster({ url, title, fallback }: { url: string | null; title: string; fallback?: ReactNode }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-100">
      {url && url !== failedUrl ? (
        <img src={url} alt={`${title} 海报`} loading="lazy" className="h-full w-full object-cover" onError={() => setFailedUrl(url)} />
      ) : (
        fallback ?? <div className="flex h-full items-center justify-center p-3 text-center text-sm text-slate-500">{title}<br />暂无封面</div>
      )}
    </div>
  )
}
