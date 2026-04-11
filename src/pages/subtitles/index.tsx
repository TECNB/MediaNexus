import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import {
  ChevronRight,
  FileText,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  isRequestCanceledError,
  searchMovies,
  searchSeries,
} from '@/lib/api/resources'
import { cn } from '@/lib/utils'
import type { MovieSearchItem, SeriesSearchItem } from '@/types/resources'

type ProcessStatus = 'mounted' | 'matching' | 'failed'
type AssociationStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

type RecentProcessRecord = {
  fileName: string
  language: string
  project: string
  status: ProcessStatus
  time: string
}

type LogTone = 'default' | 'muted' | 'success' | 'warning' | 'info'

type SystemLogRecord = {
  timestamp: string
  message: string
  tone?: LogTone
}

type SubtitleAssociationItem = {
  id: string
  title: string
  originalTitle?: string
  year?: number
  poster?: string
  mediaType: 'movie' | 'series'
  subtitle: string
}

const demoToastMessage = '演示模式：当前仅展示前端搜索与选择交互'

const recentProcesses: RecentProcessRecord[] = [
  {
    fileName: 'Dune.Part.Two.2024.srt',
    language: '简体中文',
    project: '沙丘：第二部 (2024)',
    status: 'mounted',
    time: '2分钟前',
  },
  {
    fileName: 'Poor.Things.2023.ass',
    language: '繁体中文',
    project: '可怜的东西 (2023)',
    status: 'mounted',
    time: '15分钟前',
  },
  {
    fileName: 'Godzilla.Minus.One.srt',
    language: '英语',
    project: '哥斯拉-1.0 (2023)',
    status: 'matching',
    time: '1小时前',
  },
  {
    fileName: 'All.of.Us.Strangers.2023.zip',
    language: '双语',
    project: '我们同在陌生人中 (2023)',
    status: 'failed',
    time: '今天 09:24',
  },
]

const systemLogs: SystemLogRecord[] = [
  { timestamp: '14:22:10', message: 'Worker initialized.', tone: 'muted' },
  {
    timestamp: '14:22:12',
    message: 'Found: archive_4421.zip',
    tone: 'success',
  },
  { timestamp: '14:22:13', message: 'Unzipping contents...' },
  {
    timestamp: '14:22:14',
    message: 'Processing: Dune.Part.2.Chs.srt',
    tone: 'muted',
  },
  { timestamp: '14:22:14', message: 'Mapping to STRM directory...' },
  {
    timestamp: '14:22:15',
    message: 'Target: /media/movies/Dune 2 (2024)/',
    tone: 'info',
  },
  { timestamp: '14:22:16', message: 'SUCCESS: Mounted.', tone: 'success' },
  { timestamp: '14:25:01', message: 'Watching file system...', tone: 'muted' },
  {
    timestamp: '14:28:44',
    message: "WARN: Ambiguous match 'Godzilla'",
    tone: 'warning',
  },
  {
    timestamp: '14:28:45',
    message: 'Auto-resolving to 2023 release...',
    tone: 'default',
  },
]

const processStatusMeta: Record<
  ProcessStatus,
  {
    label: string
    badgeClassName: string
    dotClassName: string
  }
> = {
  mounted: {
    label: '已挂载',
    badgeClassName: 'bg-emerald-50 text-emerald-700',
    dotClassName: 'bg-emerald-500',
  },
  matching: {
    label: '匹配中',
    badgeClassName: 'bg-amber-50 text-amber-700',
    dotClassName: 'bg-amber-500',
  },
  failed: {
    label: '失败',
    badgeClassName: 'bg-rose-50 text-rose-700',
    dotClassName: 'bg-rose-500',
  },
}

