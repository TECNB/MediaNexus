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

import { Button } from '@/components/ui/button'
import { SelectControl } from '@/components/ui/form-control'
import { listQuarkTaskCenterItems } from '@/lib/api/task-center'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type {
  QuarkTaskCenterItem,
  QuarkTaskCenterListData,
  QuarkTaskCenterListParams,
  QuarkTaskCenterProductType,
  QuarkTaskCenterSubscriptionFilter,
  QuarkTaskCenterView,
} from '@/types/quark-task-center'

type PageState = {
  status: 'loading' | 'success' | 'empty' | 'error'
  data: QuarkTaskCenterListData | null
  message: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const productCopy: Record<QuarkTaskCenterProductType, string> = {
  MOVIE: '电影',
  SERIES: '剧集',
  VARIETY: '综艺',
}

const sourceCopy: Record<string, string> = {
  MANUAL_QUARK: '手动链接',
  PANSOU_SEARCH: '资源搜索',
}

const statusCopy: Record<string, string> = {
  IN_PROGRESS: '进行中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
  PARTIAL_SUCCESS: '部分完成',
  UNKNOWN: '状态未知',
  INTERRUPTED: '已中断',
}

const stageCopy: Record<string, string> = {
  created: '任务创建',
  queued: '排队中',
  processing: '处理中',
  submitted: '已提交处理',
  completed: '完成收束',
  failed: '失败收束',
}

function formatTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isAttention(status: string) {
  return ['FAILED', 'PARTIAL_SUCCESS', 'UNKNOWN', 'INTERRUPTED'].includes(status)
}

function statusTone(status: string) {
  if (status === 'SUCCEEDED') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (isAttention(status)) return 'bg-rose-50 text-rose-700 ring-rose-200'
  return 'bg-sky-50 text-sky-700 ring-sky-200'
}

function productTone(product: QuarkTaskCenterProductType) {
  return product === 'MOVIE'
    ? 'bg-indigo-50 text-indigo-700'
    : product === 'VARIETY'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-cyan-50 text-cyan-700'
}

function QuarkTaskCard({ item, showCreator }: { item: QuarkTaskCenterItem; showCreator: boolean }) {
  const attention = isAttention(item.status)
  return (
    <article className={cn('rounded-lg border bg-white p-5 shadow-shell', attention ? 'border-rose-200' : 'border-slate-200')}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-md px-2 py-1 text-xs font-semibold', productTone(item.product_type))}>
              {productCopy[item.product_type] ?? item.product_type}
            </span>
            <span className={cn('rounded-md px-2 py-1 text-xs font-semibold ring-1', statusTone(item.status))}>
              {statusCopy[item.status] ?? item.status}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {sourceCopy[item.source_type] ?? item.source_type}
            </span>
            <span className={cn('rounded-md px-2 py-1 text-xs font-semibold', item.subscription_enabled ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500')}>
              {item.subscription_enabled ? '自动更新' : '一次性入库'}
            </span>
            {showCreator && item.created_by_username ? (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                创建者 {item.created_by_username}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 truncate text-lg font-semibold text-slate-950">{item.title}</h2>
        </div>

        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3 lg:w-[520px]">
          <div>
            <p className="text-xs font-semibold text-slate-400">阶段</p>
            <p className="mt-1 font-medium text-slate-800">{stageCopy[item.stage] ?? item.stage}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">进度</p>
            <p className="mt-1 font-medium text-slate-800">{item.progress_summary}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">更新</p>
            <p className="mt-1 font-medium text-slate-800">{formatTime(item.updated_at ?? item.created_at)}</p>
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

export function QuarkTaskCenterPanel({ showCreator = false }: { showCreator?: boolean }) {
  const [view, setView] = useState<QuarkTaskCenterView>('ALL')
  const [productType, setProductType] = useState<QuarkTaskCenterListParams['product_type']>('ALL')
  const [sourceType, setSourceType] = useState<QuarkTaskCenterListParams['source_type']>('ALL')
  const [subscription, setSubscription] = useState<QuarkTaskCenterSubscriptionFilter>('ALL')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [pageState, setPageState] = useState<PageState>({ status: 'loading', data: null, message: null })
  const controllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const loadTasks = useCallback(async (silent = false) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const requestId = ++requestIdRef.current
    setPageState((current) => ({
      status: silent && current.data ? current.status : 'loading',
      data: current.data,
      message: null,
    }))
    try {
      const data = await listQuarkTaskCenterItems({
        view,
        product_type: productType,
        source_type: sourceType,
        subscription,
        keyword: debouncedSearch,
        page,
        page_size: pageSize,
      }, controller.signal)
      if (requestIdRef.current !== requestId) return
      setPageState({ status: data.items.length > 0 ? 'success' : 'empty', data, message: null })
      setLastUpdatedAt(new Date().toLocaleTimeString('zh-CN'))
      if (data.page !== page) setPage(data.page)
    } catch (error) {
      if (isJavaRequestCanceledError(error) || requestIdRef.current !== requestId) return
      setPageState({
        status: 'error',
        data: null,
        message: error instanceof Error && error.message.trim() ? error.message : 'Quark 入库任务加载失败，请稍后重试。',
      })
    } finally {
      if (requestIdRef.current === requestId) controllerRef.current = null
    }
  }, [debouncedSearch, page, pageSize, productType, sourceType, subscription, view])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, pageSize, productType, sourceType, subscription, view])

  useEffect(() => {
    void loadTasks()
    return () => {
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [loadTasks])

  const data = pageState.data
  const total = data?.total ?? 0
  const currentPage = data?.page ?? page
  const currentPageSize = data?.page_size ?? pageSize
  const maxPage = Math.max(1, Math.ceil(total / currentPageSize))
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * currentPageSize + 1
  const rangeEnd = Math.min(total, currentPage * currentPageSize)
  const isLoading = pageState.status === 'loading'
  const controlClassName = 'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['ALL', '全部任务', '完整列表', 'text-slate-950'],
          ['IN_PROGRESS', '进行中', '正在执行', 'text-sky-700'],
          ['NEEDS_ATTENTION', '需要处理', '失败或中断', 'text-rose-700'],
          ['SUCCEEDED', '已完成', '成功完成', 'text-emerald-700'],
        ].map(([value, label, description, tone]) => (
          <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value as QuarkTaskCenterView)} className={cn('rounded-lg border bg-white px-4 py-3 text-left transition-colors', view === value ? 'border-primary shadow-shell' : 'border-slate-200 hover:border-slate-300')}>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className={cn('mt-2 text-sm font-semibold', tone)}>{description}</p>
          </button>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(140px,180px)_minmax(140px,180px)_minmax(140px,180px)_minmax(96px,120px)]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索任务标题" className={cn(controlClassName, 'w-full pl-9')} />
            </label>
            <SelectControl value={productType} onChange={(event) => setProductType(event.target.value as QuarkTaskCenterListParams['product_type'])} leadingIcon={<SlidersHorizontal className="h-4 w-4" />} className="rounded-lg bg-white text-slate-700 shadow-none">
              <option value="ALL">全部类别</option>
              <option value="MOVIE">电影</option>
              <option value="SERIES">剧集</option>
              <option value="VARIETY">综艺</option>
            </SelectControl>
            <SelectControl value={sourceType} onChange={(event) => setSourceType(event.target.value as QuarkTaskCenterListParams['source_type'])} className="rounded-lg bg-white text-slate-700 shadow-none">
              <option value="ALL">全部来源</option>
              <option value="MANUAL_QUARK">手动链接</option>
              <option value="PANSOU_SEARCH">资源搜索</option>
            </SelectControl>
            <SelectControl value={subscription} onChange={(event) => setSubscription(event.target.value as QuarkTaskCenterSubscriptionFilter)} className="rounded-lg bg-white text-slate-700 shadow-none">
              <option value="ALL">全部执行方式</option>
              <option value="SUBSCRIBED">自动更新</option>
              <option value="ONE_TIME">一次性入库</option>
            </SelectControl>
            <SelectControl value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg bg-white text-slate-700 shadow-none">
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option} 条</option>)}
            </SelectControl>
          </div>
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => void loadTasks()} className="rounded-lg">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : pageState.status === 'error' ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : view === 'NEEDS_ATTENTION' ? <Clock3 className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            <span>{pageState.status === 'error' ? pageState.message : `当前视图 ${total} 条，可手动刷新获取最新状态。`}</span>
          </div>
          {lastUpdatedAt ? <p className="text-sm text-slate-500">上次更新 {lastUpdatedAt}</p> : null}
        </div>
      </section>

      {pageState.status === 'empty' ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white px-8 py-12">
          <p className="text-lg font-semibold text-slate-950">暂无匹配 Quark 入库任务</p>
          <p className="mt-2 text-sm text-slate-500">调整视图、类别、来源或关键词后再查看。</p>
        </section>
      ) : null}

      {pageState.status === 'success' && data ? (
        <>
          <section className="space-y-3">
            {data.items.map((item) => <QuarkTaskCard key={item.id} item={item} showCreator={showCreator} />)}
          </section>
          <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">显示 {rangeStart}-{rangeEnd} / {total}</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" />上一页</Button>
              <span className="min-w-20 text-center text-sm font-medium text-slate-700">{currentPage} / {maxPage}</span>
              <Button type="button" variant="outline" size="sm" disabled={currentPage >= maxPage || isLoading} onClick={() => setPage((current) => Math.min(maxPage, current + 1))}>下一页<ChevronRight className="h-4 w-4" /></Button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
