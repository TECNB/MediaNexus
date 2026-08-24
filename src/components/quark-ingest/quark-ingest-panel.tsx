import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CloudUpload, Link2, Loader2, TriangleAlert } from 'lucide-react'

import {
  LibraryLinkPicker,
  type LibraryLinkItem,
  type ResourceSearchStatus,
} from '@/components/magnet-ingest/library-link-picker'
import { Button } from '@/components/ui/button'
import {
  createMovieQuarkIngestTask,
  createSeriesQuarkIngestTask,
  createVarietyQuarkIngestTask,
} from '@/lib/api/quark-ingest'
import {
  getSeriesSeasons,
  isRequestCanceledError,
  searchMovies,
  searchSeries,
} from '@/lib/api/resources'
import { cn } from '@/lib/utils'
import type {
  SearchableResourceItem,
  SeriesSearchItem,
} from '@/types/resources'
import type {
  QuarkIngestMediaType,
  QuarkIngestTaskResult,
} from '@/types/quark-ingest'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'
type SeasonStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

const mediaTypeCopy: Record<
  QuarkIngestMediaType,
  { label: string; root: '/Movie' | '/TV' | '/Variety' }
> = {
  movie: { label: '电影', root: '/Movie' },
  series: { label: '电视剧', root: '/TV' },
  variety: { label: '综艺', root: '/Variety' },
}

function isSeriesSearchItem(
  item: SearchableResourceItem,
): item is SeriesSearchItem {
  return 'tvdb_id' in item
}

function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        {label}
      </p>
      <p className="text-sm text-slate-500">{title}</p>
    </div>
  )
}

function MediaTypeToggle({
  value,
  onChange,
}: {
  value: QuarkIngestMediaType
  onChange: (value: QuarkIngestMediaType) => void
}) {
  return (
    <div className="flex w-full rounded-2xl border border-slate-200 bg-slate-100/80 p-1 md:w-auto">
      {(Object.keys(mediaTypeCopy) as QuarkIngestMediaType[]).map((mediaType) => (
        <button
          key={mediaType}
          type="button"
          aria-pressed={value === mediaType}
          onClick={() => onChange(mediaType)}
          className={cn(
            'min-w-0 flex-1 whitespace-nowrap rounded-[14px] px-4 py-2 text-sm font-semibold transition-all md:flex-none',
            value === mediaType
              ? 'bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
              : 'text-slate-500 hover:text-slate-900',
          )}
        >
          {mediaTypeCopy[mediaType].label}
        </button>
      ))}
    </div>
  )
}

function getShareUrlValidationMessage(value: string, treatEmptyAsError = false) {
  const normalized = value.trim()
  if (!normalized) {
    return treatEmptyAsError ? '请输入 Quark 分享链接' : null
  }

  try {
    const url = new URL(normalized)
    const isValid =
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'pan.quark.cn' &&
      (!url.port || url.port === '443') &&
      !url.username &&
      !url.password &&
      /^\/s\/[A-Za-z0-9]+(?:\/[A-Fa-f0-9]{32})?\/?$/.test(url.pathname)
    return isValid ? null : '请输入合法的 pan.quark.cn 分享链接'
  } catch {
    return '请输入合法的 pan.quark.cn 分享链接'
  }
}

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ .]+|[ .]+$/g, '')
}

function seasonLabel(seasonNumber: number) {
  return `Season ${String(seasonNumber).padStart(2, '0')}`
}