const logToneClassName: Record<LogTone, string> = {
  default: 'text-zinc-300',
  muted: 'text-zinc-500',
  success: 'text-emerald-400/85',
  warning: 'text-amber-400/85',
  info: 'text-sky-400/85',
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`
  }

  return `${size} B`
}

function buildAssociationSubtitle({
  title,
  originalTitle,
  year,
  mediaType,
}: {
  title: string
  originalTitle?: string | null
  year?: number | null
  mediaType: SubtitleAssociationItem['mediaType']
}) {
  const parts = [
    originalTitle?.trim() && originalTitle.trim() !== title.trim()
      ? originalTitle.trim()
      : null,
    typeof year === 'number' ? String(year) : null,
    mediaType === 'movie' ? '电影' : '电视剧',
  ].filter(Boolean)

  return parts.join(' · ')
}

function normalizeMovieAssociationItem(
  item: MovieSearchItem,
): SubtitleAssociationItem {
  return {
    id: item.id,
    title: item.title,
    originalTitle: item.original_title?.trim() || undefined,
    year: item.year ?? undefined,
    poster: item.poster?.trim() || undefined,
    mediaType: 'movie',
    subtitle: buildAssociationSubtitle({
      title: item.title,
      originalTitle: item.original_title,
      year: item.year,
      mediaType: 'movie',
    }),
  }
}

function normalizeSeriesAssociationItem(
  item: SeriesSearchItem,
): SubtitleAssociationItem {
  return {
    id: item.id,
    title: item.title,
    originalTitle: item.original_title?.trim() || undefined,
    year: item.year ?? undefined,
    poster: item.poster?.trim() || undefined,
    mediaType: 'series',
    subtitle: buildAssociationSubtitle({
      title: item.title,
      originalTitle: item.original_title,
      year: item.year,
      mediaType: 'series',
    }),
  }
}

async function searchAssociationItems(
  term: string,
  signal?: AbortSignal,
): Promise<SubtitleAssociationItem[]> {
  const [movies, series] = await Promise.all([
    searchMovies(term, signal),
    searchSeries(term, signal),
  ])

  return [
    ...movies.map(normalizeMovieAssociationItem),
    ...series.map(normalizeSeriesAssociationItem),
  ].slice(0, 5)
}

function PosterPlaceholder({
  mediaType,
}: {
  mediaType: SubtitleAssociationItem['mediaType']
}) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-[10px] border border-slate-200 bg-[linear-gradient(180deg,#f4f6f8_0%,#eef2f6_100%)]',
        mediaType === 'movie' ? 'h-12 w-8' : 'h-10 w-10 rounded-[12px]',
      )}
    >
      <div className="absolute inset-x-1.5 top-1.5 h-1 rounded-full bg-white/80" />
      <div className="absolute inset-x-1.5 top-4 h-5 rounded-[6px] bg-white/45" />
      <div className="absolute inset-x-2 bottom-1.5 h-1 rounded-full bg-white/70" />
    </div>
  )
}

function AssociationPoster({ item }: { item: SubtitleAssociationItem }) {
  const [hasImageError, setHasImageError] = useState(false)
  const posterSrc = item.poster?.trim()

  if (!posterSrc || hasImageError) {
    return <PosterPlaceholder mediaType={item.mediaType} />
  }

  return (
    <img
      src={posterSrc}
      alt={item.title}
      loading="lazy"
      className={cn(
        'shrink-0 overflow-hidden rounded-[10px] border border-slate-200 object-cover',
        item.mediaType === 'movie' ? 'h-12 w-8' : 'h-10 w-10 rounded-[12px]',
      )}
      onError={() => setHasImageError(true)}
    />
  )
}

function AssociationLoadingState() {
  return (
    <div className="space-y-1 p-2">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="flex items-center gap-3 rounded-[16px] border border-transparent px-3 py-2.5"
        >
          <PosterPlaceholder mediaType={item === 2 ? 'series' : 'movie'} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 rounded-full bg-slate-100" />
            <div className="h-2.5 w-44 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

function AssociationStateMessage({ message }: { message: string }) {
  return (
    <div className="px-4 py-4 text-sm text-slate-500">{message}</div>
  )
}

type AssociationResultItemProps = {
  item: SubtitleAssociationItem
  isSelected: boolean
  onSelect: (item: SubtitleAssociationItem) => void
}

function AssociationResultItem({
  item,
  isSelected,
  onSelect,
}: AssociationResultItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'border-slate-200 bg-slate-50 shadow-[0_8px_20px_rgba(15,23,42,0.04)]'
          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50/80',
      )}
      onClick={() => onSelect(item)}
    >
      <AssociationPoster item={item} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">
          {item.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {item.subtitle}
        </p>
      </div>

      <div
        className={cn(
          'h-2 w-2 rounded-full transition-colors',
          isSelected ? 'bg-slate-300' : 'bg-slate-100',
        )}
      />
    </button>
  )
}

type MediaAssociationComboboxProps = {
  keyword: string
  open: boolean
  status: AssociationStatus
  items: SubtitleAssociationItem[]
  selectedItem: SubtitleAssociationItem | null
  errorMessage: string | null
  onKeywordChange: (value: string) => void
  onInputFocus: () => void
  onClose: () => void
  onSubmit: () => void
  onSelectItem: (item: SubtitleAssociationItem) => void
  onDemoInteraction: () => void
}

function MediaAssociationCombobox({
  keyword,
  open,
  status,
  items,
  selectedItem,
  errorMessage,
  onKeywordChange,
  onInputFocus,
  onClose,
  onSubmit,
  onSelectItem,
  onDemoInteraction,
}: MediaAssociationComboboxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isManualMode = true
  const isSearching = status === 'loading'
  const isSearchDisabled = isSearching || !keyword.trim()
  const shouldRenderPanel = open && status !== 'idle'

  useEffect(() => {
    if (!shouldRenderPanel) {
      return
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) {
        return
      }

      if (containerRef.current.contains(event.target as Node)) {
        return
      }

      onClose()
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [onClose, shouldRenderPanel])

  return (
    <section
      ref={containerRef}
      className="relative rounded-[26px] border border-slate-200 bg-white/95 p-4 shadow-shell"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-950">
              关联库中项目
            </h3>
            <p className="text-xs text-slate-400">Link to Library Item</p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            <span
              className={cn(
                'text-[11px] transition-colors',
                isManualMode ? 'text-slate-400' : 'text-slate-900',
              )}
            >
              智能自动匹配
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={isManualMode}
              aria-label="切换媒体关联模式"
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full border transition-colors',
                isManualMode
                  ? 'border-slate-900 bg-slate-900'
                  : 'border-slate-200 bg-slate-200',
              )}
              onClick={onDemoInteraction}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  isManualMode ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </button>

            <span
              className={cn(
                'text-[11px] transition-colors',
                isManualMode ? 'text-slate-900' : 'text-slate-400',
              )}
            >
              手动指定项目
            </span>
          </div>
        </div>

        <div className="relative z-20">
          <form
            onSubmit={(event) => {
              event.preventDefault()

              if (isSearchDisabled) {
                return
              }

              onSubmit()
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="search"
              value={keyword}
              autoComplete="off"
              aria-label="搜索库中媒体项目"
              placeholder="搜索电影、电视剧..."
              className="h-11 w-full rounded-[18px] border border-slate-200 bg-white pl-10 pr-[88px] text-sm font-medium text-slate-900 shadow-[0_0_0_1px_rgba(15,23,42,0.02),0_10px_30px_rgba(15,23,42,0.04)] outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200/60"
              onChange={(event) => onKeywordChange(event.target.value)}
              onFocus={onInputFocus}
            />

            <Button
              type="submit"
              size="sm"
              disabled={isSearchDisabled}
              aria-busy={isSearching}
              className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-[14px] bg-slate-950 px-3 text-xs font-medium text-white shadow-none hover:bg-black"
            >
              {isSearching ? '搜索中...' : '搜索'}
            </Button>
          </form>

          {selectedItem ? (
            <p className="mt-2 text-xs text-slate-400">
              当前已选择：{selectedItem.subtitle}
            </p>
          ) : null}

          {shouldRenderPanel ? (
            <div className="absolute left-0 top-full z-30 mt-2 w-full rounded-[22px] border border-slate-200 bg-white shadow-md">
              {status === 'loading' ? <AssociationLoadingState /> : null}
              {status === 'success' ? (
                <div className="space-y-1 p-2">
                  {items.map((item) => (
                    <AssociationResultItem
                      key={`${item.mediaType}-${item.id}`}
                      item={item}
                      isSelected={selectedItem?.id === item.id}
                      onSelect={onSelectItem}
                    />
                  ))}
                </div>
              ) : null}
              {status === 'empty' ? (
                <AssociationStateMessage message="未找到匹配的库中项目" />
              ) : null}
              {status === 'error' ? (
                <AssociationStateMessage
                  message={errorMessage ?? '搜索失败，请稍后重试'}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

type RecentSubtitleTableProps = {
  records: RecentProcessRecord[]
  onViewAll: () => void
}

function RecentSubtitleTable({
  records,
  onViewAll,
}: RecentSubtitleTableProps) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white/95 p-4 shadow-shell">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-slate-950">最近处理</h3>
          <p className="text-xs text-slate-400">
            静态预览最近挂载、匹配与失败记录。
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-950"
          onClick={onViewAll}
        >
          查看全部
        </Button>
      </div>

      <div className="mt-3 overflow-hidden rounded-[20px] border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/90">
              <tr className="text-[11px] text-slate-400">
                <th className="px-4 py-2.5 font-medium">文件名</th>
                <th className="px-4 py-2.5 font-medium">语言</th>
                <th className="px-4 py-2.5 font-medium">项目</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 text-right font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {records.map((record) => {
                const statusMeta = processStatusMeta[record.status]

                return (
                  <tr
                    key={`${record.fileName}-${record.time}`}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                      {record.fileName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {record.language}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {record.project}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium',
                          statusMeta.badgeClassName,
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            statusMeta.dotClassName,
                          )}
                        />
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-400">
                      {record.time}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function SubtitleManagePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const associationRequestControllerRef = useRef<AbortController | null>(null)
  const associationLatestRequestIdRef = useRef(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [associationKeyword, setAssociationKeyword] = useState('')
  const [associationOpen, setAssociationOpen] = useState(false)
  const [associationStatus, setAssociationStatus] =
    useState<AssociationStatus>('idle')
  const [associationItems, setAssociationItems] = useState<
    SubtitleAssociationItem[]
  >([])
  const [selectedAssociationItem, setSelectedAssociationItem] =
    useState<SubtitleAssociationItem | null>(null)
  const [associationErrorMessage, setAssociationErrorMessage] = useState<
    string | null
  >(null)

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
      associationRequestControllerRef.current?.abort()
    }
  }, [])

  function openFilePicker() {
    if (!fileInputRef.current) {
      return
    }

    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  function handleUploadZoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    openFilePicker()
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  function showDemoToast() {
    setToastMessage(demoToastMessage)
  }

  function resetAssociationSearchState({
    keepKeyword = true,
    nextKeyword,
    closePanel = true,
  }: {
    keepKeyword?: boolean
    nextKeyword?: string
    closePanel?: boolean
  } = {}) {
    associationLatestRequestIdRef.current += 1
    associationRequestControllerRef.current?.abort()
    associationRequestControllerRef.current = null
    setAssociationStatus('idle')
    setAssociationItems([])
    setAssociationErrorMessage(null)
    setAssociationOpen(!closePanel)

    if (!keepKeyword) {
      setAssociationKeyword(nextKeyword ?? '')
    }
  }

  function handleAssociationKeywordChange(value: string) {
    resetAssociationSearchState({
      keepKeyword: false,
      nextKeyword: value,
      closePanel: true,
    })
    setSelectedAssociationItem(null)
  }

  function handleAssociationInputFocus() {
    if (associationStatus === 'idle') {
      return
    }

    setAssociationOpen(true)
  }

  function handleAssociationClose() {
    setAssociationOpen(false)
  }

  function handleAssociationSubmit() {
    if (associationStatus === 'loading') {
      return
    }

    const keyword = associationKeyword.trim()
    associationLatestRequestIdRef.current += 1
    const requestId = associationLatestRequestIdRef.current
    associationRequestControllerRef.current?.abort()
    associationRequestControllerRef.current = null

    if (!keyword) {
      setAssociationStatus('idle')
      setAssociationItems([])
      setAssociationErrorMessage(null)
      setAssociationOpen(false)
      return
    }

    const controller = new AbortController()
    associationRequestControllerRef.current = controller
    setAssociationStatus('loading')
    setAssociationItems([])
    setAssociationErrorMessage(null)
    setAssociationOpen(true)

    void searchAssociationItems(keyword, controller.signal)
      .then((items) => {
        if (associationLatestRequestIdRef.current !== requestId) {
          return
        }

        setAssociationStatus(items.length > 0 ? 'success' : 'empty')
        setAssociationItems(items)
        setAssociationErrorMessage(null)
        setAssociationOpen(true)
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }

        if (associationLatestRequestIdRef.current !== requestId) {
          return
        }

        console.error('subtitle association search failed', error)

        setAssociationStatus('error')
        setAssociationItems([])
        setAssociationErrorMessage('搜索失败，请稍后重试')
        setAssociationOpen(true)
      })
      .finally(() => {
        if (associationRequestControllerRef.current === controller) {
          associationRequestControllerRef.current = null
        }
      })
  }

  function handleAssociationSelect(item: SubtitleAssociationItem) {
    setSelectedAssociationItem(item)
    setAssociationKeyword(item.title)
    setAssociationOpen(false)
  }

  return (
    <PageContainer
      title="资源编目"
      description="上传字幕并自动化重命名关联的 STRM 目录。"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-medium text-slate-500">字幕管理</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Subtitle Workspace</span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <section className="rounded-[26px] border border-slate-200 bg-white/95 p-4 shadow-shell">
              <div
                className="group rounded-[22px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.98))] px-6 py-8 text-center transition-all duration-200 hover:border-slate-900 hover:shadow-[0_18px_40px_rgba(15,23,42,0.05)]"
                onClick={openFilePicker}
                onKeyDown={handleUploadZoneKeyDown}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.rar,.srt,.ass,.ssa"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors group-hover:bg-slate-950 group-hover:text-white">
                  <Upload className="h-5 w-5" />
                </div>

                <h2 className="mt-4 text-sm font-semibold text-slate-950">
                  拖拽或点击上传字幕压缩包
                </h2>
                <p className="mt-1.5 text-xs text-slate-500">
                  支持 ZIP / RAR · 最大 100MB
                </p>

                <span className="mt-4 inline-flex h-9 items-center justify-center rounded-2xl border border-slate-900 px-4 text-sm font-medium text-slate-950 transition-colors group-hover:bg-slate-950 group-hover:text-white">
                  选择文件
                </span>

                {selectedFile ? (
                  <div className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-600 shadow-sm">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate font-medium text-slate-900">
                      {selectedFile.name}
                    </span>
                    <span className="text-slate-400">
                      {formatFileSize(selectedFile.size)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-slate-400">
                    当前仅展示本地选择反馈，不执行真实上传。
                  </p>
                )}
              </div>
            </section>

            <MediaAssociationCombobox
              keyword={associationKeyword}
              open={associationOpen}
              status={associationStatus}
              items={associationItems}
              selectedItem={selectedAssociationItem}
              errorMessage={associationErrorMessage}
              onKeywordChange={handleAssociationKeywordChange}
              onInputFocus={handleAssociationInputFocus}
              onClose={handleAssociationClose}
              onSubmit={handleAssociationSubmit}
              onSelectItem={handleAssociationSelect}
              onDemoInteraction={showDemoToast}
            />

            <Button
              type="button"
              disabled={!selectedAssociationItem}
              title={
                selectedAssociationItem
                  ? '暂未接入真实上传提交'
                  : '请先搜索并选择要关联的库中项目'
              }
              className="h-11 w-full rounded-[18px] bg-slate-950 text-sm font-medium text-white hover:bg-black disabled:bg-slate-200 disabled:text-slate-500"
              onClick={showDemoToast}
            >
              上传并处理
            </Button>

            <RecentSubtitleTable
              records={recentProcesses}
              onViewAll={showDemoToast}
            />
          </div>

          <aside className="space-y-5">
            <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-[#111214] shadow-[0_24px_50px_rgba(15,23,42,0.2)]">
              <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-zinc-500">
                  System Logs
                </span>
              </div>

              <div className="space-y-2 px-4 py-4 font-mono text-[12px] leading-5 text-zinc-300">
                {systemLogs.map((record) => (
                  <p
                    key={`${record.timestamp}-${record.message}`}
                    className={logToneClassName[record.tone ?? 'default']}
                  >
                    <span className="text-zinc-600">[{record.timestamp}]</span>{' '}
                    {record.message}
                  </p>
                ))}

                <p className="text-zinc-600">|</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-shell">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-950">库概览</h3>
                <p className="text-sm text-slate-500">
                  静态指标仅用于展示当前界面层级。
                </p>
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    已管理字幕
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
                    1,428
                  </p>
                </div>
                <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  +12 今日新增
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>STRM 覆盖率</span>
                  <span className="font-semibold text-slate-900">92.4%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-full w-[92.4%] rounded-full bg-slate-900" />
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-shell">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-950">
                  快捷操作
                </h3>
                <p className="text-sm text-slate-500">
                  当前按钮只保留演示态交互反馈。
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 text-slate-950 hover:bg-white"
                  onClick={showDemoToast}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Force Emby Scan
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 text-slate-950 hover:bg-white"
                  onClick={showDemoToast}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Temp Cache
                </Button>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {toastMessage ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 right-6 z-20"
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white shadow-[0_18px_40px_rgba(15,23,42,0.24)]">
            {toastMessage}
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
