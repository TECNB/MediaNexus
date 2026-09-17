import { FormEvent, useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, ScanSearch, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  applyMediaMetadata,
  getMediaCandidateImage,
  getMediaPosterCandidates,
  searchMediaMetadata,
  selectMediaPoster,
} from '@/lib/api/media-library'
import { getJavaErrorMessage, isJavaRequestCanceledError } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type {
  MediaIdentifyQuery,
  MediaLibraryId,
  MediaLibraryItem,
  MediaMetadataCandidate,
  MediaPosterCandidate,
} from '@/types/media-library'

type ManagerMode = 'identify' | 'poster'

function CandidateImage({
  candidateId,
  itemId,
  mode,
  query,
  title,
}: {
  candidateId: string
  itemId: string
  mode: ManagerMode
  query: MediaIdentifyQuery
  title: string
}) {
  const [source, setSource] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const library = query.library
  const searchQuery = query.query
  const searchYear = query.year

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null
    setSource(null)
    setFailed(false)
    void getMediaCandidateImage(
      itemId,
      candidateId,
      mode,
      { library, query: searchQuery, year: searchYear },
      controller.signal,
    )
      .then((blob) => {
        if (!controller.signal.aborted && blob.size > 0) {
          objectUrl = URL.createObjectURL(blob)
          setSource(objectUrl)
        }
      })
      .catch((error: unknown) => {
        if (!isJavaRequestCanceledError(error)) setFailed(true)
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [candidateId, itemId, library, mode, searchQuery, searchYear])

  if (!source) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
        {failed ? <ImageIcon className="h-6 w-6" /> : <Loader2 className="h-5 w-5 animate-spin" />}
      </div>
    )
  }
  return <img alt={title + ' 候选封面'} className="h-full w-full object-cover" src={source} />
}

