import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  CircleAlert,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CloudUpload,
  File,
  Folder,
  GripVertical,
  Loader2,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  clearQuarkFileAlignment,
  projectQuarkAlignmentWorkspace,
  sortQuarkPendingFiles,
} from '@/components/quark-ingest/quark-alignment-workspace'
import {
  createQuarkMultiSourceTasks,
  previewQuarkMultiSourcePlan,
  previewQuarkShareTree,
} from '@/lib/api/quark-ingest'
import { cn } from '@/lib/utils'
import type {
  QuarkMultiSourcePayload,
  QuarkMultiSourcePreview,
  QuarkMultiSourceTaskResult,
  QuarkFileSelection,
  QuarkAssignmentType,
  QuarkEpisodeAlignment,
  QuarkRenamePreview,
  QuarkSourceSelection,
  QuarkSourceTreeNode,
  QuarkSeasonCoverage,
} from '@/types/quark-ingest'

type SaveScope = 'CURRENT_SEASON' | 'MULTIPLE_SEASONS'
type SourceDetailSeason = number | 'unassigned'

type QuarkSeasonIngestWorkspaceProps = {
  mediaType: 'series' | 'variety'
  shareUrl: string
  title: string
  originalTitle: string | null
  tmdbId: number | null
  selectedSeason: number
  seasonOptions?: number[]
  onTaskCreated?: (task: QuarkMultiSourceTaskResult) => void
  onDirtyChange?: (dirty: boolean) => void
}

function sourceNodes(nodes: QuarkSourceTreeNode[], collected: QuarkSourceTreeNode[] = []) {
  for (const node of nodes) {
    if (node.source_candidate_id) collected.push(node)
    sourceNodes(node.children, collected)
  }
  return collected
}

function descendantSourceIds(node: QuarkSourceTreeNode) {
  return sourceNodes(node.children)
    .map((child) => child.source_candidate_id)
    .filter((candidateId): candidateId is string => Boolean(candidateId))
}

function directoryPaths(nodes: QuarkSourceTreeNode[], collected: string[] = []) {
  for (const node of nodes) {
    if (node.directory) collected.push(node.relative_path)
    directoryPaths(node.children, collected)
  }
  return collected
}

function videoCounts(node: QuarkSourceTreeNode): { direct: number; total: number } {
  if (!node.directory) {
    return { direct: isVideoFile(node.name) ? 1 : 0, total: isVideoFile(node.name) ? 1 : 0 }
  }
  const direct = node.children.filter((child) => !child.directory && isVideoFile(child.name)).length
  const total = node.children.reduce((sum, child) => sum + videoCounts(child).total, 0)
  return { direct, total }
}

function formatEpisodeRanges(episodes: number[], season: number) {
  const sorted = [...new Set(episodes)].sort((a, b) => a - b)
  const ranges: string[] = []
  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index]
    let end = start
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      index += 1
      end = sorted[index]
    }
    const prefix = `S${String(season).padStart(2, '0')}E`
    ranges.push(end === start ? `${prefix}${String(start).padStart(2, '0')}` : `${prefix}${String(start).padStart(2, '0')}-E${String(end).padStart(2, '0')}`)
  }
  return ranges.join('、')
}

function initialSelections(
  preview: QuarkMultiSourcePreview,
  scope: SaveScope,
  selectedSeason: number,
  seasonOptions: number[],
): QuarkSourceSelection[] {
  const exactMatches = preview.sources.filter(
    (source) => source.detected_season === selectedSeason && source.season_status !== 'MIXED',
  )
  const currentSeasonIds = new Set(
    exactMatches.length > 0
      ? exactMatches.map((source) => source.source_candidate_id)
      : preview.sources.map((source) => source.source_candidate_id),
  )
  return preview.sources.map((source) => {
    const selectedForCurrentSeason = currentSeasonIds.has(source.source_candidate_id)
    const detectedSeason = source.detected_season != null && seasonOptions.includes(source.detected_season)
      ? source.detected_season
      : null
    return {
      source_candidate_id: source.source_candidate_id,
      season_number:
        scope === 'CURRENT_SEASON' && selectedForCurrentSeason
          ? selectedSeason
          : detectedSeason,
      ignored: scope === 'CURRENT_SEASON' ? !selectedForCurrentSeason : false,
      follow_updates: false,
      files: [],
    }
  })
}

function targetEpisodeNumbers(targetName: string) {
  const match = /S\d{2}E(\d{1,3})(?:-E(\d{1,3}))?/i.exec(targetName)
  if (!match) return []
  const first = Number(match[1])
  const last = match[2] ? Number(match[2]) : first
  return Array.from({ length: Math.abs(last - first) + 1 }, (_, index) => Math.min(first, last) + index)
}

function sourceCoverage(source: QuarkMultiSourcePreview['sources'][number]) {
  const videos = source.files.filter((file) => isVideoFile(file.source_name))
  const included = videos.filter((file) => !['IGNORED', 'EXCLUDED', 'UNRECOGNIZED', 'CONFLICT'].includes(file.status))
  return {
    videoCount: included.length,
    episodes: [...new Set(included.flatMap((file) => targetEpisodeNumbers(file.target_name)))].sort((a, b) => a - b),
    unknownCount: videos.filter((file) => ['UNRECOGNIZED', 'CONFLICT'].includes(file.status)).length,
    ignoredCount: videos.filter((file) => file.status === 'IGNORED').length,
  }
}

function coverageLabel(status: string) {
  if (status === 'COMPLETE') return '完整'
  if (status === 'MISSING') return '缺集'
  if (status === 'NEEDS_REVIEW') return '待确认'
  return '暂无法判断'
}

const ASSIGNMENT_TYPE_OPTIONS: Array<{ value: QuarkAssignmentType; label: string }> = [
  { value: 'PRIMARY', label: '正片' },
  { value: 'EDITION', label: '版本' },
  { value: 'SEGMENT', label: '分段' },
  { value: 'EXTRA', label: '额外内容' },
  { value: 'UNKNOWN', label: '待确认' },
]

