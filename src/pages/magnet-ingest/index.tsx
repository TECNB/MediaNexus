import { useEffect, useRef, useState } from 'react'
import { ChevronDown, CloudUpload, Loader2 } from 'lucide-react'

import {
  LibraryLinkPicker,
  type ResourceSearchStatus,
} from '@/components/magnet-ingest/library-link-picker'
import { RecentTasksTable } from '@/components/magnet-ingest/recent-tasks-table'
import {
  NodeStatusCard,
  ProTipCard,
  SystemLogsCard,
} from '@/components/magnet-ingest/status-cards'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  createMovieMagnetIngest,
  createSeriesMagnetIngest,
} from '@/lib/api/magnet-ingest'
import {
  isRequestCanceledError,
  searchMovies,
  searchSeries,
} from '@/lib/api/resources'
import {
  defaultMagnetText,
  initialRecentTasks,
  systemLogEntries,
  targetSeasonOptions,
} from '@/data/mock-magnet-ingest'
import { cn } from '@/lib/utils'
import type {
  CreateMovieMagnetIngestPayload,
  CreateSeriesMagnetIngestPayload,
  IngestMode,
} from '@/types/magnet-ingest'
import type { MovieSearchItem, SeriesSearchItem } from '@/types/resources'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

function SectionHeading({
  label,
  title,
}: {
  label: string
  title?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        {label}
      </p>
      {title ? <p className="text-sm text-slate-500">{title}</p> : null}
    </div>
  )
}

