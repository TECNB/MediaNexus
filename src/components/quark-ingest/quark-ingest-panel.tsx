import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, CloudUpload, File, Folder, Link2, Loader2, TriangleAlert } from 'lucide-react'

import {
  LibraryLinkPicker,
  type LibraryLinkItem,
  type ResourceSearchStatus,
} from '@/components/magnet-ingest/library-link-picker'
import { Button } from '@/components/ui/button'
import {
  OperationalLogPanel,
  type OperationalLogStatus,
} from '@/components/operation-log/operational-log-panel'
import {
  createMovieQuarkIngestTask,
  createQuarkMultiSourceTasks,
  createSeriesQuarkIngestTask,
  createVarietyQuarkIngestTask,
  listQuarkIngestTaskLogs,
  listQuarkIngestTasks,
  previewQuarkMultiSourcePlan,
  previewQuarkShareTree,
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
  QuarkIngestTaskLog,
  QuarkMultiSourcePreview,
  QuarkMultiSourceTaskResult,
  QuarkSourceSelection,
  QuarkSourceTreeNode,
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

const TASK_LOG_POLL_INTERVAL_MS = 2000
const quarkStageLabels: Record<string, string> = {
  planning: '规划中',
  rename_preview: '改名预览',
  creating: '创建任务',
  submitted: '请求执行',
  qas_running: 'QAS 执行中',
  renaming: '实际改名',
  scheduled: '等待定时执行',
  partial: '部分创建',
  failed: '创建失败',
  execution_ended: '执行输出结束',
  execution_stream_interrupted: '执行输出中断',
}
const terminalQuarkLogStages = new Set([
  'scheduled',
  'failed',
  'execution_ended',
  'execution_stream_interrupted',
])

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

function candidateNodes(
  nodes: QuarkSourceTreeNode[],
  result: QuarkSourceTreeNode[] = [],
) {
  for (const node of nodes) {
    if (node.source_candidate_id) {
      result.push(node)
    }
    candidateNodes(node.children, result)
  }
  return result
}

function candidateIdsBelow(node: QuarkSourceTreeNode) {
  return candidateNodes(node.children)
    .map((child) => child.source_candidate_id)
    .filter((value): value is string => Boolean(value))
}

function sourceMappingLabel(
  node: QuarkSourceTreeNode,
  selection: QuarkSourceSelection | undefined,
) {
  if (!selection) return null
  if (selection.ignored) return '已忽略'
  if (typeof selection.season_number === 'number') {
    const origin =
      node.season_status === 'AUTO' && node.detected_season === selection.season_number
        ? '自动'
        : '手动'
    return `${origin}·第 ${selection.season_number} 季`
  }
  return '未设置季度'
}

function ShareTree({
  nodes,
  ignoredCandidateIds,
  selectionsByCandidateId,
  selectedSeason,
  onMapDescendants,
  followUpdatesEnabled,
  onFollowDescendants,
  depth = 0,
}: {
  nodes: QuarkSourceTreeNode[]
  ignoredCandidateIds: Set<string>
  selectionsByCandidateId: Map<string, QuarkSourceSelection>
  selectedSeason: number | null
  onMapDescendants: (candidateIds: string[], seasonNumber: number) => void
  followUpdatesEnabled: boolean
  onFollowDescendants: (candidateIds: string[], followUpdates: boolean) => void
  depth?: number
}) {
  return (
    <ul className={cn('space-y-1.5 text-xs', depth > 0 && 'ml-4 border-l border-slate-200 pl-3')}>
      {nodes.map((node) => (
        <li key={`${node.relative_path}:${node.name}`}>
          {node.directory ? (
            <details
              className="group"
            >
              <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 text-slate-700 marker:hidden">
                <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500 transition-transform group-open:rotate-0" />
                <span className="break-all">{node.name}</span>
                {node.source_candidate_id ? (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px]',
                      ignoredCandidateIds.has(node.source_candidate_id)
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-indigo-50 text-indigo-700',
                    )}
                  >
                    {ignoredCandidateIds.has(node.source_candidate_id)
                      ? '已忽略'
                      : sourceMappingLabel(
                          node,
                          selectionsByCandidateId.get(node.source_candidate_id),
                        ) ?? (node.source_kind === 'DIRECT_FILES' ? '直属文件' : '来源')}
                  </span>
                ) : null}
              </summary>
              {candidateIdsBelow(node).length > 0 ? (
                <button
                  type="button"
                  className="ml-5 mt-1 rounded-lg border border-indigo-100 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  disabled={selectedSeason == null}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (selectedSeason != null) {
                      onMapDescendants(candidateIdsBelow(node), selectedSeason)
                    }
                  }}
                >
                  批量映射后代为 S{String(selectedSeason ?? 0).padStart(2, '0')}
                </button>
              ) : null}
              {followUpdatesEnabled && candidateIdsBelow(node).length > 0 ? (
                <label className="ml-2 mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={candidateIdsBelow(node)
                      .filter((candidateId) => !ignoredCandidateIds.has(candidateId))
                      .every(
                        (candidateId) =>
                          selectionsByCandidateId.get(candidateId)?.follow_updates === true,
                      )}
                    onChange={(event) =>
                      onFollowDescendants(candidateIdsBelow(node), event.target.checked)
                    }
                  />
                  订阅后代
                </label>
              ) : null}
              {node.children.length > 0 ? (
                <ShareTree
                  nodes={node.children}
                  ignoredCandidateIds={ignoredCandidateIds}
                  selectionsByCandidateId={selectionsByCandidateId}
                  selectedSeason={selectedSeason}
                  onMapDescendants={onMapDescendants}
                  followUpdatesEnabled={followUpdatesEnabled}
                  onFollowDescendants={onFollowDescendants}
                  depth={depth + 1}
                />
              ) : null}
            </details>
          ) : (
            <div className="flex min-w-0 items-center gap-2 text-slate-700">
              <File className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="break-all">{node.name}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
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
  const [createdMultiTask, setCreatedMultiTask] = useState<QuarkMultiSourceTaskResult | null>(null)
  const [multiPreview, setMultiPreview] = useState<QuarkMultiSourcePreview | null>(null)
  const [multiSelections, setMultiSelections] = useState<QuarkSourceSelection[]>([])
  const [followUpdatesEnabled, setFollowUpdatesEnabled] = useState(false)
  const [recentTasks, setRecentTasks] = useState<QuarkIngestTaskResult[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskLogs, setTaskLogs] = useState<QuarkIngestTaskLog[]>([])
  const [taskLogStatus, setTaskLogStatus] = useState<OperationalLogStatus>('idle')
  const [taskLogError, setTaskLogError] = useState<string | null>(null)
  const searchControllerRef = useRef<AbortController | null>(null)
  const seasonControllerRef = useRef<AbortController | null>(null)
  const multiPreviewControllerRef = useRef<AbortController | null>(null)

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
    (mediaType === 'movie' && typeof selectedYear !== 'number')

  const multiCandidateNames = new Map(
    candidateNodes(multiPreview?.entries ?? []).map((node) => [
      node.source_candidate_id as string,
      node.name,
    ]),
  )
  const ignoredMultiCandidateIds = new Set(
    multiSelections.filter((selection) => selection.ignored).map((selection) => selection.source_candidate_id),
  )
  const multiSelectionsByCandidateId = new Map(
    multiSelections.map((selection) => [selection.source_candidate_id, selection]),
  )
  const plannedSavePaths = [
    ...new Set(
      (multiPreview?.sources ?? [])
        .map((source) => source.save_path)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  const rootSourceCandidateId = multiPreview?.root_source_candidate_id ?? null
  const rootSourcePlan = rootSourceCandidateId
    ? multiPreview?.sources.find(
        (source) => source.source_candidate_id === rootSourceCandidateId,
      )
    : undefined

  function mapDescendantSources(candidateIds: string[], seasonNumber: number) {
    const candidateIdSet = new Set(candidateIds)
    const changing = multiSelections.some(
      (source) =>
        candidateIdSet.has(source.source_candidate_id) &&
        !source.ignored &&
        source.season_number !== seasonNumber,
    )
    if (
      changing &&
      !window.confirm(
        `确认将全部未忽略后代来源覆盖为 S${String(seasonNumber).padStart(2, '0')}？子级已有季度设置也会被覆盖。`,
      )
    ) {
      return
    }
    setMultiSelections((current) =>
      current.map((source) =>
        candidateIdSet.has(source.source_candidate_id) && !source.ignored
          ? { ...source, season_number: seasonNumber }
          : source,
      ),
    )
    setMultiPreview((current) =>
      current
        ? {
            ...current,
            sources: current.sources.map((source) =>
              candidateIdSet.has(source.source_candidate_id) && !source.ignored
                ? { ...source, selected_season: seasonNumber, status: 'PENDING' }
                : source,
            ),
          }
        : current,
    )
    markMultiPlanDirty()
  }

  function followDescendantSources(candidateIds: string[], followUpdates: boolean) {
    const candidateIdSet = new Set(candidateIds)
    setMultiSelections((current) =>
      current.map((source) =>
        candidateIdSet.has(source.source_candidate_id) && !source.ignored
          ? { ...source, follow_updates: followUpdates }
          : source,
      ),
    )
    setMultiPreview((current) =>
      current
        ? {
            ...current,
            sources: current.sources.map((source) =>
              candidateIdSet.has(source.source_candidate_id) && !source.ignored
                ? { ...source, follow_updates: followUpdates }
                : source,
            ),
          }
        : current,
    )
    markMultiPlanDirty()
  }
  const multiPlanReady = Boolean(multiPreview?.ready && multiPreview.sources.length > 0)

  useEffect(() => {
    return () => {
      searchControllerRef.current?.abort()
      seasonControllerRef.current?.abort()
      multiPreviewControllerRef.current?.abort()
    }
  }, [])

  const refreshRecentTasks = useCallback(async (preferredTaskId?: string) => {
    try {
      const data = await listQuarkIngestTasks()
      setRecentTasks(data.items)
      setSelectedTaskId((current) => {
        if (preferredTaskId && data.items.some((task) => task.id === preferredTaskId)) {
          return preferredTaskId
        }
        if (current && data.items.some((task) => task.id === current)) {
          return current
        }
        return data.items[0]?.id ?? null
      })
    } catch {
      // The submit flow remains usable when task history is temporarily unavailable.
    }
  }, [])

  useEffect(() => {
    void refreshRecentTasks()
  }, [refreshRecentTasks])

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskLogs([])
      setTaskLogStatus('idle')
      setTaskLogError(null)
      return
    }

    let active = true
    let loading = false
    const loadLogs = async () => {
      if (loading) return
      loading = true
      try {
        const data = await listQuarkIngestTaskLogs(selectedTaskId)
        if (!active) return
        setTaskLogs(data.items)
        setTaskLogStatus(data.items.length > 0 ? 'success' : 'empty')
        setTaskLogError(null)
      } catch (error) {
        if (!active) return
        setTaskLogStatus('error')
        setTaskLogError(error instanceof Error ? error.message : 'Quark 入库日志加载失败。')
      } finally {
        loading = false
      }
    }

    setTaskLogs([])
    setTaskLogStatus('loading')
    void loadLogs()
    const timer = window.setInterval(() => void loadLogs(), TASK_LOG_POLL_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [selectedTaskId])

  function resetSubmitFeedback() {
    setSubmitStatus('idle')
    setSubmitError(null)
    setCreatedTask(null)
    setCreatedMultiTask(null)
  }

  function resetMultiPreview() {
    multiPreviewControllerRef.current?.abort()
    multiPreviewControllerRef.current = null
    setMultiPreview(null)
    setMultiSelections([])
    setFollowUpdatesEnabled(false)
    setCreatedMultiTask(null)
  }

  function markMultiPlanDirty() {
    setMultiPreview((current) => (current ? { ...current, ready: false } : current))
    setSubmitStatus('idle')
    setSubmitError(null)
  }

  function resetSelection() {
    seasonControllerRef.current?.abort()
    seasonControllerRef.current = null
    setSelectedItem(null)
    setSeasonStatus('idle')
    setSeasonOptions([])
    setSelectedSeason(null)
    setSeasonError(null)
    resetMultiPreview()
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
    resetMultiPreview()

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
    setCreatedMultiTask(null)

    try {
      const commonPayload = {
        share_url: shareUrl.trim(),
        title: selectedTitle,
        original_title: selectedItem.original_title,
      }

      if (isSeasonMedia) {
        const multiMediaType = mediaType as 'series' | 'variety'
        const baseMultiPayload = {
          ...commonPayload,
          tmdb_id: selectedItem.tmdb_id,
          preview_id: multiPreview?.preview_id ?? null,
          follow_updates_enabled: followUpdatesEnabled,
          sources: multiSelections,
        }
        if (!multiPreview) {
          const controller = new AbortController()
          multiPreviewControllerRef.current = controller
          const preview = await previewQuarkShareTree(
            multiMediaType,
            { ...baseMultiPayload, sources: [] },
            controller.signal,
          )
          setMultiPreview(preview)
          setMultiSelections(
            preview.sources.map((source) => ({
              source_candidate_id: source.source_candidate_id,
              season_number: source.selected_season,
              ignored: source.ignored,
              follow_updates: false,
            })),
          )
          setSubmitStatus('success')
          return
        }
        if (!multiPlanReady) {
          const controller = new AbortController()
          multiPreviewControllerRef.current = controller
          const preview = await previewQuarkMultiSourcePlan(
            multiMediaType,
            baseMultiPayload,
            controller.signal,
          )
          setMultiPreview(preview)
          setMultiSelections(
            preview.sources.map((source) => ({
              source_candidate_id: source.source_candidate_id,
              season_number: source.selected_season,
              ignored: source.ignored,
              follow_updates: source.follow_updates,
            })),
          )
          setSubmitStatus('success')
          return
        }
        const task = await createQuarkMultiSourceTasks(multiMediaType, baseMultiPayload)
        setCreatedMultiTask(task)
        setSelectedTaskId(task.id)
        void refreshRecentTasks(task.id)
        setSubmitStatus('success')
        if (task.status === 'PARTIAL') {
          const createdCandidateIds = new Set(
            task.sources
              .filter((source) => source.status === 'CREATED')
              .map((source) => source.source_candidate_id),
          )
          setMultiSelections((current) =>
            current.map((source) =>
              createdCandidateIds.has(source.source_candidate_id)
                ? { ...source, ignored: true, follow_updates: false }
                : source,
            ),
          )
          setMultiPreview((current) =>
            current
              ? {
                  ...current,
                  ready: false,
                  message: '已创建的来源已标记为忽略，可重新预览并重试失败来源。',
                  sources: current.sources.map((source) =>
                    createdCandidateIds.has(source.source_candidate_id)
                      ? {
                          ...source,
                          ignored: true,
                          follow_updates: false,
                          status: 'IGNORED',
                        }
                      : source,
                  ),
                }
              : current,
          )
        } else if (task.status !== 'FAILED') {
          setShareUrl('')
        }
        return
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
      setSelectedTaskId(task.id)
      void refreshRecentTasks(task.id)
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
                resetMultiPreview()
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
              (isSeasonMedia
                ? '只接受 pan.quark.cn 的 HTTPS 分享链接；电视剧和综艺会先展开目录树，再确认季度与改名。'
                : '只接受 pan.quark.cn 的 HTTPS 分享链接；电影保持现有单条入库流程。')}
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
                    resetMultiPreview()
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

        {isSeasonMedia && multiPreview ? (
          <section className="space-y-3">
            <SectionHeading
              label="分享目录规划"
              title="展开目录树，为每个可执行来源设置季度；合集容器只作为批量分组，不会直接交给 QAS。"
            />
            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-shell">
              <ShareTree
                nodes={multiPreview.entries}
                ignoredCandidateIds={ignoredMultiCandidateIds}
                selectionsByCandidateId={multiSelectionsByCandidateId}
                selectedSeason={selectedSeason}
                onMapDescendants={mapDescendantSources}
                followUpdatesEnabled={followUpdatesEnabled}
                onFollowDescendants={followDescendantSources}
              />
              {multiPreview.root_source_candidate_id ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
                  <span>
                    当前目录直属文件（
                    {multiPreview.entries.filter((entry) => !entry.directory).length} 个）
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold">
                    {sourceMappingLabel(
                      {
                        name: '当前目录直属文件',
                        directory: false,
                        size: 0,
                        source_candidate_id: multiPreview.root_source_candidate_id,
                        source_kind: 'DIRECT_FILES',
                        relative_path: '',
                        detected_season: rootSourcePlan?.detected_season ?? null,
                        season_status: rootSourcePlan?.season_status ?? 'UNRECOGNIZED',
                        children: [],
                      },
                      multiSelectionsByCandidateId.get(multiPreview.root_source_candidate_id),
                    )}
                  </span>
                </div>
              ) : null}
              <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={followUpdatesEnabled}
                  onChange={(event) => {
                    const enabled = event.target.checked
                    setFollowUpdatesEnabled(enabled)
                    setMultiPreview((current) =>
                      current
                        ? {
                            ...current,
                            sources: current.sources.map((source) => ({
                              ...source,
                              follow_updates: enabled ? source.follow_updates : false,
                            })),
                          }
                        : current,
                    )
                    setMultiSelections((current) =>
                      current.map((source) => ({
                        ...source,
                        follow_updates: enabled ? source.follow_updates : false,
                      })),
                    )
                    markMultiPlanDirty()
                  }}
                />
                <span>
                  <span className="font-semibold text-slate-900">启用更新订阅</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    开启后请手动勾选需要追更的来源；系统不会自动判断。订阅仅按创建时固定正则每日检查，未来命名变化不会自动适配。
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <p className="text-xs leading-5 text-slate-500">
                  可将当前目标季批量应用到全部未忽略来源；之后仍可逐来源覆盖。
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={typeof selectedSeason !== 'number'}
                  onClick={() => {
                    if (typeof selectedSeason !== 'number') return
                    setMultiSelections((current) =>
                      current.map((source) =>
                        source.ignored ? source : { ...source, season_number: selectedSeason },
                      ),
                    )
                    setMultiPreview((current) =>
                      current
                        ? {
                            ...current,
                            sources: current.sources.map((source) =>
                              source.ignored
                                ? source
                                : { ...source, selected_season: selectedSeason, status: 'PENDING' },
                            ),
                          }
                        : current,
                    )
                    markMultiPlanDirty()
                  }}
                >
                  批量设为 S{String(selectedSeason ?? 0).padStart(2, '0')}
                </Button>
              </div>

              <div className="space-y-3">
                {(multiPreview.sources.length > 0
                  ? multiPreview.sources
                  : multiSelections.map((selection) => ({
                      source_candidate_id: selection.source_candidate_id,
                      source_name:
                        multiCandidateNames.get(selection.source_candidate_id) ?? '当前目录直属文件',
                      relative_path: '',
                      source_kind: 'DIRECT_FILES',
                      detected_season: null,
                      season_status: 'MANUAL',
                      selected_season: selection.season_number,
                      ignored: selection.ignored,
                      follow_updates: selection.follow_updates,
                      save_path: null,
                      task_name: null,
                      status: selection.ignored ? 'IGNORED' : 'PENDING',
                      files: [],
                      errors: [],
                      warnings: [],
                    })))
                  .map((source) => {
                    const selection =
                      multiSelections.find(
                        (item) => item.source_candidate_id === source.source_candidate_id,
                      ) ?? {
                        source_candidate_id: source.source_candidate_id,
                        season_number: source.selected_season,
                        ignored: source.ignored,
                        follow_updates: source.follow_updates,
                      }
                    return (
                      <div
                        key={source.source_candidate_id}
                        className={cn(
                          'rounded-2xl border px-4 py-4',
                          source.status === 'BLOCKED' || source.errors.length > 0
                            ? 'border-rose-200 bg-rose-50/60'
                            : source.ignored
                              ? 'border-slate-200 bg-slate-50 opacity-75'
                              : 'border-slate-200 bg-white',
                        )}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {source.source_name}
                              {source.source_kind === 'DIRECT_FILES' ? ' · 当前目录直属文件' : ''}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {source.relative_path || '分享根目录'} · {source.season_status}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={selection.season_number ?? ''}
                              disabled={selection.ignored}
                              onChange={(event) => {
                                const value = Number(event.target.value)
                                setMultiSelections((current) =>
                                  current.map((item) =>
                                    item.source_candidate_id === source.source_candidate_id
                                      ? { ...item, season_number: value > 0 ? value : null }
                                      : item,
                                  ),
                                )
                                setMultiPreview((current) =>
                                  current
                                    ? {
                                        ...current,
                                        sources: current.sources.map((item) =>
                                          item.source_candidate_id === source.source_candidate_id
                                            ? {
                                                ...item,
                                                selected_season: value > 0 ? value : null,
                                                status: 'PENDING',
                                              }
                                            : item,
                                        ),
                                      }
                                    : current,
                                )
                                markMultiPlanDirty()
                              }}
                              aria-label={`${source.source_name}季度`}
                              className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold"
                            >
                              <option value="">未设置季度</option>
                              {[
                                ...new Set([
                                  ...Array.from({ length: 99 }, (_, index) => index + 1),
                                  ...seasonOptions,
                                  source.detected_season ?? 0,
                                ]),
                              ]
                                .filter((value) => value > 0)
                                .sort((left, right) => left - right)
                                .map((value) => (
                                  <option key={value} value={value}>S{String(value).padStart(2, '0')}</option>
                                ))}
                            </select>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={selection.ignored}
                                onChange={(event) => {
                                  setMultiSelections((current) =>
                                    current.map((item) =>
                                      item.source_candidate_id === source.source_candidate_id
                                        ? {
                                            ...item,
                                            ignored: event.target.checked,
                                            follow_updates: event.target.checked ? false : item.follow_updates,
                                          }
                                        : item,
                                    ),
                                  )
                                  setMultiPreview((current) =>
                                    current
                                      ? {
                                          ...current,
                                          sources: current.sources.map((item) =>
                                            item.source_candidate_id === source.source_candidate_id
                                              ? {
                                                  ...item,
                                                  ignored: event.target.checked,
                                                  follow_updates: event.target.checked ? false : item.follow_updates,
                                                  status: event.target.checked ? 'IGNORED' : 'PENDING',
                                                  files: event.target.checked ? [] : item.files,
                                                  errors: event.target.checked ? [] : item.errors,
                                                }
                                              : item,
                                          ),
                                        }
                                      : current,
                                  )
                                  markMultiPlanDirty()
                                }}
                              />
                              忽略
                            </label>
                            {followUpdatesEnabled && !selection.ignored ? (
                              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={selection.follow_updates}
                                  onChange={(event) =>
                                    (() => {
                                      setMultiSelections((current) =>
                                        current.map((item) =>
                                          item.source_candidate_id === source.source_candidate_id
                                            ? { ...item, follow_updates: event.target.checked }
                                            : item,
                                        ),
                                      )
                                      markMultiPlanDirty()
                                    })()
                                  }
                                />
                                订阅
                              </label>
                            ) : null}
                          </div>
                        </div>
                        {source.files.length > 0 ? (
                          <div className="mt-3 max-h-56 overflow-auto rounded-xl bg-slate-950 px-3 py-2 font-mono text-[11px] leading-5 text-slate-200">
                            {source.files.map((file) => (
                              <div key={`${file.source_name}:${file.target_name}`} className={file.status === 'CONFLICT' ? 'text-rose-300' : undefined}>
                                {file.source_name} → {file.target_name} {file.message ? `(${file.message})` : ''}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {source.errors.length > 0 ? (
                          <p className="mt-2 text-xs leading-5 text-rose-600">{source.errors.join('；')}</p>
                        ) : null}
                      </div>
                    )
                  })}
              </div>
              <p className={cn('text-sm', multiPreview.ready ? 'text-emerald-700' : 'text-amber-700')}>
                {multiPreview.message}
              </p>
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
              {plannedSavePaths.length > 0
                ? plannedSavePaths.map((path) => <span key={path} className="block">{path}</span>)
                : targetPath ?? '选择媒体并确认必要信息后显示'}
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
              {isSeasonMedia
                ? !multiPreview
                  ? '正在检查分享目录…'
                  : !multiPlanReady
                    ? '正在生成逐文件预览…'
                    : '正在创建并触发…'
                : '正在创建并触发…'}
            </>
          ) : (
            <>
              <CloudUpload className="h-4 w-4" />
              {isSeasonMedia
                ? !multiPreview
                  ? '检查分享目录树'
                  : !multiPlanReady
                    ? '生成逐文件改名预览'
                    : '创建并立即执行 QAS 任务'
                : '创建并立即执行 QAS 任务'}
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

        {createdMultiTask ? (
          <div
            className={cn(
              'rounded-2xl px-4 py-4',
              createdMultiTask.status === 'STARTED'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800',
            )}
          >
            <div className="flex items-start gap-3">
              {createdMultiTask.status === 'STARTED' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">{createdMultiTask.message}</p>
                <p className="text-xs opacity-80">
                  已创建 {createdMultiTask.created_task_count}/{createdMultiTask.planned_task_count} 个 QAS 任务
                </p>
                {createdMultiTask.sources
                  .filter((source) => source.status !== 'CREATED')
                  .map((source) => (
                    <p key={source.source_candidate_id} className="text-xs text-rose-700">
                      {source.task_name}：{source.message}
                    </p>
                  ))}
                {createdMultiTask.warnings.map((warning) => (
                  <p key={warning} className="text-xs opacity-80">· {warning}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-5">
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <SectionHeading
              label="入库日志"
              title="包含命名规划预览与 QAS 实际执行输出。"
            />
          </div>
          {recentTasks.length > 0 ? (
            <select
              value={selectedTaskId ?? ''}
              onChange={(event) => setSelectedTaskId(event.target.value || null)}
              aria-label="选择 Quark 入库记录"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none"
            >
              {recentTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.task_name} · {task.status}
                </option>
              ))}
            </select>
          ) : null}
          <OperationalLogPanel
            logs={taskLogs}
            status={taskLogStatus}
            error={taskLogError}
            hasSelection={Boolean(selectedTaskId)}
            title="Quark 入库日志"
            monitorLabel="每 2 秒更新"
            emptySelectionMessage="创建任务后可在这里查看命名与执行日志。"
            emptyLogsMessage="任务尚未写入日志。"
            stageLabels={quarkStageLabels}
            terminalStages={terminalQuarkLogStages}
            scrollKey={selectedTaskId}
          />
        </section>

        <div className="rounded-[24px] bg-slate-950 p-5 text-white shadow-shell">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4" />
            QAS 执行方式
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/70">
            <p>提交后会把任务持久保存到 QAS，并只针对该任务立即执行一次。</p>
            <p>页面确认的是任务已创建和开始执行，不代表夸克转存已经完成。</p>
            <p>一次性来源首次执行后不再定时检查；只有手动勾选订阅的来源会在每天 04:15 追更。</p>
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
