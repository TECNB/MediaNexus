import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Activity,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  Disc3,
  Film,
  ImageOff,
  LibraryBig,
  Loader2,
  Mic2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tv,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  getMediaDeletions,
  getMediaLibraryItems,
  getMediaLibraryPoster,
  searchMediaLibrarySyncTargets,
  syncMediaLibrary,
} from '@/lib/api/media-library'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { useAuth } from '@/lib/use-auth'
import { cn } from '@/lib/utils'
import type {
  MediaLibraryId,
  MediaLibraryItem,
  MediaLibraryPageData,
  MediaDeletionTask,
  MediaLibrarySyncTarget,
} from '@/types/media-library'
import {
  DeletionProgress,
  DeletionTaskList,
  MediaDeletionManager,
} from './media-deletion'
import { MediaManager } from './media-manager'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

type LibraryTab = {
  id: MediaLibraryId
  label: string
  icon: LucideIcon
}

const PAGE_SIZE = 24

const libraryTabs: LibraryTab[] = [
  { id: 'movies', label: '电影', icon: Film },
  { id: 'tv', label: '电视剧', icon: Tv },
  { id: 'variety', label: '综艺', icon: Mic2 },
  { id: 'anime', label: '动漫', icon: Sparkles },
  {
    id: 'adult-other',
    label: 'Adult - Other',
    icon: Clapperboard,
  },
  { id: 'adult-jav', label: 'Adult-JAV', icon: Disc3 },
]

