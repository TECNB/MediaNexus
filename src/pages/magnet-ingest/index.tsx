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
  createAnimeMagnetIngestTask,
  createMovieMagnetIngest,
  createSeriesMagnetIngest,
  listAnimeMagnetIngestTaskLogs,
  listAnimeMagnetIngestTasks,
  searchAnimeMagnetItems,
} from '@/lib/api/magnet-ingest'
import {
  getSeriesSeasons,
  isRequestCanceledError,
  searchMovies,
  searchSeries,
} from '@/lib/api/resources'
import {
  defaultMagnetText,
  initialRecentTasks,
  systemLogEntries,
  type RecentIngestTask,
  type RecentIngestTaskStatus,
} from '@/data/mock-magnet-ingest'
import { cn } from '@/lib/utils'
import type {
  AnimeMagnetSearchItem,
  AnimeMagnetIngestTask,
  AnimeMagnetIngestTaskLog,
  AnimeMagnetIngestTaskStatus,
  CreateAnimeMagnetIngestTaskPayload,
  CreateMovieMagnetIngestPayload,
  CreateSeriesMagnetIngestPayload,
  IngestMode,
} from '@/types/magnet-ingest'
import type { MovieSearchItem, SeriesSearchItem } from '@/types/resources'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'
type SeriesSeasonStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

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
    { label: '电视剧(TV)', value: 'series' },
    { label: '动漫(Anime)', value: 'anime' },
  ]

  return (
    <div className="flex w-full rounded-2xl border border-slate-200 bg-slate-100/80 p-1 md:w-auto">
      {options.map((option) => {
        const isActive = option.value === mode

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-w-0 flex-1 whitespace-nowrap rounded-[14px] px-3 py-2 text-sm font-semibold transition-all md:flex-none md:px-4',
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
  options,
  status,
  error,
  onChange,
}: {
  value: number | null
  options: number[]
  status: SeriesSeasonStatus
  error: string | null
  onChange: (value: number) => void
}) {
  const isDisabled = status !== 'success'
  const placeholder =
    status === 'loading'
      ? 'Loading seasons...'
      : status === 'empty'
        ? 'No seasons available'
        : status === 'error'
          ? 'Failed to load seasons'
          : '请选择目标季数'

  return (
    <div className="space-y-2">
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="选择目标季数"
          disabled={isDisabled}
          className="h-14 w-full appearance-none rounded-[20px] border border-slate-200 bg-white px-5 pr-14 text-base font-medium text-slate-950 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200/60 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((seasonNumber) => {
            const seasonLabel = String(seasonNumber).padStart(2, '0')

            return (
              <option key={seasonNumber} value={seasonNumber}>
                {`第 ${seasonNumber} 季 (Season ${seasonLabel})`}
              </option>
            )
          })}
        </select>

        <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      </div>

      {status === 'loading' ? (
        <p className="text-sm text-slate-500">正在拉取当前剧集的可用季数...</p>
      ) : null}

      {status === 'empty' ? (
        <p className="text-sm text-slate-500">当前剧集暂无可用季数，暂时无法提交。</p>
      ) : null}

      {status === 'error' && error ? (
        <p className="text-sm text-rose-500">{error}</p>
      ) : null}
    </div>
  )
}

function hasValidTvdbId(series: SeriesSearchItem | null) {
  return typeof series?.tvdb_id === 'number' && series.tvdb_id > 0
}

function isValidSeasonNumber(value: number | null, options: number[]) {
  return typeof value === 'number' && options.includes(value)
}

function normalizeSeasonNumbers(seasonNumbers: number[]) {
  return Array.from(
    new Set(
      seasonNumbers.filter(
        (seasonNumber) => Number.isInteger(seasonNumber) && seasonNumber > 0,
      ),
    ),
  )
}

