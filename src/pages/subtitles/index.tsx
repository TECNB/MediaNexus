import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import {
  ChevronRight,
  FileText,
  RefreshCcw,
  Trash2,
  Upload,
} from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ProcessStatus = 'mounted' | 'matching' | 'failed'

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

const demoToastMessage = '演示模式：暂未接入后端能力'
const defaultTargetPath = '/media/movies/Dune 2 (2024)/'

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

export function SubtitleManagePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isPathOverrideEnabled, setIsPathOverrideEnabled] = useState(false)
  const [targetPath, setTargetPath] = useState(defaultTargetPath)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

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

  function openFilePicker() {
    if (!fileInputRef.current) {
      return
    }

    // Reset the input so choosing the same file twice still triggers feedback.
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

  return (
    <PageContainer
      title="资源编目"
      description="上传字幕并自动化重命名关联的 STRM 目录。"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-medium text-slate-500">字幕管理</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Subtitle Workspace</span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-shell">
              <div
                className="group rounded-[24px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))] px-6 py-10 text-center transition-all duration-200 hover:border-slate-900 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)]"
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

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors group-hover:bg-slate-950 group-hover:text-white">
                  <Upload className="h-6 w-6" />
                </div>

                <h2 className="mt-5 text-base font-semibold text-slate-950">
                  拖拽或点击上传字幕压缩包
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  支持 ZIP / RAR · 最大 100MB
                </p>

                <span className="mt-5 inline-flex h-10 items-center justify-center rounded-2xl border border-slate-900 px-5 text-sm font-medium text-slate-950 transition-colors group-hover:bg-slate-950 group-hover:text-white">
                  选择文件
                </span>

                {selectedFile ? (
                  <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate font-medium text-slate-900">
                      {selectedFile.name}
                    </span>
                    <span className="text-slate-400">
                      {formatFileSize(selectedFile.size)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-6 text-xs text-slate-400">
                    当前未选择文件，仅展示前端本地交互。
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-shell">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-950">
                    手动路径覆盖
                  </h3>
                  <p className="text-sm text-slate-500">
                    开启后可直接指定字幕应关联的媒体目录。
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isPathOverrideEnabled}
                  aria-label="切换手动路径覆盖"
                  className={cn(
                    'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2',
                    isPathOverrideEnabled
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-200 bg-slate-200',
                  )}
                  onClick={() =>
                    setIsPathOverrideEnabled((currentState) => !currentState)
                  }
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                      isPathOverrideEnabled
                        ? 'translate-x-6'
                        : 'translate-x-1',
                    )}
                  />
                </button>
              </div>

              <div className="mt-5 space-y-2">
                <label
                  htmlFor="subtitle-target-path"
                  className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"
                >
                  目标路径
                </label>
                <input
                  id="subtitle-target-path"
                  type="text"
                  value={targetPath}
                  disabled={!isPathOverrideEnabled}
                  onChange={(event) => setTargetPath(event.target.value)}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-sm transition-colors outline-none',
                    isPathOverrideEnabled
                      ? 'border-slate-200 bg-white text-slate-900 shadow-sm focus:border-slate-900'
                      : 'border-slate-200 bg-slate-50 text-slate-400',
                  )}
                />
                <p className="text-xs text-slate-400">
                  {isPathOverrideEnabled
                    ? '当前可编辑，仅保留本地输入状态，不校验真实目录。'
                    : '关闭时使用自动识别目录，输入框保持示例路径展示。'}
                </p>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-shell">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-950">
                    最近处理
                  </h3>
                  <p className="text-sm text-slate-500">
                    最近挂载、匹配与失败记录的静态预览。
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                  onClick={showDemoToast}
                >
                  查看全部
                </Button>
              </div>

              <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50/90">
                      <tr className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        <th className="px-4 py-3 font-semibold">文件名</th>
                        <th className="px-4 py-3 font-semibold">语言</th>
                        <th className="px-4 py-3 font-semibold">项目</th>
                        <th className="px-4 py-3 font-semibold">状态</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          时间
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {recentProcesses.map((record) => {
                        const statusMeta = processStatusMeta[record.status]

                        return (
                          <tr
                            key={`${record.fileName}-${record.time}`}
                            className="transition-colors hover:bg-slate-50/80"
                          >
                            <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-900">
                              {record.fileName}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-500">
                              <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                {record.language}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-500">
                              {record.project}
                            </td>
                            <td className="px-4 py-4 text-sm">
                              <span
                                className={cn(
                                  'inline-flex whitespace-nowrap items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium',
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
                            <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-slate-400">
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
