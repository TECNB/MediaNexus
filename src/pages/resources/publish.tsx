import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  CloudUpload,
  Database,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  createMovieReleaseOpenListIngest,
  createSeriesReleaseOpenListIngest,
  isRequestCanceledError,
  searchMovieReleases,
  searchProwlarrReleases,
} from '@/lib/api/resources'
import { formatElapsedMessage, useElapsedNow } from '@/lib/use-elapsed-time'
import { cn } from '@/lib/utils'
import type {
  OpenListQualityTag,
  ProwlarrRelease,
  ResourcePublishPageState,
  SearchableResourceItem,
  SeriesSearchItem,
} from '@/types/resources'

type ResolutionFilter = 'all' | OpenListQualityTag | 'unknown'
type DynamicFilter = 'all' | 'dolby_vision' | 'hdr' | 'sdr' | 'unmarked'
type LoadStatus = 'loading' | 'success' | 'error'

const RESOLUTION_FILTERS: Array<{
  value: ResolutionFilter
  label: string
}> = [
  { value: 'all', label: '不限' },
  { value: '2160p', label: '2160p' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: 'unknown', label: '未知' },
]

const DYNAMIC_FILTERS: Array<{ value: DynamicFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'dolby_vision', label: 'Dolby Vision' },
  { value: 'hdr', label: 'HDR' },
  { value: 'sdr', label: 'SDR' },
  { value: 'unmarked', label: '未标注' },
]

const dynamicTagCopy: Record<string, string> = {
  dolby_vision: 'Dolby Vision',
  hdr10_plus: 'HDR10+',
  hdr10: 'HDR10',
  hdr: 'HDR',
  hlg: 'HLG',
  sdr: 'SDR',
}

function isSeriesSearchItem(
  item: SearchableResourceItem,
): item is SeriesSearchItem {
  return 'tvdb_id' in item
}

function getTaskRoute(mediaType: 'movie' | 'series', taskId: string) {
  return `/resources/ingest/${mediaType}/${encodeURIComponent(taskId)}`
}

function getSeasonLabel(seasonNumber: number) {
  return `S${String(seasonNumber).padStart(2, '0')}`
}