function assignmentTypeLabel(value: string | null | undefined) {
  return ASSIGNMENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? '正片'
}

function alignmentStatusLabel(status: string) {
  if (status === 'MATCHED') return '已对齐'
  if (status === 'MULTIPLE') return '多版本/分段'
  if (status === 'MISSING') return '缺集'
  return '待确认'
}

function alignmentEpisodeLabel(row: QuarkEpisodeAlignment) {
  return `S${String(row.season_number).padStart(2, '0')}E${String(row.episode_number).padStart(2, '0')}`
}

function userFacingMessage(message: string) {
  return message.replace(/TMDB\s*/gi, '').trim()
}

function CompactCheckbox({
  checked,
  disabled = false,
  label,
  onChange,
  className,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
  className?: string
}) {
  return (
    <label className={cn(
      'inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[11px] font-medium transition-colors',
      checked
        ? 'border-slate-300 bg-slate-100 text-slate-900'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      disabled && 'cursor-not-allowed opacity-50',
      className,
    )}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span className={cn(
        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
        checked ? 'border-slate-950 bg-slate-950' : 'border-slate-300 bg-white',
      )}>
        <Check className={cn('h-3 w-3 text-white', checked ? 'opacity-100' : 'opacity-0')} />
      </span>
      <span>{label}</span>
    </label>
  )
}

type FileAssignmentPatch = {
  episodeNumber?: number | null
  assignmentType?: QuarkAssignmentType | null
  editionLabel?: string | null
  segmentLabel?: string | null
}

