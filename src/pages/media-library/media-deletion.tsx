import { useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronRight,
  FolderTree,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  createMediaDeletion,
  getMediaSeasons,
  retryMediaDeletion,
} from '@/lib/api/media-library'
import { getJavaErrorMessage } from '@/lib/java-api'
import { cn } from '@/lib/utils'
import type {
  MediaDeletionStage,
  MediaDeletionTask,
  MediaLibraryId,
  MediaLibraryItem,
  MediaSeason,
} from '@/types/media-library'

const stages: Array<{ id: MediaDeletionStage; label: string }> = [
  { id: 'DELETING_CLOUD', label: '删除网盘内容' },
  { id: 'CLEANING_STRM', label: '清理媒体索引' },
  { id: 'VERIFYING', label: '确认媒体库结果' },
]

const stageOrder: Record<MediaDeletionStage, number> = {
  DELETING_CLOUD: 0,
  CLEANING_STRM: 1,
  NOTIFYING_EMBY: 2,
  VERIFYING: 2,
  COMPLETED: 3,
}

export function DeletionProgress({ task }: { task: MediaDeletionTask }) {
  const current = stageOrder[task.stage]
  const currentStage = stages[Math.min(current, stages.length - 1)]
  const progressLabel = task.status === 'SUCCEEDED'
    ? '删除完成'
    : task.status === 'FAILED'
      ? `失败于：${currentStage.label}`
      : `${Math.min(current + 1, stages.length)}/${stages.length} · ${currentStage.label}`
  return (
    <div className="space-y-2" role="status" aria-atomic="true">
      <div aria-hidden="true" className="grid grid-cols-3 gap-1">
        {stages.map((stage, index) => {
          const complete = task.status === 'SUCCEEDED' || current > index
          const active = task.status !== 'FAILED' && current === index
          const failed = task.status === 'FAILED' && current === index
          return (
            <div
              className={cn(
                'h-1 rounded-full',
                complete ? 'bg-emerald-500' : failed ? 'bg-rose-500' : active ? 'bg-amber-500' : 'bg-slate-200',
              )}
              key={stage.id}
            />
          )
        })}
      </div>
      <p className={cn(
        'text-sm font-medium leading-5',
        task.status === 'SUCCEEDED'
          ? 'text-emerald-700'
          : task.status === 'FAILED'
            ? 'text-rose-700'
            : 'text-slate-600',
      )}>{progressLabel}</p>
      {task.error_message ? (
        <p className="text-xs leading-5 text-rose-700">{task.error_message}</p>
      ) : null}
    </div>
  )
}

