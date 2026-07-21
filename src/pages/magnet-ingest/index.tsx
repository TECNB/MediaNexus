import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CloudUpload, Loader2 } from 'lucide-react'

import {
  LibraryLinkPicker,
  type ResourceSearchStatus,
} from '@/components/magnet-ingest/library-link-picker'
import { RecentTasksTable } from '@/components/magnet-ingest/recent-tasks-table'
import {
  NodeStatusCard,
  ProTipCard,
  TaskLogsCard,
} from '@/components/magnet-ingest/status-cards'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { SelectControl } from '@/components/ui/form-control'
import {
  createAdultMagnetIngestTask,
  createAnimeMagnetIngestTask,
  createMovieMagnetIngest,
  createSeriesMagnetIngest,
  listAdultMagnetIngestTaskLogs,
  listAdultMagnetIngestTasks,
  listAnimeMagnetIngestTaskLogs,
  listAnimeMagnetIngestTasks,
  listMovieMagnetIngestTaskLogs,
  listMovieMagnetIngestTasks,
  listSeriesMagnetIngestTaskLogs,
  listSeriesMagnetIngestTasks,
} from '@/lib/api/magnet-ingest'
import {
  getSeriesSeasons,
  isRequestCanceledError,
  searchMovies,
  searchSeries,
} from '@/lib/api/resources'
import {
  type RecentIngestTask,
  type RecentIngestTaskStatus,
} from '@/data/mock-magnet-ingest'
import { useAuth } from '@/lib/use-auth'
import { checkMediaLibraryIngestAllowed } from '@/lib/media-library-presence'
import { cn } from '@/lib/utils'
import type {
  AdultMagnetCategory,
  AdultMagnetIngestTask,
  AnimeMagnetIngestTask,
  CreateAdultMagnetIngestTaskPayload,
  CreateAnimeMagnetIngestTaskPayload,
  CreateMovieMagnetIngestPayload,
  CreateSeriesMagnetIngestPayload,
  IngestMode,
  MagnetIngestTaskLog,
  MagnetIngestTaskStatus,
  MovieMagnetIngestTask,
  SeriesMagnetIngestTask,
} from '@/types/magnet-ingest'
import type { MovieSearchItem, SeriesSearchItem } from '@/types/resources'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'
type SeriesSeasonStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'
type CreatedTaskTarget = {
  taskType: IngestMode
  taskId: string
}

