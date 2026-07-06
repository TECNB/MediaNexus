import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { SelectControl } from '@/components/ui/form-control'
import {
  cleanupAdultOtherCollections,
  getAdultOtherCollectionSourceFolders,
  getLatestAdultOtherCollectionSyncRun,
  previewAdultOtherCollectionCleanup,
  previewAdultOtherCollections,
  syncAdultOtherCollections,
} from '@/lib/api/adult-other-collections'
import { refreshAutoSymlink } from '@/lib/api/autosymlink'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type {
  AutoSymlinkRefreshResult,
  AutoSymlinkRefreshTarget,
} from '@/types/autosymlink'
import type {
  AdultOtherCollectionSourceFolder,
  AdultOtherCollectionSourceFolderChangeStatus,
  AdultOtherCollectionSyncAction,
  AdultOtherCollectionSyncGroup,
  AdultOtherCollectionSyncRun,
} from '@/types/adult-other-collections'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'
type SubmitAction = 'preview' | 'sync' | 'cleanupPreview' | 'cleanup'

const DEFAULT_MIN_ITEM_COUNT = 2

const autoSymlinkTargets: Array<{
  label: string
  target: AutoSymlinkRefreshTarget
}> = [
  { label: 'Movie', target: 'MOVIE' },
  { label: 'TV', target: 'TV' },
  { label: 'Anime', target: 'ANIME' },
  { label: 'Adult', target: 'ADULT' },
]

const autoSymlinkStatusLabels = {
  FAILED: '提交失败',
  SKIPPED: '已跳过',
  SUBMITTED: '已提交',
}

const actionLabels: Record<AdultOtherCollectionSyncAction, string> = {
  CREATE: '创建',
  UPDATE: '补成员',
  UNCHANGED: '已同步',
  SKIPPED: '跳过',
  DELETE: '清理',
  REVIEW: '复查',
  MISSING_COLLECTION: '已不存在',
}

const actionStyles: Record<AdultOtherCollectionSyncAction, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 ring-blue-200',
  UNCHANGED: 'bg-slate-100 text-slate-600 ring-slate-200',
  SKIPPED: 'bg-amber-50 text-amber-700 ring-amber-200',
  DELETE: 'bg-rose-50 text-rose-700 ring-rose-200',
  REVIEW: 'bg-amber-50 text-amber-700 ring-amber-200',
  MISSING_COLLECTION: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const sourceFolderChangeStyles: Record<
  AdultOtherCollectionSourceFolderChangeStatus,
  string
> = {
  NEVER_SYNCED: 'bg-slate-100 text-slate-600 ring-slate-200',
  UNCHANGED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INCREASED: 'bg-blue-50 text-blue-700 ring-blue-200',
  DECREASED: 'bg-amber-50 text-amber-700 ring-amber-200',
  CHANGED: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  MISSING: 'bg-rose-50 text-rose-700 ring-rose-200',
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function parseMinItemCount(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 2) {
    return DEFAULT_MIN_ITEM_COUNT
  }
  return Math.trunc(parsed)
}

function sourceFolderLabel(path: string | null | undefined) {
  return path && path.length > 0 ? path : '全部 Adult - Other'
}

function autoSymlinkTargetLabel(target: AutoSymlinkRefreshTarget) {
  return (
    autoSymlinkTargets.find((item) => item.target === target)?.label ?? target
  )
}

function signedDelta(value: number | null) {
  if (value === null) {
    return '-'
  }
  return value > 0 ? `+${value}` : String(value)
}

