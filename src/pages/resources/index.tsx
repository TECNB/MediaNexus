import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Clock3 } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import {
  AnimeCard,
  type AnimeCardLoadStatus,
  type AnimeCardSubscribeStatus,
} from '@/components/resources/anime-card'
import {
  CategorySwitch,
  type ResourceCategoryValue,
} from '@/components/resources/category-switch'
import {
  MediaCard,
  type MediaCardAddStatus,
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
  createMovieOpenListIngest,
  createSeriesOpenListIngest,
  getSeriesSeasons,
  isRequestCanceledError,
  searchMovies,
  searchSeries,
} from '@/lib/api/resources'
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
  ResourcePublishPageState,
  SearchableResourceItem,
  SeriesSearchItem,
} from '@/types/resources'

type SearchableCategory = ResourceCategoryValue
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
  status: MagnetIngestTaskStatus
  qualityTag: string | null
  updatedAt: string | null
}

type RecentIngestState = {
  status: RecentIngestStatus
  item: RecentIngestSummary | null
  message: string | null
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

const searchableCategoryCopy: Record<
  SearchableCategory,
  {
    placeholder: string
    idleTitle: string
    idleDescription: string
    loadingTitle: string
    loadingDescription: string
    emptyTitle: string
    emptyDescription: string
    errorMessage: string
  }
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
  anime: {
    placeholder: '搜索动漫名称…',
    idleTitle: '输入动漫名称开始搜索',
    idleDescription: '当前分类会调用动漫搜索接口。',
    loadingTitle: '正在搜索动漫…',
    loadingDescription: '正在获取 Mikan 搜索结果。',
    emptyTitle: '没有搜索结果',
    emptyDescription: '换个动漫名称试试，或检查关键词是否输入正确。',
    errorMessage: '动漫搜索失败，请稍后重试。',
  },
}

const categorySearchHandlers: Record<
  SearchableCategory,
  (term: string, signal?: AbortSignal) => Promise<ResourceSearchResultItem[]>
> = {
  movie: async (term, signal) => searchMovies(term, signal),
  tv: async (term, signal) => searchSeries(term, signal),
  anime: async (term, signal) => searchAnime(term, signal),
}

function isSearchableCategory(
  category: ResourceCategoryValue,
): category is SearchableCategory {
  return category in categorySearchHandlers
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
  return `/resources/ingest/${mediaType}/${encodeURIComponent(taskId)}`
}

function getPublishRoute() {
  return '/resources/publish'
}

