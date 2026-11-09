import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { confirmBgmCandidate, deferBgmOperation, getBgmOperation, listWeComOperations, searchBgmOperation, supplyBgmOperation } from '@/lib/api/bgm-wishlist'
import { getJavaErrorMessage } from '@/lib/java-api'
import type { BgmOperation, BgmOperations } from '@/types/bgm-wishlist'
import { BgmOperationRecords } from './bgm-operation-records'
import { AutomationNavigation } from './navigation'

export function WeComAutomationPage() {
  const [params] = useSearchParams()
  const focusedId = params.get('operation')
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState<BgmOperations | null>(null)
  const [focused, setFocused] = useState<BgmOperation | null>(null)
  const [error, setError] = useState('')
  const [focusError, setFocusError] = useState('')
  const [actionError, setActionError] = useState('')
  const [working, setWorking] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let timer: number
    async function load() {
      if (document.visibilityState === 'visible') {
        try {
          const values = await listWeComOperations(page, controller.signal)
          if (controller.signal.aborted) return
          setRecords(values)
          setError('')
          if (focusedId) {
            try {
              const operation = values.items.find((item) => item.id === focusedId) ?? await getBgmOperation(focusedId, controller.signal)
              if (controller.signal.aborted) return
              setFocused(operation.triggerType === 'WECOM' ? operation : null)
              setFocusError(operation.triggerType === 'WECOM' ? '' : '这条记录不是微信操作。')
            } catch (caught) {
              if (!controller.signal.aborted) {
                setFocused(null)
                setFocusError(getJavaErrorMessage(caught) || '无法读取指定的微信操作记录。')
              }
            }
          }
        } catch (caught) {
          if (!controller.signal.aborted) setError(getJavaErrorMessage(caught) || '读取操作记录失败。')
        }
      }
      if (!controller.signal.aborted) timer = window.setTimeout(load, 5000)
    }
    void load()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [page, focusedId, refresh])

  async function update(action: () => Promise<BgmOperation>) {
    setWorking(true)
    setActionError('')
    try {
      await action()
      setRefresh((value) => value + 1)
    } finally {
      setWorking(false)
    }
  }

  function run(action: () => Promise<BgmOperation>) {
    void update(action).catch((caught) => setActionError(getJavaErrorMessage(caught) || '操作失败，请核对记录后重试。'))
  }

  const items = records?.items ?? []
  const visible = focusedId === focused?.id && focused && !items.some((item) => item.id === focused.id) ? [focused, ...items] : items

  return (
    <div className="space-y-4">
      <AutomationNavigation active="wecom" />
      <section aria-labelledby="wecom-operations" className="min-w-0 space-y-4 rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 id="wecom-operations" className="text-xl font-semibold text-slate-950">微信操作记录</h1>
            <p className="mt-1 text-sm text-slate-600">在微信发片名即可开始，想指定季度可加「第 3 季」或「S3」。</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setRefresh((value) => value + 1)}>刷新记录</Button>
        </div>
        {[error, focusError, actionError].filter(Boolean).map((message, index) => <p key={index} role="alert" className="break-words text-sm text-amber-800">{message}</p>)}
        {!records ? !error && <p role="status" className="text-sm text-slate-600">正在读取记录…</p> : visible.length ? (
          <BgmOperationRecords operations={visible} focusedId={focusedId} working={working}
            onConfirm={(id, subjectId, key) => update(() => confirmBgmCandidate(id, subjectId, key))}
            onSupply={(id, subjectId, identity, release) => update(() => supplyBgmOperation(id, subjectId, identity, release))}
            onSearch={(id, subjectId) => run(() => searchBgmOperation(id, subjectId))}
            onDefer={(id, subjectId) => run(() => deferBgmOperation(id, subjectId))} />
        ) : <p className="py-5 text-sm text-slate-600">暂无微信请求。用已绑定的管理员企微账号发送一部片名开始。</p>}
        {records && records.total > records.pageSize && (
          <nav aria-label="微信操作记录分页" className="flex flex-wrap items-center gap-3 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1 || records.page !== page} onClick={() => setPage(page - 1)}>上一页</Button>
            <span>第 {records.page} 页 · 共 {records.total} 条</span>
            <Button size="sm" variant="outline" disabled={page * records.pageSize >= records.total || records.page !== page} onClick={() => setPage(page + 1)}>下一页</Button>
          </nav>
        )}
      </section>
    </div>
  )
}