export function MediaDeletionManager({
  item,
  library,
  onCreated,
}: {
  item: MediaLibraryItem
  library: MediaLibraryId
  onCreated: (task: MediaDeletionTask) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [seasons, setSeasons] = useState<MediaSeason[]>([])
  const [selected, setSelected] = useState<MediaSeason | 'all' | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const episodic = library === 'tv' || library === 'variety' || library === 'anime'
  const collection = item.type === 'BoxSet'

  async function open() {
    setError(null)
    setSelected(episodic ? null : 'all')
    dialogRef.current?.showModal()
    if (!episodic || seasons.length > 0) return
    setLoading(true)
    try {
      setSeasons(await getMediaSeasons(item.item_id, library))
    } catch (nextError) {
      setError(getJavaErrorMessage(nextError) || '季度加载失败。')
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const task = await createMediaDeletion(
        item.item_id,
        library,
        selected === 'all' ? undefined : selected.season_id,
      )
      dialogRef.current?.close()
      onCreated(task)
    } catch (nextError) {
      setError(getJavaErrorMessage(nextError) || '删除任务创建失败。')
    } finally {
      setSubmitting(false)
    }
  }

  const target = selected === 'all'
    ? episodic ? '整部剧集' : collection ? '整套合集' : '整部作品'
    : selected?.name

  return (
    <>
      <Button
        className="w-full text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        onClick={() => void open()}
        size="sm"
        type="button"
        variant="outline"
      >
        {episodic ? <FolderTree aria-hidden="true" className="h-4 w-4" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
        {episodic ? '查看季度' : collection ? '删除合集' : '删除媒体'}
      </Button>

      <dialog
        aria-labelledby={`delete-media-${item.item_id}`}
        className="m-auto max-h-[92vh] w-[min(42rem,calc(100%-1.5rem))] overflow-hidden rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/55"
        onCancel={(event) => { if (submitting) event.preventDefault() }}
        ref={dialogRef}
      >
        <div className="flex max-h-[92vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold" id={`delete-media-${item.item_id}`}>
                {episodic ? `管理《${item.title}》季度` : collection ? `删除合集《${item.title}》` : `删除《${item.title}》`}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                删除网盘内容和本地 STRM 后，直接通知 Emby；不会触发 AS。
              </p>
            </div>
            <button
              aria-label="关闭删除窗口"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400"
              disabled={submitting}
              onClick={() => dialogRef.current?.close()}
              type="button"
            ><X aria-hidden="true" className="h-5 w-5" /></button>
          </header>

          <div className="overflow-y-auto p-5 sm:p-6">
            {!selected && episodic ? (
              <div className="space-y-4">
                {loading ? <div aria-label="正在加载季度" className="flex justify-center py-12" role="status"><Loader2 aria-hidden="true" className="h-7 w-7 animate-spin motion-reduce:animate-none" /></div> : null}
                {!loading && seasons.map((season) => (
                  <button
                    className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400"
                    key={season.season_id}
                    onClick={() => setSelected(season)}
                    type="button"
                  >
                    <span><strong className="block text-sm">{season.name}</strong><span className="mt-1 block text-xs text-slate-500">{season.episode_count} 集</span></span>
                    <span className="flex items-center gap-1 text-sm font-medium text-rose-700">删除本季<ChevronRight aria-hidden="true" className="h-4 w-4" /></span>
                  </button>
                ))}
                {!loading && seasons.length === 0 && !error ? <p className="py-8 text-center text-sm text-slate-500">没有找到可管理的季度。</p> : null}
                {!loading && seasons.length > 0 ? (
                  <button
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-800 hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-300"
                    onClick={() => setSelected('all')}
                    type="button"
                  ><Trash2 aria-hidden="true" className="h-4 w-4" />删除整部剧集</button>
                ) : null}
              </div>
            ) : null}

            {selected ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex gap-3">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
                    <div><h3 className="font-semibold text-rose-950">确认删除{target}</h3><p className="mt-1 text-sm leading-6 text-rose-800">此操作会永久删除真实网盘内容，无法撤销。删除完成后可以立即重新入库换源。</p></div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-medium text-slate-950">《{item.title}》</p>
                  <p className="mt-1 text-slate-500">范围：{target}</p>
                  {selected !== 'all' ? <p className="mt-1 text-slate-500">共 {selected.episode_count} 集</p> : null}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {episodic ? <Button disabled={submitting} onClick={() => setSelected(null)} type="button" variant="outline">返回季度</Button> : null}
                  <Button className="bg-rose-700 text-white hover:bg-rose-800" disabled={submitting} onClick={() => void submit()} type="button">
                    {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
                    确认永久删除
                  </Button>
                </div>
              </div>
            ) : null}
            {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p> : null}
          </div>
        </div>
      </dialog>
    </>
  )
}

export function DeletionTaskList({
  tasks,
  onChanged,
}: {
  tasks: MediaDeletionTask[]
  onChanged: (task: MediaDeletionTask) => void
}) {
  const [retrying, setRetrying] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)

  async function retry(task: MediaDeletionTask) {
    setRetrying(task.id)
    setRetryError(null)
    try {
      onChanged(await retryMediaDeletion(task.id))
    } catch (error) {
      setRetryError(getJavaErrorMessage(error) || '删除任务重试失败。')
    } finally {
      setRetrying(null)
    }
  }

  if (tasks.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-500">还没有媒体删除任务。</p>
  }
  return <div className="space-y-3">{retryError ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{retryError}</p> : null}{tasks.map((task) => (
    <article className="rounded-2xl border border-slate-200 p-4" key={task.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-950">{task.title}</h3><p className="mt-1 text-xs text-slate-500">{task.target_label}</p></div>
        <span className={cn(
          'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
          task.status === 'SUCCEEDED' ? 'bg-emerald-50 text-emerald-700' : task.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700',
        )}>{task.status === 'SUCCEEDED' ? '已完成' : task.status === 'FAILED' ? '需要处理' : '正在删除'}</span>
      </div>
      <div className="mt-4"><DeletionProgress task={task} /></div>
      {task.status === 'FAILED' ? <Button className="mt-4" disabled={retrying === task.id} onClick={() => void retry(task)} size="sm" type="button" variant="outline"><RotateCcw aria-hidden="true" className="h-4 w-4" />重试</Button> : null}
    </article>
  ))}</div>
}