export function QuarkIngestPanel() {
  const [mediaType, setMediaType] = useState<QuarkIngestMediaType>('series')
  const [shareUrl, setShareUrl] = useState('')
  const [keyword, setKeyword] = useState('')
  const [searchItems, setSearchItems] = useState<SearchableResourceItem[]>([])
  const [selectedItem, setSelectedItem] = useState<SearchableResourceItem | null>(null)
  const [searchStatus, setSearchStatus] = useState<ResourceSearchStatus>('idle')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [seasonStatus, setSeasonStatus] = useState<SeasonStatus>('idle')
  const [seasonOptions, setSeasonOptions] = useState<number[]>([])
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [seasonError, setSeasonError] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdTask, setCreatedTask] = useState<QuarkIngestTaskResult | null>(null)
  const searchControllerRef = useRef<AbortController | null>(null)
  const seasonControllerRef = useRef<AbortController | null>(null)

  const isSeasonMedia = mediaType !== 'movie'
  const shareUrlValidationMessage = getShareUrlValidationMessage(shareUrl)
  const selectedTitle = selectedItem?.title?.trim() || selectedItem?.original_title?.trim() || ''
  const selectedYear = selectedItem?.year ?? null
  const targetPath = selectedItem
    ? mediaType === 'movie'
      ? typeof selectedYear === 'number'
        ? `/Movie/${sanitizePathSegment(selectedTitle)} (${selectedYear})`
        : null
      : typeof selectedSeason === 'number'
        ? `${mediaTypeCopy[mediaType].root}/${sanitizePathSegment(selectedTitle)}/${seasonLabel(selectedSeason)}`
        : null
    : null
  const isSubmitDisabled =
    submitStatus === 'loading' ||
    !shareUrl.trim() ||
    Boolean(shareUrlValidationMessage) ||
    !selectedItem ||
    !selectedTitle ||
    (mediaType === 'movie'
      ? typeof selectedYear !== 'number'
      : typeof selectedSeason !== 'number' || seasonStatus !== 'success')

  useEffect(() => {
    return () => {
      searchControllerRef.current?.abort()
      seasonControllerRef.current?.abort()
    }
  }, [])

  function resetSubmitFeedback() {
    setSubmitStatus('idle')
    setSubmitError(null)
    setCreatedTask(null)
  }

  function resetSelection() {
    seasonControllerRef.current?.abort()
    seasonControllerRef.current = null
    setSelectedItem(null)
    setSeasonStatus('idle')
    setSeasonOptions([])
    setSelectedSeason(null)
    setSeasonError(null)
    resetSubmitFeedback()
  }

  function handleMediaTypeChange(nextMediaType: QuarkIngestMediaType) {
    if (nextMediaType === mediaType) {
      return
    }
    searchControllerRef.current?.abort()
    searchControllerRef.current = null
    setMediaType(nextMediaType)
    setKeyword('')
    setSearchItems([])
    setSearchStatus('idle')
    setSearchError(null)
    resetSelection()
  }

  function handleSearchSubmit() {
    if (searchStatus === 'loading') {
      return
    }
    const normalizedKeyword = keyword.trim()
    if (!normalizedKeyword) {
      setSearchItems([])
      setSearchStatus('idle')
      setSearchError(null)
      resetSelection()
      return
    }

    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    resetSelection()
    setSearchStatus('loading')
    setSearchError(null)

    const request =
      mediaType === 'movie'
        ? searchMovies(normalizedKeyword, controller.signal)
        : searchSeries(normalizedKeyword, controller.signal)

    void request
      .then((items) => {
        if (controller.signal.aborted) {
          return
        }
        setSearchItems(items)
        setSearchStatus(items.length > 0 ? 'success' : 'empty')
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }
        setSearchItems([])
        setSearchStatus('error')
        setSearchError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : `${mediaTypeCopy[mediaType].label}搜索失败，请稍后重试。`,
        )
      })
      .finally(() => {
        if (searchControllerRef.current === controller) {
          searchControllerRef.current = null
        }
      })
  }

  function handleSelectItem(item: LibraryLinkItem) {
    if ('bgm_id' in item) {
      return
    }
    setSelectedItem(item)
    resetSubmitFeedback()
    seasonControllerRef.current?.abort()
    seasonControllerRef.current = null
    setSeasonOptions([])
    setSelectedSeason(null)
    setSeasonError(null)

    if (!isSeasonMedia || !isSeriesSearchItem(item)) {
      setSeasonStatus('idle')
      return
    }

    const tmdbId = item.tmdb_id
    if (typeof tmdbId !== 'number' || tmdbId <= 0) {
      setSeasonStatus('error')
      setSeasonError('当前剧集缺少有效的 TMDB ID，无法加载季数。')
      return
    }

    const controller = new AbortController()
    seasonControllerRef.current = controller
    setSeasonStatus('loading')
    void getSeriesSeasons(tmdbId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) {
          return
        }
        const options = [...new Set(data.season_numbers)]
          .filter((value) => Number.isInteger(value) && value > 0)
          .sort((left, right) => left - right)
        setSeasonOptions(options)
        setSelectedSeason(options[0] ?? null)
        setSeasonStatus(options.length > 0 ? 'success' : 'empty')
        if (options.length === 0) {
          setSeasonError('目录服务暂未提供可选的正片季数。')
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }
        setSeasonStatus('error')
        setSeasonError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '季数加载失败，请稍后重试。',
        )
      })
      .finally(() => {
        if (seasonControllerRef.current === controller) {
          seasonControllerRef.current = null
        }
      })
  }

  async function handleSubmit() {
    if (submitStatus === 'loading') {
      return
    }
    const linkError = getShareUrlValidationMessage(shareUrl, true)
    if (linkError) {
      setSubmitStatus('error')
      setSubmitError(linkError)
      return
    }
    if (!selectedItem || !selectedTitle) {
      setSubmitStatus('error')
      setSubmitError(`请先选择一个${mediaTypeCopy[mediaType].label}项目`)
      return
    }

    setSubmitStatus('loading')
    setSubmitError(null)
    setCreatedTask(null)

    try {
      const commonPayload = {
        share_url: shareUrl.trim(),
        title: selectedTitle,
        original_title: selectedItem.original_title,
      }
      const task =
        mediaType === 'movie'
          ? typeof selectedYear === 'number'
            ? await createMovieQuarkIngestTask({
                ...commonPayload,
                year: selectedYear,
              })
            : null
          : typeof selectedSeason === 'number'
            ? mediaType === 'series'
              ? await createSeriesQuarkIngestTask({
                  ...commonPayload,
                  season_number: selectedSeason,
                  tmdb_id: selectedItem.tmdb_id,
                })
              : await createVarietyQuarkIngestTask({
                  ...commonPayload,
                  season_number: selectedSeason,
                  tmdb_id: selectedItem.tmdb_id,
                })
            : null

      if (!task) {
        throw new Error(
          mediaType === 'movie' ? '所选电影缺少年份' : '请选择有效的目标季数',
        )
      }
      setCreatedTask(task)
      setSubmitStatus('success')
      setShareUrl('')
    } catch (error) {
      setSubmitStatus('error')
      setSubmitError(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Quark 入库任务创建失败，请稍后重试。',
      )
    }
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.72fr)_320px]">
      <div className="min-w-0 space-y-6">
        <section className="space-y-3">
          <SectionHeading
            label="Quark 分享链接"
            title="粘贴一条 pan.quark.cn 分享链接，任务会保存到 QAS 并立即执行一次。"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white/95 shadow-shell">
            <textarea
              value={shareUrl}
              onChange={(event) => {
                setShareUrl(event.target.value)
                resetSubmitFeedback()
              }}
              aria-label="输入 Quark 分享链接"
              spellCheck={false}
              placeholder="https://pan.quark.cn/s/xxxx"
              className="min-h-[150px] w-full resize-none rounded-[28px] bg-transparent px-5 py-5 font-mono text-[15px] leading-8 text-slate-900 outline-none placeholder:text-slate-300"
            />
          </div>
          <p
            className={cn(
              'text-sm',
              shareUrlValidationMessage ? 'text-rose-500' : 'text-slate-500',
            )}
          >
            {shareUrlValidationMessage ??
              '只接受 pan.quark.cn 的 HTTPS 分享链接；当前仅支持单条提交。'}
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              label="关联媒体"
              title="选择分类并绑定目录项目，标题、年份和季数会直接复用。"
            />
            <MediaTypeToggle value={mediaType} onChange={handleMediaTypeChange} />
          </div>

          <LibraryLinkPicker
            mode={mediaType === 'movie' ? 'movie' : mediaType}
            keyword={keyword}
            items={searchItems}
            selectedItem={selectedItem}
            searchStatus={searchStatus}
            searchError={searchError}
            searchDisabled={searchStatus === 'loading'}
            onKeywordChange={(value) => {
              setKeyword(value)
              resetSubmitFeedback()
            }}
            onSearchSubmit={handleSearchSubmit}
            onSelectItem={handleSelectItem}
            onClearSelection={resetSelection}
          />
        </section>

        {isSeasonMedia ? (
          <section className="space-y-3">
            <SectionHeading
              label="目标季数"
              title={`${mediaTypeCopy[mediaType].label}不写入年份，统一保存到 Season 01 形式的季目录。`}
            />
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-shell">
              <select
                value={selectedSeason ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (Number.isInteger(value) && value > 0) {
                    setSelectedSeason(value)
                    resetSubmitFeedback()
                  }
                }}
                disabled={seasonStatus !== 'success'}
                aria-label={`${mediaTypeCopy[mediaType].label}目标季数`}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none disabled:text-slate-400"
              >
                {seasonStatus === 'success' ? (
                  seasonOptions.map((seasonNumber) => (
                    <option key={seasonNumber} value={seasonNumber}>
                      S{String(seasonNumber).padStart(2, '0')}
                    </option>
                  ))
                ) : (
                  <option value="">
                    {seasonStatus === 'loading'
                      ? '正在加载季数…'
                      : seasonStatus === 'error'
                        ? '季数加载失败'
                        : seasonStatus === 'empty'
                          ? '暂无可用季数'
                          : '请先选择媒体项目'}
                  </option>
                )}
              </select>
              {seasonError ? (
                <p className="mt-3 text-sm text-rose-500">{seasonError}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <SectionHeading
            label="保存信息"
            title="保存路径由媒体信息生成，后端会再次校验，不能手动修改。"
          />
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-shell">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              目标路径
            </p>
            <p className="mt-3 break-all font-mono text-sm text-slate-900">
              {targetPath ?? '选择媒体并确认必要信息后显示'}
            </p>
          </div>
        </section>

        <Button
          type="button"
          size="lg"
          disabled={isSubmitDisabled}
          onClick={() => void handleSubmit()}
          className="h-14 w-full rounded-[20px] bg-slate-950 text-base font-semibold text-white shadow-none hover:bg-black disabled:bg-slate-200 disabled:text-slate-500"
        >
          {submitStatus === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              正在创建并触发…
            </>
          ) : (
            <>
              <CloudUpload className="h-4 w-4" />
              创建并立即执行 QAS 任务
            </>
          )}
        </Button>

        {submitError ? <p className="text-sm text-rose-500">{submitError}</p> : null}

        {createdTask ? (
          <div
            className={cn(
              'rounded-2xl px-4 py-4',
              createdTask.status === 'STARTED'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800',
            )}
          >
            <div className="flex items-start gap-3">
              {createdTask.status === 'STARTED' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">{createdTask.message}</p>
                <p className="break-all text-xs opacity-80">
                  {createdTask.task_name} · {createdTask.save_path}
                </p>
                <p className="text-xs opacity-80">
                  已创建 {createdTask.created_task_count}/
                  {createdTask.planned_task_count} 个 QAS 任务
                </p>
                {createdTask.warnings.length > 0 ? (
                  <ul className="space-y-1 pt-1 text-xs opacity-80">
                    {createdTask.warnings.map((warning) => (
                      <li key={warning}>· {warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-5">
        <div className="rounded-[24px] bg-slate-950 p-5 text-white shadow-shell">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4" />
            QAS 执行方式
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/70">
            <p>提交后会把任务持久保存到 QAS，并只针对该任务立即执行一次。</p>
            <p>页面确认的是任务已创建和开始执行，不代表夸克转存已经完成。</p>
            <p>长期任务会在每天 04:15 再次检查分享链接中的新增内容。</p>
          </div>
        </div>

        {mediaType === 'movie' ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            电影任务会正式保存到 QAS 的 /Movie 目录；当前只建立 Movie
            下游占位，不会自动进入 SmartStrm 或 Emby。
          </div>
        ) : null}
      </aside>
    </div>
  )
}
