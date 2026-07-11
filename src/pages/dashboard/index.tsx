import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Eye,
  ExternalLink,
  Film,
  FolderOpen,
  HardDrive,
  KeyRound,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Server,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { SelectControl } from '@/components/ui/form-control'
import {
  cleanupAdultOtherCollections,
  getAdultOtherAutomationRunDetails,
  getAdultOtherCollectionSourceFolders,
  getAdultOtherAutomationRuns,
  getLatestAdultOtherCollectionSyncRun,
  previewAdultOtherCollectionCleanup,
  previewAdultOtherCollections,
  syncAdultOtherCollections,
} from '@/lib/api/adult-other-collections'
import {
  generateAdminRegistrationCode,
  getAdminRegistrationCode,
} from '@/lib/api/admin-registration-code'
import { refreshAutoSymlink } from '@/lib/api/autosymlink'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type { AdminRegistrationCodeSource } from '@/types/admin-users'
import type {
  AutoSymlinkRefreshResult,
  AutoSymlinkRefreshTarget,
} from '@/types/autosymlink'
import type {
  AdultOtherAutomationRun,
  AdultOtherCollectionInventory,
  AdultOtherCollectionSourceFolder,
  AdultOtherCollectionSourceFolderChangeStatus,
  AdultOtherCollectionSyncAction,
  AdultOtherCollectionSyncGroup,
  AdultOtherCollectionSyncRun,
} from '@/types/adult-other-collections'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'
type SubmitAction = 'preview' | 'sync' | 'cleanupPreview' | 'cleanup'
type RegistrationCodeStatus = 'idle' | 'loading' | 'saving'

const DEFAULT_MIN_ITEM_COUNT = 2
const EMPTY_COLLECTION_INVENTORY: AdultOtherCollectionInventory = {
  sourceFolderCount: 0,
  groupCount: 0,
  healthyGroupCount: 0,
  pendingCreateGroupCount: 0,
  pendingMemberGroupCount: 0,
  skippedGroupCount: 0,
  sourceFolders: [],
}

type AdminQuickLink = {
  description: string
  icon: LucideIcon
  id: string
  label: string
  tone: string
  url: string
}

const adminQuickLinks: AdminQuickLink[] = [
  {
    description: '媒体库后台',
    icon: Film,
    id: 'emby',
    label: 'Emby',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    url: 'http://107.172.224.11:8096',
  },
  {
    description: '索引器管理',
    icon: Search,
    id: 'prowlarr',
    label: 'Prowlarr',
    tone: 'bg-sky-50 text-sky-700 ring-sky-200',
    url: 'http://107.172.46.215:9696',
  },
  {
    description: '网盘文件与离线任务',
    icon: FolderOpen,
    id: 'openlist',
    label: 'OpenList',
    tone: 'bg-violet-50 text-violet-700 ring-violet-200',
    url: 'http://107.172.46.215:5244',
  },
  {
    description: 'CloudDrive2',
    icon: HardDrive,
    id: 'cd2',
    label: 'CD2',
    tone: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
    url: 'http://107.172.224.11:19798',
  },
  {
    description: 'AutoSymlink',
    icon: Server,
    id: 'as',
    label: 'AS',
    tone: 'bg-amber-50 text-amber-700 ring-amber-200',
    url: 'http://107.172.224.11:8095',
  },
]

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
  HEALTHY: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING_CREATE: 'bg-blue-50 text-blue-700 ring-blue-200',
  PENDING_MEMBERS: 'bg-amber-50 text-amber-700 ring-amber-200',
  MIXED: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const automationStageLabels: Record<string, string> = {
  SCOPING: '确认媒体范围',
  RECONCILING: '首次合集对账',
  WAITING_PRIMARY: '等待神医生成封面',
  REFRESHING_PRIMARY: '定向补全视频封面',
  VERIFYING_PRIMARY: '确认视频封面',
  FINAL_RECONCILING: '最终合集对账与封面',
  CLEANING_COLLECTIONS: '清理空合集',
  COMPLETED: '已完成',
  IGNORED: '已忽略',
  FAILED: '失败',
}

const automationItemStatusLabels: Record<string, string> = {
  WAITING_PRIMARY: '等待封面',
  NATURAL_READY: '神医自然完成',
  REFRESHED: '定向刷新成功',
  MISSING: '仍缺封面',
  SKIPPED: '已跳过',
  UNRESOLVED: '未查询到',
}

