import { useEffect, useRef, useState } from 'react'
import { ArrowUp, File, Folder, RefreshCw, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { browseAdultStorage, deleteAdultStorage } from '@/lib/api/media-library'
import { getJavaErrorMessage, isJavaRequestCanceledError } from '@/lib/java-api'
import type { AdultStorageItem, AdultStoragePage, MediaDeletionTask, MediaLibraryId } from '@/types/media-library'

import { capacityText } from './capacity'

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const active = (task: MediaDeletionTask) => task.status === 'PENDING' || task.status === 'RUNNING'

export function AdultStorage({ library, tasks, onCreated, completedCount }: {
  library: MediaLibraryId
  tasks: MediaDeletionTask[]
  onCreated: (task: MediaDeletionTask) => void
  completedCount: number
}) {
  const [directory, setDirectory] = useState<string | null>(null)
  const [data, setData] = useState<AdultStoragePage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [selection, setSelection] = useState<AdultStorageItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const confirmation = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    browseAdultStorage(library, directory, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setData(page)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isJavaRequestCanceledError(error)) {
          setError(getJavaErrorMessage(error) ?? '网盘目录加载失败')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [library, directory, refresh, completedCount])

  const current = data?.directory
  const root = data?.roots.find((path) => current === path || current?.startsWith(`${path}/`))
  const parent = current && current !== root ? current.slice(0, current.lastIndexOf('/')) : null
  const pending = data?.items.some((item) => item.capacity_status === 'pending')
  const deletionRunning = tasks.some((task) => task.library === library && task.item_id.startsWith('storage:') && active(task))

  function openDirectory(path: string | null) {
    setData(null)
    setLoading(true)
    setDirectory(path)
  }

  function confirm(item: AdultStorageItem) {
    setSelection(item)
    setDeleteError(null)
    confirmation.current?.showModal()
  }

  async function submit() {
    if (!selection || submitting) return
    setSubmitting(true)
    setDeleteError(null)
    try {
      const task = await deleteAdultStorage(library, selection)
      onCreated(task)
      setNotice(`已提交「${basename(selection.path)}」的删除任务，可在「删除任务」查看进度。`)
      confirmation.current?.close()
    } catch (error) {
      setDeleteError(getJavaErrorMessage(error) ?? '无法创建删除任务')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 shadow-shell ring-1 ring-slate-200 sm:p-5" aria-label="Adult 网盘文件夹">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold text-slate-950">网盘文件夹</h2>
          <p className="text-sm text-slate-600">直接读取 CloudDrive2（CD2）的网盘内容，包含未入库文件。已知容量从大到小排列。</p>
          {current ? <p className="break-all text-sm text-slate-600">{current}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {(parent || directory || (current && (data?.roots.length ?? 0) > 1)) ? (
            <Button size="sm" variant="outline" onClick={() => openDirectory(error ? null : parent)} type="button">
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
              {error ? '返回库根' : parent ? '上一级' : '选择网盘'}
            </Button>
          ) : null}
          <Button disabled={loading} size="sm" variant="outline" onClick={() => setRefresh((count) => count + 1)} type="button">
            <RefreshCw aria-hidden="true" className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
          </Button>
        </div>
      </div>
      {notice ? <p className="text-sm text-slate-700" role="status">{notice}</p> : null}
      {loading ? <p className="text-sm text-slate-600" role="status">正在读取目录…</p> : null}
      {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
      {!loading && !error && data ? (
        data.directory == null ? (
          data.roots.length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {data.roots.map((path) => (
                <li key={path}>
                  <button className="flex min-h-11 w-full items-center gap-2 break-all text-left text-sm font-medium hover:text-slate-600" onClick={() => openDirectory(path)} type="button">
                    <Folder aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {path}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-600">此库没有配置可浏览的网盘目录。</p>
        ) : (
          <>
            {pending ? <p className="text-sm text-slate-600" role="status">正在后台汇总文件夹容量，稍后点「刷新」查看新的排序。</p> : null}
            {data.items.length === 0 ? <p className="text-sm text-slate-600">此文件夹为空。</p> : null}
            <ul className="divide-y divide-slate-200">
              {data.items.map((item) => {
                const name = basename(item.path)
                const Icon = item.directory ? Folder : File
                return (
                  <li key={item.path} className="flex items-center gap-3 py-2">
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
                    {item.directory ? (
                      <button className="min-h-10 min-w-0 flex-1 break-all text-left text-sm font-medium text-slate-950 hover:underline" onClick={() => openDirectory(item.path)} type="button">{name}</button>
                    ) : <span className="min-w-0 flex-1 break-all text-sm text-slate-800">{name}</span>}
                    <span className="shrink-0 text-right text-xs tabular-nums text-slate-600">{capacityText(item)}</span>
                    <Button
                      aria-label={`删除${item.directory ? '文件夹' : '文件'} ${name}`}
                      className="shrink-0 text-rose-700 hover:text-rose-800"
                      disabled={!item.id || deletionRunning}
                      onClick={() => confirm(item)}
                      size="sm"
                      title={!item.id ? '网盘未返回可核对的目标标识' : deletionRunning ? '等待当前删除任务结束' : undefined}
                      type="button"
                      variant="outline"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </>
        )
      ) : null}
      <dialog
        aria-labelledby="adult-storage-delete-title"
        className="m-auto w-[min(32rem,calc(100%-1.5rem))] rounded-2xl bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/55"
        onCancel={(event) => { if (submitting) event.preventDefault() }}
        onClose={() => setSelection(null)}
        ref={confirmation}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold" id="adult-storage-delete-title">删除{selection?.directory ? '网盘文件夹' : '网盘文件'}</h3>
          <Button aria-label="关闭" disabled={submitting} onClick={() => confirmation.current?.close()} size="sm" type="button" variant="ghost">
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
        <p className="my-3 max-h-[30vh] overflow-auto break-all rounded-lg bg-slate-100 p-3 text-sm">{selection?.path}</p>
        <p className="text-sm text-slate-700">
          {selection?.directory ? '将删除该目录及所有子目录和文件，包括未入库内容。' : '只删除此文件，所在文件夹和其他文件会保留。'}
          对应的媒体库索引也会清理。此操作无法在这里撤销。
        </p>
        {deleteError ? <p className="mt-3 text-sm text-rose-700" role="alert">{deleteError}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button autoFocus disabled={submitting} onClick={() => confirmation.current?.close()} type="button" variant="outline">取消</Button>
          <Button className="bg-rose-700 text-white hover:bg-rose-800" disabled={submitting} onClick={() => void submit()} type="button">
            {submitting ? '提交中…' : '确认删除'}
          </Button>
        </div>
      </dialog>
    </section>
  )
}
