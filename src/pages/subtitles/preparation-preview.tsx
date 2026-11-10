import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SelectControl } from '@/components/ui/form-control'
import type { SubtitleCommitFile, SubtitleLanguage, SubtitlePreparation } from '@/types/subtitles'

type Props = {
  preparation: SubtitlePreparation
  pending: boolean
  onCommit: (files: SubtitleCommitFile[]) => void
  onCancel: () => void
}

const statusLabels = {
  READY: '可写入',
  CONFLICT: '文件冲突',
  UNMATCHED: '未匹配视频',
  AMBIGUOUS: '匹配存在歧义',
}

export function SubtitlePreparationPreview({ preparation, pending, onCommit, onCancel }: Props) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(
    preparation.files.filter((file) => file.status === 'READY').map((file) => file.id),
  ))
  const [languages, setLanguages] = useState<Record<string, SubtitleLanguage>>({})
  const [now, setNow] = useState(Date.now)
  const expiresAt = new Date(preparation.expires_at).getTime()
  const expired = now >= expiresAt
  const selectedFiles = preparation.files.filter((file) => selectedIds.has(file.id))
  const hasBlockedSelection = selectedFiles.some((file) => file.status !== 'READY' && file.conflict_reason !== 'DUPLICATE_CANDIDATE')
  const selectedTargets = selectedFiles.map((file) => `${file.video_name}\u0000${languages[file.id] ?? file.language}\u0000${file.extension}`)
  const hasDuplicateSelection = new Set(selectedTargets).size !== selectedTargets.length

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section aria-label="字幕写入预览" className="min-w-0 space-y-4 rounded-[22px] border border-slate-200 bg-white/95 p-4 shadow-shell">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">确认字幕写入预览</h2>
        <p className="mt-1 text-xs text-slate-500">解析未写入远端文件。仅默认选择可写入文件，不覆盖已有文件。</p>
        <p className="mt-1 break-all text-xs text-slate-500">目标目录：{preparation.target_path}</p>
        <p role="status" className={expired ? 'mt-1 text-xs text-rose-700' : 'mt-1 text-xs text-slate-500'}>
          {expired ? '预览已过期，请重新解析预览。' : `有效期至 ${new Date(preparation.expires_at).toLocaleString('zh-CN')}`}
        </p>
      </div>

      {preparation.warnings.length > 0 ? (
        <ul className="space-y-1 text-xs text-amber-700">
          {preparation.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
        </ul>
      ) : null}
      {preparation.skipped_entries.length > 0 ? (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">已跳过 {preparation.skipped_entries.length} 个条目</summary>
          <ul className="mt-2 space-y-1 break-all">
            {preparation.skipped_entries.map((entry, index) => (
              <li key={index}>{typeof entry === 'string' ? entry : JSON.stringify(entry)}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {preparation.files.length === 0 ? <p className="text-sm text-slate-500">原包中没有可预览的字幕文件。</p> : null}
      <div className="space-y-3">
        {preparation.files.map((file, index) => {
          const language = languages[file.id] ?? file.language
          const languageChanged = languages[file.id] !== undefined && languages[file.id] !== file.language
          return (
            <div key={file.id} className="min-w-0 rounded-2xl border border-slate-200 p-3 text-xs">
              <label className="flex items-start gap-2 text-sm font-medium text-slate-900">
                <input
                  type="checkbox"
                  aria-label={`选择字幕 ${file.original_path || file.original_name}`}
                  checked={selectedIds.has(file.id)}
                  disabled={pending || expired}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
                  onChange={(event) => {
                    setSelectedIds((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(file.id)
                      else next.delete(file.id)
                      return next
                    })
                  }}
                />
                <span className="min-w-0 break-all">{file.original_path || file.original_name}</span>
              </label>
              <dl className="mt-2 space-y-1 break-all text-slate-600">
                <div><dt className="inline text-slate-400">匹配视频 → </dt><dd className="inline">{file.video_name || '未确定'}</dd></div>
                <div><dt className="inline text-slate-400">最终文件 → </dt><dd className="inline">{file.final_name || '未确定'}</dd></div>
                <div><dt className="inline text-slate-400">大小 / 格式：</dt><dd className="inline">{file.size.toLocaleString()} B / {file.extension}</dd></div>
                <div><dt className="inline text-slate-400">状态：</dt><dd className={file.status === 'READY' ? 'inline text-emerald-700' : 'inline text-amber-700'}>{statusLabels[file.status]} ({file.status})</dd></div>
              </dl>
              <div className="mt-3 space-y-1">
                <label htmlFor={`subtitle-language-${index}`} className="font-medium text-slate-700">字幕语言</label>
                <SelectControl
                  id={`subtitle-language-${index}`}
                  value={language}
                  disabled={pending || expired}
                  onChange={(event) => setLanguages((current) => ({ ...current, [file.id]: event.target.value as SubtitleLanguage }))}
                >
                  <option value="unknown">未知语言</option>
                  <option value="chs">简体中文</option>
                  <option value="cht">繁体中文</option>
                </SelectControl>
                <p className="text-slate-400">识别来源：{file.language_source} {languageChanged ? '· 已手动修改，最终命名由服务端重新确认' : ''}</p>
              </div>
              {file.status !== 'READY' ? (
                <p className="mt-2 text-amber-700">
                  {file.conflict_reason === 'DUPLICATE_CANDIDATE' ? '包内有多个同名候选，请仅选一份，或修改语言后提交。' : file.status === 'AMBIGUOUS' ? '当前不支持手动选择匹配视频，此文件不可提交。' : file.status === 'CONFLICT' ? '目标文件冲突，本次不覆盖；请取消选择并检查目标目录后重新预览。' : '尚未匹配视频，此文件不可提交，请检查文件名后重新预览。'}
                </p>
              ) : null}
              {file.warnings.map((warning, warningIndex) => <p key={warningIndex} className="mt-1 break-all text-amber-700">{warning}</p>)}
            </div>
          )
        })}
      </div>

      <p role="status" className="text-xs text-slate-500">
        已选择 {selectedFiles.length} 个文件。{hasBlockedSelection ? '所选文件包含不可提交项，请取消选择。' : hasDuplicateSelection ? '所选文件目标名称重复，请只选一份或修改语言。' : '请确认语言与视频匹配后写入。'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending || expired || selectedFiles.length === 0 || hasBlockedSelection || hasDuplicateSelection} onClick={() => onCommit(selectedFiles.map((file) => ({ id: file.id, ...(languages[file.id] === undefined ? {} : { language: languages[file.id] }) })))}>
          {pending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : null}
          {pending ? '正在确认写入…' : `确认写入 ${selectedFiles.length} 个文件`}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>取消预览 / 重新解析</Button>
      </div>
    </section>
  )
}
