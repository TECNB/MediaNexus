import { useEffect, useMemo, useRef, useState } from 'react'
import { CloudUpload, File, Folder, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
  QuarkSourceSelection,
  QuarkSourceTreeNode,
} from '@/types/quark-ingest'

type SaveScope = 'CURRENT_SEASON' | 'MULTIPLE_SEASONS'

type QuarkSeasonIngestWorkspaceProps = {
  mediaType: 'series' | 'variety'
  shareUrl: string
  title: string
  originalTitle: string | null
  tmdbId: number | null
  selectedSeason: number
  seasonOptions?: number[]
  onTaskCreated?: (task: QuarkMultiSourceTaskResult) => void
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

function initialSelections(
  preview: QuarkMultiSourcePreview,
  scope: SaveScope,
  selectedSeason: number,
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
    return {
      source_candidate_id: source.source_candidate_id,
      season_number:
        scope === 'CURRENT_SEASON' && selectedForCurrentSeason
          ? selectedSeason
          : source.detected_season,
      ignored: scope === 'CURRENT_SEASON' ? !selectedForCurrentSeason : false,
      follow_updates: false,
    }
  })
}

function SourceTree({
  nodes,
  selections,
  selectedSeason,
  subscriptionEnabled,
  onMapDescendants,
  onFollowDescendants,
  depth = 0,
}: {
  nodes: QuarkSourceTreeNode[]
  selections: Map<string, QuarkSourceSelection>
  selectedSeason: number
  subscriptionEnabled: boolean
  onMapDescendants: (candidateIds: string[], seasonNumber: number) => void
  onFollowDescendants: (candidateIds: string[], followUpdates: boolean) => void
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
              <details className="group">
                <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 text-slate-700 marker:hidden">
                  <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="break-all">{node.name}</span>
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
                  <div className="ml-5 mt-1 flex flex-wrap gap-2">
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
                      <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={descendants
                            .filter((candidateId) => !selections.get(candidateId)?.ignored)
                            .every((candidateId) => selections.get(candidateId)?.follow_updates === true)}
                          onChange={(event) => onFollowDescendants(descendants, event.target.checked)}
                        />
                        更新后代
                      </label>
                    ) : null}
                  </div>
                ) : null}
                {node.children.length > 0 ? (
                  <SourceTree
                    nodes={node.children}
                    selections={selections}
                    selectedSeason={selectedSeason}
                    subscriptionEnabled={subscriptionEnabled}
                    onMapDescendants={onMapDescendants}
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
        )
      })}
    </ul>
  )
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
}: QuarkSeasonIngestWorkspaceProps) {
  const [scope, setScope] = useState<SaveScope>('CURRENT_SEASON')
  const [preview, setPreview] = useState<QuarkMultiSourcePreview | null>(null)
  const [selections, setSelections] = useState<QuarkSourceSelection[]>([])
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [createdTask, setCreatedTask] = useState<QuarkMultiSourceTaskResult | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setScope('CURRENT_SEASON')
    setPreview(null)
    setSelections([])
    setSubscriptionEnabled(false)
    setStatus('idle')
    setMessage(null)
    setCreatedTask(null)
  }, [mediaType, shareUrl, title, tmdbId, selectedSeason])

  const selectionsById = useMemo(
    () => new Map(selections.map((selection) => [selection.source_candidate_id, selection])),
    [selections],
  )
  const planReady = Boolean(preview?.ready && preview.sources.length > 0)
  const payload: QuarkMultiSourcePayload = {
    share_url: shareUrl,
    title,
    original_title: originalTitle,
    tmdb_id: tmdbId,
    preview_id: preview?.preview_id ?? null,
    follow_updates_enabled: subscriptionEnabled,
    sources: selections,
  }

  function markPlanDirty() {
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

  function changeScope(nextScope: SaveScope) {
    setScope(nextScope)
    if (preview) {
      setSelections(initialSelections(preview, nextScope, selectedSeason))
      setSubscriptionEnabled(false)
      markPlanDirty()
    }
  }

  async function advance() {
    if (status === 'loading') return
    setStatus('loading')
    setMessage(null)
    setCreatedTask(null)
    try {
      if (!preview) {
        const controller = new AbortController()
        controllerRef.current = controller
        const inspected = await previewQuarkShareTree(mediaType, payload, controller.signal)
        setPreview(inspected)
        setSelections(initialSelections(inspected, scope, selectedSeason))
        setStatus('success')
        return
      }
      if (!planReady) {
        const controller = new AbortController()
        controllerRef.current = controller
        const planned = await previewQuarkMultiSourcePlan(mediaType, payload, controller.signal)
        setPreview(planned)
        setStatus('success')
        return
      }
      const task = await createQuarkMultiSourceTasks(mediaType, payload)
      setCreatedTask(task)
      setStatus(task.status === 'FAILED' ? 'error' : 'success')
      setMessage(task.message)
      if (task.status === 'PARTIAL') {
        const createdSourceIds = new Set(
          task.sources
            .filter((source) => source.status === 'CREATED')
            .map((source) => source.source_candidate_id),
        )
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
      <div className="flex w-full rounded-xl bg-slate-100 p-1 sm:w-fit">
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
              scope === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {preview ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <SourceTree
              nodes={preview.entries}
              selections={selectionsById}
              selectedSeason={selectedSeason}
              subscriptionEnabled={subscriptionEnabled}
              onMapDescendants={(candidateIds, seasonNumber) =>
                updateDescendants(candidateIds, (selection) => ({ ...selection, season_number: seasonNumber }))}
              onFollowDescendants={(candidateIds, followUpdates) =>
                updateDescendants(candidateIds, (selection) => ({ ...selection, follow_updates: followUpdates }))}
            />
          </div>

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

          <div className="space-y-3">
            {preview.sources.map((source) => {
              const selection = selectionsById.get(source.source_candidate_id)
              if (!selection) return null
              return (
                <div
                  key={source.source_candidate_id}
                  className={cn(
                    'rounded-xl border px-4 py-4',
                    source.status === 'BLOCKED' || source.errors.length > 0
                      ? 'border-rose-200 bg-rose-50/60'
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
                        {[...new Set([
                          ...Array.from({ length: 99 }, (_, index) => index + 1),
                          ...seasonOptions,
                          source.detected_season ?? 0,
                        ])]
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
                          onChange={(event) => updateSelection(source.source_candidate_id, (current) => ({
                            ...current,
                            ignored: event.target.checked,
                            follow_updates: event.target.checked ? false : current.follow_updates,
                          }))}
                        />
                        忽略
                      </label>
                      {subscriptionEnabled && !selection.ignored ? (
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={selection.follow_updates}
                            onChange={(event) => updateSelection(source.source_candidate_id, (current) => ({
                              ...current,
                              follow_updates: event.target.checked,
                            }))}
                          />
                          更新文件夹
                        </label>
                      ) : null}
                    </div>
                  </div>
                  {source.files.length > 0 ? (
                    <div className="mt-3 max-h-56 overflow-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-[11px] leading-5 text-slate-200">
                      {source.files.map((file) => (
                        <div key={`${file.source_name}:${file.target_name}`}>
                          {file.source_name} → {file.target_name}
                          {file.message ? ` (${file.message})` : ''}
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
          <p className={cn('text-sm', preview.ready ? 'text-emerald-700' : 'text-amber-700')}>
            {preview.message}
          </p>
          {preview.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-700">· {warning}</p>
          ))}
        </div>
      ) : null}

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
          : !preview
            ? '检查分享目录树'
            : !planReady
              ? '生成逐文件改名预览'
              : '创建并立即执行 QAS 任务'}
      </Button>

      {message ? (
        <div className={cn(
          'rounded-xl px-4 py-3 text-sm',
          status === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800',
        )}>
          {message}
          {createdTask ? (
            <div className="mt-1 space-y-1 text-xs">
              <p>已创建 {createdTask.created_task_count}/{createdTask.planned_task_count} 个 QAS 任务</p>
              {createdTask.sources
                .filter((source) => source.status !== 'CREATED')
                .map((source) => <p key={source.source_candidate_id}>{source.task_name}：{source.message}</p>)}
              {createdTask.warnings.map((warning) => <p key={warning}>· {warning}</p>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