function sourceFolderChangeLabel(folder: AdultOtherCollectionSourceFolder) {
  if (folder.changeStatus === 'MISSING') {
    return `已消失 ${signedDelta(folder.itemDelta)} 项 / ${signedDelta(folder.groupDelta)} 组`
  }
  if (folder.changeStatus === 'NEVER_SYNCED') {
    return '未同步'
  }
  if (folder.changeStatus === 'UNCHANGED') {
    return '无变化'
  }
  if (folder.changeStatus === 'INCREASED') {
    return `有新增 ${signedDelta(folder.itemDelta)} 项 / ${signedDelta(folder.groupDelta)} 组`
  }
  if (folder.changeStatus === 'DECREASED') {
    return `有减少 ${signedDelta(folder.itemDelta)} 项 / ${signedDelta(folder.groupDelta)} 组`
  }
  return `有变化 ${signedDelta(folder.itemDelta)} 项 / ${signedDelta(folder.groupDelta)} 组`
}

function isCleanupRun(run: AdultOtherCollectionSyncRun) {
  return run.mode === 'CLEANUP_DRY_RUN' || run.mode === 'CLEANUP_APPLY'
}

function runModeLabel(run: AdultOtherCollectionSyncRun) {
  if (run.mode === 'DRY_RUN') {
    return '预览'
  }
  if (run.mode === 'APPLY') {
    return '执行'
  }
  if (run.mode === 'CLEANUP_DRY_RUN') {
    return '清理预览'
  }
  return '清理执行'
}

function sourceFolderOptionLabel(folder: AdultOtherCollectionSourceFolder) {
  return `${folder.label} · ${folder.itemCount} 项 · ${folder.groupCount} 组 · ${sourceFolderChangeLabel(folder)}`
}

function sourceFolderStatusText(
  folder: AdultOtherCollectionSourceFolder | null,
) {
  if (!folder) {
    return '全量范围会扫描所有第一层文件夹，建议先选择单个范围预览。'
  }
  const previewText = folder.latestPreviewAt
    ? `最近预览 ${formatDateTime(folder.latestPreviewAt)}`
    : '未预览'
  const syncText = folder.latestSyncAt
    ? `最近同步 ${formatDateTime(folder.latestSyncAt)}`
    : '未同步'
  if (!folder.latestSyncAt) {
    return `${syncText} · ${previewText}`
  }
  return `${syncText} · 上次 ${folder.lastSyncedItemCount ?? '-'} 项 / ${folder.lastSyncedGroupCount ?? '-'} 组，当前 ${folder.itemCount} 项 / ${folder.groupCount} 组 · ${previewText}`
}

function runToastMessage(run: AdultOtherCollectionSyncRun) {
  const scope = sourceFolderLabel(run.sourceFolderPath)
  if (run.mode === 'DRY_RUN') {
    return `预览完成：${scope}，${run.eligibleGroupCount} 个可处理合集`
  }
  if (run.mode === 'CLEANUP_DRY_RUN') {
    return `清理预览完成：${scope}，${run.deletedCollectionCount} 个空合集可清理`
  }
  if (run.mode === 'CLEANUP_APPLY') {
    return `清理完成：${scope}，删除 ${run.deletedCollectionCount} 个，复查 ${run.reviewCollectionCount} 个`
  }
  return `同步完成：${scope}，创建 ${run.createdCollectionCount} 个，补全 ${run.updatedCollectionCount} 个，新增 ${run.itemAddCount} 项`
}

function submitAdultOtherCollectionAction(
  action: SubmitAction,
  request: {
    minItemCount: number
    sourceFolderPath: string | null
  },
) {
  if (action === 'preview') {
    return previewAdultOtherCollections(request)
  }
  if (action === 'sync') {
    return syncAdultOtherCollections(request)
  }
  if (action === 'cleanupPreview') {
    return previewAdultOtherCollectionCleanup(request)
  }
  return cleanupAdultOtherCollections(request)
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  tone: string
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-shell ring-1 ring-slate-200">
      <div className="flex items-center gap-4">
        <span className={cn('rounded-lg p-3', tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

function OperationPanel({
  action,
  children,
  icon: Icon,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  icon: LucideIcon
  title: string
}) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-shell ring-1 ring-slate-200">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function ActionBadge({ action }: { action: AdultOtherCollectionSyncAction }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1',
        actionStyles[action],
      )}
    >
      {actionLabels[action]}
    </span>
  )
}