function getSeasonLoadValidationMessage({
  selectedSeries,
  seriesSeasonStatus,
  selectedSeasonNumber,
  seriesSeasonOptions,
  seriesSeasonError,
}: {
  selectedSeries: SeriesSearchItem | null
  seriesSeasonStatus: SeriesSeasonStatus
  selectedSeasonNumber: number | null
  seriesSeasonOptions: number[]
  seriesSeasonError: string | null
}) {
  if (!selectedSeries) {
    return '请先选择一个剧集项目'
  }

  if (!hasValidTvdbId(selectedSeries)) {
    return '当前剧集缺少有效的 TVDB ID，无法加载季数。'
  }

  if (seriesSeasonStatus === 'loading') {
    return '季数仍在加载中，请稍候。'
  }

  if (seriesSeasonStatus === 'error') {
    return seriesSeasonError || '剧集季数加载失败，请稍后重试。'
  }

  if (seriesSeasonStatus === 'empty') {
    return '当前剧集暂无可用季数，暂时无法提交。'
  }

  if (
    seriesSeasonStatus !== 'success' ||
    !isValidSeasonNumber(selectedSeasonNumber, seriesSeasonOptions)
  ) {
    return '请先选择有效的目标季数'
  }

  return null
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
  seasonNumber: number | null,
): CreateSeriesMagnetIngestPayload | null {
  const title = selectedSeries.title.trim()
  const originalTitle = selectedSeries.original_title?.trim() || title

  if (!title || seasonNumber === null || !Number.isInteger(seasonNumber)) {
    return null
  }

  return {
    magnet,
    title,
    original_title: originalTitle,
    season_number: seasonNumber,
  }
}

function getAnimeMagnetIngestPayload(
  magnet: string,
  selectedAnime: AnimeMagnetSearchItem,
): CreateAnimeMagnetIngestTaskPayload | null {
  const title = selectedAnime.title.trim()
  const seasonNumber = selectedAnime.season ?? 1

  if (!title || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return null
  }

  return {
    magnet,
    bgm_id: selectedAnime.bgm_id,
    bgm_url: selectedAnime.bgm_url,
    title,
    name_cn: selectedAnime.name_cn,
    name: selectedAnime.name,
    season_number: seasonNumber,
  }
}

function toRecentTaskStatus(
  status: AnimeMagnetIngestTaskStatus,
): RecentIngestTaskStatus {
  switch (status) {
    case 'PENDING':
      return 'parsing'
    case 'SUBMITTED':
      return 'submitted'
    case 'DOWNLOADING':
    case 'ORGANIZING':
      return 'downloading'
    case 'SUCCEEDED':
      return 'completed'
    case 'PARTIAL_SUCCESS':
      return 'partial'
    case 'INTERRUPTED':
      return 'interrupted'
    case 'FAILED':
    default:
      return 'failed'
  }
}

function formatTaskTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toRecentIngestTask(task: AnimeMagnetIngestTask): RecentIngestTask {
  return {
    id: task.id,
    name: task.magnet_hash,
    libraryTitle: `${task.title} Season ${task.season_number}`,
    status: toRecentTaskStatus(task.status),
    time: formatTaskTime(task.updated_at ?? task.created_at),
  }
}

function isMovieSearchItem(item: unknown): item is MovieSearchItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'tmdb_id' in item &&
    !('tvdb_id' in item) &&
    !('bgm_id' in item)
  )
}

function isSeriesSearchItem(item: unknown): item is SeriesSearchItem {
  return typeof item === 'object' && item !== null && 'tvdb_id' in item
}

function isAnimeMagnetSearchItem(item: unknown): item is AnimeMagnetSearchItem {
  return typeof item === 'object' && item !== null && 'bgm_id' in item
}