function formatDateTime(value: string | null) {
  if (!value) {
    return '时间未知'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function ForbiddenMediaLibraryPage() {
  const navigate = useNavigate()

  return (
    <PageContainer title="无权限" description="媒体库内容仅管理员可见。">
      <div className="rounded-2xl bg-white p-8 shadow-shell ring-1 ring-slate-200">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-slate-950">
                你没有访问媒体库的权限
              </p>
              <p className="mt-1 text-sm text-slate-500">
                该页面仅供管理员查看 Emby 中已有的媒体。
              </p>
            </div>
            <Button onClick={() => navigate('/resources')} type="button">
              返回资源搜索
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

function Poster({ item }: { item: MediaLibraryItem }) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null

    setPosterUrl(null)
    setFailed(false)

    if (!item.has_primary_image) {
      setFailed(true)
      return () => controller.abort()
    }

    void getMediaLibraryPoster(item.item_id, controller.signal, item.primary_image_tag)
      .then((blob) => {
        if (controller.signal.aborted || blob.size === 0) {
          if (!controller.signal.aborted) {
            setFailed(true)
          }
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setPosterUrl(objectUrl)
      })
      .catch((error: unknown) => {
        if (!isJavaRequestCanceledError(error)) {
          setFailed(true)
        }
      })

    return () => {
      controller.abort()
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [item.has_primary_image, item.item_id, item.primary_image_tag])

  if (!posterUrl || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 px-5 text-center text-slate-400">
        {failed ? (
          <ImageOff className="h-8 w-8" strokeWidth={1.6} />
        ) : (
          <Loader2 className="h-7 w-7 animate-spin" strokeWidth={1.8} />
        )}
        <span className="text-xs font-medium">
          {failed ? '暂无封面' : '加载封面'}
        </span>
      </div>
    )
  }

  return (
    <img
      alt={`${item.title} 封面`}
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => {
        URL.revokeObjectURL(posterUrl)
        setPosterUrl(null)
        setFailed(true)
      }}
      src={posterUrl}
    />
  )
}

function MediaCard({
  item,
  library,
  onChanged,
  deletionTask,
  onDeletionCreated,
}: {
  item: MediaLibraryItem
  library: MediaLibraryId
  onChanged: (item: MediaLibraryItem) => void
  deletionTask?: MediaDeletionTask
  onDeletionCreated: (task: MediaDeletionTask) => void
}) {
  const deleting = deletionTask && deletionTask.status !== 'SUCCEEDED'
  const collection = item.type === 'BoxSet'
  return (
    <article className={cn(
      'min-w-0 overflow-hidden rounded-2xl bg-white shadow-shell ring-1',
      deletionTask?.status === 'FAILED' ? 'ring-rose-200' : 'ring-slate-200',
    )}>
      <div className={cn('relative aspect-[2/3] overflow-hidden bg-slate-100', deleting && 'opacity-60')}>
        <Poster item={item} />
        {deleting ? <span className={cn(
          'absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm',
          deletionTask.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800',
        )}>{deletionTask.status === 'FAILED' ? '删除需处理' : '正在删除'}</span> : null}
      </div>
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-950" title={item.title}>
            {item.title}
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {collection ? '合集' : item.year ?? '年份未知'}
          </p>
        </div>
        <div className="flex items-start gap-2 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>入库于 {formatDateTime(item.date_created)}</span>
        </div>
        {deleting ? <DeletionProgress task={deletionTask} /> : (
          <>
            {!collection ? <MediaManager item={item} library={library} onChanged={onChanged} /> : null}
            <MediaDeletionManager item={item} library={library} onCreated={onDeletionCreated} />
          </>
        )}
      </div>
    </article>
  )
}

function LoadingGrid() {
  return (
    <div
      aria-label="正在加载媒体库"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      role="status"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div
          className="overflow-hidden rounded-2xl bg-white shadow-shell ring-1 ring-slate-200"
          key={index}
        >
          <div className="aspect-[2/3] animate-pulse bg-slate-200" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-px bg-slate-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MediaLibraryPageContent() {
  const [libraryId, setLibraryId] = useState<MediaLibraryId>('movies')
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [missingPoster, setMissingPoster] = useState(false)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<MediaLibraryPageData | null>(null)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [targetQuery, setTargetQuery] = useState('')
  const [targetSuggestions, setTargetSuggestions] = useState<MediaLibrarySyncTarget[]>([])
  const [selectedTargets, setSelectedTargets] = useState<MediaLibrarySyncTarget[]>([])
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [deletionTasks, setDeletionTasks] = useState<MediaDeletionTask[]>([])
  const deletionDialogRef = useRef<HTMLDialogElement>(null)
  const completedTaskIds = useRef(new Set<string>())
  const deletionTasksBaselineReady = useRef(false)

  const activeLibrary = useMemo(
    () => libraryTabs.find((tab) => tab.id === libraryId) ?? libraryTabs[0],
    [libraryId],
  )

  const loadItems = useCallback(
    async (signal?: AbortSignal) => {
      setStatus('loading')
      setErrorMessage(null)
      setData(null)

      try {
        const nextData = await getMediaLibraryItems(
          {
            library: libraryId,
            page,
            page_size: PAGE_SIZE,
            search: keyword,
            missing_poster: missingPoster,
          },
          signal,
        )
        setData(nextData)
        setStatus('success')
      } catch (error) {
        if (isJavaRequestCanceledError(error)) {
          return
        }
        setStatus('error')
        setErrorMessage(
          error instanceof Error
            ? error.message
            : '媒体库加载失败，请稍后重试。',
        )
      }
    },
    [keyword, libraryId, missingPoster, page],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadItems(controller.signal)

    return () => controller.abort()
  }, [loadItems])

  useEffect(() => {
    const query = targetQuery.trim()
    if (query.length < 2) {
      setTargetSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void searchMediaLibrarySyncTargets(libraryId, query, controller.signal)
        .then((targets) => setTargetSuggestions(targets.filter(
          (target) => !selectedTargets.some((selected) => selected.path === target.path),
        )))
        .catch((error) => {
          if (!isJavaRequestCanceledError(error)) setTargetSuggestions([])
        })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [libraryId, selectedTargets, targetQuery])

  const loadDeletions = useCallback(async (signal?: AbortSignal) => {
    try {
      const tasks = await getMediaDeletions(signal)
      const newlyCompleted = deletionTasksBaselineReady.current && tasks.some((task) => {
        if (task.status !== 'SUCCEEDED' || completedTaskIds.current.has(task.id)) return false
        completedTaskIds.current.add(task.id)
        return true
      })
      tasks.forEach((task) => {
        if (task.status === 'SUCCEEDED') completedTaskIds.current.add(task.id)
      })
      deletionTasksBaselineReady.current = true
      setDeletionTasks(tasks)
      if (newlyCompleted) void loadItems()
    } catch (error) {
      if (!isJavaRequestCanceledError(error)) console.warn('删除任务加载失败', error)
    }
  }, [loadItems])

  useEffect(() => {
    const controller = new AbortController()
    void loadDeletions(controller.signal)
    const interval = window.setInterval(() => void loadDeletions(), 3000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [loadDeletions])

  const updateDeletionTask = useCallback((task: MediaDeletionTask) => {
    setDeletionTasks((current) => [task, ...current.filter((value) => value.id !== task.id)])
  }, [])

  const total = data?.total ?? 0
  const responsePageSize = data?.page_size || PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / responsePageSize))
  const pageStart = total === 0 ? 0 : (page - 1) * responsePageSize + 1
  const pageEnd = Math.min(total, page * responsePageSize)

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextKeyword = searchInput.trim()
    setPage(1)
    setKeyword(nextKeyword)
  }

  function clearSearch() {
    setSearchInput('')
    setKeyword('')
    setPage(1)
  }

  async function handleSync() {
    if (!window.confirm('将检查网盘中已删除的媒体，并清理本地失效记录。不会删除网盘内容。确定继续吗？')) {
      return
    }
    setSyncing(true)
    const deepSync = selectedTargets.length > 0
    setSyncMessage(deepSync ? `正在深度检查 ${selectedTargets.length} 个指定目标，请稍候…` : '正在检查媒体库根目录，请稍候…')
    try {
      const result = await syncMediaLibrary(libraryId, deepSync, selectedTargets.map((target) => target.path))
      const checked = deepSync ? `${result.checked_files} 个文件` : `${result.checked_directories} 个目录`
      await loadItems()
      const removedMedia = result.removed_media ?? []
      const skippedMedia = result.skipped_media ?? []
      const failedMedia = result.failed_media ?? []
      const detailLines = [
        removedMedia.length > 0 ? `已清理：${removedMedia.join('、')}${result.removed_directories > removedMedia.length ? ` 等 ${result.removed_directories} 个媒体目录` : ''}` : '',
        skippedMedia.length > 0 ? `已跳过：${skippedMedia.join('、')}${result.skipped_items > skippedMedia.length ? ` 等 ${result.skipped_items} 项` : ''}` : '',
        failedMedia.length > 0 ? `检查失败：${failedMedia.join('、')}${result.error_count > failedMedia.length ? ` 等 ${result.error_count} 项` : ''}` : '',
      ].filter(Boolean)
      const summary = result.removed_items > 0
        ? `媒体库同步完成：检查 ${checked}，清理 ${result.removed_media?.length ?? result.removed_items} 个失效媒体`
        : `媒体库同步完成：检查 ${checked}，未发现已删除媒体`
      setSyncMessage([summary, ...detailLines].join('\n'))
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : '媒体库同步失败，请稍后重试。')
    } finally {
      setSyncing(false)
    }
  }

  const handleItemChanged = useCallback(
    (updatedItem: MediaLibraryItem) => {
      setData((current) => {
        if (!current?.items.some((item) => item.item_id === updatedItem.item_id)) {
          return current
        }

        const matchesSearch = !keyword || updatedItem.title
          .toLocaleLowerCase()
          .includes(keyword.toLocaleLowerCase())
        const remainsVisible = matchesSearch
          && (!missingPoster || !updatedItem.has_primary_image)

        return {
          ...current,
          items: remainsVisible
            ? current.items.map((item) =>
                item.item_id === updatedItem.item_id ? updatedItem : item,
              )
            : current.items.filter((item) => item.item_id !== updatedItem.item_id),
          total: remainsVisible ? current.total : Math.max(0, current.total - 1),
        }
      })
    },
    [keyword, missingPoster],
  )

  return (
    <PageContainer
      title="媒体库"
      description="查看和管理 Emby 中已有的电影、电视剧、综艺、动漫与 Adult 媒体。内容按最近入库时间排序。"
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-white p-3 shadow-shell ring-1 ring-slate-200">
          <div className="flex flex-col gap-3">
            <div
              aria-label="媒体库分类"
              className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 md:grid-cols-3 xl:grid-cols-6"
              role="tablist"
            >
              {libraryTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = tab.id === libraryId
                return (
                  <button
                    aria-selected={isActive}
                    className={cn(
                      'flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900',
                    )}
                    key={tab.id}
                    onClick={() => {
                      setLibraryId(tab.id)
                      setPage(1)
                      setTargetQuery('')
                      setTargetSuggestions([])
                      setSelectedTargets([])
                    }}
                    role="tab"
                    type="button"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <RefreshCw className="h-4 w-4 text-slate-500" />
                    同步媒体库
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    检查网盘中已删除的媒体，并清理本地失效记录；不会删除网盘内容。
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
                  <Button disabled={syncing} onClick={() => void handleSync()} type="button">
                    <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
                    {syncing ? '正在同步' : '开始同步'}
                  </Button>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <label className="text-sm font-medium text-slate-800" htmlFor="deep-sync-target">
                  指定深度检查目标
                </label>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  默认只检查媒体库根目录；搜索并选择文件或文件夹后，才会深入检查所选目标。
                </p>
                <div className="relative mt-3">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    aria-label="搜索深度检查目标"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    disabled={syncing}
                    id="deep-sync-target"
                    onChange={(event) => setTargetQuery(event.target.value)}
                    placeholder="输入动漫名、文件夹名或文件名，例如：擅长捉弄"
                    value={targetQuery}
                  />
                  {targetSuggestions.length > 0 ? (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {targetSuggestions.map((target) => (
                        <button
                          className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                          key={target.path}
                          onClick={() => {
                            setSelectedTargets((current) => [...current, target])
                            setTargetQuery('')
                            setTargetSuggestions([])
                          }}
                          type="button"
                        >
                          <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                            {target.target_type === 'folder' ? '文件夹' : '文件'}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-800">{target.label}</span>
                            <span className="block truncate text-xs text-slate-400">{target.path}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {selectedTargets.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTargets.map((target) => (
                      <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white" key={target.path}>
                        <span className="max-w-[min(70vw,28rem)] truncate">{target.label}</span>
                        <button
                          aria-label={`移除深度检查目标 ${target.label}`}
                          className="rounded-full text-slate-300 hover:text-white"
                          onClick={() => setSelectedTargets((current) => current.filter((item) => item.path !== target.path))}
                          type="button"
                        >
                          <X aria-hidden="true" className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {syncMessage ? (
                <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600" role="status">
                  <span className="whitespace-pre-line">{syncMessage}</span>
                </p>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <button
                className="relative flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-300"
                onClick={() => deletionDialogRef.current?.showModal()}
                type="button"
              >
                <Activity aria-hidden="true" className="h-4 w-4" />删除任务
                {deletionTasks.some((task) => task.status === 'PENDING' || task.status === 'RUNNING') ? (
                  <span className="rounded-full bg-amber-100 px-1.5 text-[0.6875rem] font-semibold text-amber-800" role="status" aria-atomic="true">
                    {deletionTasks.filter((task) => task.status === 'PENDING' || task.status === 'RUNNING').length}
                  </span>
                ) : null}
              </button>
              <button
                aria-pressed={missingPoster}
                className={cn(
                  'flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-slate-300',
                  missingPoster
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
                )}
                onClick={() => {
                  setMissingPoster((value) => !value)
                  setPage(1)
                }}
                type="button"
              >
                <ImageOff aria-hidden="true" className="h-4 w-4" />
                只看无封面
              </button>
              <form className="flex min-w-0 flex-1 gap-2" onSubmit={handleSearch}>
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">按标题搜索</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/70"
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={`搜索${activeLibrary.label}标题`}
                    type="search"
                    value={searchInput}
                  />
                  {searchInput ? (
                    <button
                      aria-label="清除搜索"
                      className="absolute right-2 top-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      onClick={clearSearch}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </label>
                <Button type="submit">搜索</Button>
              </form>
            </div>
          </div>
        </div>


        {keyword && status !== 'loading' ? (
          <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
            <p className="truncate">
              “<span className="font-medium text-slate-800">{keyword}</span>”
              的搜索结果
            </p>
            <button
              className="shrink-0 font-medium text-slate-700 hover:text-slate-950"
              onClick={clearSearch}
              type="button"
            >
              查看全部
            </button>
          </div>
        ) : null}

        {status === 'loading' ? <LoadingGrid /> : null}

        {status === 'error' ? (
          <div
            className="rounded-2xl bg-white px-6 py-12 text-center shadow-shell ring-1 ring-rose-100"
            role="alert"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-950">
              无法加载媒体库
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {errorMessage}
            </p>
            <Button
              className="mt-5"
              onClick={() => void loadItems()}
              type="button"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              重新加载
            </Button>
          </div>
        ) : null}

        {status === 'success' && data && data.items.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-shell ring-1 ring-slate-200">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <LibraryBig className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-950">
              {keyword
                ? '没有匹配的媒体'
                : missingPoster
                  ? '没有无封面的媒体'
                  : `${activeLibrary.label}库暂无内容`}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {keyword
                ? '可以尝试更短的标题关键词，或清除搜索查看全部内容。'
                : missingPoster
                  ? '当前分类中的作品都已经有主封面。'
                : 'Emby 中出现对应媒体后，这里会自动展示。'}
            </p>
            {keyword || missingPoster ? (
              <Button
                className="mt-5"
                onClick={() => {
                  if (keyword) {
                    clearSearch()
                  } else {
                    setMissingPoster(false)
                    setPage(1)
                  }
                }}
                type="button"
                variant="outline"
              >
                {keyword ? '清除搜索' : '查看全部媒体'}
              </Button>
            ) : null}
          </div>
        ) : null}

        {status === 'success' && data && data.items.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                共 <span className="font-semibold text-slate-800">{total}</span>{' '}
                项，当前显示 {pageStart}–{pageEnd}
              </p>
              <p className="hidden text-xs text-slate-400 sm:block">
                按 Emby 入库时间倒序
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {data.items.map((item) => (
                <MediaCard
                  deletionTask={deletionTasks.find((task) => task.item_id === item.item_id && task.status !== 'SUCCEEDED')}
                  item={item}
                  key={item.item_id}
                  library={libraryId}
                  onChanged={handleItemChanged}
                  onDeletionCreated={updateDeletionTask}
                />
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-shell ring-1 ring-slate-200 sm:flex-row">
              <p className="text-sm text-slate-500">
                第 <span className="font-semibold text-slate-800">{page}</span>{' '}
                / {totalPages} 页 · 每页 {responsePageSize} 项
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>
                <Button
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
      <dialog
        aria-labelledby="deletion-tasks-title"
        className="m-auto max-h-[92vh] w-[min(36rem,calc(100%-1.5rem))] overflow-hidden rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/55"
        ref={deletionDialogRef}
      >
        <div className="flex max-h-[92vh] flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><h2 className="text-lg font-semibold" id="deletion-tasks-title">删除任务</h2><p className="mt-1 text-sm text-slate-500">真实文件、本地索引与 Emby 同步状态</p></div>
            <button aria-label="关闭删除任务" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400" onClick={() => deletionDialogRef.current?.close()} type="button"><X aria-hidden="true" className="h-5 w-5" /></button>
          </header>
          <div className="overflow-y-auto p-5"><DeletionTaskList onChanged={updateDeletionTask} tasks={deletionTasks} /></div>
        </div>
      </dialog>
    </PageContainer>
  )
}

export function MediaLibraryPage() {
  const { user } = useAuth()

  if (user?.role !== 'ADMIN') {
    return <ForbiddenMediaLibraryPage />
  }

  return <MediaLibraryPageContent />
}