const automationCollectionStatusLabels: Record<string, string> = {
  IMAGE_READY: '合集封面完成',
  IMAGE_MISSING: '仍缺合集封面',
  SKIPPED: '未处理',
}

function automationDetailStatusStyle(status: string) {
  if (status === 'MISSING' || status === 'IMAGE_MISSING' || status === 'UNRESOLVED') {
    return 'bg-rose-50 text-rose-700 ring-rose-200'
  }
  if (status === 'WAITING_PRIMARY') {
    return 'bg-blue-50 text-blue-700 ring-blue-200'
  }
  if (status === 'SKIPPED') {
    return 'bg-amber-50 text-amber-700 ring-amber-200'
  }
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
}

function AutomationRunsPanel({
  error,
  loading,
  onRefresh,
  runs,
}: {
  error: string | null
  loading: boolean
  onRefresh: () => void
  runs: AdultOtherAutomationRun[]
}) {
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set())
  const [runDetails, setRunDetails] = useState<Record<string, AdultOtherAutomationRun>>({})
  const [detailLoadingRunIds, setDetailLoadingRunIds] = useState<Set<string>>(new Set())
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({})

  const loadRunDetails = useCallback((runId: string) => {
    setDetailLoadingRunIds((current) => new Set(current).add(runId))
    setDetailErrors((current) => {
      const next = { ...current }
      delete next[runId]
      return next
    })
    void getAdultOtherAutomationRunDetails(runId)
      .then((details) => {
        setRunDetails((current) => ({ ...current, [runId]: details }))
      })
      .catch((detailError: unknown) => {
        setDetailErrors((current) => ({
          ...current,
          [runId]: detailError instanceof Error ? detailError.message : '自动化明细加载失败',
        }))
      })
      .finally(() => {
        setDetailLoadingRunIds((current) => {
          const next = new Set(current)
          next.delete(runId)
          return next
        })
      })
  }, [])

  useEffect(() => {
    for (const run of runs) {
      const details = runDetails[run.id]
      if (
        expandedRunIds.has(run.id) &&
        details &&
        !detailLoadingRunIds.has(run.id) &&
        details.status === 'RUNNING' &&
        run.status !== 'RUNNING'
      ) {
        loadRunDetails(run.id)
      }
    }
  }, [
    detailLoadingRunIds,
    expandedRunIds,
    loadRunDetails,
    runDetails,
    runs,
  ])

  const toggleRun = (run: AdultOtherAutomationRun) => {
    const runId = run.id
    const expanding = !expandedRunIds.has(runId)
    setExpandedRunIds((current) => {
      const next = new Set(current)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      return next
    })
    if (!expanding || (runDetails[runId] && run.status !== 'RUNNING')) {
      return
    }
    loadRunDetails(runId)
  }

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-shell ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-950">自动化运行</h2>
            <p className="mt-1 text-xs text-slate-500">新入库补图、合集对账与删除清理</p>
          </div>
        </div>
        <Button
          aria-label="刷新自动化记录"
          disabled={loading}
          onClick={onRefresh}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RefreshCw className={cn('h-4 w-4', loading ? 'animate-spin' : null)} />
        </Button>
      </div>

      {error ? (
        <div className="px-5 py-4 text-sm text-rose-700">{error}</div>
      ) : runs.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-500">暂无自动化记录。</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead className="bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-3">时间</th>
                <th className="px-4 py-3">触发</th>
                <th className="px-4 py-3">状态 / 阶段</th>
                <th className="px-4 py-3">视频封面</th>
                <th className="px-4 py-3">合集</th>
                <th className="px-4 py-3 text-right">明细</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const expanded = expandedRunIds.has(run.id)
                const details = runDetails[run.id]
                const items = details?.items ?? []
                const collections = details?.collections ?? []
                const detailLoading = detailLoadingRunIds.has(run.id)
                const detailError = detailErrors[run.id]
                return (
                <Fragment key={run.id}>
                <tr className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {formatDateTime(run.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    {run.triggerType === 'NEW_ITEMS' ? '新入库' : '媒体删除'} · {run.eventCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1',
                        run.status === 'FAILED'
                          ? 'bg-rose-50 text-rose-700 ring-rose-200'
                          : run.status === 'RUNNING'
                            ? 'bg-blue-50 text-blue-700 ring-blue-200'
                            : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                      )}
                    >
                      {run.status === 'RUNNING' ? '进行中' : run.status === 'FAILED' ? '失败' : '已完成'}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">
                      {automationStageLabels[run.stage] ?? run.stage}
                      {run.message ? ` · ${run.message}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs leading-5 text-slate-600">
                    {run.triggerType === 'NEW_ITEMS' ? (
                      <>
                        目标 {run.targetItemCount} · 自然完成 {run.naturalPrimaryReadyCount}
                        <br />
                        定向刷新 {run.targetedRefreshCount} · 最终 {run.finalPrimaryReadyCount}/{run.targetItemCount} · 缺失 {run.finalPrimaryMissingCount}
                      </>
                    ) : '不涉及'}
                  </td>
                  <td className="px-4 py-3 text-xs leading-5 text-slate-600">
                    {run.triggerType === 'NEW_ITEMS' ? (
                      <>
                        创建 {run.createdCollectionCount} · 更新 {run.updatedCollectionCount}
                        <br />
                        封面 {run.collectionImageReadyCount}/{run.affectedCollectionCount}
                      </>
                    ) : `删除空合集 ${run.deletedCollectionCount}`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      aria-expanded={expanded}
                      aria-label={`${expanded ? '收起' : '展开'}${formatDateTime(run.startedAt)}自动化明细`}
                      onClick={() => toggleRun(run)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {detailLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {details ? items.length + collections.length : '查看'}
                    </Button>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-t border-slate-100 bg-slate-50/70">
                    <td className="px-5 py-5" colSpan={6}>
                      {detailLoading && !details ? (
                        <p className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          正在加载运行明细
                        </p>
                      ) : detailError ? (
                        <p className="text-sm text-rose-700">{detailError}</p>
                      ) : items.length === 0 && collections.length === 0 ? (
                        <p className="text-sm text-slate-500">该运行暂无媒体或合集明细，旧记录不会自动补录。</p>
                      ) : (
                        <div className="grid gap-6 lg:grid-cols-2">
                          <div>
                            <h3 className="text-xs font-semibold text-slate-700">媒体明细 · {items.length}</h3>
                            <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
                              {items.map((item) => (
                                <div className="flex items-start justify-between gap-4 py-3" key={item.embyItemId}>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-900" title={item.itemName ?? item.embyItemId}>
                                      {item.itemName ?? item.embyItemId}
                                    </p>
                                    <p className="mt-1 truncate text-xs text-slate-500" title={item.itemPath ?? undefined}>
                                      {item.collectionName ?? '未识别合集'} · {item.embyItemId}
                                    </p>
                                    {item.itemPath ? (
                                      <p className="mt-1 truncate text-xs text-slate-400" title={item.itemPath}>
                                        {item.itemPath}
                                      </p>
                                    ) : null}
                                    {item.message ? <p className="mt-1 text-xs text-rose-600">{item.message}</p> : null}
                                  </div>
                                  <span className={cn('shrink-0 rounded-md px-2 py-1 text-xs font-medium ring-1', automationDetailStatusStyle(item.status))}>
                                    {automationItemStatusLabels[item.status] ?? item.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h3 className="text-xs font-semibold text-slate-700">合集明细 · {collections.length}</h3>
                            <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
                              {collections.map((collection) => (
                                <div className="flex items-start justify-between gap-4 py-3" key={`${collection.collectionName}-${collection.embyCollectionId ?? 'pending'}`}>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-900" title={collection.collectionName}>
                                      {collection.collectionName}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {actionLabels[collection.action] ?? collection.action} · 新增成员 {collection.addedItemCount}
                                    </p>
                                    {collection.message ? <p className="mt-1 text-xs text-rose-600">{collection.message}</p> : null}
                                  </div>
                                  <span className={cn('shrink-0 rounded-md px-2 py-1 text-xs font-medium ring-1', automationDetailStatusStyle(collection.status))}>
                                    {automationCollectionStatusLabels[collection.status] ?? collection.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
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

function registrationCodeSourceLabel(source: AdminRegistrationCodeSource) {
  if (source === 'DATABASE') {
    return '数据库生效'
  }
  if (source === 'CONFIG') {
    return '环境配置生效'
  }
  return '未开放'
}
function sourceFolderChangeLabel(folder: AdultOtherCollectionSourceFolder) {
  if (folder.healthStatus === 'PENDING_CREATE') {
    return `待创建 ${folder.pendingCreateGroupCount} 组`
  }
  if (folder.healthStatus === 'PENDING_MEMBERS') {
    return `待补成员 ${folder.pendingMemberGroupCount} 组`
  }
  if (folder.healthStatus === 'MIXED') {
    return `待创建 ${folder.pendingCreateGroupCount} · 待补成员 ${folder.pendingMemberGroupCount}`
  }
  return '健康'
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
  if (run.mode === 'AUTO_WEBHOOK') {
    return '自动对账'
  }
  if (run.mode === 'CLEANUP_DRY_RUN') {
    return '清理预览'
  }
  return '清理执行'
}

function sourceFolderOptionLabel(folder: AdultOtherCollectionSourceFolder) {
  return `${folder.label} · ${folder.groupCount} 组 · ${sourceFolderChangeLabel(folder)}`
}

function sourceFolderStatusText(
  folder: AdultOtherCollectionSourceFolder | null,
) {
  if (!folder) {
    return '全量校验会以 Emby 当前库存和 Collection 成员为准。'
  }
  return `当前 ${folder.groupCount} 组：健康 ${folder.healthyGroupCount}，待创建 ${folder.pendingCreateGroupCount}，待补成员 ${folder.pendingMemberGroupCount}，暂不创建 ${folder.skippedGroupCount}`
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

function AdminQuickLinksPanel() {
  return (
    <section className="rounded-lg bg-white p-5 shadow-shell ring-1 ring-slate-200">
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <ExternalLink className="h-5 w-5" />
        </span>
        <h2 className="text-base font-semibold text-slate-950">快捷入口</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {adminQuickLinks.map((item) => {
          const Icon = item.icon

          return (
            <Button
              asChild
              className="h-auto min-h-20 justify-start whitespace-normal px-4 py-3 text-left"
              key={item.id}
              variant="outline"
            >
              <a href={item.url} rel="noreferrer" target="_blank">
                <span
                  className={cn(
                    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1',
                    item.tone,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-950">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    {item.description}
                  </span>
                </span>
                <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
              </a>
            </Button>
          )
        })}
      </div>
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
        sourceFolderChangeStyles[folder.healthStatus],
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
  const [automationRuns, setAutomationRuns] = useState<
    AdultOtherAutomationRun[]
  >([])
  const [automationLoading, setAutomationLoading] = useState(false)
  const [automationError, setAutomationError] = useState<string | null>(null)
  const [latestRun, setLatestRun] =
    useState<AdultOtherCollectionSyncRun | null>(null)
  const [currentRun, setCurrentRun] =
    useState<AdultOtherCollectionSyncRun | null>(null)
  const [collectionInventory, setCollectionInventory] = useState(
    EMPTY_COLLECTION_INVENTORY,
  )
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
  const [registrationCode, setRegistrationCode] = useState('')
  const [registrationCodeSource, setRegistrationCodeSource] =
    useState<AdminRegistrationCodeSource>('NONE')
  const [registrationCodeStatus, setRegistrationCodeStatus] =
    useState<RegistrationCodeStatus>('idle')
  const [registrationCodeCopied, setRegistrationCodeCopied] = useState(false)

  const sourceFolders = collectionInventory.sourceFolders
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
  const loadLatestRun = useCallback(
    async (signal?: AbortSignal) => {
      setStatus('loading')
      setErrorMessage(null)
      try {
        const [run, inventory] = await Promise.all([
          getLatestAdultOtherCollectionSyncRun(signal),
          getAdultOtherCollectionSourceFolders(signal),
        ])
        setLatestRun(run)
        setCollectionInventory(inventory)
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

  const loadRegistrationCode = useCallback(async (signal?: AbortSignal) => {
    setRegistrationCodeStatus('loading')
    try {
      const data = await getAdminRegistrationCode(signal)
      setRegistrationCode(data.registration_code ?? '')
      setRegistrationCodeSource(data.source)
      setRegistrationCodeCopied(false)
    } catch (error) {
      if (isJavaRequestCanceledError(error)) {
        return
      }
      setErrorMessage(
        error instanceof Error ? error.message : '注册码数据加载失败',
      )
    } finally {
      setRegistrationCodeStatus('idle')
    }
  }, [])

  const loadAutomationRuns = useCallback(async (signal?: AbortSignal) => {
    setAutomationLoading(true)
    try {
      setAutomationRuns(await getAdultOtherAutomationRuns(signal))
      setAutomationError(null)
    } catch (error) {
      if (!isJavaRequestCanceledError(error)) {
        setAutomationError(
          error instanceof Error ? error.message : '自动化记录加载失败',
        )
      }
    } finally {
      setAutomationLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadRegistrationCode(controller.signal)
    return () => controller.abort()
  }, [loadRegistrationCode])

  useEffect(() => {
    const controller = new AbortController()
    void loadAutomationRuns(controller.signal)
    const intervalId = window.setInterval(
      () => void loadAutomationRuns(),
      5000,
    )
    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [loadAutomationRuns])

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
          const inventory = await getAdultOtherCollectionSourceFolders()
          setCollectionInventory(inventory)
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

  const generateRegistrationCode = useCallback(async () => {
    if (
      registrationCode &&
      !window.confirm('生成新注册码后，旧注册码会立即失效。确定继续吗？')
    ) {
      return
    }
    setRegistrationCodeStatus('saving')
    setErrorMessage(null)
    try {
      const data = await generateAdminRegistrationCode()
      setRegistrationCode(data.registration_code ?? '')
      setRegistrationCodeSource(data.source)
      setRegistrationCodeCopied(false)
      setToastMessage('新注册码已生成并启用')
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '注册码生成失败',
      )
    } finally {
      setRegistrationCodeStatus('idle')
    }
  }, [registrationCode])

  const copyRegistrationCode = useCallback(async () => {
    if (!registrationCode) {
      return
    }
    try {
      await navigator.clipboard.writeText(registrationCode)
      setRegistrationCodeCopied(true)
      setToastMessage('注册码已复制')
    } catch {
      setErrorMessage('注册码复制失败，请手动复制。')
    }
  }, [registrationCode])

  return (
    <PageContainer
      title="控制台"
      description="查看 Adult-Other 当前库存健康度与自动化运行情况。"
    >
      <div className="space-y-6">
        <AdminQuickLinksPanel />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Layers}
            label="当前范围"
            tone="bg-slate-100 text-slate-700"
            value={collectionInventory.sourceFolderCount}
          />
          <StatCard
            icon={Database}
            label="当前合集组"
            tone="bg-emerald-50 text-emerald-700"
            value={collectionInventory.groupCount}
          />
          <StatCard
            icon={Layers}
            label="待创建"
            tone="bg-blue-50 text-blue-700"
            value={collectionInventory.pendingCreateGroupCount}
          />
          <StatCard
            icon={AlertTriangle}
            label="待补成员"
            tone="bg-amber-50 text-amber-700"
            value={collectionInventory.pendingMemberGroupCount}
          />
        </div>

        <AutomationRunsPanel
          error={automationError}
          loading={automationLoading}
          onRefresh={() => void loadAutomationRuns()}
          runs={automationRuns}
        />

        <details className="rounded-lg bg-white shadow-shell ring-1 ring-slate-200">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-950">
            高级恢复工具
            <span className="ml-2 font-normal text-slate-500">
              Webhook 遗漏或状态异常时手动校验
            </span>
          </summary>
          <div className="space-y-6 border-t border-slate-100 p-5">
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
            title="校验范围"
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

          <OperationPanel icon={Play} title="对账合集">
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

        <OperationPanel icon={KeyRound} title="注册码">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_16rem] xl:items-start">
            <div className="min-w-0">
              <div className="flex min-h-16 items-center rounded-lg bg-slate-950 px-5 py-4">
                <p className="break-all font-mono text-xl font-semibold leading-8 tracking-[0.12em] text-white sm:text-2xl">
                  {registrationCodeStatus === 'loading'
                    ? '加载中'
                    : registrationCode || '未开放注册'}
                </p>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {registrationCodeSourceLabel(registrationCodeSource)}。生成新注册码会写入后端数据库，并立即作为注册页校验值。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Button
                className="h-11 w-full"
                disabled={registrationCodeStatus !== 'idle'}
                onClick={() => void generateRegistrationCode()}
                type="button"
              >
                {registrationCodeStatus === 'saving' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                生成并启用
              </Button>
              <Button
                className="h-11 w-full"
                disabled={!registrationCode || registrationCodeStatus !== 'idle'}
                onClick={() => void copyRegistrationCode()}
                type="button"
                variant="outline"
              >
                {registrationCodeCopied ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {registrationCodeCopied ? '已复制' : '复制'}
              </Button>
            </div>
          </div>
        </OperationPanel>

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
              <div className="rounded-lg bg-slate-50 p-8 text-sm text-slate-500 ring-1 ring-slate-200">
                暂无手动校验记录。
              </div>
            )}
          </div>
        </details>
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
