import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Clock3 } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  AnimeCard,
  type AnimeCardLoadStatus,
  type AnimeCardSubscribeStatus,
} from '@/components/resources/anime-card'
import {
  AnimeModeSwitch,
  type AnimeResourceMode,
} from '@/components/resources/anime-mode-switch'
import {
  CategorySwitch,
  type ResourceCategoryValue,
} from '@/components/resources/category-switch'
import {
  MediaCard,
  type MediaCardAddStatus,
  type MediaCardSeasonStatus,
} from '@/components/resources/media-card'
import { SearchBar } from '@/components/resources/search-bar'
import {
  getAnimeSubtitleGroups,
  previewAnimeSubscription,
  searchAnime,
  subscribeAnime,
} from '@/lib/api/anime'
import {
  listMovieMagnetIngestTasks,
  listSeriesMagnetIngestTasks,
} from '@/lib/api/magnet-ingest'
import {
  createMovieReleaseOpenListIngest,
  createSeriesReleaseOpenListIngest,
  getSeriesSeasons,
  isRequestCanceledError,
  recommendMovieRelease,
  recommendSeriesRelease,
  searchMovies,
  searchSeries,
} from '@/lib/api/resources'
import { formatElapsedMessage, useElapsedNow } from '@/lib/use-elapsed-time'
import { cn } from '@/lib/utils'
import type {
  AnimeSearchItem,
  AnimeSubtitleGroup,
  AnimeSubscriptionPreview,
} from '@/types/anime'
import type {
  MagnetIngestTaskStatus,
  MovieMagnetIngestTask,
  SeriesMagnetIngestTask,
} from '@/types/magnet-ingest'
import type {
  OpenListQualityTag,
  ProwlarrRelease,
  ResourcePublishPageState,
  SearchableResourceItem,
  SeriesSearchItem,
} from '@/types/resources'

type NonAnimeSearchableCategory = Exclude<ResourceCategoryValue, 'anime'>
type ResourceSearchResultItem = SearchableResourceItem | AnimeSearchItem

type ResourceSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'
type RecentIngestStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'
type RecentIngestMediaType = 'movie' | 'series'

type ResourceSearchState = {
  status: ResourceSearchStatus
  items: ResourceSearchResultItem[]
  errorMessage: string | null
}

type MediaIngestState = {
  status: MediaCardAddStatus
  message: string | null
  startedAt?: number | null
}

type SeriesSeasonLoadState = {
  status: MediaCardSeasonStatus
  message: string | null
}

type AnimeGroupsState = {
  status: AnimeCardLoadStatus
  groups: AnimeSubtitleGroup[]
  message: string | null
}

type AnimePreviewState = {
  status: AnimeCardLoadStatus
  preview: AnimeSubscriptionPreview | null
  message: string | null
}

type AnimeSubscribeState = {
  status: AnimeCardSubscribeStatus
  message: string | null
}

type RecentIngestSummary = {
  taskId: string
  title: string
  mediaType: RecentIngestMediaType
  productType: 'MOVIE' | 'SERIES' | 'ANIME'
  status: MagnetIngestTaskStatus
  qualityTag: string | null
  updatedAt: string | null
}

type RecentIngestState = {
  status: RecentIngestStatus
  item: RecentIngestSummary | null
  message: string | null
}

type SearchLanguage = 'chinese' | 'english' | 'unknown'

type AutoReleaseConfirmation = {
  item: SearchableResourceItem
  itemKey: string
  mediaType: RecentIngestMediaType
  taskProductType: 'SERIES' | 'ANIME' | null
  qualityTag: OpenListQualityTag
  seasonNumber: number | null
  release: ProwlarrRelease
  releases: ProwlarrRelease[]
  query: string
  searchLanguage: SearchLanguage
  isSubmitting: boolean
}

const OPENLIST_QUALITY_TAGS: OpenListQualityTag[] = ['2160p', '1080p', '720p']
const DEFAULT_QUALITY_TAG: OpenListQualityTag = '2160p'

const taskStatusCopy: Record<MagnetIngestTaskStatus, string> = {
  PENDING: '等待中',
  SUBMITTED: '已提交',
  DOWNLOADING: '下载中',
  ORGANIZING: '整理中',
  SUCCEEDED: '已完成',
  PARTIAL_SUCCESS: '部分完成',
  FAILED: '失败',
  INTERRUPTED: '已中断',
}

type ResourceSearchCopy = {
  placeholder: string
  idleTitle: string
  idleDescription: string
  loadingTitle: string
  loadingDescription: string
  emptyTitle: string
  emptyDescription: string
  errorMessage: string
}

const searchableCategoryCopy: Record<
  NonAnimeSearchableCategory,
  ResourceSearchCopy
> = {
  movie: {
    placeholder: '搜索电影名称…',
    idleTitle: '输入电影名称开始搜索',
    idleDescription: '选择电影后可直接通过 OpenList 创建入库任务。',
    loadingTitle: '正在搜索电影…',
    loadingDescription: '正在从资源索引服务获取最新搜索结果。',
    emptyTitle: '没有搜索结果',
    emptyDescription: '换个电影名称试试，或检查关键词是否输入正确。',
    errorMessage: '电影搜索失败，请稍后重试。',
  },
  tv: {
    placeholder: '搜索电视剧名称…',
    idleTitle: '输入电视剧名称开始搜索',
    idleDescription: '选择剧集季数和分辨率后可直接创建入库任务。',
    loadingTitle: '正在搜索电视剧…',
    loadingDescription: '正在从资源索引服务获取最新搜索结果。',
    emptyTitle: '没有搜索结果',
    emptyDescription: '换个电视剧名称试试，或检查关键词是否输入正确。',
    errorMessage: '电视剧搜索失败，请稍后重试。',
  },
}

const animeResourceModeCopy: Record<
  AnimeResourceMode,
  {
    description: string
    search: ResourceSearchCopy
  }
