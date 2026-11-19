import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { continueReleaseComparison, observeReleaseComparison } from '@/lib/api/resources'
import type { ProwlarrRelease, ProwlarrReleaseSearchData, ReleaseComparison } from '@/types/resources'

type Props = {
  comparison?: ReleaseComparison | null
  items: ProwlarrRelease[]
  onUpdate: (snapshot: ProwlarrReleaseSearchData) => void
  disabled?: boolean
}

const statusLabels = { RUNNING: '正在比较', COMPLETE: '本轮比较完成', PAUSED: '比较已暂停', BLOCKED: '比较受阻' }

export function ReleaseComparisonProgress({ comparison, items, onUpdate, disabled = false }: Props) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const actionRef = useRef<AbortController | null>(null)
  const id = comparison?.id
  const status = comparison?.status

  useEffect(() => {
    setError(null)
    setBusy(false)
    return () => actionRef.current?.abort()
  }, [id])

  useEffect(() => {
    if (!id || status !== 'RUNNING' || disabled) return
    const controller = new AbortController()
    observeReleaseComparison({ id, status }, {
      signal: controller.signal,
      onSnapshot: snapshot => onUpdateRef.current(snapshot),
      onError: () => setError('进度读取失败，已保留已查结果。请重试读取；不会自动续查。'),
    })
    return () => controller.abort()
  }, [id, status, disabled, revision])

  if (!comparison) return null
  const recommended = items.find(item => item.download_ref === comparison.recommended_ref)

  async function continueComparison() {
    if (!id || busy) return
    const controller = new AbortController()
    actionRef.current?.abort()
    actionRef.current = controller
    setBusy(true); setError(null)
    try {
      const snapshot = await continueReleaseComparison(id, controller.signal)
      if (!controller.signal.aborted) onUpdateRef.current(snapshot)
    } catch {
      if (!controller.signal.aborted) setError('继续比较失败，已保留结果。可再次点击继续比较。')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <section className="my-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700" aria-label="候选比较进度">
    <p role="status">{statusLabels[comparison.status]} · 已查 {comparison.checked} · 待查 {comparison.pending}</p>
    <p className="break-words">当前推荐：{recommended?.title ?? (comparison.recommended_ref ? '推荐项正在同步' : '暂无已核验可推荐项')}</p>
    <p className="text-xs">搜索快照：<time dateTime={comparison.snapshot_at}>{new Date(comparison.snapshot_at).toLocaleString('zh-CN')}</time></p>
    {comparison.message && <p>{comparison.message}</p>}
    {comparison.status !== 'COMPLETE' && <p>尚未完成全部候选比较。可手工选择当前可推荐项，不代表全部候选中的最终优选；暂停后需明确继续。</p>}
    {(comparison.status === 'PAUSED' || comparison.status === 'BLOCKED') && <Button type="button" variant="outline" className="min-h-11" disabled={busy || disabled} onClick={() => void continueComparison()}>{busy ? '正在继续…' : '继续比较'}</Button>}
    {error && <div role="alert"><p>{error}</p>{comparison.status === 'RUNNING' && <Button type="button" variant="outline" className="mt-2 min-h-11" disabled={disabled} onClick={() => { setError(null); setRevision(value => value + 1) }}>重试读取进度</Button>}</div>}
  </section>
}