function SourceTree({
  nodes,
  selections,
  selectedSeason,
  subscriptionEnabled,
  expandedDirectories,
  onMapDescendants,
  onFollowDescendants,
  onDirectoryToggle,
  depth = 0,
}: {
  nodes: QuarkSourceTreeNode[]
  selections: Map<string, QuarkSourceSelection>
  selectedSeason: number
  subscriptionEnabled: boolean
  expandedDirectories: Set<string>
  onMapDescendants: (candidateIds: string[], seasonNumber: number) => void
  onFollowDescendants: (candidateIds: string[], followUpdates: boolean) => void
  onDirectoryToggle: (relativePath: string, expanded: boolean) => void
  depth?: number
}) {
  return (
    <ul className={cn('space-y-1.5 text-xs', depth > 0 && 'ml-4 border-l border-slate-200 pl-3')}>
      {nodes.map((node) => {
        const selection = node.source_candidate_id
          ? selections.get(node.source_candidate_id)
          : undefined
        const descendants = descendantSourceIds(node)
        return (
          <li key={`${node.relative_path}:${node.name}`}>
            {node.directory ? (
              <details
                open={expandedDirectories.has(node.relative_path)}
                onToggle={(event) => onDirectoryToggle(
                  node.relative_path,
                  event.currentTarget.open,
                )}
                className="group"
              >
                <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 marker:hidden">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                  <Folder className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="min-w-0 break-all font-medium">{node.name}</span>
                  {node.directory ? (() => {
                    const counts = videoCounts(node)
                    return counts.total > 0 ? (
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {counts.direct > 0 && counts.direct !== counts.total ? `直属 ${counts.direct} · ` : ''}共 {counts.total} 个视频
                      </span>
                    ) : null
                  })() : null}
                  {selection ? (
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px]',
                      selection.ignored
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-indigo-50 text-indigo-700',
                    )}>
                      {selection.ignored
                        ? '已忽略'
                        : selection.season_number
                          ? `第 ${selection.season_number} 季`
                          : '未设置季度'}
                    </span>
                  ) : null}
                </summary>
                {descendants.length > 0 ? (
                  <div className="ml-5 mt-1 flex flex-wrap gap-2 px-1">
                    <button
                      type="button"
                      className="rounded-lg border border-indigo-100 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50"
                      onClick={(event) => {
                        event.preventDefault()
                        onMapDescendants(descendants, selectedSeason)
                      }}
                    >
                      后代映射为 S{String(selectedSeason).padStart(2, '0')}
                    </button>
                    {subscriptionEnabled ? (
                      <CompactCheckbox
                        checked={descendants
                          .filter((candidateId) => !selections.get(candidateId)?.ignored)
                          .every((candidateId) => selections.get(candidateId)?.follow_updates === true)}
                        label="更新后代"
                        className="h-7 px-2"
                        onChange={(followUpdates) => onFollowDescendants(descendants, followUpdates)}
                      />
                    ) : null}
                  </div>
                ) : null}
                {node.children.length > 0 ? (
                  <SourceTree
                    nodes={node.children}
                    selections={selections}
                    selectedSeason={selectedSeason}
                    subscriptionEnabled={subscriptionEnabled}
                    expandedDirectories={expandedDirectories}
                    onMapDescendants={onMapDescendants}
                    onFollowDescendants={onFollowDescendants}
                    onDirectoryToggle={onDirectoryToggle}
                    depth={depth + 1}
                  />
                ) : null}
              </details>
            ) : (
              <div className="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-white hover:text-slate-900">
                <File className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 break-all">{node.name}</span>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function isVideoFile(name: string) {
  return /\.(mkv|mp4|avi|mov|wmv|flv|ts|m2ts|webm|rmvb)$/i.test(name)
}

export function QuarkSeasonIngestWorkspace({
  mediaType,
  shareUrl,
  title,
  originalTitle,
  tmdbId,
  selectedSeason,
  seasonOptions = [],
  onTaskCreated,
  onDirtyChange,
}: QuarkSeasonIngestWorkspaceProps) {
  const [scope, setScope] = useState<SaveScope>('CURRENT_SEASON')
  const [preview, setPreview] = useState<QuarkMultiSourcePreview | null>(null)
  const [selections, setSelections] = useState<QuarkSourceSelection[]>([])
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [createdTask, setCreatedTask] = useState<QuarkMultiSourceTaskResult | null>(null)
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set())
  const [detachedFileIds, setDetachedFileIds] = useState<Set<string>>(new Set())
  const [alignmentSeason, setAlignmentSeason] = useState<number | null>(selectedSeason)
  const [sourceDetailSeason, setSourceDetailSeason] = useState<SourceDetailSeason>(selectedSeason)
  const [renamePreviewGenerated, setRenamePreviewGenerated] = useState(false)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const scopeRef = useRef<SaveScope>('CURRENT_SEASON')

  useEffect(() => {
    onDirtyChange?.(hasPendingChanges)
  }, [hasPendingChanges, onDirtyChange])

  const selectionsById = useMemo(
    () => new Map(selections.map((selection) => [selection.source_candidate_id, selection])),
    [selections],
  )
  const planReady = Boolean(
    preview?.ready && preview.sources.length > 0 && preview.planned_task_count > 0,
  )
  const payload: QuarkMultiSourcePayload = {
    share_url: shareUrl,
    title,
    original_title: originalTitle,
    tmdb_id: tmdbId,
    preview_id: preview?.preview_id ?? null,
    follow_updates_enabled: subscriptionEnabled,
    sources: selections,
  }

  const previewEpisodeAlignments = useMemo(
    () => preview?.episode_alignments ?? [],
    [preview?.episode_alignments],
  )
  const episodeOptionsBySeason = useMemo(() => {
    const numbersBySeason = new Map<number, Set<number>>()
    const add = (season: number | null | undefined, episode: number) => {
      if (season == null || episode <= 0 || episode > 999) return
      const numbers = numbersBySeason.get(season) ?? new Set<number>()
      numbers.add(episode)
      numbersBySeason.set(season, numbers)
    }
    for (const alignment of previewEpisodeAlignments) add(alignment.season_number, alignment.episode_number)
    for (const coverage of preview?.season_coverages ?? []) {
      for (const episode of coverage.episodes ?? []) add(coverage.season_number, episode.episode_number)
      for (const episode of coverage.missing_episode_numbers) add(coverage.season_number, episode)
    }
    for (const source of preview?.sources ?? []) {
      for (const file of source.files) {
        for (const episode of targetEpisodeNumbers(file.target_name)) add(source.selected_season, episode)
        if (file.episode_number != null) add(source.selected_season, file.episode_number)
      }
    }
    return new Map([...numbersBySeason.entries()].map(([season, numbers]) => [
      season,
      [...numbers].sort((left, right) => left - right),
    ]))
  }, [previewEpisodeAlignments, preview?.season_coverages, preview?.sources])

  const fileSources = useMemo(() => {
    const byFileId = new Map<string, { sourceCandidateId: string; file: QuarkRenamePreview }>()
    for (const source of preview?.sources ?? []) {
      for (const file of source.files) {
        byFileId.set(file.file_id, { sourceCandidateId: source.source_candidate_id, file })
      }
    }
    return byFileId
  }, [preview?.sources])

  const alignedFileIds = useMemo(() => new Set(
    previewEpisodeAlignments.flatMap((alignment) => alignment.files.map((file) => file.file_id)),
  ), [previewEpisodeAlignments])

  const previewPendingFiles = useMemo(() => [...fileSources.values()]
    .filter(({ file }) => isVideoFile(file.source_name)
      && !alignedFileIds.has(file.file_id)
      && ['UNRECOGNIZED', 'CONFLICT', 'MANUAL'].includes(file.status)),
  [alignedFileIds, fileSources])

  const alignmentProjection = useMemo(() => projectQuarkAlignmentWorkspace(
    previewEpisodeAlignments,
    previewPendingFiles,
    fileSources,
    selections,
    detachedFileIds,
  ), [detachedFileIds, fileSources, previewEpisodeAlignments, previewPendingFiles, selections])
  const episodeAlignments = alignmentProjection.episodeAlignments
  const pendingFiles = alignmentProjection.pendingFiles

  const alignmentSeasons = useMemo(() => [...new Set([
    ...episodeAlignments.map((alignment) => alignment.season_number),
    ...(preview?.season_coverages ?? []).map((coverage) => coverage.season_number),
  ])].filter((season) => season > 0).sort((left, right) => left - right), [
    episodeAlignments,
    preview?.season_coverages,
  ])

  useEffect(() => {
    setAlignmentSeason((current) => {
      if (current != null && alignmentSeasons.includes(current)) return current
      if (alignmentSeasons.includes(selectedSeason)) return selectedSeason
      return alignmentSeasons[0] ?? null
    })
  }, [alignmentSeasons, selectedSeason])

  const visibleEpisodeAlignments = useMemo(
    () => alignmentSeason == null
      ? episodeAlignments
      : episodeAlignments.filter((alignment) => alignment.season_number === alignmentSeason),
    [alignmentSeason, episodeAlignments],
  )

  const pendingCountBySeason = useMemo(() => {
    const counts = new Map<number, number>()
    for (const pending of pendingFiles) {
      const season = selectionsById.get(pending.sourceCandidateId)?.season_number
      if (season != null) counts.set(season, (counts.get(season) ?? 0) + 1)
    }
    return counts
  }, [pendingFiles, selectionsById])

  const visiblePendingFiles = useMemo(() => sortQuarkPendingFiles(pendingFiles.filter((pending) => {
    if (alignmentSeason == null) return true
    return selectionsById.get(pending.sourceCandidateId)?.season_number === alignmentSeason
  })), [alignmentSeason, pendingFiles, selectionsById])
  const pendingPanelResolved = visiblePendingFiles.length === 0

  const sourceDetailSeasons = useMemo(() => {
    const seasons = new Set<number>()
    let includesUnassigned = false
    for (const source of preview?.sources ?? []) {
      const season = selectionsById.get(source.source_candidate_id)?.season_number
        ?? source.selected_season
      if (season != null && season > 0) {
        seasons.add(season)
      } else {
        includesUnassigned = true
      }
    }
    return [
      ...[...seasons].sort((left, right) => left - right),
      ...(includesUnassigned ? ['unassigned' as const] : []),
    ]
  }, [preview?.sources, selectionsById])

  useEffect(() => {
    setSourceDetailSeason((current) => {
      if (sourceDetailSeasons.includes(current)) return current
      if (sourceDetailSeasons.includes(selectedSeason)) return selectedSeason
      return sourceDetailSeasons[0] ?? selectedSeason
    })
  }, [selectedSeason, sourceDetailSeasons])

  const visibleSourceDetails = useMemo(() => (preview?.sources ?? []).filter((source) => {
    if (!renamePreviewGenerated || sourceDetailSeasons.length <= 1) return true
    const season = selectionsById.get(source.source_candidate_id)?.season_number
      ?? source.selected_season
    return sourceDetailSeason === 'unassigned'
      ? season == null || season <= 0
      : season === sourceDetailSeason
  }), [preview?.sources, renamePreviewGenerated, selectionsById, sourceDetailSeason, sourceDetailSeasons.length])

  const sourceDetailSummary = useMemo(() => new Map(sourceDetailSeasons.map((season) => {
    const sources = (preview?.sources ?? []).filter((source) => {
      const sourceSeason = selectionsById.get(source.source_candidate_id)?.season_number
        ?? source.selected_season
      return season === 'unassigned'
        ? sourceSeason == null || sourceSeason <= 0
        : sourceSeason === season
    })
    return [season, {
      sourceCount: sources.length,
      errorCount: sources.reduce((count, source) => count + source.errors.length, 0),
    }]
  })), [preview?.sources, selectionsById, sourceDetailSeasons])
  const showSourceDetailTabs = renamePreviewGenerated && sourceDetailSeasons.length > 1

  const inspectShareTree = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setPreview(null)
    setSelections([])
    setExpandedDirectories(new Set())
    setDetachedFileIds(new Set())
    setRenamePreviewGenerated(false)
    setHasPendingChanges(false)
    setStatus('loading')
    setMessage(null)
    setCreatedTask(null)
    try {
      const inspected = await previewQuarkShareTree(mediaType, {
        share_url: shareUrl,
        title,
        original_title: originalTitle,
        tmdb_id: tmdbId,
        preview_id: null,
        follow_updates_enabled: false,
        sources: [],
      }, controller.signal)
      if (controller.signal.aborted) return
      setPreview(inspected)
      setSelections(initialSelections(inspected, scopeRef.current, selectedSeason, seasonOptions))
      setExpandedDirectories(new Set(directoryPaths(inspected.entries)))
      setStatus('success')
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus('error')
      setMessage(error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'Quark 分享目录加载失败，请稍后重试。')
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
      }
    }
  }, [mediaType, originalTitle, seasonOptions, selectedSeason, shareUrl, title, tmdbId])

  useEffect(() => {
    scopeRef.current = 'CURRENT_SEASON'
    setScope('CURRENT_SEASON')
    setSubscriptionEnabled(false)
    void inspectShareTree()
    return () => controllerRef.current?.abort()
  }, [inspectShareTree])

  function markPlanDirty() {
    setHasPendingChanges(true)
    setPreview((current) => (current ? { ...current, ready: false } : current))
    setStatus('idle')
    setMessage(null)
    setCreatedTask(null)
  }

  function updateSelection(
    candidateId: string,
    update: (selection: QuarkSourceSelection) => QuarkSourceSelection,
  ) {
    setSelections((current) => current.map((selection) =>
      selection.source_candidate_id === candidateId ? update(selection) : selection,
    ))
    markPlanDirty()
  }

  function updateFileSelection(
    candidateId: string,
    fileId: string,
    update: (current: QuarkFileSelection | null) => QuarkFileSelection | null,
  ) {
    updateSelection(candidateId, (selection) => {
      const current = selection.files.find((file) => file.file_id === fileId) ?? null
      const next = update(current)
      return {
        ...selection,
        files: next
          ? [...selection.files.filter((file) => file.file_id !== fileId), next]
          : selection.files.filter((file) => file.file_id !== fileId),
      }
    })
  }

  function updateDescendants(
    candidateIds: string[],
    update: (selection: QuarkSourceSelection) => QuarkSourceSelection,
  ) {
    const selectedIds = new Set(candidateIds)
    setSelections((current) => current.map((selection) =>
      selectedIds.has(selection.source_candidate_id) && !selection.ignored
        ? update(selection)
        : selection,
    ))
    markPlanDirty()
  }

  function updateFileAssignment(
    candidateId: string,
    fileId: string,
    patch: FileAssignmentPatch,
  ) {
    updateFileSelection(candidateId, fileId, (current) => {
      const assignmentType = patch.assignmentType !== undefined
        ? patch.assignmentType
        : current?.assignment_type ?? 'PRIMARY'
      const typeChanged = patch.assignmentType !== undefined
        && patch.assignmentType !== current?.assignment_type
      return {
        file_id: fileId,
        episode_number: patch.episodeNumber !== undefined
          ? patch.episodeNumber
          : current?.episode_number ?? null,
        ignored: false,
        assignment_type: assignmentType,
        edition_label: patch.editionLabel !== undefined
          ? patch.editionLabel
          : typeChanged ? null : current?.edition_label ?? null,
        segment_label: patch.segmentLabel !== undefined
          ? patch.segmentLabel
          : typeChanged ? null : current?.segment_label ?? null,
        forced: true,
      }
    })
  }

  function handleFileDrop(event: DragEvent<HTMLDivElement>, seasonNumber: number, episodeNumber: number) {
    event.preventDefault()
    const fileId = event.dataTransfer.getData('text/plain')
    if (!fileId) return
    const source = fileSources.get(fileId)
    if (!source) return
    setDetachedFileIds((current) => {
      if (!current.has(fileId)) return current
      const next = new Set(current)
      next.delete(fileId)
      return next
    })
    updateSelection(source.sourceCandidateId, (selection) => ({
      ...selection,
      season_number: seasonNumber,
    }))
    updateFileAssignment(source.sourceCandidateId, fileId, {
      episodeNumber,
      assignmentType: (source.file.assignment_type as QuarkAssignmentType | null) ?? 'PRIMARY',
      editionLabel: source.file.edition_label ?? null,
      segmentLabel: source.file.segment_label ?? null,
    })
  }

  function handlePendingDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const fileId = event.dataTransfer.getData('text/plain')
    if (!fileId) return
    const source = fileSources.get(fileId)
    if (!source) return
    setDetachedFileIds((current) => new Set(current).add(fileId))
    const originalSeason = preview?.sources.find(
      (item) => item.source_candidate_id === source.sourceCandidateId,
    )?.selected_season
    setSelections((current) => clearQuarkFileAlignment(
      current,
      source.sourceCandidateId,
      fileId,
      originalSeason,
    ))
    markPlanDirty()
  }

  function toggleDirectory(relativePath: string, expanded: boolean) {
    setExpandedDirectories((current) => {
      if (current.has(relativePath) === expanded) return current
      const next = new Set(current)
      if (expanded) {
        next.add(relativePath)
      } else {
        next.delete(relativePath)
      }
      return next
    })
  }

  function changeScope(nextScope: SaveScope) {
    scopeRef.current = nextScope
    setScope(nextScope)
    if (preview) {
      setSelections(initialSelections(preview, nextScope, selectedSeason, seasonOptions))
      setDetachedFileIds(new Set())
      setSubscriptionEnabled(false)
      markPlanDirty()
    }
  }

  async function advance() {
    if (status === 'loading' || !preview) return
    setStatus('loading')
    setMessage(null)
    setCreatedTask(null)
    try {
      if (!planReady) {
        const controller = new AbortController()
        controllerRef.current = controller
        const planned = await previewQuarkMultiSourcePlan(mediaType, payload, controller.signal)
        setPreview(planned)
        setDetachedFileIds(new Set())
        setRenamePreviewGenerated(true)
        setStatus('success')
        return
      }
      const task = await createQuarkMultiSourceTasks(mediaType, payload)
      setCreatedTask(task)
      setStatus(task.status === 'FAILED' ? 'error' : 'success')
      setMessage(task.message)
      if (task.status === 'PARTIAL') {
        const sourceResults = new Map<string, string[]>()
        for (const source of task.sources) {
          sourceResults.set(source.source_candidate_id, [
            ...(sourceResults.get(source.source_candidate_id) ?? []),
            source.status,
          ])
        }
        const createdSourceIds = new Set([...sourceResults.entries()]
          .filter(([, statuses]) => statuses.length > 0 && statuses.every((item) => item === 'CREATED'))
          .map(([sourceId]) => sourceId))
        setSelections((current) => current.map((selection) =>
          createdSourceIds.has(selection.source_candidate_id)
            ? { ...selection, ignored: true, follow_updates: false }
            : selection,
        ))
        setPreview((current) => current ? {
          ...current,
          ready: false,
          message: '已创建的来源已标记为忽略，可重新预览并重试失败来源。',
        } : current)
        setHasPendingChanges(true)
      } else if (task.status === 'STARTED' || task.status === 'SCHEDULED') {
        setHasPendingChanges(false)
      }
      onTaskCreated?.(task)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'Quark 入库处理失败，请稍后重试。')
    } finally {
      controllerRef.current = null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex w-full rounded-lg border border-slate-200 bg-white p-1 sm:w-fit">
        {([
          ['CURRENT_SEASON', `仅保存第 ${selectedSeason} 季`],
          ['MULTIPLE_SEASONS', '保存多季'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => changeScope(value)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-xs font-semibold sm:flex-none',
              scope === value
                ? 'bg-slate-950 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {preview ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50">
            <div className="flex items-center justify-end gap-2 border-b border-slate-200 px-4 py-2">
              <button
                type="button"
                onClick={() => setExpandedDirectories(new Set(directoryPaths(preview.entries)))}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-slate-900"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                全部展开
              </button>
              <button
                type="button"
                onClick={() => setExpandedDirectories(new Set())}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-slate-900"
              >
                <ChevronsDownUp className="h-3.5 w-3.5" />
                全部折叠
              </button>
            </div>
            <div className="scrollbar-none max-h-[min(32vh,18rem)] overflow-y-auto overscroll-auto p-4">
              <SourceTree
                nodes={preview.entries}
                selections={selectionsById}
                selectedSeason={selectedSeason}
                subscriptionEnabled={subscriptionEnabled}
                expandedDirectories={expandedDirectories}
                onMapDescendants={(candidateIds, seasonNumber) =>
                  updateDescendants(candidateIds, (selection) => ({ ...selection, season_number: seasonNumber }))}
                onFollowDescendants={(candidateIds, followUpdates) =>
                  updateDescendants(candidateIds, (selection) => ({ ...selection, follow_updates: followUpdates }))}
                onDirectoryToggle={toggleDirectory}
              />
            </div>
          </div>

          {preview.season_coverages.length > 0 ? (
            <div className="space-y-2 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">季度覆盖</p>
              {preview.season_coverages.map((coverage: QuarkSeasonCoverage) => (
                <div key={coverage.season_number} className="text-xs leading-5 text-slate-600">
                  <p>
                    第 {coverage.season_number} 季 · 视频 {coverage.video_count} · 覆盖 {coverage.recognized_episode_count}
                    {coverage.aired_episode_count != null ? `/${coverage.aired_episode_count} 已播` : ''}
                    {coverage.expected_episode_count != null ? ` · 全季 ${coverage.expected_episode_count}` : ''}
                    {coverage.ignored_video_count > 0 ? ` · 已忽略 ${coverage.ignored_video_count}` : ''}
                    {coverage.unknown_video_count > 0 ? ` · 待确认 ${coverage.unknown_video_count}` : ''}
                    {` · ${coverageLabel(coverage.coverage_status)}`}
                  </p>
                  {coverage.missing_episode_numbers.length > 0 ? (
                    <p className="text-amber-700">缺少：{formatEpisodeRanges(coverage.missing_episode_numbers, coverage.season_number)}</p>
                  ) : null}
                  {coverage.extra_episode_numbers.length > 0 ? (
                    <p className="text-sky-700">额外集号：{formatEpisodeRanges(coverage.extra_episode_numbers, coverage.season_number)}</p>
                  ) : null}
                  {coverage.unknown_air_date_numbers.length > 0 ? (
                    <p className="text-slate-500">播出日期未知：{formatEpisodeRanges(coverage.unknown_air_date_numbers, coverage.season_number)}</p>
                  ) : null}
                  {coverage.coverage_status === 'UNAVAILABLE' ? (
                    <p className="text-slate-500">{coverage.message}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {episodeAlignments.length > 0 || pendingFiles.length > 0 ? (
            <section className="flex h-[min(76vh,46rem)] min-h-[34rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">集数对齐</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    按季度查看目标集数，从右侧待处置区拖动文件完成映射。缺集只提示，不阻止提交；待确认文件必须处置。
                  </p>
                </div>
                <span className={cn(
                  'rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                  preview.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  preview.ready ? 'border-emerald-200' : 'border-amber-200',
                )}>
                  {preview.ready
                    ? `预览可提交 · ${preview.planned_task_count} 个执行任务`
                    : '调整后请重新生成预览'}
                </span>
              </div>
              {alignmentSeasons.length > 0 ? (
                <div
                  role="tablist"
                  aria-label="集数对齐季度"
                  className="scrollbar-none mt-3 flex w-full shrink-0 gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1"
                >
                  {alignmentSeasons.map((season) => (
                    <button
                      key={season}
                      type="button"
                      role="tab"
                      aria-selected={alignmentSeason === season}
                      onClick={() => setAlignmentSeason(season)}
                      className={cn(
                        'shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                        alignmentSeason === season
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900',
                      )}
                    >
                      第 {season} 季
                      {(pendingCountBySeason.get(season) ?? 0) > 0
                        ? ` · 待处理 ${pendingCountBySeason.get(season)}`
                        : ''}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-1">
                <div className="scrollbar-none min-h-0 overflow-y-auto overscroll-auto pr-1">
                  {visibleEpisodeAlignments.length > 0 ? (
                    <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {visibleEpisodeAlignments.map((alignment) => (
                        <div
                          key={`${alignment.season_number}:${alignment.episode_number}`}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleFileDrop(event, alignment.season_number, alignment.episode_number)}
                          className="px-3 py-3 transition-colors hover:bg-slate-50/80"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <span className="font-semibold text-slate-900">
                              {alignmentEpisodeLabel(alignment)}
                            </span>
                            {alignment.air_date ? <span className="text-slate-500">{alignment.air_date}</span> : null}
                            {alignment.episode_title ? <span className="truncate text-slate-600">{alignment.episode_title}</span> : null}
                            <span className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px]',
                              alignment.status === 'MISSING'
                                ? 'bg-amber-100 text-amber-700'
                                : alignment.status === 'MULTIPLE'
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-emerald-100 text-emerald-700',
                            )}>
                              {alignmentStatusLabel(alignment.status)}
                            </span>
                          </div>
                          {alignment.files.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              {alignment.files.map((file) => (
                                <div
                                  key={file.file_id}
                                  draggable={isVideoFile(file.source_name)}
                                  onDragStart={(event) => {
                                    event.dataTransfer.setData('text/plain', file.file_id)
                                    event.dataTransfer.effectAllowed = 'move'
                                  }}
                                  className="flex min-w-0 cursor-grab items-start gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-[11px] active:cursor-grabbing"
                                >
                                  <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                                  <span className="min-w-0 break-all font-mono text-slate-600">{file.source_name}</span>
                                  <span className="shrink-0 text-slate-400">→</span>
                                  <span className="min-w-0 break-all font-mono text-slate-800">{file.target_name}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-2 text-[11px] text-slate-500">
                              将右侧待确认视频拖到这里，映射为该 TMDB 集数
                            </p>
                          )}
                          {alignment.message ? (
                            <p className="mt-1 text-[11px] text-slate-500">{userFacingMessage(alignment.message)}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-8 text-center text-xs text-slate-500">
                      当前季度没有可用的目标集数信息，请在来源文件列表中手动指定集数。
                    </div>
                  )}
                </div>
                <aside
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={handlePendingDrop}
                  className="scrollbar-none max-h-40 min-h-0 overflow-y-auto overscroll-auto rounded-lg border border-slate-200 bg-white lg:max-h-none"
                >
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3">
                    <p className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-800">
                      <span>第 {alignmentSeason ?? selectedSeason} 季待处置视频</span>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px]',
                        pendingPanelResolved
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700',
                      )}>
                        {visiblePendingFiles.length}
                      </span>
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      {pendingPanelResolved
                        ? '当前季度已完成对齐；仍可将左侧文件拖回此处重新调整。'
                        : '拖到左侧目标集数；已映射的文件可拖回此处撤销，版本、分段或忽略可在下方继续调整。'}
                    </p>
                  </div>
                  {visiblePendingFiles.length > 0 ? (
                    <div className="space-y-1.5 px-3 pb-3 pt-2">
                      {visiblePendingFiles.map(({ file }) => (
                        <div
                          key={file.file_id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', file.file_id)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          className="flex cursor-grab items-start gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-700 active:cursor-grabbing"
                          title={file.source_name}
                        >
                          <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                          <span className="min-w-0 break-all">{file.source_name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="m-3 rounded-md border border-dashed border-emerald-200 bg-emerald-50/70 px-2 py-3 text-center text-[11px] text-emerald-700">
                      当前季度没有待处置视频
                    </p>
                  )}
                </aside>
              </div>
            </section>
          ) : null}

          <label className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={subscriptionEnabled}
              onChange={(event) => {
                const enabled = event.target.checked
                setSubscriptionEnabled(enabled)
                if (!enabled) {
                  setSelections((current) => current.map((selection) => ({
                    ...selection,
                    follow_updates: false,
                  })))
                }
                markPlanDirty()
              }}
            />
            <span>
              <span className="font-semibold text-slate-900">订阅模式</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                开启后可逐个标记更新文件夹；未标记的季度仍按一次性任务保存。
              </span>
            </span>
          </label>

          <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
              <div>
                <p className="text-sm font-semibold text-slate-800">季度来源明细</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {preview.sources.length} 个来源 · 展开后可调整集数、版本、分段或忽略
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
            </summary>
            {showSourceDetailTabs ? (
              <div className="border-t border-slate-200 bg-slate-50/70 p-3 pb-2">
                <div
                  role="tablist"
                  aria-label="季度来源明细"
                  className="scrollbar-none flex gap-1 overflow-x-auto rounded-lg bg-slate-200/70 p-1"
                >
                  {sourceDetailSeasons.map((season) => {
                    const summary = sourceDetailSummary.get(season)
                    const active = sourceDetailSeason === season
                    return (
                      <button
                        key={season}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSourceDetailSeason(season)}
                        className={cn(
                          'shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                          active
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900',
                        )}
                      >
                        {season === 'unassigned' ? '未分季' : `第 ${season} 季`}
                        {(summary?.errorCount ?? 0) > 0 ? (
                          <span className="ml-1 text-rose-600">异常 {summary?.errorCount}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <div className={cn(
              'scrollbar-none max-h-[min(48vh,28rem)] overflow-y-auto overscroll-auto bg-slate-50/70 p-3',
              showSourceDetailTabs ? 'pt-1' : 'border-t border-slate-200',
            )}>
              <div className="space-y-3">
                {visibleSourceDetails.map((source) => {
              const selection = selectionsById.get(source.source_candidate_id)
              if (!selection) return null
              const coverage = sourceCoverage(source)
              const sourceEpisodeOptions = episodeOptionsBySeason.get(
                selection.season_number ?? source.selected_season ?? selectedSeason,
              ) ?? []
              return (
                <div
                  key={source.source_candidate_id}
                  className={cn(
                    'rounded-xl border px-4 py-4',
                    source.status === 'BLOCKED' || source.errors.length > 0
                      ? 'border-rose-200 bg-white'
                      : selection.ignored
                        ? 'border-slate-200 bg-slate-50 opacity-75'
                        : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{source.source_name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {source.relative_path || '分享根目录'} · {source.season_status}
                      </p>
                      {source.files.length > 0 ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          视频 {coverage.videoCount} · 覆盖 {coverage.episodes.length} 集
                          {coverage.episodes.length > 0 && selection.season_number
                            ? `（${formatEpisodeRanges(coverage.episodes, selection.season_number)}）`
                            : ''}
                          {coverage.unknownCount > 0 ? ` · 待确认 ${coverage.unknownCount}` : ''}
                          {coverage.ignoredCount > 0 ? ` · 已忽略 ${coverage.ignoredCount}` : ''}
                        </p>
                      ) : null}
                      {source.save_path ? (
                        <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                          {source.save_path}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={selection.season_number ?? ''}
                        disabled={selection.ignored}
                        onChange={(event) => {
                          const seasonNumber = Number(event.target.value)
                          updateSelection(source.source_candidate_id, (current) => ({
                            ...current,
                            season_number: seasonNumber > 0 ? seasonNumber : null,
                          }))
                        }}
                        aria-label={`${source.source_name}季度`}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"
                      >
                        <option value="">未设置季度</option>
                        {[...new Set(seasonOptions)]
                          .filter((value) => value > 0)
                          .sort((left, right) => left - right)
                          .map((value) => (
                            <option key={value} value={value}>S{String(value).padStart(2, '0')}</option>
                          ))}
                      </select>
                      <CompactCheckbox
                        checked={selection.ignored}
                        label="忽略"
                        onChange={(ignored) => updateSelection(source.source_candidate_id, (current) => ({
                          ...current,
                          ignored,
                          follow_updates: ignored ? false : current.follow_updates,
                        }))}
                      />
                      {subscriptionEnabled && !selection.ignored ? (
                        <CompactCheckbox
                          checked={selection.follow_updates}
                          label="更新文件夹"
                          onChange={(followUpdates) => updateSelection(source.source_candidate_id, (current) => ({
                            ...current,
                            follow_updates: followUpdates,
                          }))}
                        />
                      ) : null}
                    </div>
                  </div>
                  {source.files.length > 0 ? (
                    <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {source.files.map((file) => {
                        const correction = selection.files.find((item) => item.file_id === file.file_id)
                        const canCorrect = file.status !== 'EXCLUDED' && !selection.ignored
                        return (
                          <div
                            key={file.file_id}
                            draggable={isVideoFile(file.source_name) && !selection.ignored}
                            onDragStart={(event) => {
                              if (!isVideoFile(file.source_name) || selection.ignored) return
                              event.dataTransfer.setData('text/plain', file.file_id)
                              event.dataTransfer.effectAllowed = 'move'
                            }}
                            className="grid gap-2 px-3 py-2.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
                          >
                            <div className="min-w-0 font-mono text-[11px] leading-5">
                              <p className="break-all text-slate-700">
                                {isVideoFile(file.source_name) ? (
                                  <GripVertical className="mr-1 inline h-3 w-3 text-slate-400" />
                                ) : null}
                                {file.source_name} <span className="text-slate-400">→</span> {file.target_name}
                              </p>
                              {file.message ? (
                                <p className={cn(
                                  'break-all font-sans',
                                  file.status === 'CONFLICT' || file.status === 'UNRECOGNIZED'
                                    ? 'text-rose-600'
                                    : 'text-slate-500',
                                )}>
                                  {file.message}
                                </p>
                              ) : null}
                            </div>
                            {canCorrect ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {isVideoFile(file.source_name) ? (
                                  <label className="flex items-center gap-1 text-[11px] text-slate-600">
                                    <span>目标集数</span>
                                    <select
                                      value={correction?.ignored ? '' : correction?.episode_number ?? file.episode_number ?? ''}
                                      disabled={correction?.ignored}
                                      onChange={(event) => {
                                        const episode = Number(event.target.value)
                                        updateFileAssignment(source.source_candidate_id, file.file_id, {
                                          episodeNumber: episode > 0 && episode <= 999 ? episode : null,
                                        })
                                      }}
                                      aria-label={`${file.source_name}目标集数`}
                                      className="h-8 max-w-[9rem] rounded-md border border-slate-200 bg-white px-1.5 text-xs"
                                    >
                                      <option value="">选择集数</option>
                                      {sourceEpisodeOptions.map((episode) => (
                                        <option key={episode} value={episode}>
                                          S{String(selection.season_number ?? selectedSeason).padStart(2, '0')}E{String(episode).padStart(2, '0')}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : null}
                                {isVideoFile(file.source_name) ? (() => {
                                  const assignmentType = correction?.assignment_type
                                    ?? file.assignment_type
                                    ?? 'PRIMARY'
                                  const label = assignmentType === 'SEGMENT'
                                    ? correction?.segment_label ?? file.segment_label ?? ''
                                    : correction?.edition_label ?? file.edition_label ?? ''
                                  return (
                                    <>
                                      <select
                                        value={assignmentType}
                                        onChange={(event) => updateFileAssignment(
                                          source.source_candidate_id,
                                          file.file_id,
                                          {
                                            episodeNumber: correction?.episode_number ?? file.episode_number ?? null,
                                            assignmentType: event.target.value as QuarkAssignmentType,
                                          },
                                        )}
                                        aria-label={`${file.source_name}处置类型`}
                                        className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-xs"
                                      >
                                        {ASSIGNMENT_TYPE_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                      </select>
                                      {(assignmentType === 'EDITION' || assignmentType === 'SEGMENT' || assignmentType === 'EXTRA') ? (
                                        <input
                                          type="text"
                                          value={label}
                                          onChange={(event) => updateFileAssignment(
                                            source.source_candidate_id,
                                            file.file_id,
                                            assignmentType === 'SEGMENT'
                                              ? {
                                                  episodeNumber: correction?.episode_number ?? file.episode_number ?? null,
                                                  segmentLabel: event.target.value,
                                                  editionLabel: null,
                                                }
                                              : {
                                                  episodeNumber: correction?.episode_number ?? file.episode_number ?? null,
                                                  editionLabel: event.target.value,
                                                  segmentLabel: null,
                                                },
                                          )}
                                          placeholder={assignmentType === 'SEGMENT'
                                            ? '如：上'
                                            : assignmentType === 'EXTRA' ? '如：加更' : '如：VIP'}
                                          aria-label={`${file.source_name}${assignmentTypeLabel(assignmentType)}标签`}
                                          className="h-8 w-20 rounded-md border border-slate-200 px-2 text-xs"
                                        />
                                      ) : null}
                                    </>
                                  )
                                })() : null}
                                <CompactCheckbox
                                  checked={correction?.ignored === true}
                                  label="忽略文件"
                                  onChange={(ignored) => updateFileSelection(
                                    source.source_candidate_id,
                                    file.file_id,
                                    () => ignored
                                      ? {
                                          file_id: file.file_id,
                                          episode_number: null,
                                          ignored: true,
                                          assignment_type: null,
                                          edition_label: null,
                                          segment_label: null,
                                          forced: false,
                                        }
                                      : null,
                                  )}
                                />
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                  {source.errors.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5" role="alert">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                        <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                        需要处理
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {source.errors.map((error, index) => (
                          <li
                            key={`${source.source_candidate_id}:error:${index}`}
                            className="flex items-start gap-2 text-xs leading-5 text-slate-700"
                          >
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                            <span className="min-w-0 break-words">{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )
                })}
              </div>
            </div>
          </details>
          <p className={cn(
            'text-sm',
            preview.ready ? 'text-emerald-700' : 'text-amber-700',
          )}>
            {preview.ready
              ? '预览已生成，可以确认入库。'
              : '预览已更新，请检查需要处理的文件后继续。'}
          </p>
          {preview.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-700">· {warning}</p>
          ))}
        </div>
      ) : null}

      {!preview && status === 'loading' ? (
        <div className="rounded-xl bg-slate-50 px-4 py-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">正在检查分享目录树…</p>
        </div>
      ) : null}

      {preview ? (
        <Button
          type="button"
          size="lg"
          disabled={status === 'loading'}
          onClick={() => void advance()}
          className="h-12 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-none hover:bg-black"
        >
          {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
          {status === 'loading'
            ? '正在处理…'
            : !planReady
              ? '生成逐文件改名预览'
              : '确认并开始入库'}
        </Button>
      ) : status === 'error' ? (
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => void inspectShareTree()}
          className="h-12 w-full rounded-xl border-slate-200 text-sm font-semibold shadow-none"
        >
          <RefreshCw className="h-4 w-4" />
          重新加载分享目录
        </Button>
      ) : null}

      {message ? (
        <div className={cn(
          'rounded-xl px-4 py-3 text-sm',
          status === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800',
        )}>
          {message}
          {createdTask ? (
            <div className="mt-1 space-y-1 text-xs">
              {createdTask.sources
                .filter((source) => source.status !== 'CREATED')
                .map((source) => (
                  <p key={`${source.source_candidate_id}:${source.task_name}`}>{source.message}</p>
                ))}
              {createdTask.warnings.map((warning) => <p key={warning}>· {warning}</p>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