function createInitialSearchState(): ResourceSearchState {
  return {
    status: 'idle',
    items: [],
    errorMessage: null,
  }
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

function toRecentMovieTask(task: MovieMagnetIngestTask): RecentIngestSummary {
  return {
    taskId: task.id,
    title: `${task.title} (${task.year})`,
    mediaType: 'movie',
    status: task.status,
    qualityTag: task.quality_tag ?? task.resolution_tags?.[0] ?? null,
    updatedAt: task.updated_at ?? task.created_at,
  }
}

function toRecentSeriesTask(task: SeriesMagnetIngestTask): RecentIngestSummary {
  return {
    taskId: task.id,
    title: `${task.series_name} ${task.season_folder}`,
    mediaType: 'series',
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
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const latestRequestIdRef = useRef(0)
  const recentIngestRequestIdRef = useRef(0)
  const activeRequestControllerRef = useRef<AbortController | null>(null)
  const seriesSeasonsControllerRef = useRef<AbortController | null>(null)
  const activeMediaIngestKeysRef = useRef<Set<string>>(new Set())
  const activeAnimeSubscribeKeysRef = useRef<Set<string>>(new Set())
  const animeCardsControllerRef = useRef<AbortController | null>(null)
  const animePreviewRequestIdsRef = useRef<Record<string, number>>({})

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
    return () => {
      activeRequestControllerRef.current?.abort()
      seriesSeasonsControllerRef.current?.abort()
      animeCardsControllerRef.current?.abort()
      animeCardsControllerRef.current = null
    }
  }, [])

  useEffect(() => {
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
    setAnimeGroupsStates({})
    setAnimePreviewStates({})
    setAnimeGroupSelections({})
    setAnimeSubscribeStates({})
    animePreviewRequestIdsRef.current = {}
  }, [category])

  const isCategorySearchable = isSearchableCategory(category)
  const activeCategoryCopy = isCategorySearchable
    ? searchableCategoryCopy[category]
    : null
  const isSearching = isCategorySearchable && searchState.status === 'loading'
  const isSearchSubmitDisabled = !isCategorySearchable || isSearching
  const activeSearchPlaceholder = activeCategoryCopy?.placeholder ?? '搜索资源…'

  function handleSearchSubmit() {
    if (!isSearchableCategory(category) || searchState.status === 'loading') {
      return
    }

    const activeCategory = category
    const activeSearchHandler = categorySearchHandlers[activeCategory]
    const activeCopy = searchableCategoryCopy[activeCategory]
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
      activeMediaIngestKeysRef.current.clear()
      activeAnimeSubscribeKeysRef.current.clear()
      setSearchState(createInitialSearchState())
      setSubmittedTerm('')
      setMediaIngestStates({})
      setQualitySelections({})
      setSeriesSeasonSelections({})
      setSeriesSeasonOptions({})
      setAnimeGroupsStates({})
      setAnimePreviewStates({})
      setAnimeGroupSelections({})
      setAnimeSubscribeStates({})
      animePreviewRequestIdsRef.current = {}
      return
    }

    const controller = new AbortController()
    activeRequestControllerRef.current = controller
    seriesSeasonsControllerRef.current?.abort()
    seriesSeasonsControllerRef.current = null

    activeMediaIngestKeysRef.current.clear()
    activeAnimeSubscribeKeysRef.current.clear()
    setMediaIngestStates({})
    setQualitySelections({})
    setSeriesSeasonSelections({})
    setSeriesSeasonOptions({})
    setAnimeGroupsStates({})
    setAnimePreviewStates({})
    setAnimeGroupSelections({})
    setAnimeSubscribeStates({})
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

        if (activeCategory === 'anime' && items.length > 0) {
          startAnimeCardSetup(items.filter(isAnimeSearchItem), requestId)
        }
        if (activeCategory === 'tv' && items.length > 0) {
          startSeriesSeasonSetup(
            items.filter(
              (item): item is SeriesSearchItem =>
                !isAnimeSearchItem(item) && isSeriesSearchItem(item),
            ),
            requestId,
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
          errorMessage: activeCopy.errorMessage,
        })
      })
      .finally(() => {
        if (activeRequestControllerRef.current === controller) {
          activeRequestControllerRef.current = null
        }
      })
  }

  function getSelectedQualityTag(item: SearchableResourceItem) {
    return qualitySelections[getMediaIngestKey(item)] ?? DEFAULT_QUALITY_TAG
  }

  function getSelectedSeasonNumber(item: SeriesSearchItem) {
    return seriesSeasonSelections[getSeriesIngestKey(item)] ?? 1
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
    let ingestPromise: Promise<MovieMagnetIngestTask | SeriesMagnetIngestTask>

    if (isSeriesSearchItem(item)) {
      if (typeof seasonNumber !== 'number') {
        showCardError('请选择剧集目标季数。')
        return
      }

      mediaType = 'series'
      ingestPromise = createSeriesOpenListIngest({
        term: submittedTerm,
        title: item.title,
        original_title: item.original_title,
        season_number: seasonNumber,
        quality: qualityTag,
      })
    } else {
      const movieYear = item.year
      if (typeof movieYear !== 'number') {
        showCardError('该电影缺少年份，暂时无法入库。')
        return
      }

      mediaType = 'movie'
      ingestPromise = createMovieOpenListIngest({
        term: submittedTerm,
        title: item.title,
        original_title: item.original_title,
        year: movieYear,
        quality: qualityTag,
      })
    }

    activeMediaIngestKeysRef.current.add(itemKey)
    setMediaIngestStates((currentStates) => ({
      ...currentStates,
      [itemKey]: {
        status: 'loading',
        message: '正在匹配 Prowlarr 发布资源…',
      },
    }))

    void ingestPromise
      .then((task) => {
        const message = '入库任务已创建'

        setMediaIngestStates((currentStates) => ({
          ...currentStates,
          [itemKey]: {
            status: 'success',
            message,
          },
        }))
        setToastMessage(message)
        loadRecentIngestSummary()
        navigate(getTaskRoute(mediaType, task.id))
      })
      .catch((error) => {
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
      } satisfies ResourcePublishPageState,
    })
  }

  function startSeriesSeasonSetup(
    items: SeriesSearchItem[],
    searchRequestId: number,
  ) {
    const controller = new AbortController()
    seriesSeasonsControllerRef.current = controller

    items.forEach((item) => {
      if (typeof item.tvdb_id !== 'number' || item.tvdb_id < 1) {
        return
      }

      void getSeriesSeasons(item.tvdb_id, controller.signal)
        .then((result) => {
          if (
            controller.signal.aborted ||
            latestRequestIdRef.current !== searchRequestId
          ) {
            return
          }
          const options = result.season_numbers.filter(
            (seasonNumber) => seasonNumber > 0,
          )
          if (options.length === 0) {
            return
          }
          const itemKey = getSeriesIngestKey(item)
          setSeriesSeasonOptions((currentOptions) => ({
            ...currentOptions,
            [itemKey]: options,
          }))
          setSeriesSeasonSelections((currentSelections) => ({
            ...currentSelections,
            [itemKey]: currentSelections[itemKey] ?? options[0],
          }))
        })
        .catch((error) => {
          if (
            !controller.signal.aborted &&
            !isRequestCanceledError(error)
          ) {
            console.error('series seasons load failed', error)
          }
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
            <span>{item.mediaType === 'movie' ? '电影' : '剧集'}</span>
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
            查看日志
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    )
  }

  function renderSearchContent() {
    if (!activeCategoryCopy) {
      return null
    }

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
              category === 'anime'
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

              return (
                <MediaCard
                  key={item.id}
                  item={item}
                  addStatus={ingestState?.status}
                  addMessage={ingestState?.message}
                  qualityTags={OPENLIST_QUALITY_TAGS}
                  selectedQualityTag={getSelectedQualityTag(item)}
                  seasonOptions={
                    isSeriesSearchItem(item)
                      ? seriesSeasonOptions[getSeriesIngestKey(item)] ?? [1]
                      : undefined
                  }
                  selectedSeasonNumber={
                    isSeriesSearchItem(item)
                      ? getSelectedSeasonNumber(item)
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
      description="从资源卡片直接匹配 Prowlarr 发布资源，并通过 OpenList 创建电影或剧集入库任务。"
    >
      <div className="space-y-8">
        <div className="flex flex-col items-center gap-5">
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            onSubmit={handleSearchSubmit}
            placeholder={activeSearchPlaceholder}
            isSubmitting={isSearching}
            submitDisabled={isSearchSubmitDisabled}
          />
          <CategorySwitch value={category} onChange={setCategory} />
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
    </PageContainer>
  )
}