function formatSize(value: number | null) {
  if (typeof value !== 'number' || value < 0) {
    return '—'
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

function formatMetric(value: number | null) {
  return typeof value === 'number' ? String(value) : '—'
}

function matchesResolution(
  release: ProwlarrRelease,
  filter: ResolutionFilter,
) {
  if (filter === 'all') {
    return true
  }
  if (filter === 'unknown') {
    return release.resolution_tags.length === 0
  }
  return release.resolution_tags.includes(filter)
}

function matchesDynamic(release: ProwlarrRelease, filter: DynamicFilter) {
  if (filter === 'all') {
    return true
  }
  if (filter === 'unmarked') {
    return release.dynamic_range_tags.length === 0
  }
  if (filter === 'hdr') {
    return release.dynamic_range_tags.some((tag) =>
      ['hdr10_plus', 'hdr10', 'hdr', 'hlg'].includes(tag),
    )
  }
  return release.dynamic_range_tags.includes(filter)
}

function releaseKey(release: ProwlarrRelease, index: number) {
  return `${index}:${release.indexer_id}:${release.download_ref}`
}

function releaseMatchLabel(release: ProwlarrRelease) {
  const source = release.match_source?.trim()
  const query = release.match_query?.trim()

  if (source && query) {
    return `${source}：${query}`
  }
  return source || query || null
}

function MissingState() {
  return (
    <PageContainer
      title="发布资源选择"
      description="请从资源搜索结果的“查看更多”进入。"
    >
      <div className="rounded-lg bg-white px-8 py-12">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="mt-4 text-lg font-semibold text-slate-950">
          缺少资源信息
        </p>
        <Link
          to="/resources"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回资源搜索
        </Link>
      </div>
    </PageContainer>
  )
}

export function ResourcePublishPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const pageState = location.state as ResourcePublishPageState | null
  const item = pageState?.item ?? null
  const mediaType = pageState?.mediaType ?? null
  const [seasonNumber, setSeasonNumber] = useState(
    pageState?.seasonNumber ?? 1,
  )
  const [resolutionFilter, setResolutionFilter] =
    useState<ResolutionFilter>('all')
  const [dynamicFilter, setDynamicFilter] = useState<DynamicFilter>('all')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loadState, setLoadState] = useState<{
    status: LoadStatus
    query: string
    items: ProwlarrRelease[]
    message: string | null
    startedAt: number | null
  }>({
    status: 'loading',
    query: '',
    items: [],
    message: null,
    startedAt: Date.now(),
  })
  const [submitState, setSubmitState] = useState<{
    keys: string[]
    message: string | null
  }>({
    keys: [],
    message: null,
  })

  useEffect(() => {
    if (
      !pageState ||
      !item ||
      (mediaType !== 'movie' && mediaType !== 'series') ||
      (mediaType === 'series' && !pageState.submittedTerm.trim()) ||
      (mediaType === 'movie' && typeof item.year !== 'number')
    ) {
      return
    }

    const controller = new AbortController()
    setLoadState((current) => ({
      status: 'loading',
      query: current.query,
      items: current.items,
      message: null,
      startedAt: Date.now(),
    }))
    setSubmitState({ keys: [], message: null })

    const request =
      mediaType === 'movie'
        ? searchMovieReleases(
            {
              tmdb_id: item.tmdb_id,
              imdb_id: item.imdb_id,
              title: item.title,
              original_title: item.original_title,
              year: item.year as number,
              quality: pageState.qualityTag,
            },
            controller.signal,
          )
        : searchProwlarrReleases(
            {
              term: pageState.submittedTerm,
              media_type: mediaType,
              season_number: seasonNumber,
            },
            controller.signal,
          )

    void request
      .then((data) => {
        setLoadState({
          status: 'success',
          query: data.query,
          items: data.items,
          message: null,
          startedAt: null,
        })
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }
        setLoadState({
          status: 'error',
          query: '',
          items: [],
          message:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '发布资源加载失败，请稍后重试。',
          startedAt: null,
        })
      })

    return () => controller.abort()
  }, [item, mediaType, pageState, refreshVersion, seasonNumber])

  const filteredItems = useMemo(
    () =>
      loadState.items.filter(
        (release) =>
          matchesResolution(release, resolutionFilter) &&
          matchesDynamic(release, dynamicFilter),
      ),
    [dynamicFilter, loadState.items, resolutionFilter],
  )
  const loadElapsedNow = useElapsedNow(
    loadState.status === 'loading' && typeof loadState.startedAt === 'number',
  )
  const loadMessage = formatElapsedMessage(
    '正在加载 Prowlarr 发布资源…',
    loadState.startedAt,
    loadElapsedNow,
  )

  if (
    !pageState ||
    !item ||
    (mediaType !== 'movie' && mediaType !== 'series') ||
    (mediaType === 'series' && !pageState.submittedTerm.trim()) ||
    (mediaType === 'movie' && typeof item.year !== 'number')
  ) {
    return <MissingState />
  }

  const isSeriesItem = isSeriesSearchItem(item)
  const seasonOptions =
    pageState.seasonOptions.length > 0 ? pageState.seasonOptions : [1]
  const targetLabel =
    mediaType === 'series'
      ? getSeasonLabel(seasonNumber)
      : String(item.year ?? '年份未知')

  const resolutionCounts = RESOLUTION_FILTERS.reduce<
    Record<ResolutionFilter, number>
  >(
    (counts, option) => {
      counts[option.value] = loadState.items.filter(
        (release) =>
          matchesDynamic(release, dynamicFilter) &&
          matchesResolution(release, option.value),
      ).length
      return counts
    },
    { all: 0, '2160p': 0, '1080p': 0, '720p': 0, unknown: 0 },
  )

  const dynamicCounts = DYNAMIC_FILTERS.reduce<Record<DynamicFilter, number>>(
    (counts, option) => {
      counts[option.value] = loadState.items.filter(
        (release) =>
          matchesResolution(release, resolutionFilter) &&
          matchesDynamic(release, option.value),
      ).length
      return counts
    },
    { all: 0, dolby_vision: 0, hdr: 0, sdr: 0, unmarked: 0 },
  )

  function handleSubmit(release: ProwlarrRelease, key: string) {
    setSubmitState((current) => ({
      keys: [...current.keys, key],
      message: null,
    }))
    const commonPayload = {
      title: item!.title,
      original_title: item!.original_title,
      release_title: release.title,
      indexer: release.indexer,
      size: release.size,
      indexer_id: release.indexer_id,
      download_ref: release.download_ref,
      resolution_tags: release.resolution_tags,
      dynamic_range_tags: release.dynamic_range_tags,
    }

    const request =
      mediaType === 'movie'
        ? createMovieReleaseOpenListIngest({
            ...commonPayload,
            year: item!.year as number,
          })
        : createSeriesReleaseOpenListIngest({
            ...commonPayload,
            season_number: seasonNumber,
          })

    void request
      .then((task) => navigate(getTaskRoute(mediaType, task.id)))
      .catch((error) => {
        setSubmitState((current) => ({
          keys: current.keys.filter((itemKey) => itemKey !== key),
          message:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '发布资源入库失败，请稍后重试。',
        }))
      })
  }

  return (
    <PageContainer
      title="发布资源选择"
      description="从 Prowlarr 返回结果中选择一个具体发布，随后创建 OpenList 入库任务。"
    >
      <section className="rounded-lg bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Link
              to="/resources"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-950"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回资源搜索
            </Link>
            <h2 className="mt-3 truncate text-2xl font-semibold text-slate-950">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mediaType === 'movie'
                ? `电影 · ${targetLabel} · 使用电影实体搜索计划`
                : `剧集 · ${targetLabel} · 搜索词“${pageState.submittedTerm}”`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {mediaType === 'series' && isSeriesItem ? (
              <label className="relative">
                <select
                  value={seasonNumber}
                  onChange={(event) =>
                    setSeasonNumber(Number(event.target.value))
                  }
                  className="h-10 appearance-none rounded-lg bg-slate-100 px-3 pr-8 text-sm font-semibold text-slate-700 outline-none"
                >
                  {seasonOptions.map((season) => (
                    <option key={season} value={season}>
                      {getSeasonLabel(season)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </label>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefreshVersion((value) => value + 1)}
              disabled={loadState.status === 'loading'}
              className="h-10 rounded-lg border-slate-200 shadow-none"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  loadState.status === 'loading' && 'animate-spin',
                )}
              />
              刷新
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-500">分辨率</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RESOLUTION_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setResolutionFilter(option.value)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-semibold transition',
                    resolutionFilter === option.value
                      ? 'bg-slate-950 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {option.label} {resolutionCounts[option.value]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">动态范围</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DYNAMIC_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDynamicFilter(option.value)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-semibold transition',
                    dynamicFilter === option.value
                      ? 'bg-slate-950 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {option.label} {dynamicCounts[option.value]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>查询：{loadState.query || '正在生成查询'}</span>
          <button
            type="button"
            onClick={() => {
              setResolutionFilter('all')
              setDynamicFilter('all')
            }}
            className="font-semibold text-slate-700 hover:text-slate-950"
          >
            重置筛选
          </button>
        </div>
      </section>

      {loadState.status === 'loading' ? (
        <div className="rounded-lg bg-white px-8 py-16 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-400" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            {loadMessage}
          </p>
        </div>
      ) : loadState.status === 'error' ? (
        <div className="rounded-lg bg-white px-8 py-12">
          <AlertTriangle className="h-7 w-7 text-rose-500" />
          <p className="mt-4 font-semibold text-slate-950">加载失败</p>
          <p className="mt-2 text-sm text-slate-500">{loadState.message}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg bg-white px-8 py-14 text-center">
          <Database className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-4 font-semibold text-slate-950">
            当前筛选下没有发布资源
          </p>
          <p className="mt-2 text-sm text-slate-500">
            可以重置筛选或刷新当前查询。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((release) => {
            const key = releaseKey(release, loadState.items.indexOf(release))
            const isSubmitting = submitState.keys.includes(key)
            const matchLabel = releaseMatchLabel(release)
            const tags = [
              ...release.resolution_tags,
              ...release.dynamic_range_tags.map(
                (tag) => dynamicTagCopy[tag] ?? tag,
              ),
            ]

            return (
              <article key={key} className="rounded-lg bg-white p-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-semibold leading-6 text-slate-950">
                      {release.title}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {matchLabel ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          命中 {matchLabel}
                        </span>
                      ) : null}
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                      {tags.length === 0 ? (
                        <span className="text-xs text-slate-400">未解析标签</span>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-3 xl:grid-cols-6">
                      <span className="inline-flex items-center gap-1.5">
                        <HardDrive className="h-3.5 w-3.5" />
                        {formatSize(release.size)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        做种 {formatMetric(release.seeders)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Download className="h-3.5 w-3.5" />
                        下载 {formatMetric(release.leechers)}
                      </span>
                      <span>抓取 {formatMetric(release.grabs)}</span>
                      <span className="truncate">
                        来源 {release.indexer || '—'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {release.publish_date || '—'}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit(release, key)}
                    className="h-10 shrink-0 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white shadow-none hover:bg-slate-800"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在创建任务
                      </>
                    ) : (
                      <>
                        <CloudUpload className="h-4 w-4" />
                        使用该发布进行 OpenList 入库
                      </>
                    )}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {submitState.message ? (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
          {submitState.message}
        </p>
      ) : null}
    </PageContainer>
  )
}
