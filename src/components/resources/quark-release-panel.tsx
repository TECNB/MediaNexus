import { useEffect, useRef, useState } from 'react'
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
import {
  createMovieQuarkIngestTask,
  createSeriesQuarkIngestTask,
  createVarietyQuarkIngestTask,
  previewMovieQuarkIngest,
  previewSeriesQuarkIngest,
  previewVarietyQuarkIngest,
} from '@/lib/api/quark-ingest'
import {
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
}

const availabilityCopy = {
  OK: { label: '链接有效', className: 'bg-emerald-50 text-emerald-700' },
  BAD: { label: '链接失效', className: 'bg-rose-50 text-rose-700' },
  LOCKED: { label: '访问受限', className: 'bg-amber-50 text-amber-700' },
  UNCERTAIN: { label: '待确认', className: 'bg-amber-50 text-amber-700' },
  UNCHECKED: { label: '未检查', className: 'bg-slate-100 text-slate-600' },
} as const

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
}: QuarkReleasePanelProps) {
  const requestIdRef = useRef(0)
  const searchControllerRef = useRef<AbortController | null>(null)
  const previewControllerRef = useRef<AbortController | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({
    status: 'loading',
    query: '',
    items: [],
    warnings: [],
    message: null,
  })
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)

  function search(refresh: boolean) {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    searchControllerRef.current?.abort()
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

  useEffect(
    () => () => {
      previewControllerRef.current?.abort()
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

  function seasonPayload(candidate: QuarkRelease) {
    return {
      share_url: candidate.share_url,
      title: item.title,
      original_title: item.original_title,
      season_number: seasonNumber,
      tmdb_id: item.tmdb_id,
    }
  }

  function handlePreview(candidate: QuarkRelease) {
    previewControllerRef.current?.abort()
    const controller = new AbortController()
    previewControllerRef.current = controller
    setPreviewState({
      candidate,
      status: 'loading',
      preview: null,
      result: null,
      message: null,
    })

    let request: Promise<QuarkIngestPreview>
    try {
      request =
        mediaType === 'movie'
          ? previewMovieQuarkIngest(moviePayload(candidate), controller.signal)
          : targetMediaType === 'VARIETY'
            ? previewVarietyQuarkIngest(seasonPayload(candidate), controller.signal)
            : previewSeriesQuarkIngest(seasonPayload(candidate), controller.signal)
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

    const request =
      mediaType === 'movie'
        ? createMovieQuarkIngestTask(moviePayload(candidate))
        : targetMediaType === 'VARIETY'
          ? createVarietyQuarkIngestTask(seasonPayload(candidate))
          : createSeriesQuarkIngestTask(seasonPayload(candidate))

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
              宽松召回全部候选；相关性和冲突仅用于排序，不会删除结果。
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
            正在搜索并检查 Quark 分享链接…
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
        <div className="space-y-3">
          {loadState.items.map((candidate) => {
            const availability = availabilityCopy[candidate.availability]
            const relevance = relevanceCopy[candidate.relevance]
            return (
              <article key={candidate.id} className="rounded-lg bg-white p-5">
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
                    onClick={() => handlePreview(candidate)}
                    className="h-10 shrink-0 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white shadow-none hover:bg-slate-800"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    检查内容并确认
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {previewState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-8">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:max-h-[calc(100dvh-4rem)] sm:p-6"
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
                <div className="mt-5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 p-4">
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
              {previewState.status !== 'done' ? (
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