const TASK_LOG_POLL_INTERVAL_MS = 2000
const TASK_LIST_POLL_INTERVAL_MS = 5000
const FINISHED_TASK_STATUSES = new Set<MagnetIngestTaskStatus>([
  'SUCCEEDED',
  'PARTIAL_SUCCESS',
  'FAILED',
  'INTERRUPTED',
])

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
  isAdmin,
  onChange,
}: {
  mode: IngestMode
  isAdmin: boolean
  onChange: (mode: IngestMode) => void
}) {
  const options: Array<{ label: string; value: IngestMode }> = [
    { label: '电影', value: 'movie' },
    { label: '电视剧', value: 'series' },
    { label: '动漫', value: 'anime' },
    ...(isAdmin ? [{ label: 'Adult', value: 'adult' as const }] : []),
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

function AdultCategoryToggle({
  category,
  onChange,
}: {
  category: AdultMagnetCategory
  onChange: (category: AdultMagnetCategory) => void
}) {
  const options: Array<{ label: string; value: AdultMagnetCategory }> = [
    { label: 'JAV', value: 'JAV' },
    { label: 'Other', value: 'OTHER' },
  ]

  return (
    <div className="flex w-full rounded-2xl border border-slate-200 bg-slate-100/80 p-1 md:w-auto">
      {options.map((option) => {
        const isActive = option.value === category

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-w-0 flex-1 whitespace-nowrap rounded-[14px] px-4 py-2 text-sm font-semibold transition-all md:flex-none',
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
  mediaLabel,
  onChange,
}: {
  value: number | null
  options: number[]
  status: SeriesSeasonStatus
  error: string | null
  mediaLabel: '剧集' | '动漫'
  onChange: (value: number) => void
}) {
  const isDisabled = status !== 'success'
  const placeholder =
    status === 'loading'
      ? '正在加载季数...'
      : status === 'empty'
        ? '暂无可用季数'
        : status === 'error'
          ? '季数加载失败'
          : '请选择目标季数'

  return (
    <div className="space-y-2">
      <SelectControl
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="选择目标季数"
        disabled={isDisabled}
        className="h-14 rounded-[20px] px-5 pr-14 text-base text-slate-950"
        chevronClassName="right-5 h-5 w-5"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((seasonNumber) => {
          return (
            <option key={seasonNumber} value={seasonNumber}>
              {`第 ${seasonNumber} 季`}
            </option>
          )
        })}
      </SelectControl>

      {status === 'loading' ? (
        <p className="text-sm text-slate-500">正在拉取当前{mediaLabel}的可用季数...</p>
      ) : null}

      {status === 'empty' ? (
        <p className="text-sm text-slate-500">当前{mediaLabel}暂无可用季数，暂时无法提交。</p>
      ) : null}

      {status === 'error' && error ? (
        <p className="text-sm text-rose-500">{error}</p>
      ) : null}
    </div>
  )
}

function hasValidTmdbId(series: SeriesSearchItem | null) {
  return typeof series?.tmdb_id === 'number' && series.tmdb_id > 0
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
  selectedItem,
  mediaLabel,
  seriesSeasonStatus,
  selectedSeasonNumber,
  seriesSeasonOptions,
  seriesSeasonError,
}: {
  selectedItem: SeriesSearchItem | null
  mediaLabel: '剧集' | '动漫'
  seriesSeasonStatus: SeriesSeasonStatus
  selectedSeasonNumber: number | null
  seriesSeasonOptions: number[]
  seriesSeasonError: string | null
}) {
  if (!selectedItem) {
    return `请先选择一个${mediaLabel}项目`
  }

  if (!hasValidTmdbId(selectedItem)) {
    return `当前${mediaLabel}缺少有效的 TMDB ID，无法加载季数。`
  }

  if (seriesSeasonStatus === 'loading') {
    return '季数仍在加载中，请稍候。'
  }

  if (seriesSeasonStatus === 'error') {
    return seriesSeasonError || `${mediaLabel}季数加载失败，请稍后重试。`
  }

  if (seriesSeasonStatus === 'empty') {
    return `当前${mediaLabel}暂无可用季数，暂时无法提交。`
  }

  if (
    seriesSeasonStatus !== 'success' ||
    !isValidSeasonNumber(selectedSeasonNumber, seriesSeasonOptions)
  ) {
    return '请先选择有效的目标季数'
  }

  return null
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

function getAdultMagnetLines(magnetInput: string) {
  return magnetInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function getAdultMagnetValidationMessage(
  magnetInput: string,
  treatEmptyAsError = false,
) {
  const magnetLines = getAdultMagnetLines(magnetInput)

  if (magnetLines.length === 0) {
    return treatEmptyAsError ? '请输入至少一条 magnet 或 ed2k 链接' : null
  }

  if (magnetLines.length > 50) {
    return '单批最多提交 50 条下载链接'
  }

  for (const [index, line] of magnetLines.entries()) {
    const linkMatchCount = (line.match(/magnet:\?|ed2k:\/\//gi) ?? []).length
    const lowerCaseLine = line.toLowerCase()
    if (
      linkMatchCount !== 1 ||
      (!lowerCaseLine.startsWith('magnet:?') &&
        !lowerCaseLine.startsWith('ed2k://'))
    ) {
      return `第 ${index + 1} 行不是有效的 magnet 或 ed2k 链接`
    }
  }

  return null
}

function formatAdultPreviewDate(date: Date) {
  return `${date.getMonth() + 1}.${date.getDate()}`
}

const adultCategoryLabel: Record<AdultMagnetCategory, string> = {
  JAV: 'JAV',
  OTHER: 'Other',
}

function getMovieMagnetIngestPayload(
  magnet: string,
  selectedMovie: MovieSearchItem,
): CreateMovieMagnetIngestPayload | null {
  const title = selectedMovie.title.trim()
  const originalTitle = selectedMovie.original_title?.trim() || title
  const year = selectedMovie.year

  if (!title || typeof year !== 'number') {
    return null
  }

  return {
    magnet,
    title,
    original_title: originalTitle,
    year,
    tmdb_id: selectedMovie.tmdb_id,
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
    tmdb_id: selectedSeries.tmdb_id,
  }
}

function getAnimeMagnetIngestPayload(
  magnet: string,
  selectedAnime: SeriesSearchItem,
  seasonNumber: number | null,
): CreateAnimeMagnetIngestTaskPayload | null {
  const title = selectedAnime.title.trim()
  const tmdbId = selectedAnime.tmdb_id

  if (
    !title ||
    typeof tmdbId !== 'number' ||
    tmdbId <= 0 ||
    seasonNumber === null ||
    !Number.isInteger(seasonNumber) ||
    seasonNumber <= 0
  ) {
    return null
  }

  return {
    magnet,
    tmdb_id: tmdbId,
    title,
    name_cn: title,
    name: selectedAnime.original_title?.trim() || null,
    season_number: seasonNumber,
  }
}

function getAdultMagnetIngestPayload(
  magnetInput: string,
  category: AdultMagnetCategory,
): CreateAdultMagnetIngestTaskPayload | null {
  const magnets = getAdultMagnetLines(magnetInput)

  if (magnets.length === 0 || magnets.length > 50) {
    return null
  }

  return {
    category,
    magnets,
  }
}

function toRecentTaskStatus(
  status: MagnetIngestTaskStatus,
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

function isFinishedTaskStatus(status: MagnetIngestTaskStatus) {
  return FINISHED_TASK_STATUSES.has(status)
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

function containsChineseText(value: string) {
  return /[\u4e00-\u9fff]/.test(value)
}

function preferredChineseText(...values: Array<string | null | undefined>) {
  let fallback: string | null = null

  for (const value of values) {
    const candidate = value?.trim()
    if (!candidate) {
      continue
    }
    fallback ??= candidate
    if (containsChineseText(candidate)) {
      return candidate
    }
  }

  return fallback
}

function movieDisplayTitle(task: MovieMagnetIngestTask) {
  const title =
    preferredChineseText(task.title, task.original_title) ?? '电影任务'
  return `${title} (${task.year})`
}

function seriesDisplayTitle(task: SeriesMagnetIngestTask) {
  const title =
    preferredChineseText(task.title, task.series_name, task.original_title) ??
    '剧集任务'
  return `${title} ${task.season_folder}`
}

function animeDisplayTitle(task: AnimeMagnetIngestTask) {
  const title =
    preferredChineseText(task.name_cn, task.title, task.name) ?? '动漫任务'
  return `${title} 第 ${task.season_number} 季`
}

function toRecentAnimeTask(task: AnimeMagnetIngestTask): RecentIngestTask {
  return {
    id: task.id,
    name: task.magnet_hash,
    libraryTitle: animeDisplayTitle(task),
    status: toRecentTaskStatus(task.status),
    time: formatTaskTime(task.updated_at ?? task.created_at),
  }
}

function toRecentAdultTask(task: AdultMagnetIngestTask): RecentIngestTask {
  return {
    id: task.id,
    name: `${adultCategoryLabel[task.category] ?? task.category} · ${
      task.magnet_count
    } 条`,
    libraryTitle: `${task.date_folder} · 保留 ${task.kept_count} · 删除 ${task.deleted_count}`,
    status: toRecentTaskStatus(task.status),
    time: formatTaskTime(task.updated_at ?? task.created_at),
  }
}

function toRecentMovieTask(task: MovieMagnetIngestTask): RecentIngestTask {
  return {
    id: task.id,
    name: task.magnet_hash,
    libraryTitle: movieDisplayTitle(task),
    status: toRecentTaskStatus(task.status),
    time: formatTaskTime(task.updated_at ?? task.created_at),
  }
}

function toRecentSeriesTask(task: SeriesMagnetIngestTask): RecentIngestTask {
  return {
    id: task.id,
    name: task.magnet_hash,
    libraryTitle: seriesDisplayTitle(task),
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

export function MagnetIngestPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [mode, setMode] = useState<IngestMode>('movie')
  const [magnetInput, setMagnetInput] = useState('')
  const [adultCategory, setAdultCategory] =
    useState<AdultMagnetCategory>('JAV')
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
  const [animeResults, setAnimeResults] = useState<SeriesSearchItem[]>([])
  const [selectedMovie, setSelectedMovie] = useState<MovieSearchItem | null>(
    null,
  )
  const [selectedSeries, setSelectedSeries] = useState<SeriesSearchItem | null>(
    null,
  )
  const [selectedAnime, setSelectedAnime] = useState<SeriesSearchItem | null>(
    null,
  )
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
  const [createdTaskTarget, setCreatedTaskTarget] =
    useState<CreatedTaskTarget | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [movieTasks, setMovieTasks] = useState<MovieMagnetIngestTask[]>([])
  const [movieTasksStatus, setMovieTasksStatus] =
    useState<ResourceSearchStatus>('idle')
  const [movieTasksError, setMovieTasksError] = useState<string | null>(null)
  const [selectedMovieTaskId, setSelectedMovieTaskId] = useState<string | null>(
    null,
  )
  const [movieTaskLogs, setMovieTaskLogs] = useState<MagnetIngestTaskLog[]>([])
  const [movieTaskLogsStatus, setMovieTaskLogsStatus] =
    useState<ResourceSearchStatus>('idle')
  const [movieTaskLogsError, setMovieTaskLogsError] = useState<string | null>(
    null,
  )
  const [seriesTasks, setSeriesTasks] = useState<SeriesMagnetIngestTask[]>([])
  const [seriesTasksStatus, setSeriesTasksStatus] =
    useState<ResourceSearchStatus>('idle')
  const [seriesTasksError, setSeriesTasksError] = useState<string | null>(null)
  const [selectedSeriesTaskId, setSelectedSeriesTaskId] = useState<string | null>(
    null,
  )
  const [seriesTaskLogs, setSeriesTaskLogs] = useState<MagnetIngestTaskLog[]>(
    [],
  )
  const [seriesTaskLogsStatus, setSeriesTaskLogsStatus] =
    useState<ResourceSearchStatus>('idle')
  const [seriesTaskLogsError, setSeriesTaskLogsError] = useState<string | null>(
    null,
  )
  const [animeTasks, setAnimeTasks] = useState<AnimeMagnetIngestTask[]>([])
  const [animeTasksStatus, setAnimeTasksStatus] =
    useState<ResourceSearchStatus>('idle')
  const [animeTasksError, setAnimeTasksError] = useState<string | null>(null)
  const [selectedAnimeTaskId, setSelectedAnimeTaskId] = useState<string | null>(
    null,
  )
  const [animeTaskLogs, setAnimeTaskLogs] = useState<MagnetIngestTaskLog[]>([])
  const [animeTaskLogsStatus, setAnimeTaskLogsStatus] =
    useState<ResourceSearchStatus>('idle')
  const [animeTaskLogsError, setAnimeTaskLogsError] = useState<string | null>(
    null,
  )
  const [adultTasks, setAdultTasks] = useState<AdultMagnetIngestTask[]>([])
  const [adultTasksStatus, setAdultTasksStatus] =
    useState<ResourceSearchStatus>('idle')
  const [adultTasksError, setAdultTasksError] = useState<string | null>(null)
  const [selectedAdultTaskId, setSelectedAdultTaskId] = useState<string | null>(
    null,
  )
  const [adultTaskLogs, setAdultTaskLogs] = useState<MagnetIngestTaskLog[]>([])
  const [adultTaskLogsStatus, setAdultTaskLogsStatus] =
    useState<ResourceSearchStatus>('idle')
  const [adultTaskLogsError, setAdultTaskLogsError] = useState<string | null>(
    null,
  )
  const latestSearchRequestIdRef = useRef(0)
  const activeSearchControllerRef = useRef<AbortController | null>(null)
  const latestSeriesSeasonRequestIdRef = useRef(0)
  const activeSeriesSeasonControllerRef = useRef<AbortController | null>(null)
  const latestMovieTaskLogsRequestIdRef = useRef(0)
  const latestSeriesTaskLogsRequestIdRef = useRef(0)
  const latestAnimeTaskLogsRequestIdRef = useRef(0)
  const latestAdultTaskLogsRequestIdRef = useRef(0)
  const selectedMovieTaskIdRef = useRef<string | null>(null)
  const selectedSeriesTaskIdRef = useRef<string | null>(null)
  const selectedAnimeTaskIdRef = useRef<string | null>(null)
  const selectedAdultTaskIdRef = useRef<string | null>(null)
  const selectedMovieTask =
    movieTasks.find((task) => task.id === selectedMovieTaskId) ?? null
  const selectedSeriesTask =
    seriesTasks.find((task) => task.id === selectedSeriesTaskId) ?? null
  const selectedAnimeTask =
    animeTasks.find((task) => task.id === selectedAnimeTaskId) ?? null
  const selectedAdultTask =
    adultTasks.find((task) => task.id === selectedAdultTaskId) ?? null
  const isSelectedMovieTaskFinished = selectedMovieTask
    ? isFinishedTaskStatus(selectedMovieTask.status)
    : false
  const isSelectedSeriesTaskFinished = selectedSeriesTask
    ? isFinishedTaskStatus(selectedSeriesTask.status)
    : false
  const isSelectedAnimeTaskFinished = selectedAnimeTask
    ? isFinishedTaskStatus(selectedAnimeTask.status)
    : false
  const isSelectedAdultTaskFinished = selectedAdultTask
    ? isFinishedTaskStatus(selectedAdultTask.status)
    : false

  useEffect(() => {
    selectedMovieTaskIdRef.current = selectedMovieTaskId
  }, [selectedMovieTaskId])

  useEffect(() => {
    selectedSeriesTaskIdRef.current = selectedSeriesTaskId
  }, [selectedSeriesTaskId])

  useEffect(() => {
    selectedAnimeTaskIdRef.current = selectedAnimeTaskId
  }, [selectedAnimeTaskId])

  useEffect(() => {
    selectedAdultTaskIdRef.current = selectedAdultTaskId
  }, [selectedAdultTaskId])

  useEffect(() => {
    if (!isAdmin && mode === 'adult') {
      setMode('movie')
    }
  }, [isAdmin, mode])

  const loadMovieTasks = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      const showLoading = options.showLoading ?? true

      if (showLoading) {
        setMovieTasksStatus('loading')
      }
      setMovieTasksError(null)

      try {
        const tasks = await listMovieMagnetIngestTasks()
        setMovieTasks(tasks)
        setMovieTasksStatus(tasks.length > 0 ? 'success' : 'empty')

        const currentTaskId = selectedMovieTaskIdRef.current
        if (tasks.length === 0) {
          selectedMovieTaskIdRef.current = null
          setSelectedMovieTaskId(null)
        } else if (
          !currentTaskId ||
          !tasks.some((task) => task.id === currentTaskId)
        ) {
          selectedMovieTaskIdRef.current = tasks[0].id
          setSelectedMovieTaskId(tasks[0].id)
        }
      } catch (error) {
        if (showLoading) {
          setMovieTasks([])
        }
        setMovieTasksStatus('error')
        setMovieTasksError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '电影任务加载失败，请稍后重试。',
        )
      }
    },
    [],
  )

  const loadSeriesTasks = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      const showLoading = options.showLoading ?? true

      if (showLoading) {
        setSeriesTasksStatus('loading')
      }
      setSeriesTasksError(null)

      try {
        const tasks = await listSeriesMagnetIngestTasks()
        setSeriesTasks(tasks)
        setSeriesTasksStatus(tasks.length > 0 ? 'success' : 'empty')

        const currentTaskId = selectedSeriesTaskIdRef.current
        if (tasks.length === 0) {
          selectedSeriesTaskIdRef.current = null
          setSelectedSeriesTaskId(null)
        } else if (
          !currentTaskId ||
          !tasks.some((task) => task.id === currentTaskId)
        ) {
          selectedSeriesTaskIdRef.current = tasks[0].id
          setSelectedSeriesTaskId(tasks[0].id)
        }
      } catch (error) {
        if (showLoading) {
          setSeriesTasks([])
        }
        setSeriesTasksStatus('error')
        setSeriesTasksError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '剧集任务加载失败，请稍后重试。',
        )
      }
    },
    [],
  )

  const loadAnimeTasks = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      const showLoading = options.showLoading ?? true

      if (showLoading) {
        setAnimeTasksStatus('loading')
      }
      setAnimeTasksError(null)

      try {
        const tasks = await listAnimeMagnetIngestTasks()
        setAnimeTasks(tasks)
        setAnimeTasksStatus(tasks.length > 0 ? 'success' : 'empty')

        const currentTaskId = selectedAnimeTaskIdRef.current
        if (tasks.length === 0) {
          selectedAnimeTaskIdRef.current = null
          setSelectedAnimeTaskId(null)
        } else if (
          !currentTaskId ||
          !tasks.some((task) => task.id === currentTaskId)
        ) {
          selectedAnimeTaskIdRef.current = tasks[0].id
          setSelectedAnimeTaskId(tasks[0].id)
        }
      } catch (error) {
        if (showLoading) {
          setAnimeTasks([])
        }
        setAnimeTasksStatus('error')
        setAnimeTasksError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '动漫任务加载失败，请稍后重试。',
        )
      }
    },
    [],
  )

  const loadAdultTasks = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      const showLoading = options.showLoading ?? true

      if (showLoading) {
        setAdultTasksStatus('loading')
      }
      setAdultTasksError(null)

      try {
        const tasks = await listAdultMagnetIngestTasks()
        setAdultTasks(tasks)
        setAdultTasksStatus(tasks.length > 0 ? 'success' : 'empty')

        const currentTaskId = selectedAdultTaskIdRef.current
        if (tasks.length === 0) {
          selectedAdultTaskIdRef.current = null
          setSelectedAdultTaskId(null)
        } else if (
          !currentTaskId ||
          !tasks.some((task) => task.id === currentTaskId)
        ) {
          selectedAdultTaskIdRef.current = tasks[0].id
          setSelectedAdultTaskId(tasks[0].id)
        }
      } catch (error) {
        if (showLoading) {
          setAdultTasks([])
        }
        setAdultTasksStatus('error')
        setAdultTasksError(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : 'Adult 任务加载失败，请稍后重试。',
        )
      }
    },
    [],
  )

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
    const selectedItem =
      mode === 'series' ? selectedSeries : mode === 'anime' ? selectedAnime : null
    if (!selectedItem) {
      return
    }

    const tmdbId = selectedItem.tmdb_id
    const hasTmdbId = typeof tmdbId === 'number' && tmdbId > 0
    const mediaLabel = mode === 'anime' ? '动漫' : '剧集'

    if (!hasTmdbId) {
      setSeriesSeasonStatus('error')
      setSeriesSeasonOptions([])
      setSelectedSeasonNumber(null)
      setSeriesSeasonError(`当前${mediaLabel}缺少有效的 TMDB ID，无法加载季数。`)
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

    void getSeriesSeasons(tmdbId, controller.signal)
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
            : `${mediaLabel}季数加载失败，请稍后重试。`,
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
  }, [mode, selectedAnime, selectedSeries])

  useEffect(() => {
    let isDisposed = false
    let timeoutId: number | null = null
    const loadTasks =
      mode === 'movie'
        ? loadMovieTasks
        : mode === 'series'
          ? loadSeriesTasks
          : mode === 'anime'
            ? loadAnimeTasks
            : loadAdultTasks

    const refreshTasks = (showLoading: boolean) => {
      void loadTasks({ showLoading }).finally(() => {
        if (isDisposed) {
          return
        }

        timeoutId = window.setTimeout(() => {
          refreshTasks(false)
        }, TASK_LIST_POLL_INTERVAL_MS)
      })
    }

    refreshTasks(true)

    return () => {
      isDisposed = true

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [mode, loadMovieTasks, loadSeriesTasks, loadAnimeTasks, loadAdultTasks])

  useEffect(() => {
    if (mode !== 'movie' || !selectedMovieTaskId) {
      latestMovieTaskLogsRequestIdRef.current += 1
      setMovieTaskLogs([])
      setMovieTaskLogsStatus('idle')
      setMovieTaskLogsError(null)
      return
    }

    let isDisposed = false
    let timeoutId: number | null = null

    const refreshLogs = (showLoading: boolean) => {
      const requestId = latestMovieTaskLogsRequestIdRef.current + 1
      latestMovieTaskLogsRequestIdRef.current = requestId

      if (showLoading) {
        setMovieTaskLogsStatus('loading')
      }
      setMovieTaskLogsError(null)

      void listMovieMagnetIngestTaskLogs(selectedMovieTaskId)
        .then((logs) => {
          if (
            isDisposed ||
            latestMovieTaskLogsRequestIdRef.current !== requestId
          ) {
            return
          }

          setMovieTaskLogs(logs)
          setMovieTaskLogsStatus(logs.length > 0 ? 'success' : 'empty')
          setMovieTaskLogsError(null)
        })
        .catch((error) => {
          if (
            isDisposed ||
            latestMovieTaskLogsRequestIdRef.current !== requestId
          ) {
            return
          }

          setMovieTaskLogs([])
          setMovieTaskLogsStatus('error')
          setMovieTaskLogsError(
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '任务日志加载失败，请稍后重试。',
          )
        })
        .finally(() => {
          if (isDisposed || isSelectedMovieTaskFinished) {
            return
          }

          timeoutId = window.setTimeout(() => {
            refreshLogs(false)
          }, TASK_LOG_POLL_INTERVAL_MS)
        })
    }

    refreshLogs(true)

    return () => {
      isDisposed = true

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [mode, selectedMovieTaskId, isSelectedMovieTaskFinished])

  useEffect(() => {
    if (mode !== 'series' || !selectedSeriesTaskId) {
      latestSeriesTaskLogsRequestIdRef.current += 1
      setSeriesTaskLogs([])
      setSeriesTaskLogsStatus('idle')
      setSeriesTaskLogsError(null)
      return
    }

    let isDisposed = false
    let timeoutId: number | null = null

    const refreshLogs = (showLoading: boolean) => {
      const requestId = latestSeriesTaskLogsRequestIdRef.current + 1
      latestSeriesTaskLogsRequestIdRef.current = requestId

      if (showLoading) {
        setSeriesTaskLogsStatus('loading')
      }
      setSeriesTaskLogsError(null)

      void listSeriesMagnetIngestTaskLogs(selectedSeriesTaskId)
        .then((logs) => {
          if (
            isDisposed ||
            latestSeriesTaskLogsRequestIdRef.current !== requestId
          ) {
            return
          }

          setSeriesTaskLogs(logs)
          setSeriesTaskLogsStatus(logs.length > 0 ? 'success' : 'empty')
          setSeriesTaskLogsError(null)
        })
        .catch((error) => {
          if (
            isDisposed ||
            latestSeriesTaskLogsRequestIdRef.current !== requestId
          ) {
            return
          }

          setSeriesTaskLogs([])
          setSeriesTaskLogsStatus('error')
          setSeriesTaskLogsError(
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '任务日志加载失败，请稍后重试。',
          )
        })
        .finally(() => {
          if (isDisposed || isSelectedSeriesTaskFinished) {
            return
          }

          timeoutId = window.setTimeout(() => {
            refreshLogs(false)
          }, TASK_LOG_POLL_INTERVAL_MS)
        })
    }

    refreshLogs(true)

    return () => {
      isDisposed = true

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [mode, selectedSeriesTaskId, isSelectedSeriesTaskFinished])

  useEffect(() => {
    if (mode !== 'anime' || !selectedAnimeTaskId) {
      latestAnimeTaskLogsRequestIdRef.current += 1
      setAnimeTaskLogs([])
      setAnimeTaskLogsStatus('idle')
      setAnimeTaskLogsError(null)
      return
    }

    let isDisposed = false
    let timeoutId: number | null = null

    const refreshLogs = (showLoading: boolean) => {
      const requestId = latestAnimeTaskLogsRequestIdRef.current + 1
      latestAnimeTaskLogsRequestIdRef.current = requestId

      if (showLoading) {
        setAnimeTaskLogsStatus('loading')
      }
      setAnimeTaskLogsError(null)

      void listAnimeMagnetIngestTaskLogs(selectedAnimeTaskId)
        .then((logs) => {
          if (
            isDisposed ||
            latestAnimeTaskLogsRequestIdRef.current !== requestId
          ) {
            return
          }

          setAnimeTaskLogs(logs)
          setAnimeTaskLogsStatus(logs.length > 0 ? 'success' : 'empty')
          setAnimeTaskLogsError(null)
        })
        .catch((error) => {
          if (
            isDisposed ||
            latestAnimeTaskLogsRequestIdRef.current !== requestId
          ) {
            return
          }

          setAnimeTaskLogs([])
          setAnimeTaskLogsStatus('error')
          setAnimeTaskLogsError(
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '任务日志加载失败，请稍后重试。',
          )
        })
        .finally(() => {
          if (isDisposed || isSelectedAnimeTaskFinished) {
            return
          }

          timeoutId = window.setTimeout(() => {
            refreshLogs(false)
          }, TASK_LOG_POLL_INTERVAL_MS)
        })
    }

    refreshLogs(true)

    return () => {
      isDisposed = true

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [mode, selectedAnimeTaskId, isSelectedAnimeTaskFinished])

  useEffect(() => {
    if (mode !== 'adult' || !selectedAdultTaskId) {
      latestAdultTaskLogsRequestIdRef.current += 1
      setAdultTaskLogs([])
      setAdultTaskLogsStatus('idle')
      setAdultTaskLogsError(null)
      return
    }

    let isDisposed = false
    let timeoutId: number | null = null

    const refreshLogs = (showLoading: boolean) => {
      const requestId = latestAdultTaskLogsRequestIdRef.current + 1
      latestAdultTaskLogsRequestIdRef.current = requestId

      if (showLoading) {
        setAdultTaskLogsStatus('loading')
      }
      setAdultTaskLogsError(null)

      void listAdultMagnetIngestTaskLogs(selectedAdultTaskId)
        .then((logs) => {
          if (
            isDisposed ||
            latestAdultTaskLogsRequestIdRef.current !== requestId
          ) {
            return
          }

          setAdultTaskLogs(logs)
          setAdultTaskLogsStatus(logs.length > 0 ? 'success' : 'empty')
          setAdultTaskLogsError(null)
        })
        .catch((error) => {
          if (
            isDisposed ||
            latestAdultTaskLogsRequestIdRef.current !== requestId
          ) {
            return
          }

          setAdultTaskLogs([])
          setAdultTaskLogsStatus('error')
          setAdultTaskLogsError(
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '任务日志加载失败，请稍后重试。',
          )
        })
        .finally(() => {
          if (isDisposed || isSelectedAdultTaskFinished) {
            return
          }

          timeoutId = window.setTimeout(() => {
            refreshLogs(false)
          }, TASK_LOG_POLL_INTERVAL_MS)
        })
    }

    refreshLogs(true)

    return () => {
      isDisposed = true

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [mode, selectedAdultTaskId, isSelectedAdultTaskFinished])

  const singleMagnetValidationMessage = getMagnetValidationMessage(magnetInput)
  const adultMagnetValidationMessage = getAdultMagnetValidationMessage(magnetInput)
  const magnetValidationMessage =
    mode === 'adult' ? adultMagnetValidationMessage : singleMagnetValidationMessage
  const selectedSeasonItem =
    mode === 'series' ? selectedSeries : mode === 'anime' ? selectedAnime : null
  const seasonMediaLabel = mode === 'anime' ? '动漫' : '剧集'
  const seriesSeasonValidationMessage = getSeasonLoadValidationMessage({
    selectedItem: selectedSeasonItem,
    mediaLabel: seasonMediaLabel,
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
        : mode === 'anime'
          ? Boolean(seriesSeasonValidationMessage)
          : !isAdmin)

  function abortActiveSearch() {
    latestSearchRequestIdRef.current += 1
    activeSearchControllerRef.current?.abort()
    activeSearchControllerRef.current = null
  }

  function resetSubmitFeedback() {
    setSubmitStatus('idle')
    setSubmitError(null)
    setSubmitSuccessMessage(null)
    setCreatedTaskTarget(null)
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
    resetSeriesSeasonState()
  }

  function handleModeChange(nextMode: IngestMode) {
    if (nextMode === mode) {
      return
    }

    if (nextMode === 'adult' && !isAdmin) {
      return
    }

    abortActiveSearch()

    if (mode === 'movie') {
      resetMovieModeState()
    } else if (mode === 'series') {
      resetSeriesModeState()
    } else if (mode === 'anime') {
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
    resetSeriesSeasonState()
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

    void searchSeries(keyword, controller.signal)
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
    const magnetErrorMessage =
      mode === 'adult'
        ? getAdultMagnetValidationMessage(magnetInput, true)
        : getMagnetValidationMessage(magnetInput, true)

    if (magnetErrorMessage) {
      setSubmitStatus('error')
      setSubmitError(magnetErrorMessage)
      setSubmitSuccessMessage(null)
      setToastMessage(magnetErrorMessage)
      return
    }

    if (mode === 'adult') {
      if (!isAdmin) {
        const message = '仅管理员可以创建 Adult 任务'
        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
        return
      }

      const payload = getAdultMagnetIngestPayload(
        magnetInput,
        adultCategory,
      )

      if (!payload) {
        const message = 'Adult 下载链接列表无效，暂时无法提交'
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
        const task = await createAdultMagnetIngestTask(payload)
        const successMessage = `Adult 批量任务已创建：${task.id}`

        setSubmitStatus('success')
        setSubmitSuccessMessage(successMessage)
        setCreatedTaskTarget({ taskType: 'adult', taskId: task.id })
        selectedAdultTaskIdRef.current = task.id
        setSelectedAdultTaskId(task.id)
        setMagnetInput('')
        setToastMessage(successMessage)
        await loadAdultTasks()
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '任务创建失败，请稍后重试'

        console.error('adult magnet ingest failed', error)

        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
      }

      return
    }

    if (mode === 'series') {
      const seasonValidationMessage = seriesSeasonValidationMessage

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
        const message = '所选剧集缺少标题或目标季数，暂时无法提交'
        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
        return
      }

      setSubmitStatus('loading')
      setSubmitError(null)
      setSubmitSuccessMessage(null)

      const isIngestAllowed = await checkMediaLibraryIngestAllowed(
        {
          media_type: 'series',
          tmdb_id: selectedSeries.tmdb_id,
          season_number: selectedSeasonNumber,
        },
        selectedSeries.title,
      )
      if (!isIngestAllowed) {
        setSubmitStatus('idle')
        return
      }

      try {
        const task = await createSeriesMagnetIngest(payload)
        const successMessage = `剧集任务已创建：${task.id}`

        setSubmitStatus('success')
        setSubmitSuccessMessage(successMessage)
        setCreatedTaskTarget({ taskType: 'series', taskId: task.id })
        selectedSeriesTaskIdRef.current = task.id
        setSelectedSeriesTaskId(task.id)
        setMagnetInput('')
        setToastMessage(successMessage)
        await loadSeriesTasks()
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '任务创建失败，请稍后重试'

        console.error('series magnet ingest failed', error)

        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
      }

      return
    }

    if (mode === 'anime') {
      if (seriesSeasonValidationMessage || !selectedAnime) {
        const message =
          seriesSeasonValidationMessage || '请先选择一个动漫项目'
        setSubmitStatus('error')
        setSubmitError(message)
        setSubmitSuccessMessage(null)
        setToastMessage(message)
        return
      }

      const payload = getAnimeMagnetIngestPayload(
        normalizedMagnet,
        selectedAnime,
        selectedSeasonNumber,
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

      const isIngestAllowed = await checkMediaLibraryIngestAllowed(
        {
          media_type: 'series',
          tmdb_id: selectedAnime.tmdb_id,
          season_number: payload.season_number,
        },
        selectedAnime.title,
      )
      if (!isIngestAllowed) {
        setSubmitStatus('idle')
        return
      }

      try {
        const task = await createAnimeMagnetIngestTask(payload)
        const successMessage = `动漫整季任务已创建：${task.id}`

        setSubmitStatus('success')
        setSubmitSuccessMessage(successMessage)
        setCreatedTaskTarget({ taskType: 'anime', taskId: task.id })
        selectedAnimeTaskIdRef.current = task.id
        setSelectedAnimeTaskId(task.id)
        setMagnetInput('')
        setToastMessage(successMessage)
        await loadAnimeTasks()
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '任务创建失败，请稍后重试'

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
      const message = '所选电影缺少标题或年份，暂时无法提交'
      setSubmitStatus('error')
      setSubmitError(message)
      setSubmitSuccessMessage(null)
      setToastMessage(message)
      return
    }

    setSubmitStatus('loading')
    setSubmitError(null)
    setSubmitSuccessMessage(null)

    const isIngestAllowed = await checkMediaLibraryIngestAllowed(
      {
        media_type: 'movie',
        tmdb_id: selectedMovie.tmdb_id,
      },
      selectedMovie.title,
    )
    if (!isIngestAllowed) {
      setSubmitStatus('idle')
      return
    }

    try {
      const task = await createMovieMagnetIngest(payload)
      const successMessage = `电影任务已创建：${task.id}`

      setSubmitStatus('success')
      setSubmitSuccessMessage(successMessage)
      setCreatedTaskTarget({ taskType: 'movie', taskId: task.id })
      selectedMovieTaskIdRef.current = task.id
      setSelectedMovieTaskId(task.id)
      setMagnetInput('')
      setToastMessage(successMessage)
      await loadMovieTasks()
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : '任务创建失败，请稍后重试'

      console.error('movie magnet ingest failed', error)

      setSubmitStatus('error')
      setSubmitError(message)
      setSubmitSuccessMessage(null)
      setToastMessage(message)
    }
  }

  const currentRecentTasks =
    mode === 'movie'
      ? movieTasks.map(toRecentMovieTask)
      : mode === 'series'
        ? seriesTasks.map(toRecentSeriesTask)
        : mode === 'anime'
          ? animeTasks.map(toRecentAnimeTask)
          : adultTasks.map(toRecentAdultTask)
  const currentTasksStatus =
    mode === 'movie'
      ? movieTasksStatus
      : mode === 'series'
        ? seriesTasksStatus
        : mode === 'anime'
          ? animeTasksStatus
          : adultTasksStatus
  const currentTasksError =
    mode === 'movie'
      ? movieTasksError
      : mode === 'series'
        ? seriesTasksError
        : mode === 'anime'
          ? animeTasksError
          : adultTasksError
  const currentSelectedTaskId =
    mode === 'movie'
      ? selectedMovieTaskId
      : mode === 'series'
        ? selectedSeriesTaskId
        : mode === 'anime'
          ? selectedAnimeTaskId
          : selectedAdultTaskId
  const currentTaskLogs =
    mode === 'movie'
      ? movieTaskLogs
      : mode === 'series'
        ? seriesTaskLogs
        : mode === 'anime'
          ? animeTaskLogs
          : adultTaskLogs
  const currentTaskLogsStatus =
    mode === 'movie'
      ? movieTaskLogsStatus
      : mode === 'series'
        ? seriesTaskLogsStatus
        : mode === 'anime'
          ? animeTaskLogsStatus
          : adultTaskLogsStatus
  const currentTaskLogsError =
    mode === 'movie'
      ? movieTaskLogsError
      : mode === 'series'
        ? seriesTaskLogsError
        : mode === 'anime'
          ? animeTaskLogsError
          : adultTaskLogsError
  const taskModeLabel =
    mode === 'movie'
      ? '电影'
      : mode === 'series'
        ? '剧集'
        : mode === 'anime'
          ? '动漫'
          : 'Adult'
  const adultPreviewPath = `Adult/${adultCategoryLabel[adultCategory]}/${formatAdultPreviewDate(
    new Date(),
  )}`

  return (
    <PageContainer
      title="手动磁力入库"
      description="直接粘贴高质量磁力链接，将其绑定至媒体库结构并推送至云端离线下载。"
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.72fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <SectionHeading
              label="磁力链接"
              title={
                mode === 'adult'
                  ? 'Adult 支持多条 magnet / ed2k，按换行拆分，单批最多 50 条。'
                  : '当前仅支持单条 magnet，提交前会进行最小格式校验。'
              }
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
                placeholder={
                  mode === 'adult'
                    ? '每行粘贴一条 magnet:? 或 ed2k:// 链接'
                    : '粘贴单条 magnet:? 链接'
                }
                className="min-h-[180px] w-full resize-none rounded-[28px] bg-transparent px-5 py-5 font-mono text-[15px] leading-8 text-slate-900 outline-none placeholder:text-slate-300"
              />
            </div>

            <p
              className={`text-sm ${
                magnetValidationMessage ? 'text-rose-500' : 'text-slate-500'
              }`}
            >
              {magnetValidationMessage ??
                (mode === 'adult'
                  ? '空行会被忽略；JAV 和 Other 均支持 magnet 与 ed2k，后端会按服务器日期写入当天 Adult 目录。'
                  : '仅支持单条 magnet，需以 magnet:? 开头；不会自动拆分多条内容。')}
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <SectionHeading
                label={mode === 'adult' ? 'Adult 分类' : '关联库项目'}
                title={
                  mode === 'movie'
                    ? '使用电影搜索接口查询媒体库项目，并从结果中单选一个电影进行绑定。'
                    : mode === 'series'
                      ? '使用剧集搜索接口查询媒体库项目，并从结果中单选一个剧集进行绑定。'
                      : mode === 'anime'
                        ? '使用 TMDB 剧集搜索接口查询动漫条目，并从结果中单选一个动漫进行绑定。'
                        : '选择 Adult 保存分类，任务将使用当天日期目录和临时隔离目录处理。'
                }
              />

              <MediaTypeToggle
                mode={mode}
                isAdmin={isAdmin}
                onChange={handleModeChange}
              />
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
            ) : mode === 'anime' ? (
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
                  if (isSeriesSearchItem(item)) {
                    setSelectedAnime(item)
                  }
                  resetSubmitFeedback()
                }}
                onClearSelection={() => {
                  setSelectedAnime(null)
                  resetSeriesSeasonState()
                  resetSubmitFeedback()
                }}
              />
            ) : (
              <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-shell">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <AdultCategoryToggle
                    category={adultCategory}
                    onChange={(category) => {
                      setAdultCategory(category)
                      resetSubmitFeedback()
                    }}
                  />
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    目标路径预览：{' '}
                    <span className="font-mono text-slate-900">
                      {adultPreviewPath}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {mode === 'series' || mode === 'anime' ? (
            <section className="space-y-3">
              <SectionHeading
                label="目标季数"
                title={
                  mode === 'anime'
                    ? '选中动漫后会通过 TMDB 动态拉取真实可用季度，并用于动漫整季提交。'
                    : '选中剧集后会动态拉取真实可用季数，并用于电视剧离线直收提交。'
                }
              />

              <TargetSeasonSelect
                value={selectedSeasonNumber}
                options={seriesSeasonOptions}
                status={seriesSeasonStatus}
                error={seriesSeasonError}
                mediaLabel={mode === 'anime' ? '动漫' : '剧集'}
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
                创建中...
              </>
            ) : (
              <>
                <CloudUpload className="h-4 w-4" />
                {mode === 'movie'
                  ? '创建电影任务'
                  : mode === 'series'
                    ? '创建剧集任务'
                    : mode === 'anime'
                      ? '创建动漫整季任务'
                      : '创建 Adult 批量任务'}
              </>
            )}
          </Button>

          {submitError ? (
            <p className="text-sm text-rose-500">{submitError}</p>
          ) : null}

          {submitStatus === 'success' && submitSuccessMessage ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-emerald-700">
                {submitSuccessMessage}
              </p>
              {createdTaskTarget ? (
                <Link
                  to={`/tasks/${createdTaskTarget.taskType}/${encodeURIComponent(createdTaskTarget.taskId)}`}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-800 transition hover:text-emerald-950"
                >
                  查看任务详情
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Link
              to="/tasks"
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"
            >
              查看全部任务
            </Link>
          </div>

          <RecentTasksTable
            tasks={currentRecentTasks}
            description={`展示你有权限查看的${taskModeLabel}磁力任务，可点击任务查看日志。`}
            actionLabel="刷新"
            emptyMessage={
              currentTasksStatus === 'loading'
                ? '正在加载任务...'
                : `暂无${taskModeLabel}任务`
            }
            selectedTaskId={currentSelectedTaskId}
            onSelectTask={(task) => {
              if (mode === 'movie') {
                selectedMovieTaskIdRef.current = task.id
                setSelectedMovieTaskId(task.id)
                return
              }
              if (mode === 'series') {
                selectedSeriesTaskIdRef.current = task.id
                setSelectedSeriesTaskId(task.id)
                return
              }
              if (mode === 'anime') {
                selectedAnimeTaskIdRef.current = task.id
                setSelectedAnimeTaskId(task.id)
                return
              }
              selectedAdultTaskIdRef.current = task.id
              setSelectedAdultTaskId(task.id)
            }}
            onViewAll={() => {
              if (mode === 'movie') {
                void loadMovieTasks()
                return
              }
              if (mode === 'series') {
                void loadSeriesTasks()
                return
              }
              if (mode === 'anime') {
                void loadAnimeTasks()
                return
              }
              if (mode === 'adult') {
                void loadAdultTasks()
              }
            }}
          />

          {currentTasksError ? (
            <p className="text-sm text-rose-500">{currentTasksError}</p>
          ) : null}

        </div>

        <aside className="min-w-0 space-y-5">
          <TaskLogsCard
            logs={currentTaskLogs}
            status={currentTaskLogsStatus}
            error={currentTaskLogsError}
            selectedTaskId={currentSelectedTaskId}
            emptySelectionMessage={`选择${taskModeLabel}任务后查看执行日志。`}
          />
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