function MediaTypeToggle({
  mode,
  onChange,
}: {
  mode: IngestMode
  onChange: (mode: IngestMode) => void
}) {
  const options: Array<{ label: string; value: IngestMode }> = [
    { label: '电影(Movie)', value: 'movie' },
    { label: '电视剧 (TV Show)', value: 'series' },
  ]

  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
      {options.map((option) => {
        const isActive = option.value === mode

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[14px] px-4 py-2 text-sm font-semibold transition-all',
              isActive
                ? 'bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function TargetSeasonSelect({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="选择目标季数"
        className="h-14 w-full appearance-none rounded-[20px] border border-slate-200 bg-white px-5 pr-14 text-base font-medium text-slate-950 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200/60"
      >
        {targetSeasonOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
    </div>
  )
}

function getInitialMagnetText() {
  return (
    defaultMagnetText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  )
}

function getMagnetValidationMessage(
  magnetInput: string,
  treatEmptyAsError = false,
) {
  const trimmedMagnet = magnetInput.trim()

  if (!trimmedMagnet) {
    return treatEmptyAsError ? '请输入单条 magnet 链接' : null
  }

  const nonEmptyLines = trimmedMagnet
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const magnetMatchCount = (trimmedMagnet.match(/magnet:\?/gi) ?? []).length

  if (nonEmptyLines.length > 1 || magnetMatchCount > 1) {
    return '当前仅支持单条 magnet'
  }

  if (!trimmedMagnet.toLowerCase().startsWith('magnet:?')) {
    return 'magnet 链接需以 magnet:? 开头'
  }

  return null
}

function getMovieMagnetIngestPayload(
  magnet: string,
  selectedMovie: MovieSearchItem,
): CreateMovieMagnetIngestPayload | null {
  const title = selectedMovie.title.trim()
  const originalTitle = selectedMovie.original_title?.trim()
  const year = selectedMovie.year

  if (!title || !originalTitle || typeof year !== 'number') {
    return null
  }

  return {
    magnet,
    title,
    original_title: originalTitle,
    year,
  }
}

function getSeriesMagnetIngestPayload(
  magnet: string,
  selectedSeries: SeriesSearchItem,
  seasonNumber: number,
): CreateSeriesMagnetIngestPayload | null {
  const title = selectedSeries.title.trim()
  const originalTitle = selectedSeries.original_title?.trim() || title

  if (!title || !Number.isInteger(seasonNumber)) {
    return null
  }

  return {
    magnet,
    title,
    original_title: originalTitle,
    season_number: seasonNumber,
  }
}

export function MagnetIngestPage() {
  const [mode, setMode] = useState<IngestMode>('movie')
  const [magnetInput, setMagnetInput] = useState(getInitialMagnetText)
  const [movieKeyword, setMovieKeyword] = useState('')
  const [seriesKeyword, setSeriesKeyword] = useState('')
  const [movieSearchStatus, setMovieSearchStatus] =
    useState<ResourceSearchStatus>('idle')
  const [seriesSearchStatus, setSeriesSearchStatus] =
    useState<ResourceSearchStatus>('idle')
  const [movieResults, setMovieResults] = useState<MovieSearchItem[]>([])
  const [seriesResults, setSeriesResults] = useState<SeriesSearchItem[]>([])
  const [selectedMovie, setSelectedMovie] = useState<MovieSearchItem | null>(
    null,
  )
  const [selectedSeries, setSelectedSeries] = useState<SeriesSearchItem | null>(
    null,
  )
  const [targetSeason, setTargetSeason] = useState(1)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [movieSearchError, setMovieSearchError] = useState<string | null>(null)
  const [seriesSearchError, setSeriesSearchError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(
    null,
  )
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const latestSearchRequestIdRef = useRef(0)
  const activeSearchControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null)
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toastMessage])

  useEffect(() => {
    return () => {
      activeSearchControllerRef.current?.abort()
    }
  }, [])

  const magnetValidationMessage = getMagnetValidationMessage(magnetInput)
  const isPushDisabled =
    !magnetInput.trim() ||
    Boolean(magnetValidationMessage) ||
    submitStatus === 'loading' ||
    (mode === 'movie' ? !selectedMovie : !selectedSeries)

  function abortActiveSearch() {
    latestSearchRequestIdRef.current += 1
    activeSearchControllerRef.current?.abort()
    activeSearchControllerRef.current = null
  }

  function resetSubmitFeedback() {
    setSubmitStatus('idle')
    setSubmitError(null)
    setSubmitSuccessMessage(null)
  }

  function resetMovieModeState() {
    setMovieKeyword('')
    setMovieSearchStatus('idle')
    setMovieResults([])
    setSelectedMovie(null)
    setMovieSearchError(null)
  }

  function resetSeriesModeState() {
    setSeriesKeyword('')
    setSeriesSearchStatus('idle')
    setSeriesResults([])
    setSelectedSeries(null)
    setSeriesSearchError(null)
    setTargetSeason(1)
  }

  function handleModeChange(nextMode: IngestMode) {
    if (nextMode === mode) {
      return
    }

    abortActiveSearch()

    if (mode === 'movie') {
      resetMovieModeState()
    } else {
      resetSeriesModeState()
    }

    setMode(nextMode)
    resetSubmitFeedback()
  }

  function handleMovieKeywordChange(value: string) {
    abortActiveSearch()
    setMovieKeyword(value)
    setMovieSearchStatus('idle')
    setMovieResults([])
    setMovieSearchError(null)
  }

  function handleSeriesKeywordChange(value: string) {
    abortActiveSearch()
    setSeriesKeyword(value)
    setSeriesSearchStatus('idle')
    setSeriesResults([])
    setSeriesSearchError(null)
  }

  function handleMovieSearchSubmit() {
    if (movieSearchStatus === 'loading') {
      return
    }

    const keyword = movieKeyword.trim()
    abortActiveSearch()
    const requestId = latestSearchRequestIdRef.current

    if (!keyword) {
      setMovieSearchStatus('idle')
      setMovieResults([])
      setMovieSearchError(null)
      return
    }

    const controller = new AbortController()
    activeSearchControllerRef.current = controller

    setMovieSearchStatus('loading')
    setMovieResults([])
    setMovieSearchError(null)

    void searchMovies(keyword, controller.signal)
      .then((items) => {
        if (latestSearchRequestIdRef.current !== requestId) {
          return
        }

        setMovieSearchStatus(items.length > 0 ? 'success' : 'empty')
        setMovieResults(items)
        setMovieSearchError(null)
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }

        if (latestSearchRequestIdRef.current !== requestId) {
          return
        }

        console.error('movie search failed', error)

        setMovieSearchStatus('error')
        setMovieResults([])
        setMovieSearchError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '电影搜索失败，请稍后重试。',
        )
      })
      .finally(() => {
        if (activeSearchControllerRef.current === controller) {
          activeSearchControllerRef.current = null
        }
      })
  }

  function handleSeriesSearchSubmit() {
    if (seriesSearchStatus === 'loading') {
      return
    }

    const keyword = seriesKeyword.trim()
    abortActiveSearch()
    const requestId = latestSearchRequestIdRef.current

    if (!keyword) {
      setSeriesSearchStatus('idle')
      setSeriesResults([])
      setSeriesSearchError(null)
      return
    }

    const controller = new AbortController()
    activeSearchControllerRef.current = controller

    setSeriesSearchStatus('loading')
    setSeriesResults([])
    setSeriesSearchError(null)

    void searchSeries(keyword, controller.signal)
      .then((items) => {
        if (latestSearchRequestIdRef.current !== requestId) {
          return
        }

        setSeriesSearchStatus(items.length > 0 ? 'success' : 'empty')
        setSeriesResults(items)
        setSeriesSearchError(null)
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }

        if (latestSearchRequestIdRef.current !== requestId) {
          return
        }

        console.error('series search failed', error)

        setSeriesSearchStatus('error')
        setSeriesResults([])
        setSeriesSearchError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '剧集搜索失败，请稍后重试。',
        )
      })
      .finally(() => {
        if (activeSearchControllerRef.current === controller) {
          activeSearchControllerRef.current = null
        }
      })
  }

  async function handleSubmit() {
    if (submitStatus === 'loading') {
      return
    }

    const normalizedMagnet = magnetInput.trim()
    const magnetErrorMessage = getMagnetValidationMessage(magnetInput, true)

    if (magnetErrorMessage) {
      setSubmitStatus('error')
      setSubmitError(magnetErrorMessage)
      setSubmitSuccessMessage(null)
      setToastMessage(magnetErrorMessage)
      return
    }

    if (mode === 'series') {
      if (!selectedSeries) {
        const message = '请先选择一个剧集项目'
        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
        return
      }

      if (!Number.isInteger(targetSeason) || targetSeason < 1) {
        const message = '请先选择目标季数'
        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
        return
      }

      const payload = getSeriesMagnetIngestPayload(
        normalizedMagnet,
        selectedSeries,
        targetSeason,
      )

      if (!payload) {
        const message = '所选剧集缺少标题、原始标题或目标季数，暂时无法提交'
        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
        return
      }

      setSubmitStatus('loading')
      setSubmitError(null)
      setSubmitSuccessMessage(null)

      try {
        const response = await createSeriesMagnetIngest(payload)
        const successMessage = response.save_path
          ? `离线任务已创建：${response.save_path}`
          : '已成功推送至离线下载'

        setSubmitStatus('success')
        setSubmitSuccessMessage(successMessage)
        setMagnetInput('')
        setToastMessage(successMessage)
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '推送失败，请稍后重试'

        console.error('series magnet ingest failed', error)

        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
      }

      return
    }

    if (!selectedMovie) {
      const message = '请先选择一个电影项目'
      setSubmitStatus('error')
      setSubmitError(message)
      setSubmitSuccessMessage(null)
      setToastMessage(message)
      return
    }

    const payload = getMovieMagnetIngestPayload(normalizedMagnet, selectedMovie)

    if (!payload) {
      const message = '所选电影缺少标题、原始标题或年份，暂时无法提交'
      setSubmitStatus('error')
      setSubmitError(message)
      setSubmitSuccessMessage(null)
      setToastMessage(message)
      return
    }

    setSubmitStatus('loading')
    setSubmitError(null)
    setSubmitSuccessMessage(null)

    try {
      const response = await createMovieMagnetIngest(payload)
      const successMessage = response.save_path
        ? `离线任务已创建：${response.save_path}`
        : '已成功推送至离线下载'

      setSubmitStatus('success')
      setSubmitSuccessMessage(successMessage)
      setMagnetInput('')
      setToastMessage(successMessage)
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : '推送失败，请稍后重试'

      console.error('movie magnet ingest failed', error)

      setSubmitStatus('error')
      setSubmitError(message)
      setSubmitSuccessMessage(null)
      setToastMessage(message)
    }
  }

  return (
    <PageContainer
      title="手动磁力直收"
      description="直接粘贴高质量磁力链接，将其绑定至媒体库结构并推送至云端离线下载。"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.72fr)_320px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <SectionHeading
              label="Magnet Links"
              title="当前仅支持单条 magnet，提交前会进行最小格式校验。"
            />

            <div className="rounded-[28px] border border-slate-200 bg-white/95 shadow-shell">
              <textarea
                value={magnetInput}
                onChange={(event) => {
                  setMagnetInput(event.target.value)
                  resetSubmitFeedback()
                }}
                aria-label="输入磁力链接"
                spellCheck={false}
                placeholder="粘贴单条 magnet:? 链接"
                className="min-h-[180px] w-full resize-none rounded-[28px] bg-transparent px-5 py-5 font-mono text-[15px] leading-8 text-slate-900 outline-none placeholder:text-slate-300"
              />
            </div>

            <p
              className={`text-sm ${
                magnetValidationMessage ? 'text-rose-500' : 'text-slate-500'
              }`}
            >
              {magnetValidationMessage ??
                '仅支持单条 magnet，需以 magnet:? 开头；不会自动拆分多条内容。'}
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <SectionHeading
                label="关联库项目 (Link to Library Item)"
                title={
                  mode === 'movie'
                    ? '使用电影搜索接口查询媒体库项目，并从结果中单选一个电影进行绑定。'
                    : '使用剧集搜索接口查询媒体库项目，并从结果中单选一个剧集进行绑定。'
                }
              />

              <MediaTypeToggle mode={mode} onChange={handleModeChange} />
            </div>

            {mode === 'movie' ? (
              <LibraryLinkPicker
                mode="movie"
                keyword={movieKeyword}
                items={movieResults}
                selectedItem={selectedMovie}
                searchStatus={movieSearchStatus}
                searchError={movieSearchError}
                searchDisabled={movieSearchStatus === 'loading'}
                onKeywordChange={handleMovieKeywordChange}
                onSearchSubmit={handleMovieSearchSubmit}
                onSelectItem={(item) => {
                  setSelectedMovie(item as MovieSearchItem)
                  resetSubmitFeedback()
                }}
                onClearSelection={() => {
                  setSelectedMovie(null)
                  resetSubmitFeedback()
                }}
              />
            ) : (
              <LibraryLinkPicker
                mode="series"
                keyword={seriesKeyword}
                items={seriesResults}
                selectedItem={selectedSeries}
                searchStatus={seriesSearchStatus}
                searchError={seriesSearchError}
                searchDisabled={seriesSearchStatus === 'loading'}
                onKeywordChange={handleSeriesKeywordChange}
                onSearchSubmit={handleSeriesSearchSubmit}
                onSelectItem={(item) => {
                  setSelectedSeries(item as SeriesSearchItem)
                  resetSubmitFeedback()
                }}
                onClearSelection={() => {
                  setSelectedSeries(null)
                  resetSubmitFeedback()
                }}
              />
            )}
          </section>

          {mode === 'series' ? (
            <section className="space-y-3">
              <SectionHeading
                label="目标季数 (Target Season)"
                title="当前使用本地静态季数列表，可为剧集离线直收指定目标季数。"
              />

              <TargetSeasonSelect
                value={targetSeason}
                onChange={(value) => {
                  setTargetSeason(value)
                  resetSubmitFeedback()
                }}
              />
            </section>
          ) : null}

          <Button
            type="button"
            size="lg"
            disabled={isPushDisabled}
            onClick={() => {
              void handleSubmit()
            }}
            className="h-14 w-full rounded-[20px] bg-slate-950 text-base font-semibold text-white shadow-none hover:bg-black disabled:bg-slate-200 disabled:text-slate-500"
          >
            {submitStatus === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                推送中...
              </>
            ) : (
              <>
                <CloudUpload className="h-4 w-4" />
                推送至离线下载 (Push to Offline)
              </>
            )}
          </Button>

          {submitError ? (
            <p className="text-sm text-rose-500">{submitError}</p>
          ) : null}

          {submitStatus === 'success' && submitSuccessMessage ? (
            <p className="text-sm text-emerald-600">{submitSuccessMessage}</p>
          ) : null}

          <RecentTasksTable
            tasks={initialRecentTasks}
            onViewAll={() => setToastMessage('Recent Tasks 暂保持静态 mock')}
          />
        </div>

        <aside className="space-y-5">
          <SystemLogsCard logs={systemLogEntries} />
          <NodeStatusCard />
          <ProTipCard />
        </aside>
      </div>

      {toastMessage ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 right-6 z-20"
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white shadow-[0_18px_40px_rgba(15,23,42,0.24)]">
            {toastMessage}
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
