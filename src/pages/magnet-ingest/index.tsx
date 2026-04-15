import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  Loader2,
  Tv,
  X,
} from 'lucide-react'

import { LibraryLinkPicker } from '@/components/magnet-ingest/library-link-picker'
import { RecentTasksTable } from '@/components/magnet-ingest/recent-tasks-table'
import {
  NodeStatusCard,
  ProTipCard,
  SystemLogsCard,
} from '@/components/magnet-ingest/status-cards'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { createMovieMagnetIngest } from '@/lib/api/magnet-ingest'
import {
  isRequestCanceledError,
  searchMovies,
} from '@/lib/api/resources'
import {
  defaultSelectedSeries,
  defaultMagnetText,
  initialRecentTasks,
  systemLogEntries,
  targetSeasonOptions,
} from '@/data/mock-magnet-ingest'
import { cn } from '@/lib/utils'
import type {
  CreateMovieMagnetIngestPayload,
  IngestMode,
  MockSeriesSelection,
} from '@/types/magnet-ingest'
import type { MovieSearchItem } from '@/types/resources'

type MovieSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'
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

function SeriesPoster({
  poster,
  title,
}: {
  poster: string
  title: string
}) {
  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
      {poster ? (
        <img src={poster} alt={title} className="h-full w-full object-cover" />
      ) : (
        <Tv className="h-4 w-4 text-slate-400" />
      )}
    </div>
  )
}

function SelectedSeriesCard({
  selectedSeries,
  onClear,
  onRestore,
}: {
  selectedSeries: MockSeriesSelection | null
  onClear: () => void
  onRestore: () => void
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-shell">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        Current Binding
      </p>

      {selectedSeries ? (
        <div className="mt-3 flex items-center gap-4">
          <SeriesPoster
            poster={selectedSeries.poster}
            title={selectedSeries.title}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-slate-950">
              {selectedSeries.title}
            </p>
            <p className="truncate text-sm text-slate-500">
              {selectedSeries.subtitle}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-slate-950" />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClear}
              className="h-10 w-10 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              aria-label="清除剧集绑定"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Tv className="h-4 w-4 shrink-0 text-slate-400" />
            <span>当前阶段剧集模式先展示前端 mock 已选条目，不接真实剧集搜索接口。</span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRestore}
            className="mt-4 h-9 rounded-full border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-white"
          >
            恢复示例剧集
          </Button>
        </div>
      )}
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

export function MagnetIngestPage() {
  const [mode, setMode] = useState<IngestMode>('movie')
  const [magnetInput, setMagnetInput] = useState(getInitialMagnetText)
  const [mediaKeyword, setMediaKeyword] = useState('')
  const [movieSearchStatus, setMovieSearchStatus] =
    useState<MovieSearchStatus>('idle')
  const [movieResults, setMovieResults] = useState<MovieSearchItem[]>([])
  const [selectedMovie, setSelectedMovie] = useState<MovieSearchItem | null>(
    null,
  )
  const [selectedSeries, setSelectedSeries] =
    useState<MockSeriesSelection | null>(defaultSelectedSeries)
  const [targetSeason, setTargetSeason] = useState(4)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [searchError, setSearchError] = useState<string | null>(null)
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

  function resetSubmitFeedback() {
    setSubmitStatus('idle')
    setSubmitError(null)
    setSubmitSuccessMessage(null)
  }

  function handleModeChange(nextMode: IngestMode) {
    if (nextMode === mode) {
      return
    }

    if (nextMode === 'series') {
      activeSearchControllerRef.current?.abort()
      activeSearchControllerRef.current = null
      setMovieSearchStatus((currentStatus) =>
        currentStatus === 'loading' ? 'idle' : currentStatus,
      )
    }

    setMode(nextMode)
    resetSubmitFeedback()
  }

  function handleMediaKeywordChange(value: string) {
    latestSearchRequestIdRef.current += 1
    activeSearchControllerRef.current?.abort()
    activeSearchControllerRef.current = null
    setMediaKeyword(value)
    setMovieSearchStatus('idle')
    setMovieResults([])
    setSearchError(null)
  }

  function handleMovieSearchSubmit() {
    if (movieSearchStatus === 'loading') {
      return
    }

    const keyword = mediaKeyword.trim()
    latestSearchRequestIdRef.current += 1
    const requestId = latestSearchRequestIdRef.current

    activeSearchControllerRef.current?.abort()
    activeSearchControllerRef.current = null

    if (!keyword) {
      setMovieSearchStatus('idle')
      setMovieResults([])
      setSearchError(null)
      return
    }

    const controller = new AbortController()
    activeSearchControllerRef.current = controller

    setMovieSearchStatus('loading')
    setMovieResults([])
    setSearchError(null)

    void searchMovies(keyword, controller.signal)
      .then((items) => {
        if (latestSearchRequestIdRef.current !== requestId) {
          return
        }

        setMovieSearchStatus(items.length > 0 ? 'success' : 'empty')
        setMovieResults(items)
        setSearchError(null)
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
        setSearchError(
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
        const message = '请先保留一个剧集 mock 项目'
        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
        return
      }

      const message = `剧集离线直收接口暂未接入（${selectedSeries.title} · Season ${targetSeason}）`
      setSubmitStatus('idle')
      setSubmitError(null)
      setSubmitSuccessMessage(null)
      setToastMessage(message)
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
                    : '当前为剧集模式前端 mock 展示，暂不接入真实剧集搜索接口。'
                }
              />

              <MediaTypeToggle mode={mode} onChange={handleModeChange} />
            </div>

            {mode === 'movie' ? (
              <LibraryLinkPicker
                keyword={mediaKeyword}
                items={movieResults}
                selectedItem={selectedMovie}
                searchStatus={movieSearchStatus}
                searchError={searchError}
                searchDisabled={movieSearchStatus === 'loading'}
                onKeywordChange={handleMediaKeywordChange}
                onSearchSubmit={handleMovieSearchSubmit}
                onSelectItem={(item) => {
                  setSelectedMovie(item)
                  resetSubmitFeedback()
                }}
                onClearSelection={() => {
                  setSelectedMovie(null)
                  resetSubmitFeedback()
                }}
              />
            ) : (
              <SelectedSeriesCard
                selectedSeries={selectedSeries}
                onClear={() => {
                  setSelectedSeries(null)
                  resetSubmitFeedback()
                }}
                onRestore={() => {
                  setSelectedSeries(defaultSelectedSeries)
                  resetSubmitFeedback()
                }}
              />
            )}
          </section>

          {mode === 'series' ? (
            <section className="space-y-3">
              <SectionHeading
                label="目标季数 (Target Season)"
                title="当前使用本地 mock 季数选项，为后续剧集接口接入预留状态位置。"
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
