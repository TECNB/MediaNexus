import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Database,
  File,
  Folder,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { QuarkSeasonIngestWorkspace } from '@/components/quark-ingest/quark-season-ingest-workspace'
import {
  createMovieQuarkIngestTask,
  previewMovieQuarkIngest,
} from '@/lib/api/quark-ingest'
import {
  checkQuarkReleaseLinks,
  isRequestCanceledError,
  searchQuarkReleases,
} from '@/lib/api/resources'
import { cn } from '@/lib/utils'
import type {
  QuarkIngestPreview,
  QuarkIngestTaskResult,
  QuarkSharePreviewNode,
} from '@/types/quark-ingest'
import type {
  QuarkRelease,
  QuarkReleaseMediaType,
  SearchableResourceItem,
} from '@/types/resources'

type LoadState = {
  status: 'loading' | 'success' | 'error'
  query: string
  items: QuarkRelease[]
  warnings: string[]
  message: string | null
}

type PreviewState = {
  candidate: QuarkRelease
  status: 'loading' | 'success' | 'submitting' | 'done' | 'error'
  preview: QuarkIngestPreview | null
  result: QuarkIngestTaskResult | null
  message: string | null
}

type QuarkReleasePanelProps = {
  mediaType: 'movie' | 'series'
  targetMediaType: QuarkReleaseMediaType
  item: SearchableResourceItem
  seasonNumber: number
  seasonOptions: number[]
}

const availabilityCopy = {
  OK: { label: '链接有效', className: 'bg-emerald-50 text-emerald-700' },
  BAD: { label: '链接失效', className: 'bg-rose-50 text-rose-700' },
  LOCKED: { label: '访问受限', className: 'bg-amber-50 text-amber-700' },
  PENDING: { label: '检查中', className: 'bg-indigo-50 text-indigo-700' },
  UNCERTAIN: { label: '待确认', className: 'bg-amber-50 text-amber-700' },
  UNSUPPORTED: { label: '暂不支持检查', className: 'bg-slate-100 text-slate-600' },
  UNCHECKED: { label: '未检查', className: 'bg-slate-100 text-slate-600' },
} as const

const RELEASE_PAGE_SIZE = 20
const LINK_CHECK_BATCH_SIZE = 6
const LINK_CHECK_DEBOUNCE_MS = 220

const relevanceCopy = {
  STRONG: { label: '高度相关', className: 'bg-indigo-50 text-indigo-700' },
  POSSIBLE: { label: '可能相关', className: 'bg-slate-100 text-slate-600' },
  CONFLICT: { label: '信息冲突', className: 'bg-orange-50 text-orange-700' },
} as const

