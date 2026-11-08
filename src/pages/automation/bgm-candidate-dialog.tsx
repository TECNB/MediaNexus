import { formatReleaseSize } from '@/lib/release-size'
import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { searchMovieReleases, searchSeriesReleases } from '@/lib/api/resources'
import { getJavaErrorMessage } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type { BgmCandidate, BgmIdentity, BgmOperation, BgmOperationEntry } from '@/types/bgm-wishlist'
import type { ProwlarrRelease } from '@/types/resources'

export type BgmCandidateActions = {
  onConfirm: (id: string, subjectId: number, candidateKey: string) => void | Promise<void>
  onSupply: (id: string, subjectId: number, identity: Pick<BgmIdentity, 'mediaType' | 'tmdbId' | 'seasonNumber'>, release: ProwlarrRelease) => Promise<void>
}

export function BgmCandidateDialog({ operation, entry, working, onConfirm, onSupply, onClose }: BgmCandidateActions & {
  operation: BgmOperation
  entry: BgmOperationEntry
  working: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<AbortController | null>(null)
  const submittingRef = useRef(false)
  const titleId = useId()
  const descriptionId = useId()
  const [results, setResults] = useState<BgmCandidate[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const identity = entry.item.identity
  const candidates = [...entry.candidates, ...results]
  const selected = candidates.find((candidate) => candidate.key === selectedKey)
  const pending = submitting || working
  const canSearch = !!identity && (identity.mediaType === 'MOVIE' ? identity.year !== null : identity.seasonNumber !== null)
  const actionable = ['WAITING_CONFIRMATION', 'WAITING_RESOURCE'].includes(entry.status)

  useEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      searchRef.current?.abort()
      dialog?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  async function search() {
    if (!identity || !canSearch || loading) return
    searchRef.current?.abort()
    const controller = new AbortController()
    searchRef.current = controller
    setLoading(true); setError(null)
    try {
      const common = { tmdb_id: identity.tmdbId, imdb_id: null, title: identity.title, original_title: identity.originalTitle, quality: operation.source.quality, bangumi_title: entry.item.title }
      const data = identity.mediaType === 'MOVIE'
        ? await searchMovieReleases({ ...common, year: identity.year! }, controller.signal)
        : await searchSeriesReleases({ ...common, tvdb_id: null, season_number: identity.seasonNumber! }, controller.signal)
      if (controller.signal.aborted) return
      // Stored candidates retain their server keys; fresh releases are supplied verbatim.
      const known = new Set(entry.candidates.map(({ release }) => `${release.indexer_id}:${release.download_ref}`))
      setResults(data.items.filter((release) => {
        const key = `${release.indexer_id}:${release.download_ref}`
        if (known.has(key)) return false
        known.add(key)
        return true
      }).map((release, index) => ({ key: `search:${index}:${release.indexer_id}:${release.download_ref}`, release })))
      setSelectedKey(''); setSearched(true)
    } catch (caught) {
      if (!controller.signal.aborted) setError(getJavaErrorMessage(caught) || '搜索失败，请重试。')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  async function confirm() {
    if (!selected || pending || loading || !actionable || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true); setError(null)
    try {
      if (entry.status === 'WAITING_CONFIRMATION' && entry.candidates.some((candidate) => candidate.key === selected.key)) {
        await onConfirm(operation.id, entry.item.subjectId, selected.key)
      } else {
        if (!identity) throw new Error('请先在当前作品上纠正目录匹配，再补充来源。')
        await onSupply(operation.id, entry.item.subjectId, { mediaType: identity.mediaType, tmdbId: identity.tmdbId, seasonNumber: identity.seasonNumber }, selected.release)
      }
      onClose()
    } catch (caught) {
      setError(`${getJavaErrorMessage(caught) || '提交失败'}。请核对操作记录后再试。`)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={(event) => {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }} onCancel={(event) => { event.preventDefault(); if (!pending) onClose() }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-xl backdrop:bg-slate-950/40 sm:p-6">
    <div className="flex items-start justify-between gap-4"><h2 id={titleId} className="min-w-0 break-words text-lg font-semibold">选择发布 · {entry.item.title}</h2><Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={pending} onClick={onClose}>关闭</Button></div>
    <p id={descriptionId} className="mt-3 text-sm text-slate-600">选中候选不会下载。确认后按原操作创建入库任务；请核对标题、画质、季度与字幕。</p>
    <p className="mt-2 break-words text-sm text-slate-600">目标：{identity?.title ?? '目录待匹配'}{identity?.mediaType === 'SERIES' ? ` · 第 ${identity.seasonNumber ?? '待确认'} 季` : ''} · 画质 {operation.source.quality} · 归属 {operation.source.ownerUsername}</p>
    {entry.reason && <p className="mt-2 text-sm text-amber-800">{entry.reason.message}</p>}
    <div className="my-4 flex flex-wrap items-center gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={pending || loading || !canSearch || !actionable} onClick={() => void search()}>{loading ? '正在搜索当前作品…' : '搜索当前作品资源'}</Button><span className="text-sm text-slate-500">已有 {entry.candidates.length} 条候选{searched ? ` · 新找到 ${results.length} 条` : ''}</span></div>
    {!canSearch && <p className="mb-3 text-sm text-amber-800">{!identity ? '请先关闭弹窗，在当前作品上纠正目录匹配。' : '搜索需要完整的年份或目标季度，请先在当前作品上纠正匹配。已有候选仍可查看。'}</p>}
    {loading && <p role="status" className="mb-3 text-sm text-slate-600">正在查询发布资源，关闭弹窗可取消搜索。</p>}
    {error && <p role="alert" className="mb-3 break-words rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <fieldset disabled={pending || loading} aria-busy={loading} className="min-w-0 space-y-3">
      <legend className="mb-2 text-sm font-semibold">选择一个候选</legend>
      {candidates.map((candidate, index) => {
        const release = candidate.release
        const checked = selectedKey === candidate.key
        return <label key={candidate.key} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-4 focus-within:ring-2 focus-within:ring-slate-600', checked ? 'border-slate-950 bg-slate-50' : 'border-slate-200')}>
          <input type="radio" aria-label={`选择候选 ${index + 1}：${release.title}`} name={titleId} value={candidate.key} checked={checked} onChange={() => { setSelectedKey(candidate.key); setError(null) }} className="mt-1 h-4 w-4 shrink-0 accent-slate-950" />
          <span className="min-w-0 space-y-2 text-sm"><span className="block break-words [overflow-wrap:anywhere] font-semibold">{release.title}</span><span className="block text-slate-600">{checked ? '已选中' : `候选 ${index + 1}`} · 来源：{release.indexer ?? '未知'} · 画质：{release.resolution_tags.join(' / ') || '未知'} · 季度：{release.season_tags.join(' / ') || '未知，需人工核对'}</span><span className="block text-slate-600">做种：{release.seeders ?? '未知'} · 体积：{formatReleaseSize(release)}{release.dynamic_range_tags.length ? ` · ${release.dynamic_range_tags.join(' / ')}` : ''}</span><span className="block break-words text-amber-800">{release.match_source ? `匹配依据：${release.match_source}${release.match_query ? ` · ${release.match_query}` : ''}。` : '匹配依据未知。'}字幕及可下载性未经验证。</span></span>
        </label>
      })}
    </fieldset>
    {!candidates.length && !loading && <p role="status" className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{searched ? '本次未找到候选，可重试搜索，或关闭后重新搜索操作记录。' : '此记录没有保留候选，可搜索当前作品资源后选择。'}</p>}
    {!actionable && <p role="status" className="mt-3 text-sm text-amber-800">操作状态已更新，请关闭弹窗查看最新记录。</p>}
    <div className="mt-5 flex flex-wrap items-center justify-end gap-3"><p role="status" aria-live="polite" className="mr-auto text-sm text-slate-600">{submitting ? '正在提交，请勿重复操作…' : selected ? '已选中 1 条候选，等待确认。' : '尚未选择候选。'}</p><Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={onClose}>取消</Button><Button type="button" className="min-h-11" disabled={!selected || pending || loading || !actionable || (!identity && entry.status !== 'WAITING_CONFIRMATION')} onClick={() => void confirm()}>{submitting ? '正在提交…' : '确认使用此发布'}</Button></div>
  </dialog>
}