function SourceFolderChangeBadge({
  folder,
}: {
  folder: AdultOtherCollectionSourceFolder
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1',
        sourceFolderChangeStyles[folder.changeStatus],
      )}
    >
      {sourceFolderChangeLabel(folder)}
    </span>
  )
}

function GroupRow({
  cleanupRun,
  group,
}: {
  cleanupRun: boolean
  group: AdultOtherCollectionSyncGroup
}) {
  const changedValue = cleanupRun
    ? group.action === 'DELETE'
      ? '是'
      : '否'
    : group.addedItemCount

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 align-top">
        <div className="max-w-[22rem]">
          <p className="truncate text-sm font-medium text-slate-900">
            {group.collectionName}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {group.sourceFolderPath}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{group.itemCount}</td>
      <td className="px-4 py-3">
        <ActionBadge action={group.action} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{changedValue}</td>
      <td className="px-4 py-3 align-top">
        <div className="max-w-[26rem] space-y-1">
          {group.skipReason ? (
            <p className="text-xs text-amber-700">{group.skipReason}</p>
          ) : null}
          {group.sampleItemNames.slice(0, 2).map((name, index) => (
            <p
              className="truncate text-xs text-slate-500"
              key={`${name}-${index}`}
            >
              {name}
            </p>
          ))}
        </div>
      </td>
    </tr>
  )
}