function PreviewTree({
  nodes,
  depth = 0,
}: {
  nodes: QuarkSharePreviewNode[]
  depth?: number
}) {
  if (nodes.length === 0) {
    return <p className="text-xs text-slate-400">分享目录为空</p>
  }

  return (
    <ul className={cn('space-y-1.5', depth > 0 && 'ml-5 border-l border-slate-200 pl-3')}>
      {nodes.map((node, index) => (
        <li key={`${depth}:${index}:${node.name}`}>
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-700">
            {node.directory ? (
              <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            ) : (
              <File className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <span className="break-all">{node.name}</span>
          </div>
          {node.children.length > 0 ? (
            <div className="mt-1.5">
              <PreviewTree nodes={node.children} depth={depth + 1} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function QuarkReleasePanel({
  mediaType,
  targetMediaType,
  item,
  seasonNumber,
  seasonOptions,
}: QuarkReleasePanelProps) {
  const requestIdRef = useRef(0)
  const searchControllerRef = useRef<AbortController | null>(null)
  const previewControllerRef = useRef<AbortController | null>(null)
  const validationControllerRef = useRef<AbortController | null>(null)
  const validationTimerRef = useRef<number | null>(null)
  const validationGenerationRef = useRef(0)
  const queuedCandidatesRef = useRef(new Map<string, QuarkRelease>())
  const inFlightCandidateIdsRef = useRef(new Set<string>())
  const flushValidationQueueRef = useRef<() => void>(() => undefined)
  const listRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({
    status: 'loading',
    query: '',
    items: [],
    warnings: [],
    message: null,
  })
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [visibleLimit, setVisibleLimit] = useState(RELEASE_PAGE_SIZE)
  const previewOpen = previewState !== null

  useEffect(() => {
    const documentElement = document.documentElement
    const body = document.body
    const previousRootOverflow = documentElement.style.overflow
    const previousBodyOverflow = body.style.overflow
    if (previewOpen) {
      documentElement.style.overflow = 'hidden'
      body.style.overflow = 'hidden'
    }
    return () => {
      documentElement.style.overflow = previousRootOverflow
      body.style.overflow = previousBodyOverflow
    }
  }, [previewOpen])

  const scheduleValidationFlush = useCallback(() => {
    if (
      validationTimerRef.current !== null ||
      validationControllerRef.current !== null ||
      queuedCandidatesRef.current.size === 0
    ) {
      return
    }
    validationTimerRef.current = window.setTimeout(() => {
      validationTimerRef.current = null
      flushValidationQueueRef.current()
    }, LINK_CHECK_DEBOUNCE_MS)
  }, [])

  flushValidationQueueRef.current = () => {
    if (
      validationControllerRef.current !== null ||
      queuedCandidatesRef.current.size === 0
    ) {
      return
    }
    const batch = Array.from(queuedCandidatesRef.current.values())
      .slice(0, LINK_CHECK_BATCH_SIZE)
    batch.forEach((candidate) => queuedCandidatesRef.current.delete(candidate.id))
    const batchIds = new Set(batch.map((candidate) => candidate.id))
    batchIds.forEach((candidateId) => inFlightCandidateIdsRef.current.add(candidateId))

    const generation = validationGenerationRef.current
    const viewToken = `quark-${generation}`
    const controller = new AbortController()
    validationControllerRef.current = controller
    setLoadState((current) => ({
      ...current,
      items: current.items.map((candidate) =>
        batchIds.has(candidate.id) && candidate.availability === 'UNCHECKED'
          ? {
              ...candidate,
              availability: 'PENDING',
              availability_summary: '正在检查链接有效性',
            }
          : candidate),
    }))

    void checkQuarkReleaseLinks({
      view_token: viewToken,
      items: batch.map((candidate) => ({
        id: candidate.id,
        share_url: candidate.share_url,
      })),
    }, controller.signal)
      .then((data) => {
        if (
          controller.signal.aborted ||
          validationGenerationRef.current !== generation ||
          data.view_token !== viewToken
        ) {
          return
        }
        const checksById = new Map(data.items.map((checked) => [checked.id, checked]))
        setLoadState((current) => ({
          ...current,
          items: current.items.map((candidate) => {
            if (!batchIds.has(candidate.id)) return candidate
            const checked = checksById.get(candidate.id)
            return checked
              ? {
                  ...candidate,
                  availability: checked.availability,
                  availability_summary: checked.availability_summary,
                }
              : {
                  ...candidate,
                  availability: 'UNCERTAIN',
                  availability_summary: 'PanSou 未返回该链接的检查结果',
                }
          }),
        }))
      })
      .catch((error) => {
        if (
          controller.signal.aborted ||
          validationGenerationRef.current !== generation ||
          isRequestCanceledError(error)
        ) {
          return
        }
        setLoadState((current) => ({
          ...current,
          items: current.items.map((candidate) =>
            batchIds.has(candidate.id)
              ? {
                  ...candidate,
                  availability: 'UNCERTAIN',
                  availability_summary: '链接检查暂时失败，可继续检查分享内容',
                }
              : candidate),
        }))
      })
      .finally(() => {
        if (validationControllerRef.current === controller) {
          validationControllerRef.current = null
        }
        if (validationGenerationRef.current === generation) {
          batchIds.forEach((candidateId) => inFlightCandidateIdsRef.current.delete(candidateId))
          scheduleValidationFlush()
        }
      })
  }

  const queueCandidateForCheck = useCallback((candidate: QuarkRelease) => {
    if (
      candidate.availability !== 'UNCHECKED' ||
      queuedCandidatesRef.current.has(candidate.id) ||
      inFlightCandidateIdsRef.current.has(candidate.id)
    ) {
      return
    }
    queuedCandidatesRef.current.set(candidate.id, candidate)
    scheduleValidationFlush()
  }, [scheduleValidationFlush])

  const rankedItems = useMemo(() => [
    ...loadState.items.filter((candidate) => candidate.availability !== 'BAD'),
    ...loadState.items.filter((candidate) => candidate.availability === 'BAD'),
  ], [loadState.items])
  const visibleItems = useMemo(
    () => rankedItems.slice(0, visibleLimit),
    [rankedItems, visibleLimit],
  )
  const checkedCount = useMemo(
    () => loadState.items.filter((candidate) =>
      !['UNCHECKED', 'PENDING'].includes(candidate.availability)).length,
    [loadState.items],
  )
  const badCount = useMemo(
    () => loadState.items.filter((candidate) => candidate.availability === 'BAD').length,
    [loadState.items],
  )

  function search(refresh: boolean) {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    searchControllerRef.current?.abort()
    validationControllerRef.current?.abort()
    validationControllerRef.current = null
    if (validationTimerRef.current !== null) {
      window.clearTimeout(validationTimerRef.current)
      validationTimerRef.current = null
    }
    queuedCandidatesRef.current.clear()
    inFlightCandidateIdsRef.current.clear()
    validationGenerationRef.current = requestId
    setVisibleLimit(RELEASE_PAGE_SIZE)
    const controller = new AbortController()
    searchControllerRef.current = controller
    setLoadState((current) => ({
      ...current,
      status: 'loading',
      message: null,
    }))

    void searchQuarkReleases(
      {
        media_type: targetMediaType,
        title: item.title,
        original_title: item.original_title,
        year: mediaType === 'movie' ? item.year : null,
        season_number: mediaType === 'series' ? seasonNumber : null,
        tmdb_id: item.tmdb_id,
        refresh,
      },
      controller.signal,
    )
      .then((data) => {
        if (requestIdRef.current !== requestId) {
          return
        }
        setLoadState({
          status: 'success',
          query: data.query,
          items: data.items,
          warnings: data.warnings,
          message: null,
        })
      })
      .catch((error) => {
        if (
          requestIdRef.current !== requestId ||
          controller.signal.aborted ||
          isRequestCanceledError(error)
        ) {
          return
        }
        setLoadState({
          status: 'error',
          query: '',
          items: [],
          warnings: [],
          message:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : 'Quark 资源搜索失败，请稍后重试。',
        })
      })
  }

  useEffect(() => {
    search(false)
    return () => searchControllerRef.current?.abort()
    // Search is intentionally keyed by the selected media identity and target season/type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, mediaType, seasonNumber, targetMediaType])

  useEffect(() => {
    if (loadState.status !== 'success' || !listRef.current) return
    const candidatesById = new Map(visibleItems.map((candidate) => [candidate.id, candidate]))
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.35) return
        const candidateId = (entry.target as HTMLElement).dataset.quarkCandidateId
        const candidate = candidateId ? candidatesById.get(candidateId) : undefined
        if (candidate) queueCandidateForCheck(candidate)
      })
    }, { threshold: [0.35, 0.6] })
    listRef.current
      .querySelectorAll<HTMLElement>('[data-quark-candidate-id]')
      .forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [loadState.status, queueCandidateForCheck, visibleItems])

  useEffect(() => {
    if (!loadMoreRef.current || visibleLimit >= rankedItems.length) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleLimit((current) => Math.min(current + RELEASE_PAGE_SIZE, rankedItems.length))
      }
    }, { rootMargin: '0px 0px 100px 0px' })
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [rankedItems.length, visibleLimit])

  useEffect(
    () => () => {
      previewControllerRef.current?.abort()
      validationControllerRef.current?.abort()
      if (validationTimerRef.current !== null) {
        window.clearTimeout(validationTimerRef.current)
      }
      queuedCandidatesRef.current.clear()
      inFlightCandidateIdsRef.current.clear()
    },
    [],
  )

  function moviePayload(candidate: QuarkRelease) {
    if (typeof item.year !== 'number') {
      throw new Error('所选电影缺少年份')
    }
    return {
      share_url: candidate.share_url,
      title: item.title,
      original_title: item.original_title,
      year: item.year,
    }
  }

  function handlePreview(candidate: QuarkRelease) {
    previewControllerRef.current?.abort()
    const controller = new AbortController()
    previewControllerRef.current = controller
    setPreviewState({
      candidate,
      status: mediaType === 'movie' ? 'loading' : 'success',
      preview: null,
      result: null,
      message: null,
    })

    if (mediaType !== 'movie') {
      return
    }

    let request: Promise<QuarkIngestPreview>
    try {
      request = previewMovieQuarkIngest(moviePayload(candidate), controller.signal)
    } catch (error) {
      setPreviewState({
        candidate,
        status: 'error',
        preview: null,
        result: null,
        message: error instanceof Error ? error.message : '分享预览失败',
      })
      return
    }

    void request
      .then((preview) => {
        if (controller.signal.aborted) {
          return
        }
        setPreviewState({
          candidate,
          status: 'success',
          preview,
          result: null,
          message: null,
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return
        }
        setPreviewState({
          candidate,
          status: 'error',
          preview: null,
          result: null,
          message:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : 'Quark 分享预览失败，请稍后重试。',
        })
      })
  }

  function handleConfirm() {
    if (!previewState || previewState.status !== 'success') {
      return
    }
    const candidate = previewState.candidate
    setPreviewState((current) =>
      current ? { ...current, status: 'submitting', message: null } : current,
    )

    const request = createMovieQuarkIngestTask(moviePayload(candidate))

    void request
      .then((result) => {
        setPreviewState((current) =>
          current
            ? { ...current, status: 'done', result, message: null }
            : current,
        )
      })
      .catch((error) => {
        setPreviewState((current) =>
          current
            ? {
                ...current,
                status: 'error',
                message:
                  error instanceof Error && error.message.trim()
                    ? error.message.trim()
                    : 'QAS 任务创建失败，请稍后重试。',
              }
            : current,
        )
      })
  }

  function closePreview() {
    if (previewState?.status === 'submitting') {
      return
    }
    previewControllerRef.current?.abort()
    setPreviewState(null)
  }

  return (
    <>
      <section className="rounded-lg bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Link2 className="h-4 w-4" />
              PanSou Quark 资源
            </div>
            <p className="mt-1 text-xs text-slate-500">
              宽松召回全部候选；相关性决定顺序，可见链接在后台逐批检查。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loadState.status === 'loading'}
            onClick={() => search(true)}
            className="h-10 rounded-lg border-slate-200 shadow-none"
          >
            <RefreshCw
              className={cn(
                'h-4 w-4',
                loadState.status === 'loading' && 'animate-spin',
              )}
            />
            刷新 PanSou
          </Button>
        </div>
        <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
          查询：{loadState.query || item.title}
          {loadState.status === 'success' && loadState.items.length > 0
            ? ` · 找到 ${loadState.items.length} 条 · 已检查 ${checkedCount} 条 · 失效 ${badCount} 条`
            : ''}
        </p>
      </section>

      {loadState.warnings.length > 0 ? (
        <section className="rounded-lg bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {loadState.warnings.map((warning) => (
            <p key={warning}>· {warning}</p>
          ))}
        </section>
      ) : null}

      {loadState.status === 'loading' ? (
        <div className="rounded-lg bg-white px-8 py-16 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-400" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            正在搜索 Quark 分享链接…
          </p>
        </div>
      ) : loadState.status === 'error' ? (
        <div className="rounded-lg bg-white px-8 py-12">
          <AlertTriangle className="h-7 w-7 text-rose-500" />
          <p className="mt-4 font-semibold text-slate-950">Quark 搜索失败</p>
          <p className="mt-2 text-sm text-slate-500">{loadState.message}</p>
        </div>
      ) : loadState.items.length === 0 ? (
        <div className="rounded-lg bg-white px-8 py-14 text-center">
          <Database className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-4 font-semibold text-slate-950">没有 Quark 候选资源</p>
          <p className="mt-2 text-sm text-slate-500">
            可以刷新 PanSou，或改用现有的手动 Quark 分享链接入口。
          </p>
        </div>
      ) : (
        <div ref={listRef} className="space-y-3">
          {visibleItems.map((candidate) => {
            const availability = availabilityCopy[candidate.availability]
            const relevance = relevanceCopy[candidate.relevance]
            return (
              <article
                key={candidate.id}
                data-quark-candidate-id={candidate.id}
                className={cn(
                  'rounded-lg bg-white p-5',
                  candidate.availability === 'BAD' && 'opacity-75',
                )}
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-semibold leading-6 text-slate-950">
                      {candidate.title}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className={cn('rounded-md px-2 py-1', relevance.className)}>
                        {relevance.label}
                      </span>
                      <span
                        className={cn(
                          'rounded-md px-2 py-1',
                          availability.className,
                        )}
                      >
                        {availability.label}
                      </span>
                      {candidate.match_reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700"
                        >
                          {reason}
                        </span>
                      ))}
                      {candidate.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-slate-100 px-2 py-1 text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {candidate.conflicts.length > 0 ? (
                      <div className="mt-3 space-y-1 text-xs text-orange-700">
                        {candidate.conflicts.map((conflict) => (
                          <p key={conflict}>· {conflict}</p>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                      <span>来源：{candidate.source || '未知'}</span>
                      <span>时间：{candidate.published_at || '未知'}</span>
                      <span>{candidate.availability_summary}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={candidate.availability === 'BAD'}
                    onClick={() => handlePreview(candidate)}
                    className="h-10 shrink-0 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white shadow-none hover:bg-slate-800"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {candidate.availability === 'BAD' ? '链接已失效' : '检查内容并确认'}
                  </Button>
                </div>
              </article>
            )
          })}
          {visibleLimit < rankedItems.length ? (
            <div ref={loadMoreRef} className="flex h-14 items-center justify-center text-xs text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              继续向下加载更多候选
            </div>
          ) : null}
        </div>
      )}

      {previewState ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-hidden overscroll-auto bg-slate-950/55 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-8">
          <div
            role="dialog"
            aria-modal="true"
            className="scrollbar-none my-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto overscroll-auto rounded-2xl bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:my-0 sm:max-h-[calc(100dvh-4rem)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Quark 分享确认
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  检查分享内容后立即入库
                </h2>
                <p className="mt-2 break-words text-sm text-slate-500">
                  {previewState.candidate.title}
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭确认窗口"
                disabled={previewState.status === 'submitting'}
                onClick={closePreview}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {previewState.status === 'loading' ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-400" />
                <p className="mt-4 text-sm text-slate-500">
                  正在只读检查分享目录和 QAS 命名计划…
                </p>
              </div>
            ) : previewState.status === 'done' && previewState.result ? (
              <div className="mt-6 rounded-xl bg-emerald-50 p-5 text-emerald-800">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">{previewState.result.message}</p>
                    <p className="mt-2 text-sm">
                      已创建 {previewState.result.created_task_count}/
                      {previewState.result.planned_task_count} 个 QAS 任务
                    </p>
                    <p className="mt-1 break-all text-xs opacity-80">
                      {previewState.result.save_path}
                    </p>
                    {previewState.result.warnings.map((warning) => (
                      <p key={warning} className="mt-2 text-xs">
                        · {warning}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ) : mediaType === 'series' ? (
              <div className="mt-6">
                <QuarkSeasonIngestWorkspace
                  mediaType={targetMediaType === 'VARIETY' ? 'variety' : 'series'}
                  shareUrl={previewState.candidate.share_url}
                  title={item.title}
                  originalTitle={item.original_title}
                  tmdbId={item.tmdb_id}
                  selectedSeason={seasonNumber}
                  seasonOptions={seasonOptions}
                />
              </div>
            ) : previewState.preview ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  {[
                    ['视频', previewState.preview.video_count],
                    ['字幕', previewState.preview.subtitle_count],
                    ['目录', previewState.preview.directory_count],
                    ['QAS 任务', previewState.preview.planned_task_count],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-100 px-4 py-3">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl bg-slate-100 px-4 py-4">
                  <p className="text-xs font-semibold text-slate-500">保存目录</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-900">
                    {previewState.preview.save_path}
                  </p>
                </div>
                {previewState.preview.warnings.length > 0 ? (
                  <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {previewState.preview.warnings.map((warning) => (
                      <p key={warning}>· {warning}</p>
                    ))}
                  </div>
                ) : null}
                <div className="scrollbar-none mt-5 max-h-72 overflow-y-auto overscroll-auto rounded-xl border border-slate-200 p-4">
                  <p className="mb-3 text-xs font-semibold text-slate-500">
                    分享目录（只读）
                  </p>
                  <PreviewTree nodes={previewState.preview.entries} />
                </div>
              </>
            ) : null}

            {previewState.message ? (
              <div className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {previewState.message}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={previewState.status === 'submitting'}
                onClick={closePreview}
                className="rounded-xl border-slate-200 shadow-none"
              >
                {previewState.status === 'done' ? '关闭' : '取消'}
              </Button>
              {mediaType === 'movie' && previewState.status !== 'done' ? (
                <Button
                  type="button"
                  disabled={previewState.status !== 'success'}
                  onClick={handleConfirm}
                  className="rounded-xl bg-slate-950 text-white shadow-none hover:bg-slate-800"
                >
                  {previewState.status === 'submitting' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CloudUpload className="h-4 w-4" />
                  )}
                  {previewState.status === 'submitting'
                    ? '正在创建 QAS 任务…'
                    : '确认并立即入库'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
