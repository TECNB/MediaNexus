import { useEffect, useRef, useState } from 'react'
import { RefreshCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { checkSubtitleUpload } from '@/lib/api/subtitles'
import { getJavaErrorMessage, isJavaRequestCanceledError } from '@/lib/java-api'
import type { SubtitleFileCheckLocation, SubtitleFileCheckStatus, SubtitleUploadCheck } from '@/types/subtitles'

const statusLabels: Record<SubtitleFileCheckStatus, string> = {
  COMPLETE: '文件已到位',
  PENDING: '文件尚未全部到位',
  UNAVAILABLE: '暂时无法检查',
}

function CheckLocation({ label, location }: { label: string; location: SubtitleFileCheckLocation }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3 text-xs">
      <p className="font-medium text-slate-900">{label}：{statusLabels[location.status]} ({location.status})</p>
      {location.message ? <p className="break-words text-slate-500">{location.message}</p> : null}
      <ul className="space-y-2 text-slate-600">
        {location.files.map((file, index) => (
          <li key={index} className="break-all">
            <p>{file.name} · {!file.present ? '未到位' : file.actual_size === null || file.expected_size === null ? '已存在，大小尚无法核对' : file.matches_size ? '已到位，大小一致' : '已存在，大小不符'}</p>
            <p className="text-slate-400">预期 {file.expected_size ?? '未知'} B / 实际 {file.actual_size ?? '未知'} B</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SubtitleUploadFileCheck({ uploadId }: { uploadId: string }) {
  const [result, setResult] = useState<SubtitleUploadCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  async function checkFiles() {
    if (controllerRef.current) return
    const controller = new AbortController()
    controllerRef.current = controller
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const response = await checkSubtitleUpload(uploadId, controller.signal)
      if (!controller.signal.aborted) setResult(response)
    } catch (cause) {
      if (!controller.signal.aborted && !isJavaRequestCanceledError(cause)) {
        setError(getJavaErrorMessage(cause) || '文件到位检查失败，请重试。')
      }
    } finally {
      if (!controller.signal.aborted) setPending(false)
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  return (
    <section aria-label="当前批次文件到位检查" aria-busy={pending} className="space-y-3 rounded-[22px] border border-slate-200 bg-white/95 p-4 shadow-shell">
      <h3 className="text-sm font-semibold text-slate-950">当前批次文件到位</h3>
      <p className="break-all text-xs text-slate-400">批次：{uploadId}</p>
      <p className="text-xs leading-5 text-slate-500">只读检查本批次源目录与输出目录文件。结果不代表 AS 刷新成功或 Emby 已完成扫描；等待 AS 时也可主动检查。</p>
      <Button type="button" variant="outline" disabled={pending} onClick={() => void checkFiles()}>
        {pending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : null}
        {pending ? '正在检查…' : '检查文件到位'}
      </Button>
      {error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : null}
      {result ? (
        <div role="status" className="space-y-2">
          <CheckLocation label="源目录（OpenList）" location={result.source} />
          <CheckLocation label="输出目录（STRM）" location={result.output} />
        </div>
      ) : null}
    </section>
  )
}