function ResultTable({ run }: { run: AdultOtherCollectionSyncRun }) {
  const cleanupRun = isCleanupRun(run)
  const visibleGroups = useMemo(
    () =>
      run.groups
        .filter((group) => group.eligible || group.action !== 'SKIPPED')
        .slice(0, 20),
    [run.groups],
  )

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-shell ring-1 ring-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">候选合集</p>
          <p className="mt-1 text-xs text-slate-500">
            显示前 {visibleGroups.length} 个可处理或已处理分组
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {runModeLabel(run)} · {formatDateTime(run.startedAt)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">合集</th>
              <th className="px-4 py-3">
                {cleanupRun ? '当前成员' : '媒体'}
              </th>
              <th className="px-4 py-3">动作</th>
              <th className="px-4 py-3">
                {cleanupRun ? '清理' : '新增'}
              </th>
              <th className="px-4 py-3">样例</th>
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map((group) => (
              <GroupRow
                cleanupRun={cleanupRun}
                group={group}
                key={`${group.sourceFolderPath}-${group.collectionName}`}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [latestRun, setLatestRun] =
    useState<AdultOtherCollectionSyncRun | null>(null)
  const [currentRun, setCurrentRun] =
    useState<AdultOtherCollectionSyncRun | null>(null)
  const [sourceFolders, setSourceFolders] = useState<
    AdultOtherCollectionSourceFolder[]
  >([])
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [submitAction, setSubmitAction] = useState<SubmitAction | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [autoSymlinkTarget, setAutoSymlinkTarget] =
    useState<AutoSymlinkRefreshTarget | null>(null)
  const [lastAutoSymlinkResult, setLastAutoSymlinkResult] =
    useState<AutoSymlinkRefreshResult | null>(null)
  const [minItemCountInput, setMinItemCountInput] = useState(
    String(DEFAULT_MIN_ITEM_COUNT),
  )
  const [selectedSourceFolderPath, setSelectedSourceFolderPath] = useState('')

  const selectedRun = currentRun ?? latestRun
  const selectedSourceFolder = selectedSourceFolderPath
    ? (sourceFolders.find(
        (folder) => folder.path === selectedSourceFolderPath,
      ) ?? null)
    : null
  const isSubmitting = submitAction !== null
  const cleanupDisabled =
    isSubmitting || status === 'loading' || !selectedSourceFolderPath
  const selectedRunIsCleanup = selectedRun ? isCleanupRun(selectedRun) : false
  const selectedRunIsCleanupApply = selectedRun?.mode === 'CLEANUP_APPLY'
  const folderOverview = useMemo(() => {
    const changedStatuses: AdultOtherCollectionSourceFolderChangeStatus[] = [
      'INCREASED',
      'DECREASED',
      'CHANGED',
      'MISSING',
    ]

    return {
      changed: sourceFolders.filter((folder) =>
        changedStatuses.includes(folder.changeStatus),
      ).length,
      missing: sourceFolders.filter(
        (folder) => folder.changeStatus === 'MISSING',
      ).length,
      total: sourceFolders.length,
      unsynced: sourceFolders.filter(
        (folder) => folder.changeStatus === 'NEVER_SYNCED',
      ).length,
    }
  }, [sourceFolders])

  const loadLatestRun = useCallback(
    async (signal?: AbortSignal) => {
      setStatus('loading')
      setErrorMessage(null)
      try {
        const [run, folders] = await Promise.all([
          getLatestAdultOtherCollectionSyncRun(signal),
          getAdultOtherCollectionSourceFolders(signal),
        ])
        setLatestRun(run)
        setSourceFolders(folders)
        setStatus('success')
      } catch (error) {
        if (isJavaRequestCanceledError(error)) {
          return
        }
        setErrorMessage(
          error instanceof Error ? error.message : '最近同步记录加载失败',
        )
        setStatus('error')
      }
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadLatestRun(controller.signal)
    return () => controller.abort()
  }, [loadLatestRun])

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null)
    }, 3200)

    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  const submit = useCallback(
    async (action: SubmitAction) => {
      if (
        action === 'cleanup' &&
        !window.confirm('仅会删除当前成员数为 0 的 Collection，非空 Collection 会跳过。确定继续吗？')
      ) {
        return
      }
      setSubmitAction(action)
      setErrorMessage(null)
      try {
        const request = {
          minItemCount: parseMinItemCount(minItemCountInput),
          sourceFolderPath: selectedSourceFolderPath || null,
        }
        const run = await submitAdultOtherCollectionAction(action, request)
        setCurrentRun(run)
        setLatestRun(run)
        setToastMessage(runToastMessage(run))
        setStatus('success')
        try {
          const folders = await getAdultOtherCollectionSourceFolders()
          setSourceFolders(folders)
        } catch {
          setErrorMessage('操作已完成，但文件夹状态刷新失败，请手动刷新。')
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Adult-Other 合集同步请求失败',
        )
        setStatus('error')
      } finally {
        setSubmitAction(null)
      }
    },
    [minItemCountInput, selectedSourceFolderPath],
  )

  const submitAutoSymlinkRefresh = useCallback(
    async (target: AutoSymlinkRefreshTarget) => {
      const label = autoSymlinkTargetLabel(target)
      setAutoSymlinkTarget(target)
      setErrorMessage(null)
      setToastMessage(`开始同步：AS ${label} 任务正在提交`)
      try {
        const result = await refreshAutoSymlink(target)
        setLastAutoSymlinkResult(result)
        setToastMessage(`${result.message}：AS ${label}`)
        if (result.status !== 'SUBMITTED') {
          setErrorMessage(result.message)
        }
      } catch (error) {
        setLastAutoSymlinkResult(null)
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'AutoSymlink 同步任务提交失败',
        )
        setStatus('error')
      } finally {
        setAutoSymlinkTarget(null)
      }
    },
    [],
  )

  return (
    <PageContainer
      title="控制台"
      description="管理 Adult-Other Collection 同步与后续系统能力。"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Layers}
            label="同步范围"
            tone="bg-slate-100 text-slate-700"
            value={folderOverview.total}
          />
          <StatCard
            icon={AlertTriangle}
            label="有变化"
            tone="bg-amber-50 text-amber-700"
            value={folderOverview.changed}
          />
          <StatCard
            icon={Trash2}
            label="已消失"
            tone="bg-rose-50 text-rose-700"
            value={folderOverview.missing}
          />
          <StatCard
            icon={Database}
            label="未同步"
            tone="bg-blue-50 text-blue-700"
            value={folderOverview.unsynced}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(16rem,1fr))]">
          <OperationPanel
            action={
              <Button
                aria-label="刷新最近同步记录"
                disabled={isSubmitting || status === 'loading'}
                onClick={() => void loadLatestRun()}
                size="icon"
                type="button"
                variant="ghost"
              >
                <RefreshCw
                  className={cn(
                    'h-4 w-4',
                    status === 'loading' ? 'animate-spin' : null,
                  )}
                />
              </Button>
            }
            icon={Layers}
            title="同步范围"
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_8rem]">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  文件夹
                </span>
                <SelectControl
                  className="mt-2 h-11 w-full"
                  disabled={isSubmitting || status === 'loading'}
                  name="sourceFolderPath"
                  onChange={(event) =>
                    setSelectedSourceFolderPath(event.currentTarget.value)
                  }
                  value={selectedSourceFolderPath}
                >
                  <option value="">全部 Adult - Other</option>
                  {sourceFolders.map((folder) => (
                    <option key={folder.path} value={folder.path}>
                      {sourceFolderOptionLabel(folder)}
                    </option>
                  ))}
                </SelectControl>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  最小媒体数
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  max={100}
                  min={2}
                  onChange={(event) =>
                    setMinItemCountInput(event.currentTarget.value)
                  }
                  type="number"
                  value={minItemCountInput}
                />
              </label>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {selectedSourceFolder ? (
                  <SourceFolderChangeBadge folder={selectedSourceFolder} />
                ) : (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                    全量范围
                  </span>
                )}
                <span className="text-sm font-medium text-slate-900">
                  {sourceFolderLabel(selectedSourceFolderPath)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {sourceFolderStatusText(selectedSourceFolder)}
              </p>
            </div>
          </OperationPanel>

          <OperationPanel icon={Play} title="创建合集">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Button
                className="h-11"
                disabled={isSubmitting}
                onClick={() => void submit('preview')}
                type="button"
                variant="outline"
              >
                {submitAction === 'preview' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                预览
              </Button>
              <Button
                className="h-11"
                disabled={isSubmitting}
                onClick={() => void submit('sync')}
                type="button"
              >
                {submitAction === 'sync' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                执行
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">范围</p>
                <p className="mt-1 truncate font-medium text-slate-900">
                  {sourceFolderLabel(selectedSourceFolderPath)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">阈值</p>
                <p className="mt-1 font-medium text-slate-900">
                  {parseMinItemCount(minItemCountInput)}
                </p>
              </div>
            </div>
          </OperationPanel>

          <OperationPanel icon={Trash2} title="清理空合集">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Button
                className="h-11"
                disabled={cleanupDisabled}
                onClick={() => void submit('cleanupPreview')}
                type="button"
                variant="outline"
              >
                {submitAction === 'cleanupPreview' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                预览清理
              </Button>
              <Button
                className="h-11 bg-rose-600 text-white hover:bg-rose-700"
                disabled={cleanupDisabled}
                onClick={() => void submit('cleanup')}
                type="button"
              >
                {submitAction === 'cleanup' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                清理
              </Button>
            </div>
            <div className="mt-5 border-t border-rose-100 pt-4 text-sm">
              <p className="text-xs text-rose-700">清理范围</p>
              <p className="mt-1 truncate font-medium text-rose-950">
                {selectedSourceFolderPath
                  ? sourceFolderLabel(selectedSourceFolderPath)
                  : '未选择'}
              </p>
            </div>
          </OperationPanel>

          <OperationPanel icon={RefreshCw} title="AS 手动同步">
            <div className="grid grid-cols-2 gap-3">
              {autoSymlinkTargets.map((item) => (
                <Button
                  className="h-11"
                  disabled={autoSymlinkTarget !== null || isSubmitting}
                  key={item.target}
                  onClick={() => void submitAutoSymlinkRefresh(item.target)}
                  type="button"
                  variant={item.target === 'ADULT' ? 'default' : 'outline'}
                >
                  {autoSymlinkTarget === item.target ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4 text-sm">
              <p className="text-xs text-slate-500">同步状态</p>
              <p className="mt-1 truncate font-medium text-slate-900">
                {autoSymlinkTarget
                  ? `正在提交 ${autoSymlinkTargetLabel(autoSymlinkTarget)}`
                  : lastAutoSymlinkResult
                    ? `${autoSymlinkStatusLabels[lastAutoSymlinkResult.status]} ${autoSymlinkTargetLabel(lastAutoSymlinkResult.target)}`
                    : '等待手动触发'}
              </p>
              {lastAutoSymlinkResult ? (
                <p className="mt-1 truncate text-xs text-slate-500">
                  {lastAutoSymlinkResult.message} ·{' '}
                  {formatDateTime(lastAutoSymlinkResult.finishedAt)}
                </p>
              ) : null}
            </div>
          </OperationPanel>
        </div>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {selectedRun ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Database}
                label={selectedRunIsCleanup ? '候选 Collection' : '媒体总数'}
                tone="bg-slate-100 text-slate-700"
                value={selectedRun.totalItemCount}
              />
              <StatCard
                icon={Layers}
                label={selectedRunIsCleanup ? '可清理空合集' : '可处理合集'}
                tone="bg-blue-50 text-blue-700"
                value={selectedRun.eligibleGroupCount}
              />
              <StatCard
                icon={CheckCircle2}
                label={
                  selectedRunIsCleanup
                    ? selectedRunIsCleanupApply
                      ? '已清理 Collection'
                      : '可清理 Collection'
                    : '需新增成员'
                }
                tone="bg-emerald-50 text-emerald-700"
                value={
                  selectedRunIsCleanup
                    ? selectedRun.deletedCollectionCount
                    : selectedRun.itemAddCount
                }
              />
              <StatCard
                icon={AlertTriangle}
                label={selectedRunIsCleanup ? '需复查 Collection' : '跳过媒体'}
                tone="bg-amber-50 text-amber-700"
                value={
                  selectedRunIsCleanup
                    ? selectedRun.reviewCollectionCount
                    : selectedRun.skippedItemCount
                }
              />
            </div>

            <div className="rounded-lg bg-white p-5 shadow-shell ring-1 ring-slate-200">
              <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <p className="text-xs text-slate-500">同步范围</p>
                  <p className="mt-1 truncate font-medium text-slate-900">
                    {sourceFolderLabel(selectedRun.sourceFolderPath)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">运行模式</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {runModeLabel(selectedRun)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">状态</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {selectedRun.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    {selectedRunIsCleanup
                      ? selectedRunIsCleanupApply
                        ? '已清理 Collection'
                        : '可清理 Collection'
                      : '创建 Collection'}
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {selectedRunIsCleanup
                      ? selectedRun.deletedCollectionCount
                      : selectedRun.createdCollectionCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    {selectedRunIsCleanup ? '需复查 Collection' : '补全 Collection'}
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {selectedRunIsCleanup
                      ? selectedRun.reviewCollectionCount
                      : selectedRun.updatedCollectionCount}
                  </p>
                </div>
              </div>
            </div>

            <ResultTable run={selectedRun} />
          </>
        ) : (
          <div className="rounded-lg bg-white p-8 text-sm text-slate-500 shadow-shell ring-1 ring-slate-200">
            暂无同步记录，先运行一次预览。
          </div>
        )}
      </div>

      {toastMessage ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 right-6 z-50"
        >
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-2xl">
            {toastMessage}
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
