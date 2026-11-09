import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getBgmSeasons, searchBgmCatalog } from '@/lib/api/bgm-wishlist'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import type { BgmCatalogCandidate } from '@/types/bgm-wishlist'

type DirectoryChoice = { kind: 'movie' | 'series'; tmdbId: number; season: number | null }

export function BgmDirectoryPicker({ seriesLabel = '剧集型动漫', title, onClose, onChoose, saving }: {
  seriesLabel?: string
  title: string
  onClose: () => void
  onChoose: (choice: DirectoryChoice) => void
  saving: boolean
}) {
  const [kind, setKind] = useState<'movie' | 'series'>('series')
  const [query, setQuery] = useState(title)
  const [items, setItems] = useState<BgmCatalogCandidate[]>([])
  const [selected, setSelected] = useState<BgmCatalogCandidate | null>(null)
  const [seasons, setSeasons] = useState<number[]>([])
  const [season, setSeason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchController = useRef<AbortController | null>(null)

  useEffect(() => () => searchController.current?.abort(), [])

  useEffect(() => {
    if (!selected?.tmdbId || kind !== 'series') return
    const controller = new AbortController()
    setSeasons([])
    setSeason('')
    setError(null)
    setLoading(true)
    getBgmSeasons(selected.tmdbId, controller.signal).then((result) => {
      setSeasons(result.map((entry) => entry.seasonNumber))
    }).catch((caught) => {
      if (!isJavaRequestCanceledError(caught)) setError(caught instanceof Error ? caught.message : '季度读取失败')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [kind, selected])

  async function search() {
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    setLoading(true)
    setError(null)
    setSelected(null)
    try {
      const results = await searchBgmCatalog(query, controller.signal)
      if (!controller.signal.aborted) setItems(results.filter((item) => item.mediaType === (kind === 'movie' ? 'MOVIE' : 'SERIES')))
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : '目录搜索失败')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200" aria-label={`纠正 ${title} 的目录匹配`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">选择真实目录 · {title}</h3><Button type="button" size="sm" variant="outline" onClick={onClose}>关闭</Button></div>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="text-sm">类型 <select className="rounded-lg border border-slate-200 p-2" value={kind} onChange={(e) => { searchController.current?.abort(); setLoading(false); setKind(e.target.value as 'movie' | 'series'); setItems([]); setSelected(null) }}><option value="series">{seriesLabel}</option><option value="movie">电影</option></select></label>
        <label className="text-sm">目录名称 <input className="rounded-lg border border-slate-200 p-2" value={query} onChange={(e) => { searchController.current?.abort(); setLoading(false); setItems([]); setSelected(null); setQuery(e.target.value) }} /></label>
        <Button type="button" variant="outline" disabled={!query.trim() || loading} onClick={() => void search()}>搜索目录</Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-3 max-h-56 space-y-2 overflow-auto">{items.map((item) => <button type="button" key={item.tmdbId} onClick={() => setSelected(item)} className={`block w-full rounded-lg border p-3 text-left text-sm ${selected?.tmdbId === item.tmdbId ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>{item.title} · {item.year ?? '年份未知'} · TMDB {item.tmdbId}</button>)}</div>
      {selected && kind === 'series' && <label className="mt-3 block text-sm">目标季度 <select className="rounded-lg border border-slate-200 p-2" value={season} onChange={(e) => setSeason(e.target.value)}><option value="">请选择季度</option>{seasons.map((n) => <option key={n} value={n}>第 {n} 季</option>)}</select></label>}
      <Button className="mt-4" type="button" disabled={saving || loading || !selected?.tmdbId || (kind === 'series' && season === '')} onClick={() => { if (selected?.tmdbId) onChoose({ kind, tmdbId: selected.tmdbId, season: kind === 'series' ? Number(season) : null }) }}>保存匹配并重新检查</Button>
    </section>
  )
}
