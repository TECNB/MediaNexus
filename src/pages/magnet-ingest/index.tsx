import { useEffect, useState } from 'react'
import { CloudUpload, Loader2 } from 'lucide-react'

import { LibraryLinkPicker } from '@/components/magnet-ingest/library-link-picker'
import { RecentTasksTable } from '@/components/magnet-ingest/recent-tasks-table'
import {
  NodeStatusCard,
  ProTipCard,
  SystemLogsCard,
} from '@/components/magnet-ingest/status-cards'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  defaultMagnetText,
  initialRecentTasks,
  magnetCategoryLabel,
  mockLibraryItems,
  systemLogEntries,
  type MagnetLibraryItem,
  type RecentIngestTask,
} from '@/data/mock-magnet-ingest'

function SectionHeading({
  label,
  title,
}: {
  label: string
  title?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        {label}
      </p>
      {title ? <p className="text-sm text-slate-500">{title}</p> : null}
    </div>
  )
}

function buildTaskName(magnetText: string) {
  const firstLine = magnetText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) {
    return 'Manual.Magnet.Task'
  }

  const nameFromDn = firstLine.match(/[?&]dn=([^&]+)/i)?.[1]

  if (nameFromDn) {
    try {
      return decodeURIComponent(nameFromDn).replace(/\+/g, '.')
    } catch {
      return nameFromDn.replace(/\+/g, '.')
    }
  }

  return firstLine.replace(/^magnet:\?/i, 'magnet').slice(0, 36)
}

export function MagnetIngestPage() {
  const [magnetText, setMagnetText] = useState(defaultMagnetText)
  const [libraryKeyword, setLibraryKeyword] = useState('')
  const [selectedLibraryItem, setSelectedLibraryItem] =
    useState<MagnetLibraryItem | null>(null)
  const [recentTasks, setRecentTasks] =
    useState<RecentIngestTask[]>(initialRecentTasks)
  const [fakeSubmitting, setFakeSubmitting] = useState(false)
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

  const normalizedKeyword = libraryKeyword.trim().toLowerCase()
  const filteredLibraryItems = normalizedKeyword
    ? mockLibraryItems.filter((item) =>
        [
          item.title,
          item.originalTitle,
          item.subtitle,
          String(item.year),
          item.category,
          magnetCategoryLabel[item.category],
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword),
      )
    : mockLibraryItems.slice(0, 6)

  const isPushDisabled =
    !magnetText.trim() || !selectedLibraryItem || fakeSubmitting

  async function handleFakeSubmit() {
    if (isPushDisabled || !selectedLibraryItem) {
      return
    }

    setFakeSubmitting(true)
    await new Promise((resolve) => {
      window.setTimeout(resolve, 1000)
    })

    const nextTask: RecentIngestTask = {
      id: `task-${Date.now()}`,
      name: buildTaskName(magnetText),
      libraryTitle: selectedLibraryItem.title,
      status: 'submitted',
      time: '刚刚',
    }

    setRecentTasks((currentTasks) => [nextTask, ...currentTasks].slice(0, 6))
    setToastMessage('仅为静态演示，尚未接入后端')
    setFakeSubmitting(false)
  }

  return (
    <PageContainer
      title="手动磁力直收"
      description="直接粘贴高质量磁力链接，将其绑定至媒体库结构并推送至云端离线下载。"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.72fr)_320px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <SectionHeading label="Magnet Links" />

            <div className="rounded-[28px] border border-slate-200 bg-white/95 shadow-shell">
              <textarea
                value={magnetText}
                onChange={(event) => setMagnetText(event.target.value)}
                aria-label="输入磁力链接"
                spellCheck={false}
                className="min-h-[180px] w-full resize-none rounded-[28px] bg-transparent px-5 py-5 font-mono text-[15px] leading-8 text-slate-900 outline-none placeholder:text-slate-300"
              />
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeading
              label="关联库项目 (Link to Library Item)"
              title="参考资源搜索页的搜索式选择方案，本轮改为本地 mock 结果筛选与选中态展示。"
            />

            <LibraryLinkPicker
              keyword={libraryKeyword}
              items={filteredLibraryItems}
              selectedItem={selectedLibraryItem}
              isShowingRecommendations={!normalizedKeyword}
              onKeywordChange={(value) => {
                setLibraryKeyword(value)
                setSelectedLibraryItem(null)
              }}
              onSelectItem={(item) => {
                setSelectedLibraryItem(item)
                setLibraryKeyword(item.title)
              }}
            />
          </section>

          <Button
            type="button"
            size="lg"
            disabled={isPushDisabled}
            onClick={() => {
              void handleFakeSubmit()
            }}
            className="h-14 w-full rounded-[20px] bg-slate-950 text-base font-semibold text-white shadow-none hover:bg-black disabled:bg-slate-200 disabled:text-slate-500"
          >
            {fakeSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                推送中...
              </>
            ) : (
              <>
                <CloudUpload className="h-4 w-4" />
                推送至离线下载 (Push to Offline)
              </>
            )}
          </Button>

          <RecentTasksTable
            tasks={recentTasks}
            onViewAll={() => setToastMessage('仅为静态演示，VIEW ALL 暂未接入')}
          />
        </div>

        <aside className="space-y-5">
          <SystemLogsCard logs={systemLogEntries} />
          <NodeStatusCard />
          <ProTipCard />
        </aside>
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