export function MediaManager({
  item,
  library,
  onChanged,
}: {
  item: MediaLibraryItem
  library: MediaLibraryId
  onChanged: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<ManagerMode>('identify')
  const [queryText, setQueryText] = useState(item.title.replace(/\s*\(\d{4}\)\s*$/, ''))
  const [yearText, setYearText] = useState('')
  const [identifyQuery, setIdentifyQuery] = useState<MediaIdentifyQuery | null>(null)
  const [metadata, setMetadata] = useState<MediaMetadataCandidate[]>([])
  const [posters, setPosters] = useState<MediaPosterCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replaceImages, setReplaceImages] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function open(nextMode: ManagerMode) {
    setMode(nextMode)
    setError(null)
    dialogRef.current?.showModal()
    if (nextMode === 'poster' && posters.length === 0) void loadPosters()
  }

  async function loadPosters() {
    setLoading(true)
    setError(null)
    try {
      setPosters(await getMediaPosterCandidates(item.item_id, library))
    } catch (nextError) {
      setError(getJavaErrorMessage(nextError) || '候选封面加载失败。')
    } finally {
      setLoading(false)
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = queryText.trim()
    if (!title) return
    const year = yearText.trim() ? Number(yearText) : undefined
    const nextQuery = { library, query: title, year }
    setLoading(true)
    setError(null)
    try {
      setMetadata(await searchMediaMetadata(item.item_id, nextQuery))
      setIdentifyQuery(nextQuery)
    } catch (nextError) {
      setError(getJavaErrorMessage(nextError) || '识别候选加载失败。')
    } finally {
      setLoading(false)
    }
  }

  async function applyCandidate(candidate: MediaMetadataCandidate) {
    if (!identifyQuery || !window.confirm(
      '确认将《' + item.title + '》重新识别为《' + candidate.name + '》吗？这会更新作品 ID 和元数据。',
    )) return
    setSaving(true)
    setError(null)
    try {
      await applyMediaMetadata(item.item_id, identifyQuery, candidate.candidate_id, replaceImages)
      dialogRef.current?.close()
      onChanged()
    } catch (nextError) {
      setError(getJavaErrorMessage(nextError) || '重新识别失败。')
    } finally {
      setSaving(false)
    }
  }

  async function applyPoster(candidate: MediaPosterCandidate) {
    if (!window.confirm('确认使用这张 ' + candidate.provider_name + ' 封面吗？只会替换主封面。')) return
    setSaving(true)
    setError(null)
    try {
      await selectMediaPoster(item.item_id, library, candidate.candidate_id)
      dialogRef.current?.close()
      onChanged()
    } catch (nextError) {
      setError(getJavaErrorMessage(nextError) || '封面替换失败。')
    } finally {
      setSaving(false)
    }
  }

  const imageQuery = identifyQuery ?? { library, query: queryText.trim() }

  return (
    <>
      <div className="grid gap-2">
        <Button onClick={() => open('identify')} size="sm" type="button" variant="outline">
          <ScanSearch aria-hidden="true" className="h-4 w-4" />纠正识别
        </Button>
        <Button onClick={() => open('poster')} size="sm" type="button" variant="outline">
          <ImageIcon aria-hidden="true" className="h-4 w-4" />更换封面
        </Button>
      </div>

      <dialog
        aria-labelledby={'media-manager-title-' + item.item_id}
        className="m-auto max-h-[90vh] w-[min(68rem,calc(100%-2rem))] overflow-hidden rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/55"
        onCancel={(event) => { if (saving) event.preventDefault() }}
        ref={dialogRef}
      >
        <div className="flex max-h-[90vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold" id={'media-manager-title-' + item.item_id}>管理《{item.title}》</h2>
              <p className="mt-1 text-sm text-slate-500">纠正作品身份，或只替换当前主封面。</p>
            </div>
            <button
              aria-label="关闭媒体管理"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400"
              disabled={saving}
              onClick={() => dialogRef.current?.close()}
              type="button"
            ><X className="h-5 w-5" /></button>
          </header>

          <div className="grid grid-cols-2 gap-1 border-b border-slate-200 bg-slate-50 p-2" role="tablist">
            {(['identify', 'poster'] as const).map((value) => (
              <button
                aria-selected={mode === value}
                className={cn('min-h-11 rounded-xl px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-slate-400',
                  mode === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
                key={value}
                onClick={() => {
                  setMode(value)
                  setError(null)
                  if (value === 'poster' && posters.length === 0) void loadPosters()
                }}
                role="tab"
                type="button"
              >{value === 'identify' ? '纠正识别' : '更换封面'}</button>
            ))}
          </div>

          <div className="overflow-y-auto p-5 sm:p-6">
            {mode === 'identify' ? (
              <div className="space-y-5">
                <form className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]" onSubmit={search}>
                  <label className="space-y-1 text-sm font-medium">作品名称
                    <input className="h-11 w-full rounded-xl border border-slate-300 px-3 font-normal focus:border-slate-500 focus:ring-2 focus:ring-slate-200" onChange={(event) => setQueryText(event.target.value)} value={queryText} />
                  </label>
                  <label className="space-y-1 text-sm font-medium">年份（可选）
                    <input className="h-11 w-full rounded-xl border border-slate-300 px-3 font-normal focus:border-slate-500 focus:ring-2 focus:ring-slate-200" min="1800" max="3000" onChange={(event) => setYearText(event.target.value)} placeholder={item.year?.toString() ?? '例如 2018'} type="number" value={yearText} />
                  </label>
                  <Button className="self-end" disabled={loading || !queryText.trim()} type="submit">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}搜索
                  </Button>
                </form>
                <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <input checked={replaceImages} className="mt-1 h-4 w-4" onChange={(event) => setReplaceImages(event.target.checked)} type="checkbox" />
                  <span><strong>同时替换所有图片</strong><br /><span className="text-amber-800">默认关闭；开启后会删除现有自定义图片并由 Emby 重新下载。</span></span>
                </label>
                {identifyQuery && metadata.length === 0 && !loading ? <p className="py-8 text-center text-sm text-slate-500">没有找到候选，请尝试去掉年份或使用原名。</p> : null}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {metadata.map((candidate) => (
                    <article className="overflow-hidden rounded-2xl border border-slate-200" key={candidate.candidate_id}>
                      <div className="aspect-[2/3] bg-slate-100">
                        {candidate.has_image ? <CandidateImage candidateId={candidate.candidate_id} itemId={item.item_id} mode="identify" query={imageQuery} title={candidate.name} /> : null}
                      </div>
                      <div className="space-y-3 p-4">
                        <div><h3 className="font-semibold">{candidate.name}</h3><p className="text-xs text-slate-500">{candidate.production_year ?? '年份未知'} · {candidate.search_provider_name}</p></div>
                        <p className="line-clamp-3 text-sm leading-6 text-slate-600">{candidate.overview || '暂无简介'}</p>
                        <p className="break-all text-xs text-slate-400">{Object.entries(candidate.provider_ids).slice(0, 3).map(([key, value]) => key + ': ' + value).join(' · ')}</p>
                        <Button className="w-full" disabled={saving} onClick={() => void applyCandidate(candidate)} type="button">选择此作品</Button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-600">只替换 Primary 主封面，不修改作品 ID、标题或简介。</p><Button disabled={loading} onClick={() => void loadPosters()} size="sm" type="button" variant="outline">刷新候选</Button></div>
                {loading ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-slate-500" /></div> : null}
                {!loading && posters.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">没有找到候选封面；如果作品身份不正确，请先纠正识别。</p> : null}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {posters.map((candidate) => (
                    <article className="overflow-hidden rounded-2xl border border-slate-200" key={candidate.candidate_id}>
                      <button className="block w-full text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500" disabled={saving} onClick={() => void applyPoster(candidate)} type="button">
                        <div className="aspect-[2/3] bg-slate-100"><CandidateImage candidateId={candidate.candidate_id} itemId={item.item_id} mode="poster" query={{ library, query: '' }} title={item.title} /></div>
                        <div className="p-3"><p className="truncate text-sm font-medium">{candidate.provider_name}</p><p className="mt-1 text-xs text-slate-500">{candidate.width && candidate.height ? candidate.width + ' × ' + candidate.height : '尺寸未知'} · {candidate.language || '无语言'}</p></div>
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
            {error ? <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p> : null}
          </div>
        </div>
      </dialog>
    </>
  )
}
