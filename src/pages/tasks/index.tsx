import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { SelectControl } from '@/components/ui/form-control'
import { listOpenListTaskCenterItems } from '@/lib/api/task-center'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { useAuth } from '@/lib/use-auth'
import { cn } from '@/lib/utils'
import type { MagnetIngestTaskStatus } from '@/types/magnet-ingest'
import type {
  OpenListTaskCenterItem,
  OpenListTaskCenterListData,
  OpenListTaskCenterProductFilter,
  OpenListTaskCenterProductType,
  OpenListTaskCenterSourceFilter,
  OpenListTaskCenterView,
} from '@/types/task-center'

type PageStatus = 'loading' | 'success' | 'empty' | 'error'

type PageState = {
  status: PageStatus
  data: OpenListTaskCenterListData | null
  message: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

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

const stageCopy: Record<string, string> = {
  created: '任务创建',
  submitted: '提交 OpenList',
  downloading: '离线下载',
  organizing: '文件整理',
  succeeded: '完成收束',
  done: '完成收束',
  failed: '失败收束',
  interrupted: '已中断',
}

const productTypeCopy: Record<OpenListTaskCenterProductType, string> = {
  MOVIE: '电影',
  SERIES: '剧集',
  ANIME: '动漫',
  ADULT: 'Adult',
}

const productFilterOptions: Array<{
  value: OpenListTaskCenterProductFilter
  label: string
}> = [
  { value: 'ALL', label: '全部类别' },
  { value: 'MOVIE', label: '电影' },
  { value: 'SERIES', label: '剧集' },
  { value: 'ANIME', label: '动漫' },
  { value: 'ADULT', label: 'Adult' },
]

const sourceFilterOptions: Array<{
  value: OpenListTaskCenterSourceFilter
  label: string
}> = [
  { value: 'ALL', label: '全部来源' },
  { value: 'MANUAL_MAGNET', label: '起点为手动磁力' },
  { value: 'PROWLARR_RELEASE', label: '起点为发布资源' },
]

const sourceTypeCopy: Record<string, string> = {
  MANUAL_MAGNET: '手动磁力',
  PROWLARR_RELEASE: '发布资源',
}

function isNeedsAttention(status: MagnetIngestTaskStatus) {
  return (
    status === 'FAILED' ||
    status === 'INTERRUPTED' ||
    status === 'PARTIAL_SUCCESS'
  )
}

function formatTime(value: string | null) {
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

function statusTone(status: MagnetIngestTaskStatus) {
  if (status === 'SUCCEEDED') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }
  if (isNeedsAttention(status)) {
    return 'bg-rose-50 text-rose-700 ring-rose-200'
  }
  return 'bg-sky-50 text-sky-700 ring-sky-200'
}

function productTone(productType: OpenListTaskCenterProductType) {
  switch (productType) {
    case 'MOVIE':
      return 'bg-indigo-50 text-indigo-700'
    case 'ANIME':
      return 'bg-fuchsia-50 text-fuchsia-700'
    case 'ADULT':
      return 'bg-rose-50 text-rose-700'
    default:
      return 'bg-cyan-50 text-cyan-700'
  }
}

function sourceLabel(sourceType: string) {
  return sourceTypeCopy[sourceType] ?? sourceType
}

function stageLabel(stage: string) {
  return stageCopy[stage] ?? stage
}

function TaskStat({
  label,
  description,
  tone,
  active,
  onClick,
}: {
  label: string
  description: string
  tone: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-lg border bg-white px-4 py-3 text-left transition-colors',
        active
          ? 'border-primary shadow-shell'
          : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={cn('mt-2 text-sm font-semibold', tone)}>{description}</p>
    </button>
  )
}

function TaskCard({
  item,
  showCreator,
}: {
  item: OpenListTaskCenterItem
  showCreator: boolean
}) {
  const needsAttention = isNeedsAttention(item.status)
  const creatorLabel =
    item.created_by_username ?? `用户 ${item.created_by_user_id ?? '-'}`
  const attemptCount = item.attempt_count ?? 1

  return (
    <article
      className={cn(
        'rounded-lg border bg-white p-5 shadow-shell',
        needsAttention ? 'border-rose-200' : 'border-slate-200',
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-md px-2 py-1 text-xs font-semibold',
                productTone(item.product_type),
              )}
            >
              {productTypeCopy[item.product_type]}
            </span>
            <span
              className={cn(
                'rounded-md px-2 py-1 text-xs font-semibold ring-1',
                statusTone(item.status),
              )}
            >
              {taskStatusCopy[item.status] ?? item.status}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              当前：{sourceLabel(item.source_type)}
            </span>
            {showCreator ? (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                创建者 {creatorLabel}
              </span>
            ) : null}
            {attemptCount > 1 ? (
              <span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                共 {attemptCount} 次尝试
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 truncate text-lg font-semibold text-slate-950">
            {item.title}
          </h2>
          {item.release_title ? (
            <p className="mt-1 truncate text-sm text-slate-500">
              发布：{item.release_title}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3 lg:w-[480px]">
          <div>
            <p className="text-xs font-semibold text-slate-400">阶段</p>
            <p className="mt-1 font-medium text-slate-800">
              {stageLabel(item.stage)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">进度</p>
            <p className="mt-1 font-medium text-slate-800">
              {item.progress_summary}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">更新</p>
            <p className="mt-1 font-medium text-slate-800">
              {formatTime(item.updated_at ?? item.created_at)}
            </p>
          </div>
        </div>

        <Button asChild variant="outline" className="shrink-0 rounded-lg">
          <Link to={item.detail_path} className="inline-flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            查看
          </Link>
        </Button>
      </div>
    </article>
  )
}

export function TaskCenterPage() {
  const { user } = useAuth()
  const [view, setView] = useState<OpenListTaskCenterView>('ALL')
  const [productFilter, setProductFilter] =
    useState<OpenListTaskCenterProductFilter>('ALL')
  const [sourceFilter, setSourceFilter] =
    useState<OpenListTaskCenterSourceFilter>('ALL')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [pageState, setPageState] = useState<PageState>({
    status: 'loading',
    data: null,
    message: null,
  })
  const activeLoadControllerRef = useRef<AbortController | null>(null)
  const latestLoadRequestIdRef = useRef(0)
  const showCreator = user?.role === 'ADMIN'
  const isAdultProductFilter = productFilter === 'ADULT'
  const effectiveProductFilter =
    showCreator || !isAdultProductFilter ? productFilter : 'ALL'
  const effectiveSourceFilter = isAdultProductFilter ? 'ALL' : sourceFilter

  const loadTasks = useCallback(
    async (silent = false) => {
      activeLoadControllerRef.current?.abort()
      const controller = new AbortController()
      activeLoadControllerRef.current = controller
      latestLoadRequestIdRef.current += 1
      const requestId = latestLoadRequestIdRef.current

      setPageState((current) => ({
        status: silent && current.data ? current.status : 'loading',
        data: current.data,
        message: null,
      }))

      try {
        const data = await listOpenListTaskCenterItems(
          {
            view,
            product_type: effectiveProductFilter,
            source_type: effectiveSourceFilter,
            keyword: debouncedSearch,
            page,
            page_size: pageSize,
          },
          controller.signal,
        )
        if (latestLoadRequestIdRef.current !== requestId) {
          return
        }
        setPageState({
          status: data.items.length > 0 ? 'success' : 'empty',
          data,
          message: null,
        })
        setLastUpdatedAt(new Date().toLocaleTimeString('zh-CN'))
        if (data.page !== page) {
          setPage(data.page)
        }
      } catch (error) {
        if (
          isJavaRequestCanceledError(error) ||
          latestLoadRequestIdRef.current !== requestId
        ) {
          return
        }
        setPageState({
          status: 'error',
          data: null,
          message:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : '任务中心加载失败，请稍后重试。',
        })
      } finally {
        if (latestLoadRequestIdRef.current === requestId) {
          activeLoadControllerRef.current = null
        }
      }
    },
    [
      debouncedSearch,
      effectiveProductFilter,
      effectiveSourceFilter,
      page,
      pageSize,
      view,
    ],
  )

  useEffect(() => {
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, pageSize, productFilter, sourceFilter, view])

  useEffect(() => {
    void loadTasks()

    return () => {
      latestLoadRequestIdRef.current += 1
      activeLoadControllerRef.current?.abort()
      activeLoadControllerRef.current = null
    }
  }, [loadTasks])

  const data = pageState.data
  const total = data?.total ?? 0
  const currentPage = data?.page ?? page
  const currentPageSize = data?.page_size ?? pageSize
  const maxPage = Math.max(1, Math.ceil(total / currentPageSize))
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * currentPageSize + 1
  const rangeEnd = Math.min(total, currentPage * currentPageSize)
  const availableProductFilterOptions = showCreator
    ? productFilterOptions
    : productFilterOptions.filter((option) => option.value !== 'ADULT')
  const availableSourceFilterOptions = isAdultProductFilter
    ? sourceFilterOptions.filter((option) => option.value === 'ALL')
    : sourceFilterOptions
  const isLoading = pageState.status === 'loading'
  const controlClassName =
    'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

  useEffect(() => {
    if (!showCreator && productFilter === 'ADULT') {
      setProductFilter('ALL')
    }
  }, [productFilter, showCreator])

  useEffect(() => {
    if (isAdultProductFilter && sourceFilter !== 'ALL') {
      setSourceFilter('ALL')
    }
  }, [isAdultProductFilter, sourceFilter])

  return (
    <PageContainer
      title="任务中心"
      description="统一查看电影、剧集、动漫整季和有权查看的 Adult OpenList 入库任务，按最近更新时间倒序排列。"
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TaskStat
          label="全部任务"
          description="完整列表"
          tone="text-slate-950"
          active={view === 'ALL'}
          onClick={() => setView('ALL')}
        />
        <TaskStat
          label="进行中"
          description="正在执行"
          tone="text-sky-700"
          active={view === 'IN_PROGRESS'}
          onClick={() => setView('IN_PROGRESS')}
        />
        <TaskStat
          label="需要处理"
          description="失败或中断"
          tone="text-rose-700"
          active={view === 'NEEDS_ATTENTION'}
          onClick={() => setView('NEEDS_ATTENTION')}
        />
        <TaskStat
          label="已完成"
          description="成功完成"
          tone="text-emerald-700"
          active={view === 'SUCCEEDED'}
          onClick={() => setView('SUCCEEDED')}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(150px,180px)_minmax(170px,200px)_minmax(96px,120px)]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索标题、发布标题或 magnet hash"
                className={cn(controlClassName, 'w-full pl-9')}
              />
            </label>
            <SelectControl
              value={productFilter}
              onChange={(event) => {
                const nextProductFilter = event.target
                  .value as OpenListTaskCenterProductFilter
                setProductFilter(nextProductFilter)
                if (nextProductFilter === 'ADULT') {
                  setSourceFilter('ALL')
                }
              }}
              leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
              className="rounded-lg bg-white text-slate-700 shadow-none"
            >
              {availableProductFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(
                  event.target.value as OpenListTaskCenterSourceFilter,
                )
              }
              disabled={isAdultProductFilter}
              className="rounded-lg bg-white text-slate-700 shadow-none"
            >
              {availableSourceFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded-lg bg-white text-slate-700 shadow-none"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} 条
                </option>
              ))}
            </SelectControl>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => void loadTasks()}
            className="rounded-lg"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : pageState.status === 'error' ? (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            ) : view === 'NEEDS_ATTENTION' ? (
              <Clock3 className="h-4 w-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            <span>
              {pageState.status === 'error'
                ? pageState.message
                : `当前视图 ${total} 条，可手动刷新获取最新状态。`}
            </span>
          </div>
          {lastUpdatedAt ? (
            <p className="text-sm text-slate-500">上次更新 {lastUpdatedAt}</p>
          ) : null}
        </div>
      </section>

      {pageState.status === 'empty' ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white px-8 py-12">
          <p className="text-lg font-semibold text-slate-950">暂无匹配任务</p>
          <p className="mt-2 text-sm text-slate-500">
            调整视图、类别、来源或关键词后再查看；新建入库任务也会自动出现在这里。
          </p>
        </section>
      ) : null}

      {pageState.status === 'success' && data ? (
        <>
          <section className="space-y-3">
            {data.items.map((item) => (
              <TaskCard
                key={`${item.task_type}:${item.id}`}
                item={item}
                showCreator={showCreator}
              />
            ))}
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              显示 {rangeStart}-{rangeEnd} / {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="min-w-20 text-center text-sm font-medium text-slate-700">
                {currentPage} / {maxPage}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= maxPage || isLoading}
                onClick={() =>
                  setPage((current) => Math.min(maxPage, current + 1))
                }
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </PageContainer>
  )
}