export function MagnetIngestPage() {
  const [mode, setMode] = useState<IngestMode>('movie')
  const [magnetInput, setMagnetInput] = useState(getInitialMagnetText)
  const [movieKeyword, setMovieKeyword] = useState('')
  const [seriesKeyword, setSeriesKeyword] = useState('')
  const [animeKeyword, setAnimeKeyword] = useState('')
  const [movieSearchStatus, setMovieSearchStatus] =
    useState<ResourceSearchStatus>('idle')
  const [seriesSearchStatus, setSeriesSearchStatus] =
    useState<ResourceSearchStatus>('idle')
  const [animeSearchStatus, setAnimeSearchStatus] =
    useState<ResourceSearchStatus>('idle')
  const [movieResults, setMovieResults] = useState<MovieSearchItem[]>([])
  const [seriesResults, setSeriesResults] = useState<SeriesSearchItem[]>([])
  const [animeResults, setAnimeResults] = useState<AnimeMagnetSearchItem[]>([])
  const [selectedMovie, setSelectedMovie] = useState<MovieSearchItem | null>(
    null,
  )
  const [selectedSeries, setSelectedSeries] = useState<SeriesSearchItem | null>(
    null,
  )
  const [selectedAnime, setSelectedAnime] =
    useState<AnimeMagnetSearchItem | null>(null)
  const [seriesSeasonStatus, setSeriesSeasonStatus] =
    useState<SeriesSeasonStatus>('idle')
  const [seriesSeasonOptions, setSeriesSeasonOptions] = useState<number[]>([])
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(
    null,
  )
  const [seriesSeasonError, setSeriesSeasonError] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [movieSearchError, setMovieSearchError] = useState<string | null>(null)
  const [seriesSearchError, setSeriesSearchError] = useState<string | null>(null)
  const [animeSearchError, setAnimeSearchError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(
    null,
  )
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [animeTasks, setAnimeTasks] = useState<AnimeMagnetIngestTask[]>([])
  const [animeTasksStatus, setAnimeTasksStatus] =
    useState<ResourceSearchStatus>('idle')
  const [animeTasksError, setAnimeTasksError] = useState<string | null>(null)
  const [selectedAnimeTaskId, setSelectedAnimeTaskId] = useState<string | null>(
    null,
  )
  const [animeTaskLogs, setAnimeTaskLogs] = useState<AnimeMagnetIngestTaskLog[]>(
    [],
  )
  const [animeTaskLogsStatus, setAnimeTaskLogsStatus] =
    useState<ResourceSearchStatus>('idle')
  const [animeTaskLogsError, setAnimeTaskLogsError] = useState<string | null>(
    null,
  )
  const latestSearchRequestIdRef = useRef(0)
  const activeSearchControllerRef = useRef<AbortController | null>(null)
  const latestSeriesSeasonRequestIdRef = useRef(0)
  const activeSeriesSeasonControllerRef = useRef<AbortController | null>(null)

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
      activeSeriesSeasonControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (mode !== 'series' || !selectedSeries) {
      return
    }

    const tvdbId = selectedSeries.tvdb_id

    if (typeof tvdbId !== 'number' || tvdbId <= 0) {
      setSeriesSeasonStatus('error')
      setSeriesSeasonOptions([])
      setSelectedSeasonNumber(null)
      setSeriesSeasonError('当前剧集缺少有效的 TVDB ID，无法加载季数。')
      return
    }

    latestSeriesSeasonRequestIdRef.current += 1
    const requestId = latestSeriesSeasonRequestIdRef.current
    activeSeriesSeasonControllerRef.current?.abort()

    const controller = new AbortController()
    activeSeriesSeasonControllerRef.current = controller

    setSeriesSeasonStatus('loading')
    setSeriesSeasonOptions([])
    setSelectedSeasonNumber(null)
    setSeriesSeasonError(null)

    void getSeriesSeasons(tvdbId, controller.signal)
      .then((data) => {
        if (latestSeriesSeasonRequestIdRef.current !== requestId) {
          return
        }

        const nextSeasonOptions = normalizeSeasonNumbers(data.season_numbers)

        if (nextSeasonOptions.length === 0) {
          setSeriesSeasonStatus('empty')
          setSeriesSeasonOptions([])
          setSelectedSeasonNumber(null)
          setSeriesSeasonError(null)
          return
        }

        setSeriesSeasonStatus('success')
        setSeriesSeasonOptions(nextSeasonOptions)
        setSelectedSeasonNumber(nextSeasonOptions[0])
        setSeriesSeasonError(null)
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }

        if (latestSeriesSeasonRequestIdRef.current !== requestId) {
          return
        }

        console.error('series seasons fetch failed', error)

        setSeriesSeasonStatus('error')
        setSeriesSeasonOptions([])
        setSelectedSeasonNumber(null)
        setSeriesSeasonError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '剧集季数加载失败，请稍后重试。',
        )
      })
      .finally(() => {
        if (activeSeriesSeasonControllerRef.current === controller) {
          activeSeriesSeasonControllerRef.current = null
        }
      })

    return () => {
      controller.abort()

      if (activeSeriesSeasonControllerRef.current === controller) {
        activeSeriesSeasonControllerRef.current = null
      }
    }
  }, [mode, selectedSeries])

  useEffect(() => {
    if (mode !== 'anime') {
      return
    }

    void loadAnimeTasks()
  }, [mode])

  useEffect(() => {
    if (mode !== 'anime' || !selectedAnimeTaskId) {
      setAnimeTaskLogs([])
      setAnimeTaskLogsStatus('idle')
      setAnimeTaskLogsError(null)
      return
    }

    setAnimeTaskLogsStatus('loading')
    setAnimeTaskLogsError(null)

    void listAnimeMagnetIngestTaskLogs(selectedAnimeTaskId)
      .then((logs) => {
        setAnimeTaskLogs(logs)
        setAnimeTaskLogsStatus(logs.length > 0 ? 'success' : 'empty')
        setAnimeTaskLogsError(null)
      })
      .catch((error) => {
        setAnimeTaskLogs([])
        setAnimeTaskLogsStatus('error')
        setAnimeTaskLogsError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '任务日志加载失败，请稍后重试。',
        )
      })
  }, [mode, selectedAnimeTaskId])

  const magnetValidationMessage = getMagnetValidationMessage(magnetInput)
  const seriesSeasonValidationMessage = getSeasonLoadValidationMessage({
    selectedSeries,
    seriesSeasonStatus,
    selectedSeasonNumber,
    seriesSeasonOptions,
    seriesSeasonError,
  })
  const isPushDisabled =
    !magnetInput.trim() ||
    Boolean(magnetValidationMessage) ||
    submitStatus === 'loading' ||
    (mode === 'movie'
      ? !selectedMovie
      : mode === 'series'
        ? Boolean(seriesSeasonValidationMessage)
        : !selectedAnime)

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

  function resetSeriesSeasonState() {
    latestSeriesSeasonRequestIdRef.current += 1
    activeSeriesSeasonControllerRef.current?.abort()
    activeSeriesSeasonControllerRef.current = null
    setSeriesSeasonStatus('idle')
    setSeriesSeasonOptions([])
    setSelectedSeasonNumber(null)
    setSeriesSeasonError(null)
  }

  function resetSeriesModeState() {
    setSeriesKeyword('')
    setSeriesSearchStatus('idle')
    setSeriesResults([])
    setSelectedSeries(null)
    setSeriesSearchError(null)
    resetSeriesSeasonState()
  }

  function resetAnimeModeState() {
    setAnimeKeyword('')
    setAnimeSearchStatus('idle')
    setAnimeResults([])
    setSelectedAnime(null)
    setAnimeSearchError(null)
  }

  async function loadAnimeTasks() {
    setAnimeTasksStatus('loading')
    setAnimeTasksError(null)

    try {
      const tasks = await listAnimeMagnetIngestTasks()
      setAnimeTasks(tasks)
      setAnimeTasksStatus(tasks.length > 0 ? 'success' : 'empty')
      if (!selectedAnimeTaskId && tasks.length > 0) {
        setSelectedAnimeTaskId(tasks[0].id)
      }
    } catch (error) {
      setAnimeTasks([])
      setAnimeTasksStatus('error')
      setAnimeTasksError(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : '动漫任务加载失败，请稍后重试。',
      )
    }
  }

  function handleModeChange(nextMode: IngestMode) {
    if (nextMode === mode) {
      return
    }

    abortActiveSearch()

    if (mode === 'movie') {
      resetMovieModeState()
    } else if (mode === 'series') {
      resetSeriesModeState()
    } else {
      resetAnimeModeState()
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

  function handleAnimeKeywordChange(value: string) {
    abortActiveSearch()
    setAnimeKeyword(value)
    setAnimeSearchStatus('idle')
    setAnimeResults([])
    setSelectedAnime(null)
    setAnimeSearchError(null)
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

  function handleAnimeSearchSubmit() {
    if (animeSearchStatus === 'loading') {
      return
    }

    const keyword = animeKeyword.trim()
    abortActiveSearch()
    const requestId = latestSearchRequestIdRef.current

    if (!keyword) {
      setAnimeSearchStatus('idle')
      setAnimeResults([])
      setAnimeSearchError(null)
      return
    }

    const controller = new AbortController()
    activeSearchControllerRef.current = controller

    setAnimeSearchStatus('loading')
    setAnimeResults([])
    setAnimeSearchError(null)

    void searchAnimeMagnetItems(keyword, controller.signal)
      .then((items) => {
        if (latestSearchRequestIdRef.current !== requestId) {
          return
        }

        setAnimeSearchStatus(items.length > 0 ? 'success' : 'empty')
        setAnimeResults(items)
        setAnimeSearchError(null)
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }

        if (latestSearchRequestIdRef.current !== requestId) {
          return
        }

        console.error('anime magnet search failed', error)

        setAnimeSearchStatus('error')
        setAnimeResults([])
        setAnimeSearchError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '动漫搜索失败，请稍后重试。',
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
      const seasonValidationMessage = getSeasonLoadValidationMessage({
        selectedSeries,
        seriesSeasonStatus,
        selectedSeasonNumber,
        seriesSeasonOptions,
        seriesSeasonError,
      })

      if (seasonValidationMessage) {
        setSubmitStatus('error')
        setSubmitError(seasonValidationMessage)
        setSubmitSuccessMessage(null)
        setToastMessage(seasonValidationMessage)
        return
      }

      if (!selectedSeries || selectedSeasonNumber === null) {
        const message = '请先选择有效的目标季数'
        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
        return
      }

      const payload = getSeriesMagnetIngestPayload(
        normalizedMagnet,
        selectedSeries,
        selectedSeasonNumber,
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

    if (mode === 'anime') {
      if (!selectedAnime) {
        const message = '请先选择一个动漫项目'
        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
        return
      }

      const payload = getAnimeMagnetIngestPayload(
        normalizedMagnet,
        selectedAnime,
      )

      if (!payload) {
        const message = '所选动漫缺少标题或季数，暂时无法提交'
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
        const task = await createAnimeMagnetIngestTask(payload)
        const successMessage = `动漫整季任务已创建：${task.id}`

        setSubmitStatus('success')
        setSubmitSuccessMessage(successMessage)
        setSelectedAnimeTaskId(task.id)
        setMagnetInput('')
        setToastMessage(successMessage)
        await loadAnimeTasks()
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '推送失败，请稍后重试'

        console.error('anime magnet ingest failed', error)

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
                    : mode === 'series'
                      ? '使用剧集搜索接口查询媒体库项目，并从结果中单选一个剧集进行绑定。'
                      : '使用 Bangumi 搜索接口查询动漫条目，并从结果中单选一个动漫进行绑定。'
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
                  if (isMovieSearchItem(item)) {
                    setSelectedMovie(item)
                  }
                  resetSubmitFeedback()
                }}
                onClearSelection={() => {
                  setSelectedMovie(null)
                  resetSubmitFeedback()
                }}
              />
            ) : mode === 'series' ? (
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
                  if (isSeriesSearchItem(item)) {
                    setSelectedSeries(item)
                  }
                  resetSubmitFeedback()
                }}
                onClearSelection={() => {
                  setSelectedSeries(null)
                  resetSeriesSeasonState()
                  resetSubmitFeedback()
                }}
              />
            ) : (
              <LibraryLinkPicker
                mode="anime"
                keyword={animeKeyword}
                items={animeResults}
                selectedItem={selectedAnime}
                searchStatus={animeSearchStatus}
                searchError={animeSearchError}
                searchDisabled={animeSearchStatus === 'loading'}
                onKeywordChange={handleAnimeKeywordChange}
                onSearchSubmit={handleAnimeSearchSubmit}
                onSelectItem={(item) => {
                  if (isAnimeMagnetSearchItem(item)) {
                    setSelectedAnime(item)
                  }
                  resetSubmitFeedback()
                }}
                onClearSelection={() => {
                  setSelectedAnime(null)
                  resetSubmitFeedback()
                }}
              />
            )}
          </section>

          {mode === 'series' ? (
            <section className="space-y-3">
              <SectionHeading
                label="目标季数 (Target Season)"
                title="选中剧集后会动态拉取真实可用季数，并用于电视剧离线直收提交。"
              />

              <TargetSeasonSelect
                value={selectedSeasonNumber}
                options={seriesSeasonOptions}
                status={seriesSeasonStatus}
                error={seriesSeasonError}
                onChange={(value) => {
                  setSelectedSeasonNumber(value)
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
                {mode === 'anime'
                  ? '创建动漫整季任务'
                  : '推送至离线下载 (Push to Offline)'}
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
            tasks={
              mode === 'anime'
                ? animeTasks.map(toRecentIngestTask)
                : initialRecentTasks
            }
            description={
              mode === 'anime'
                ? '展示最近的动漫整季磁力任务，可点击任务查看日志。'
                : undefined
            }
            actionLabel={mode === 'anime' ? '刷新' : 'VIEW ALL'}
            emptyMessage={
              animeTasksStatus === 'loading' ? '正在加载任务...' : '暂无动漫任务'
            }
            selectedTaskId={mode === 'anime' ? selectedAnimeTaskId : null}
            onSelectTask={
              mode === 'anime'
                ? (task) => {
                    setSelectedAnimeTaskId(task.id)
                  }
                : undefined
            }
            onViewAll={() => {
              if (mode === 'anime') {
                void loadAnimeTasks()
                return
              }

              setToastMessage('Recent Tasks 暂保持静态 mock')
            }}
          />

          {mode === 'anime' && animeTasksError ? (
            <p className="text-sm text-rose-500">{animeTasksError}</p>
          ) : null}

          {mode === 'anime' && selectedAnimeTaskId ? (
            <section className="space-y-3">
              <SectionHeading
                label="Task Logs"
                title="展示所选动漫磁力任务的后端执行日志。"
              />

              <div className="rounded-[20px] border border-slate-200 bg-slate-950 p-4 text-sm text-slate-100">
                {animeTaskLogsStatus === 'loading' ? (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载日志...
                  </div>
                ) : null}

                {animeTaskLogsStatus === 'error' ? (
                  <p className="text-rose-200">
                    {animeTaskLogsError ?? '任务日志加载失败'}
                  </p>
                ) : null}

                {animeTaskLogsStatus === 'empty' ? (
                  <p className="text-slate-400">暂无日志</p>
                ) : null}

                {animeTaskLogsStatus === 'success' ? (
                  <div className="max-h-[320px] space-y-2 overflow-y-auto font-mono text-xs leading-6">
                    {animeTaskLogs.map((entry) => (
                      <div key={entry.id} className="text-slate-300">
                        <span className="text-slate-500">
                          {formatTaskTime(entry.created_at)}
                        </span>{' '}
                        <span
                          className={cn(
                            'font-semibold',
                            entry.level === 'ERROR'
                              ? 'text-rose-300'
                              : entry.level === 'WARN'
                                ? 'text-amber-300'
                                : 'text-emerald-300',
                          )}
                        >
                          {entry.level}
                        </span>{' '}
                        <span className="text-slate-500">[{entry.stage}]</span>{' '}
                        <span>{entry.message}</span>
                        {entry.detail ? (
                          <span className="block break-all pl-4 text-slate-500">
                            {entry.detail}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
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