> = {
  'season-ingest': {
    description: '选择季度和清晰度，自动匹配或手动选择发布资源。',
    search: {
      placeholder: '搜索动漫名称…',
      idleTitle: '输入动漫名称开始搜索',
      idleDescription: '选择季度和清晰度后可创建整季入库任务。',
      loadingTitle: '正在搜索动漫…',
      loadingDescription: '正在获取可入库的动漫目录结果。',
      emptyTitle: '没有搜索结果',
      emptyDescription: '换个动漫名称试试，或检查关键词是否输入正确。',
      errorMessage: '动漫搜索失败，请稍后重试。',
    },
  },
  'follow-subscription': {
    description: '选择字幕组，通过 Ani-RSS 订阅后续更新。',
    search: {
      placeholder: '搜索动漫名称…',
      idleTitle: '输入动漫名称开始搜索',
      idleDescription: '选择字幕组后可通过 Ani-RSS 订阅后续更新。',
      loadingTitle: '正在搜索动漫…',
      loadingDescription: '正在获取 Mikan 搜索结果。',
      emptyTitle: '没有搜索结果',
      emptyDescription: '换个动漫名称试试，或检查关键词是否输入正确。',
      errorMessage: '动漫搜索失败，请稍后重试。',
    },
  },
}

const categorySearchHandlers: Record<
  NonAnimeSearchableCategory,
  (term: string, signal?: AbortSignal) => Promise<ResourceSearchResultItem[]>
> = {
  movie: async (term, signal) => searchMovies(term, signal),
  tv: async (term, signal) => searchSeries(term, signal),
}

const animeModeSearchHandlers: Record<
  AnimeResourceMode,
  (term: string, signal?: AbortSignal) => Promise<ResourceSearchResultItem[]>
> = {
  'season-ingest': async (term, signal) => searchSeries(term, signal),
  'follow-subscription': async (term, signal) => searchAnime(term, signal),
}

const DEFAULT_ANIME_RESOURCE_MODE: AnimeResourceMode = 'season-ingest'

const dynamicRangeCopy: Record<string, string> = {
  dolby_vision: 'Dolby Vision',
  hdr10_plus: 'HDR10+',
  hdr10: 'HDR10',
  hdr: 'HDR',
  hlg: 'HLG',
  sdr: 'SDR',
}

function isAnimeSearchItem(
  item: ResourceSearchResultItem,
): item is AnimeSearchItem {
  return 'source_url' in item
}

function isSeriesSearchItem(
  item: SearchableResourceItem,
): item is SeriesSearchItem {
  return 'tvdb_id' in item
}

function getMovieIngestKey(item: SearchableResourceItem) {
  return typeof item.tmdb_id === 'number' && item.tmdb_id > 0
    ? `movie:tmdb:${item.tmdb_id}`
    : `movie:id:${item.id}`
}

function getSeriesIngestKey(item: SeriesSearchItem) {
  if (typeof item.tvdb_id === 'number' && item.tvdb_id > 0) {
    return `series:tvdb:${item.tvdb_id}`
  }
  if (typeof item.tmdb_id === 'number' && item.tmdb_id > 0) {
    return `series:tmdb:${item.tmdb_id}`
  }
  return `series:id:${item.id}`
}

function getMediaIngestKey(item: SearchableResourceItem) {
  return isSeriesSearchItem(item)
    ? getSeriesIngestKey(item)
    : getMovieIngestKey(item)
}

function getAnimeCardKey(item: AnimeSearchItem) {
  return item.id
}

function getTaskRoute(mediaType: RecentIngestMediaType, taskId: string) {
  return `/tasks/${mediaType}/${encodeURIComponent(taskId)}`
}

function getPublishRoute() {
  return '/resources/publish'
}

function hasChineseText(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

function hasLatinText(value: string) {
  return /[A-Za-z]/.test(value)
}

function getSearchLanguage(term: string): SearchLanguage {
  if (hasChineseText(term)) {
    return 'chinese'
  }
  if (hasLatinText(term)) {
    return 'english'
  }
  return 'unknown'
}

function getItemSearchLanguage(item: SearchableResourceItem) {
  return getSearchLanguage(`${item.title} ${item.original_title ?? ''}`)
}

function releaseMatchLabel(release: ProwlarrRelease, fallbackQuery: string) {
  const source = release.match_source?.trim()
  const query = release.match_query?.trim() || fallbackQuery.trim()

  if (source && query) {
    return `${source}：${query}`
  }
  return query || source || '-'
}

function releaseCandidateKey(release: ProwlarrRelease, index: number) {
  return `${index}:${release.indexer_id}:${release.download_ref}:${release.title}`
}

function formatSeasonLabel(seasonNumber: number) {
  return `S${String(seasonNumber).padStart(2, '0')}`
}

function formatDynamicRange(tags: string[]) {
  return tags.length > 0
    ? tags.map((tag) => dynamicRangeCopy[tag] ?? tag).join(' / ')
    : '未标注'
}

function formatReleaseSize(value: number | null) {
  if (typeof value !== 'number' || value < 0) {
    return '未知大小'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(unitIndex > 2 ? 2 : 0)} ${units[unitIndex]}`
}

function createInitialSearchState(): ResourceSearchState {
  return {
    status: 'idle',
    items: [],
    errorMessage: null,
  }
}

function getUserFacingErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : fallbackMessage
}

function formatTaskTime(value: string | null) {
  if (!value) {
    return '暂无时间'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '暂无时间'
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTaskTimeValue(value: string | null) {
  if (!value) {
    return 0
  }

  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
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

function toRecentMovieTask(task: MovieMagnetIngestTask): RecentIngestSummary {
  return {
    taskId: task.id,
    title: movieDisplayTitle(task),
    mediaType: 'movie',
    productType: 'MOVIE',
    status: task.status,
    qualityTag: task.quality_tag ?? task.resolution_tags?.[0] ?? null,
    updatedAt: task.updated_at ?? task.created_at,
  }
}

function toRecentSeriesTask(task: SeriesMagnetIngestTask): RecentIngestSummary {
  return {
    taskId: task.id,
    title: seriesDisplayTitle(task),
    mediaType: 'series',
    productType: task.task_product_type === 'ANIME' ? 'ANIME' : 'SERIES',
    status: task.status,
    qualityTag: task.quality_tag ?? task.resolution_tags?.[0] ?? null,
    updatedAt: task.updated_at ?? task.created_at,
  }
}

function pickLatestRecentTask(items: RecentIngestSummary[]) {
  return items
    .slice()
    .sort(
      (left, right) =>
        getTaskTimeValue(right.updatedAt) - getTaskTimeValue(left.updatedAt),
    )[0]
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mx-auto max-w-xl rounded-[28px] bg-white px-8 py-14 text-center shadow-[0_18px_40px_rgba(15,23,42,0.035)]">
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  )
}

export function ResourceSearchPage() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<ResourceCategoryValue>('movie')
  const [animeResourceMode, setAnimeResourceMode] =
    useState<AnimeResourceMode>(DEFAULT_ANIME_RESOURCE_MODE)
  const [searchText, setSearchText] = useState('')
  const [submittedTerm, setSubmittedTerm] = useState('')
  const [searchState, setSearchState] = useState<ResourceSearchState>(
    createInitialSearchState,
  )
  const [mediaIngestStates, setMediaIngestStates] = useState<
    Record<string, MediaIngestState>
  >({})
  const [qualitySelections, setQualitySelections] = useState<
    Record<string, OpenListQualityTag>
  >({})
  const [seriesSeasonSelections, setSeriesSeasonSelections] = useState<
    Record<string, number>
  >({})
  const [seriesSeasonOptions, setSeriesSeasonOptions] = useState<
    Record<string, number[]>
  >({})
  const [seriesSeasonLoadStates, setSeriesSeasonLoadStates] = useState<
    Record<string, SeriesSeasonLoadState>
  >({})
  const [recentIngestState, setRecentIngestState] = useState<RecentIngestState>({
    status: 'idle',
    item: null,
    message: null,
  })
  const [animeGroupsStates, setAnimeGroupsStates] = useState<
    Record<string, AnimeGroupsState>
  >({})
  const [animePreviewStates, setAnimePreviewStates] = useState<
    Record<string, AnimePreviewState>
  >({})
  const [animeGroupSelections, setAnimeGroupSelections] = useState<
    Record<string, string>
  >({})
  const [animeSubscribeStates, setAnimeSubscribeStates] = useState<
    Record<string, AnimeSubscribeState>
  >({})
  const [autoReleaseConfirmation, setAutoReleaseConfirmation] =
    useState<AutoReleaseConfirmation | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const isAutoReleaseConfirmationOpen = autoReleaseConfirmation !== null
  const latestRequestIdRef = useRef(0)
  const recentIngestRequestIdRef = useRef(0)
  const activeRequestControllerRef = useRef<AbortController | null>(null)
  const seriesSeasonsControllerRef = useRef<AbortController | null>(null)
  const activeMediaIngestKeysRef = useRef<Set<string>>(new Set())
  const activeAnimeSubscribeKeysRef = useRef<Set<string>>(new Set())
  const animeCardsControllerRef = useRef<AbortController | null>(null)
  const animePreviewRequestIdsRef = useRef<Record<string, number>>({})

  const resetSearchSession = useCallback(() => {
    latestRequestIdRef.current += 1
    activeRequestControllerRef.current?.abort()
    activeRequestControllerRef.current = null
    seriesSeasonsControllerRef.current?.abort()
    seriesSeasonsControllerRef.current = null
    animeCardsControllerRef.current?.abort()
    animeCardsControllerRef.current = null
    activeMediaIngestKeysRef.current.clear()
    activeAnimeSubscribeKeysRef.current.clear()
    setSearchState(createInitialSearchState())
    setSubmittedTerm('')
    setMediaIngestStates({})
    setQualitySelections({})
    setSeriesSeasonSelections({})
    setSeriesSeasonOptions({})
    setSeriesSeasonLoadStates({})
    setAnimeGroupsStates({})
    setAnimePreviewStates({})
    setAnimeGroupSelections({})
    setAnimeSubscribeStates({})
    setAutoReleaseConfirmation(null)
    animePreviewRequestIdsRef.current = {}
  }, [])

  const loadRecentIngestSummary = useCallback(() => {
    recentIngestRequestIdRef.current += 1
    const requestId = recentIngestRequestIdRef.current

    setRecentIngestState((currentState) => ({
      status: currentState.item ? 'success' : 'loading',
      item: currentState.item,
      message: null,
    }))

    void Promise.all([
      listMovieMagnetIngestTasks(),
      listSeriesMagnetIngestTasks(),
    ])
      .then(([movieTasks, seriesTasks]) => {
        if (recentIngestRequestIdRef.current !== requestId) {
          return
        }

        const latestTask = pickLatestRecentTask([
          ...movieTasks.map(toRecentMovieTask),
          ...seriesTasks.map(toRecentSeriesTask),
        ])

        setRecentIngestState({
          status: latestTask ? 'success' : 'empty',
          item: latestTask ?? null,
          message: null,
        })
      })
      .catch((error) => {
        if (recentIngestRequestIdRef.current !== requestId) {
          return
        }

        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '最近入库记录暂时不可用。'

        setRecentIngestState({
          status: 'error',
          item: null,
          message,
        })
      })
  }, [])

  useEffect(() => {
    loadRecentIngestSummary()
  }, [loadRecentIngestSummary])

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
    if (!isAutoReleaseConfirmationOpen) {
      return
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [isAutoReleaseConfirmationOpen])

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort()
      seriesSeasonsControllerRef.current?.abort()
      animeCardsControllerRef.current?.abort()
      animeCardsControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    resetSearchSession()
    setAnimeResourceMode(DEFAULT_ANIME_RESOURCE_MODE)
  }, [category, resetSearchSession])

  const activeCategoryCopy =
    category === 'anime'
      ? animeResourceModeCopy[animeResourceMode].search
      : searchableCategoryCopy[category]
  const isSearching = searchState.status === 'loading'
  const activeSearchPlaceholder = activeCategoryCopy.placeholder
  const hasActiveTimedIngest = Object.values(mediaIngestStates).some(
    (state) => state.status === 'loading' && typeof state.startedAt === 'number',
  )
  const elapsedNow = useElapsedNow(hasActiveTimedIngest)

  function handleSearchSubmit() {
    if (searchState.status === 'loading') {
      return
    }

    const activeCategory = category
    const activeAnimeResourceMode = animeResourceMode
    const activeSearchHandler =
      activeCategory === 'anime'
        ? animeModeSearchHandlers[activeAnimeResourceMode]
        : categorySearchHandlers[activeCategory]
    const activeCopy =
      activeCategory === 'anime'
        ? animeResourceModeCopy[activeAnimeResourceMode].search
        : searchableCategoryCopy[activeCategory]
    const keyword = searchText.trim()
    latestRequestIdRef.current += 1
    const requestId = latestRequestIdRef.current

    activeRequestControllerRef.current?.abort()
    activeRequestControllerRef.current = null
    seriesSeasonsControllerRef.current?.abort()
    seriesSeasonsControllerRef.current = null
    animeCardsControllerRef.current?.abort()
    animeCardsControllerRef.current = null

    if (!keyword) {
      resetSearchSession()
      return
    }

    const controller = new AbortController()
    activeRequestControllerRef.current = controller
    seriesSeasonsControllerRef.current = null

    activeMediaIngestKeysRef.current.clear()
    activeAnimeSubscribeKeysRef.current.clear()
    setMediaIngestStates({})
    setQualitySelections({})
    setSeriesSeasonSelections({})
    setSeriesSeasonOptions({})
    setSeriesSeasonLoadStates({})
    setAnimeGroupsStates({})
    setAnimePreviewStates({})
    setAnimeGroupSelections({})
    setAnimeSubscribeStates({})
    setAutoReleaseConfirmation(null)
    animePreviewRequestIdsRef.current = {}
    setSearchState({
      status: 'loading',
      items: [],
      errorMessage: null,
    })
    setSubmittedTerm(keyword)

    void activeSearchHandler(keyword, controller.signal)
      .then((items) => {
        if (latestRequestIdRef.current !== requestId) {
          return
        }

        setSearchState({
          status: items.length > 0 ? 'success' : 'empty',
          items,
          errorMessage: null,
        })

        if (
          activeCategory === 'anime' &&
          activeAnimeResourceMode === 'follow-subscription' &&
          items.length > 0
        ) {
          startAnimeCardSetup(items.filter(isAnimeSearchItem), requestId)
        }
        if (
          (activeCategory === 'tv' ||
            (activeCategory === 'anime' &&
              activeAnimeResourceMode === 'season-ingest')) &&
          items.length > 0
        ) {
          startSeriesSeasonSetup(
            items.filter(
              (item): item is SeriesSearchItem =>
                !isAnimeSearchItem(item) && isSeriesSearchItem(item),
            ),
            requestId,
            activeCategory === 'anime' ? 'ANIME' : 'SERIES',
          )
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }

        if (latestRequestIdRef.current !== requestId) {
          return
        }

        console.error(`${activeCategory} search failed`, error)

        setSearchState({
          status: 'error',
          items: [],
          errorMessage: getUserFacingErrorMessage(
            error,
            activeCopy.errorMessage,
          ),
        })
      })
      .finally(() => {
        if (activeRequestControllerRef.current === controller) {
          activeRequestControllerRef.current = null
        }
      })
  }

  function handleAnimeResourceModeChange(nextMode: AnimeResourceMode) {
    if (nextMode === animeResourceMode) {
      return
    }

    resetSearchSession()
    setAnimeResourceMode(nextMode)
  }

  function getSelectedQualityTag(item: SearchableResourceItem) {
    return qualitySelections[getMediaIngestKey(item)] ?? DEFAULT_QUALITY_TAG
  }

  function getSelectedSeasonNumber(item: SeriesSearchItem) {
    return seriesSeasonSelections[getSeriesIngestKey(item)] ?? null
  }

  function handleQualityTagChange(
    item: SearchableResourceItem,
    qualityTag: OpenListQualityTag,
  ) {
    setQualitySelections((currentSelections) => ({
      ...currentSelections,
      [getMediaIngestKey(item)]: qualityTag,
    }))
  }

  function handleSeasonNumberChange(
    item: SeriesSearchItem,
    seasonNumber: number,
  ) {
    setSeriesSeasonSelections((currentSelections) => ({
      ...currentSelections,
      [getSeriesIngestKey(item)]: seasonNumber,
    }))
  }

  function handleOpenListIngest(
    item: SearchableResourceItem,
    qualityTag: OpenListQualityTag,
    seasonNumber: number | null,
  ) {
    const itemKey = getMediaIngestKey(item)
    const currentIngestState = mediaIngestStates[itemKey]
    const searchSessionId = latestRequestIdRef.current

    if (
      activeMediaIngestKeysRef.current.has(itemKey) ||
      currentIngestState?.status === 'loading' ||
      currentIngestState?.status === 'success'
    ) {
      return
    }

    const showCardError = (message: string) => {
      setMediaIngestStates((currentStates) => ({
        ...currentStates,
        [itemKey]: {
          status: 'error',
          message,
        },
      }))
      setToastMessage(message)
    }

    let mediaType: RecentIngestMediaType

    const isAnimeSeasonIngest =
      isSeriesSearchItem(item) && category === 'anime'

    if (isSeriesSearchItem(item)) {
      if (typeof seasonNumber !== 'number') {
        showCardError(
          isAnimeSeasonIngest ? '请选择动漫目标季度。' : '请选择剧集目标季数。',
        )
        return
      }

      mediaType = 'series'
    } else {
      const movieYear = item.year
      if (typeof movieYear !== 'number') {
        showCardError('该电影缺少年份，暂时无法入库。')
        return
      }

      mediaType = 'movie'
    }

    const seriesItem = isSeriesSearchItem(item) ? item : null
    const taskProductType =
      mediaType === 'series' && category === 'anime' ? 'ANIME' : 'SERIES'
    activeMediaIngestKeysRef.current.add(itemKey)
    setMediaIngestStates((currentStates) => ({
      ...currentStates,
      [itemKey]: {
        status: 'loading',
        message: '正在匹配 Prowlarr 发布资源…',
        startedAt: Date.now(),
      },
    }))

    const releaseRequest =
      mediaType === 'movie'
        ? recommendMovieRelease({
            tmdb_id: item.tmdb_id,
            imdb_id: item.imdb_id,
            title: item.title,
            original_title: item.original_title,
            year: item.year as number,
            quality: qualityTag,
          }).then((data) => {
            const release = data.items[0]
            if (!release) {
              throw new Error('未找到匹配的电影发布资源。')
            }
            return {
              release,
              releases: data.items,
              query: data.query,
              searchLanguage: getItemSearchLanguage(item),
            }
          })
        : seriesItem
          ? recommendSeriesRelease({
              tvdb_id: seriesItem.tvdb_id,
              tmdb_id: seriesItem.tmdb_id,
              imdb_id: seriesItem.imdb_id,
              title: seriesItem.title,
              original_title: seriesItem.original_title,
              season_number: seasonNumber ?? 1,
              quality: qualityTag,
            }).then((data) => {
              const release = data.items[0]
              if (!release) {
                throw new Error(
                  isAnimeSeasonIngest
                    ? '未找到匹配的动漫整季发布资源。'
                    : '未找到匹配的剧集发布资源。',
                )
              }
              return {
                release,
                releases: data.items,
                query: data.query,
                searchLanguage: getItemSearchLanguage(seriesItem),
              }
            })
          : Promise.reject(
              new Error(
                isAnimeSeasonIngest
                  ? '请选择动漫目标季度。'
                  : '请选择剧集目标季数。',
              ),
            )

    void releaseRequest
      .then(({ release, releases, query, searchLanguage }) => {
        if (latestRequestIdRef.current !== searchSessionId) {
          return
        }

        setMediaIngestStates((currentStates) => ({
          ...currentStates,
          [itemKey]: {
            status: 'loading',
            message: '请确认自动匹配的发布资源。',
          },
        }))
        setAutoReleaseConfirmation({
          item,
          itemKey,
          mediaType,
          taskProductType: mediaType === 'series' ? taskProductType : null,
          qualityTag,
          seasonNumber: mediaType === 'series' ? seasonNumber : null,
          release,
          releases,
          query,
          searchLanguage,
          isSubmitting: false,
        })
      })
      .catch((error) => {
        if (latestRequestIdRef.current !== searchSessionId) {
          return
        }

        activeMediaIngestKeysRef.current.delete(itemKey)
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '入库任务创建失败，请稍后重试。'

        setMediaIngestStates((currentStates) => ({
          ...currentStates,
          [itemKey]: {
            status: 'error',
            message,
          },
        }))
        setToastMessage(message)
      })
  }

  function handleCancelAutoReleaseConfirmation() {
    if (!autoReleaseConfirmation || autoReleaseConfirmation.isSubmitting) {
      return
    }

    const itemKey = autoReleaseConfirmation.itemKey
    activeMediaIngestKeysRef.current.delete(itemKey)
    setMediaIngestStates((currentStates) => {
      const nextStates = { ...currentStates }
      delete nextStates[itemKey]
      return nextStates
    })
    setAutoReleaseConfirmation(null)
  }

  function handleSelectAutoReleaseCandidate(release: ProwlarrRelease) {
    if (!autoReleaseConfirmation || autoReleaseConfirmation.isSubmitting) {
      return
    }

    setAutoReleaseConfirmation({
      ...autoReleaseConfirmation,
      release,
    })
  }

  function handleConfirmAutoRelease() {
    if (!autoReleaseConfirmation || autoReleaseConfirmation.isSubmitting) {
      return
    }

    const selection = autoReleaseConfirmation
    const release = selection.release
    const commonPayload = {
      title: selection.item.title,
      original_title: selection.item.original_title,
      release_title: release.title,
      indexer: release.indexer,
      size: release.size,
      indexer_id: release.indexer_id,
      download_ref: release.download_ref,
      resolution_tags: release.resolution_tags,
      dynamic_range_tags: release.dynamic_range_tags,
    }

    const request =
      selection.mediaType === 'movie'
        ? createMovieReleaseOpenListIngest({
            ...commonPayload,
            year: selection.item.year as number,
          })
        : createSeriesReleaseOpenListIngest({
            ...commonPayload,
            season_number: selection.seasonNumber ?? 1,
            task_product_type: selection.taskProductType ?? 'SERIES',
          })

    setAutoReleaseConfirmation({ ...selection, isSubmitting: true })
    setMediaIngestStates((currentStates) => ({
      ...currentStates,
      [selection.itemKey]: {
        status: 'loading',
        message: '正在创建 OpenList 入库任务…',
      },
    }))

    void request
      .then((task) => {
        const message = '入库任务已创建'

        setMediaIngestStates((currentStates) => ({
          ...currentStates,
          [selection.itemKey]: {
            status: 'success',
            message,
          },
        }))
        setAutoReleaseConfirmation(null)
        setToastMessage(message)
        loadRecentIngestSummary()
        navigate(getTaskRoute(selection.mediaType, task.id))
      })
      .catch((error) => {
        activeMediaIngestKeysRef.current.delete(selection.itemKey)
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '入库任务创建失败，请稍后重试。'

        setMediaIngestStates((currentStates) => ({
          ...currentStates,
          [selection.itemKey]: {
            status: 'error',
            message,
          },
        }))
        setAutoReleaseConfirmation(null)
        setToastMessage(message)
      })
  }

  function handleViewMore(
    item: SearchableResourceItem,
    qualityTag: OpenListQualityTag,
    seasonNumber: number | null,
  ) {
    const mediaType: RecentIngestMediaType = isSeriesSearchItem(item)
      ? 'series'
      : 'movie'

    navigate(getPublishRoute(), {
      state: {
        mediaType,
        item,
        submittedTerm,
        qualityTag,
        seasonNumber: mediaType === 'series' ? seasonNumber ?? 1 : null,
        seasonOptions:
          mediaType === 'series' && isSeriesSearchItem(item)
            ? seriesSeasonOptions[getSeriesIngestKey(item)] ?? [1]
            : [],
        taskProductType:
          mediaType === 'series' && category === 'anime' ? 'ANIME' : 'SERIES',
      } satisfies ResourcePublishPageState,
    })
  }

  function startSeriesSeasonSetup(
    items: SeriesSearchItem[],
    searchRequestId: number,
    taskProductType: 'SERIES' | 'ANIME',
  ) {
    const controller = new AbortController()
    seriesSeasonsControllerRef.current = controller

    setSeriesSeasonLoadStates(
      items.reduce<Record<string, SeriesSeasonLoadState>>((states, item) => {
        const hasCatalogIdentity =
          (typeof item.tmdb_id === 'number' && item.tmdb_id > 0) ||
          (typeof item.tvdb_id === 'number' && item.tvdb_id > 0)
        states[getSeriesIngestKey(item)] = hasCatalogIdentity
          ? {
              status: 'loading',
              message: '正在加载可选季数…',
            }
          : {
              status: 'error',
              message:
                taskProductType === 'ANIME'
                  ? '缺少可用的动漫目录 ID，无法加载季度。'
                  : '缺少可用的剧集目录 ID，无法加载季数。',
            }
        return states
      }, {}),
    )

    items.forEach((item) => {
      const hasTmdbId = typeof item.tmdb_id === 'number' && item.tmdb_id > 0
      const hasTvdbId = typeof item.tvdb_id === 'number' && item.tvdb_id > 0
      if (!hasTmdbId && !hasTvdbId) {
        return
      }

      const itemKey = getSeriesIngestKey(item)
      void getSeriesSeasons(
        {
          tmdbId: hasTmdbId ? item.tmdb_id : null,
          tvdbId: hasTvdbId ? item.tvdb_id : null,
        },
        controller.signal,
      )
        .then((result) => {
          if (
            controller.signal.aborted ||
            latestRequestIdRef.current !== searchRequestId
          ) {
            return
          }
          const options = Array.from(
            new Set(
              result.season_numbers.filter(
                (seasonNumber) => seasonNumber > 0,
              ),
            ),
          ).sort((left, right) => left - right)
          if (options.length === 0) {
            setSeriesSeasonLoadStates((currentStates) => ({
              ...currentStates,
              [itemKey]: {
                status: 'empty',
                message: '目录服务暂未提供可选的正片季数。',
              },
            }))
            return
          }
          setSeriesSeasonOptions((currentOptions) => ({
            ...currentOptions,
            [itemKey]: options,
          }))
          setSeriesSeasonSelections((currentSelections) => ({
            ...currentSelections,
            [itemKey]: currentSelections[itemKey] ?? options[0],
          }))
          setSeriesSeasonLoadStates((currentStates) => ({
            ...currentStates,
            [itemKey]: {
              status: 'success',
              message: null,
            },
          }))
        })
        .catch((error) => {
          if (controller.signal.aborted || isRequestCanceledError(error)) {
            return
          }
          const message =
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : taskProductType === 'ANIME'
                ? '动漫季度加载失败，请稍后重试。'
                : '剧集季数加载失败，请稍后重试。'
          setSeriesSeasonLoadStates((currentStates) => ({
            ...currentStates,
            [itemKey]: {
              status: 'error',
              message,
            },
          }))
          console.error('series seasons load failed', error)
        })
    })
  }

  function startAnimeCardSetup(items: AnimeSearchItem[], searchRequestId: number) {
    animeCardsControllerRef.current?.abort()
    const controller = new AbortController()
    animeCardsControllerRef.current = controller

    const loadingStates = items.reduce<Record<string, AnimeGroupsState>>(
      (states, item) => {
        states[getAnimeCardKey(item)] = {
          status: 'loading',
          groups: [],
          message: null,
        }
        return states
      },
      {},
    )

    setAnimeGroupsStates(loadingStates)
    setAnimePreviewStates({})
    setAnimeGroupSelections({})
    setAnimeSubscribeStates({})
    animePreviewRequestIdsRef.current = {}

    items.forEach((item) => {
      void loadAnimeGroups(item, controller.signal, searchRequestId)
    })
  }

  async function loadAnimeGroups(
    item: AnimeSearchItem,
    signal: AbortSignal,
    searchRequestId: number,
  ) {
    const itemKey = getAnimeCardKey(item)
    const sourceUrl = item.source_url?.trim()

    if (!sourceUrl) {
      setAnimeGroupsStates((currentStates) => ({
        ...currentStates,
        [itemKey]: {
          status: 'error',
          groups: [],
          message: '该结果缺少来源地址。',
        },
      }))
      return
    }

    try {
      const groups = await getAnimeSubtitleGroups(item.id, sourceUrl, signal)

      if (signal.aborted || latestRequestIdRef.current !== searchRequestId) {
        return
      }

      setAnimeGroupsStates((currentStates) => ({
        ...currentStates,
        [itemKey]: {
          status: 'success',
          groups,
          message: groups.length > 0 ? null : '未找到中文字幕组',
        },
      }))

      const defaultGroup = groups[0]
      if (defaultGroup) {
        setAnimeGroupSelections((currentSelections) => ({
          ...currentSelections,
          [itemKey]: defaultGroup.id,
        }))
        void loadAnimePreview(item, defaultGroup, signal, searchRequestId)
      }
    } catch (error) {
      if (signal.aborted || isRequestCanceledError(error)) {
        return
      }

      if (latestRequestIdRef.current !== searchRequestId) {
        return
      }

      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : '字幕组加载失败，请稍后重试。'

      setAnimeGroupsStates((currentStates) => ({
        ...currentStates,
        [itemKey]: {
          status: 'error',
          groups: [],
          message,
        },
      }))
    }
  }

  async function loadAnimePreview(
    item: AnimeSearchItem,
    group: AnimeSubtitleGroup,
    signal: AbortSignal | undefined,
    searchRequestId: number,
  ) {
    const itemKey = getAnimeCardKey(item)
    const previewRequestId =
      (animePreviewRequestIdsRef.current[itemKey] ?? 0) + 1
    animePreviewRequestIdsRef.current[itemKey] = previewRequestId

    setAnimePreviewStates((currentStates) => ({
      ...currentStates,
      [itemKey]: {
        status: 'loading',
        preview: null,
        message: null,
      },
    }))

    try {
      const preview = await previewAnimeSubscription(
        {
          rss: group.rss,
          bgm_url: group.bgm_url,
          subgroup: group.label,
        },
        signal,
      )

      if (
        signal?.aborted ||
        latestRequestIdRef.current !== searchRequestId ||
        animePreviewRequestIdsRef.current[itemKey] !== previewRequestId
      ) {
        return
      }

      setAnimePreviewStates((currentStates) => ({
        ...currentStates,
        [itemKey]: {
          status: 'success',
          preview,
          message: null,
        },
      }))
    } catch (error) {
      if (signal?.aborted || isRequestCanceledError(error)) {
        return
      }

      if (
        latestRequestIdRef.current !== searchRequestId ||
        animePreviewRequestIdsRef.current[itemKey] !== previewRequestId
      ) {
        return
      }

      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : '字幕组预览失败，请稍后重试。'

      setAnimePreviewStates((currentStates) => ({
        ...currentStates,
        [itemKey]: {
          status: 'error',
          preview: null,
          message,
        },
      }))
    }
  }

  function handleAnimeGroupChange(item: AnimeSearchItem, groupId: string) {
    const itemKey = getAnimeCardKey(item)
    const group = animeGroupsStates[itemKey]?.groups.find(
      (candidate) => candidate.id === groupId,
    )

    setAnimeGroupSelections((currentSelections) => ({
      ...currentSelections,
      [itemKey]: groupId,
    }))
    setAnimeSubscribeStates((currentStates) => {
      const currentState = currentStates[itemKey]
      if (!currentState || currentState.status === 'success') {
        return currentStates
      }
      return {
        ...currentStates,
        [itemKey]: {
          status: 'idle',
          message: null,
        },
      }
    })

    if (group) {
      void loadAnimePreview(
        item,
        group,
        animeCardsControllerRef.current?.signal,
        latestRequestIdRef.current,
      )
    }
  }

  function handleAnimeSubscribe(item: AnimeSearchItem) {
    const itemKey = getAnimeCardKey(item)
    const searchSessionId = latestRequestIdRef.current
    const selectedGroupId = animeGroupSelections[itemKey]
    const group = animeGroupsStates[itemKey]?.groups.find(
      (candidate) => candidate.id === selectedGroupId,
    )
    const previewState = animePreviewStates[itemKey]

    if (
      !group ||
      previewState?.status !== 'success' ||
      !previewState.preview ||
      previewState.preview.preview_count <= 0 ||
      activeAnimeSubscribeKeysRef.current.has(itemKey) ||
      animeSubscribeStates[itemKey]?.status === 'success'
    ) {
      return
    }

    activeAnimeSubscribeKeysRef.current.add(itemKey)
    setAnimeSubscribeStates((currentStates) => ({
      ...currentStates,
      [itemKey]: {
        status: 'loading',
        message: '正在订阅…',
      },
    }))

    void subscribeAnime({
      rss: group.rss,
      bgm_url: group.bgm_url,
      subgroup: group.label,
    })
      .then((result) => {
        if (latestRequestIdRef.current !== searchSessionId) {
          return
        }

        setAnimePreviewStates((currentStates) => ({
          ...currentStates,
          [itemKey]: {
            status: 'success',
            preview: result.preview,
            message: null,
          },
        }))
        setAnimeSubscribeStates((currentStates) => ({
          ...currentStates,
          [itemKey]: {
            status: 'success',
            message: result.message,
          },
        }))
        setToastMessage(result.message)
      })
      .catch((error) => {
        if (latestRequestIdRef.current !== searchSessionId) {
          return
        }

        activeAnimeSubscribeKeysRef.current.delete(itemKey)
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '订阅失败，请稍后重试。'

        setAnimeSubscribeStates((currentStates) => ({
          ...currentStates,
          [itemKey]: {
            status: 'error',
            message,
          },
        }))
        setToastMessage(message)
      })
  }

  function renderRecentIngestSummary() {
    if (recentIngestState.status === 'empty') {
      return null
    }

    if (recentIngestState.status === 'loading') {
      return (
        <div className="mx-auto flex max-w-7xl items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-medium text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.03)]">
          <Clock3 className="h-4 w-4 text-slate-400" />
          正在读取最近入库任务…
        </div>
      )
    }

    if (recentIngestState.status === 'error') {
      return (
        <div className="mx-auto max-w-7xl rounded-2xl bg-white px-5 py-4 text-sm font-medium text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.03)]">
          {recentIngestState.message ?? '最近入库记录暂时不可用。'}
        </div>
      )
    }

    const item = recentIngestState.item
    if (!item) {
      return null
    }

    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl bg-white px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span>最近入库</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>
              {item.productType === 'MOVIE'
                ? '电影'
                : item.productType === 'ANIME'
                  ? '动漫整季'
                  : '剧集'}
            </span>
            {item.qualityTag ? (
              <>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{item.qualityTag}</span>
              </>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-950">
            {item.title}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4 text-sm">
          <span className="text-slate-500">
            {taskStatusCopy[item.status] ?? item.status} ·{' '}
            {formatTaskTime(item.updatedAt)}
          </span>
          <Link
            to={getTaskRoute(item.mediaType, item.taskId)}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            查看任务详情
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/tasks"
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-950"
          >
            查看全部任务
          </Link>
        </div>
      </div>
    )
  }

  function renderAutoReleaseConfirmation() {
    if (!autoReleaseConfirmation) {
      return null
    }

    const selection = autoReleaseConfirmation
    const release = selection.release
    const isNonChineseRelease = !hasChineseText(release.title)
    const matchLabel = releaseMatchLabel(release, selection.query)
    const hasMultipleCandidates = selection.releases.length > 1
    const selectedSeasonLabel =
      selection.mediaType === 'series' &&
      typeof selection.seasonNumber === 'number'
        ? formatSeasonLabel(selection.seasonNumber)
        : null
    const languageCopy =
      selection.searchLanguage === 'chinese'
        ? '中文'
        : selection.searchLanguage === 'english'
          ? '英文'
          : '未识别'

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-slate-950/40 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-8">
        <div
          role="dialog"
          aria-modal="true"
          className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:max-h-[calc(100dvh-4rem)] sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                自动匹配资源
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {hasMultipleCandidates ? '选择推荐发布入库' : '确认使用该发布入库？'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                命中：{matchLabel} · 搜索词语种：{languageCopy}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {selection.mediaType === 'movie'
                ? '电影'
                : selection.taskProductType === 'ANIME'
                  ? '动漫整季'
                  : '剧集'}{' '}
              ·{' '}
              {selection.qualityTag}
              {selectedSeasonLabel ? ` · ${selectedSeasonLabel}` : ''}
              {hasMultipleCandidates ? ` · ${selection.releases.length} 个推荐` : ''}
            </span>
          </div>

          {isNonChineseRelease ? (
            <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
              当前自动选中的发布标题不含中文，可能没有内置中文字幕。确认后如有需要，可以继续使用字幕上传能力补充字幕。
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {selection.releases.map((candidate, index) => {
              const isSelected = candidate === release
              const candidateMatchLabel = releaseMatchLabel(
                candidate,
                selection.query,
              )
              return (
                <button
                  key={releaseCandidateKey(candidate, index)}
                  type="button"
                  disabled={selection.isSubmitting}
                  onClick={() => handleSelectAutoReleaseCandidate(candidate)}
                  className={cn(
                    'w-full rounded-xl border px-4 py-4 text-left transition',
                    isSelected
                      ? 'border-slate-950 bg-slate-100'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className="break-words text-sm font-semibold leading-6 text-slate-950">
                      {candidate.title}
                    </p>
                    <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                      推荐 {index + 1}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">
                      命中 {candidateMatchLabel}
                    </span>
                    {selection.mediaType === 'series'
                      ? candidate.season_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-sky-50 px-2 py-1 text-sky-700"
                          >
                            {tag}
                          </span>
                        ))
                      : null}
                    <span className="rounded-md bg-slate-200 px-2 py-1 text-slate-700">
                      {formatReleaseSize(candidate.size)}
                    </span>
                    <span className="rounded-md bg-slate-200 px-2 py-1 text-slate-700">
                      做种 {candidate.seeders ?? '—'}
                    </span>
                    <span className="rounded-md bg-slate-200 px-2 py-1 text-slate-700">
                      {formatDynamicRange(candidate.dynamic_range_tags)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-5 rounded-xl bg-slate-100 px-4 py-4">
            <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
              <span>
                当前选择：
                {selectedSeasonLabel ? `${selectedSeasonLabel} / ` : ''}
                {selection.qualityTag} /{' '}
                {formatDynamicRange(release.dynamic_range_tags)}
              </span>
              <span>体积：{formatReleaseSize(release.size)}</span>
              <span>做种：{release.seeders ?? '—'}</span>
              <span>下载：{release.leechers ?? '—'}</span>
              <span>抓取：{release.grabs ?? '—'}</span>
              <span>来源：{release.indexer || '—'}</span>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={selection.isSubmitting}
              onClick={handleCancelAutoReleaseConfirmation}
              className="rounded-xl border-slate-200 shadow-none"
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={selection.isSubmitting}
              onClick={handleConfirmAutoRelease}
              className="rounded-xl bg-slate-950 text-white shadow-none hover:bg-slate-800"
            >
              {selection.isSubmitting ? '正在创建任务…' : '确认入库'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  function renderSearchContent() {
    switch (searchState.status) {
      case 'loading':
        return (
          <EmptyState
            title={activeCategoryCopy.loadingTitle}
            description={activeCategoryCopy.loadingDescription}
          />
        )

      case 'error':
        return (
          <EmptyState
            title="搜索失败"
            description={
              searchState.errorMessage ?? activeCategoryCopy.errorMessage
            }
          />
        )

      case 'empty':
        return (
          <EmptyState
            title={activeCategoryCopy.emptyTitle}
            description={activeCategoryCopy.emptyDescription}
          />
        )

      case 'success':
        return (
          <div
            className={cn(
              'mx-auto grid max-w-7xl',
              category === 'anime' &&
                animeResourceMode === 'follow-subscription'
                ? 'grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                : 'grid-cols-1 gap-5 lg:grid-cols-2',
            )}
          >
            {searchState.items.map((item) => {
              if (isAnimeSearchItem(item)) {
                const itemKey = getAnimeCardKey(item)
                const groupsState = animeGroupsStates[itemKey]
                const previewState = animePreviewStates[itemKey]
                const subscribeState = animeSubscribeStates[itemKey]

                return (
                  <AnimeCard
                    key={item.id}
                    item={item}
                    groups={groupsState?.groups}
                    groupsStatus={groupsState?.status}
                    groupsMessage={groupsState?.message}
                    selectedGroupId={animeGroupSelections[itemKey]}
                    preview={previewState?.preview}
                    previewStatus={previewState?.status}
                    previewMessage={previewState?.message}
                    subscribeStatus={subscribeState?.status}
                    subscribeMessage={subscribeState?.message}
                    onGroupChange={handleAnimeGroupChange}
                    onSubscribe={handleAnimeSubscribe}
                  />
                )
              }

              const itemKey = getMediaIngestKey(item)
              const ingestState = mediaIngestStates[itemKey]
              const ingestMessage = formatElapsedMessage(
                ingestState?.message,
                ingestState?.startedAt,
                elapsedNow,
              )

              return (
                <MediaCard
                  key={item.id}
                  item={item}
                  taskProductType={category === 'anime' ? 'ANIME' : 'SERIES'}
                  addStatus={ingestState?.status}
                  addMessage={ingestMessage}
                  qualityTags={OPENLIST_QUALITY_TAGS}
                  selectedQualityTag={getSelectedQualityTag(item)}
                  seasonOptions={
                    isSeriesSearchItem(item)
                      ? seriesSeasonOptions[getSeriesIngestKey(item)] ?? []
                      : undefined
                  }
                  selectedSeasonNumber={
                    isSeriesSearchItem(item)
                      ? getSelectedSeasonNumber(item)
                      : undefined
                  }
                  seasonStatus={
                    isSeriesSearchItem(item)
                      ? seriesSeasonLoadStates[getSeriesIngestKey(item)]
                          ?.status
                      : undefined
                  }
                  seasonMessage={
                    isSeriesSearchItem(item)
                      ? seriesSeasonLoadStates[getSeriesIngestKey(item)]
                          ?.message
                      : undefined
                  }
                  onQualityTagChange={handleQualityTagChange}
                  onSeasonNumberChange={
                    isSeriesSearchItem(item)
                      ? handleSeasonNumberChange
                      : undefined
                  }
                  onOpenListIngest={handleOpenListIngest}
                  onViewMore={handleViewMore}
                />
              )
            })}
          </div>
        )

      case 'idle':
      default:
        return (
          <EmptyState
            title={activeCategoryCopy.idleTitle}
            description={activeCategoryCopy.idleDescription}
          />
        )
    }
  }

  return (
    <PageContainer
      title="资源搜索"
      description="从资源卡片匹配 Prowlarr 发布资源，并通过 OpenList 创建电影、剧集或动漫整季入库任务。"
    >
      <div className="space-y-8">
        <div className="flex justify-end">
          <Link
            to="/tasks"
            className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            查看全部任务
          </Link>
        </div>

        <div className="flex flex-col items-center gap-5">
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            onSubmit={handleSearchSubmit}
            placeholder={activeSearchPlaceholder}
            isSubmitting={isSearching}
            submitDisabled={isSearching}
          />
          <CategorySwitch value={category} onChange={setCategory} />
          {category === 'anime' ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <AnimeModeSwitch
                value={animeResourceMode}
                onChange={handleAnimeResourceModeChange}
              />
              <p className="text-sm text-slate-500">
                {animeResourceModeCopy[animeResourceMode].description}
              </p>
            </div>
          ) : null}
        </div>

        {renderRecentIngestSummary()}

        {renderSearchContent()}
      </div>

      {toastMessage ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 right-6 z-20"
        >
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
            {toastMessage}
          </div>
        </div>
      ) : null}

      {renderAutoReleaseConfirmation()}
    </PageContainer>
  )
}
