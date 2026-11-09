import { useEffect, useState } from 'react'

import { BgmPoster } from './bgm-poster'
import { AutomationNavigation } from './navigation'
import { getJavaErrorMessage, javaApiClient } from '@/lib/java-api'
import type { WishlistProvider } from '@/types/bgm-wishlist'

type Wishlist = {
  id: string
  account: string
  enabled: boolean
  refreshStatus: string
  items: { id: number; title: string; year: number | null; coverUrl: string | null }[]
  recent: { id: string; startedAt: string; status: string; title: string | null; reason: string | null }[]
}

const statuses: Record<string, string> = {
  QUEUED: '已受理', RUNNING: '处理中', WAITING: '需要处理', SUCCEEDED: '本轮处理结束',
  PARTIAL_SUCCESS: '部分成功', FAILED: '处理失败', INTERRUPTED: '执行中断',
}

export function MemberWishlistPage({ provider }: { provider: WishlistProvider }) {
  const [items, setItems] = useState<Wishlist[] | null>(null)
  const [error, setError] = useState('')
  const douban = provider === 'DOUBAN'

  useEffect(() => {
    const controller = new AbortController()
    void javaApiClient.get<{ code: number; message: string; data: Wishlist[] | null }>('/api/v1/automation/wishlists', {
      params: { provider }, signal: controller.signal,
    }).then(({ data }) => {
      if (data.code !== 200 || !data.data) throw new Error(data.message)
      if (!controller.signal.aborted) setItems(data.data)
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(getJavaErrorMessage(caught) || '无法读取想看记录。')
    })
    return () => controller.abort()
  }, [provider])

  return <div className="space-y-4">
    <AutomationNavigation active={douban ? 'douban' : 'bgm'} />
    <h1 className="text-xl font-semibold">{douban ? '豆瓣想看' : 'BGM 想看'}</h1>
    {error ? <p role="alert" className="text-sm text-amber-800">{error}</p>
      : !items ? <p role="status" className="text-sm text-slate-600">正在读取想看记录…</p>
      : !items.length ? <p className="text-sm text-slate-600">当前账号没有关联的想看来源。</p>
      : items.map((source) => <section key={source.id} className="space-y-4 rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
        <div>
          <h2 className="break-words font-semibold">{source.account}</h2>
          <p className="mt-1 text-sm text-slate-600">{source.enabled ? '自动入库已开启' : '自动入库未开启'} · {source.items.length} 部作品</p>
          {source.refreshStatus === 'FAILED' && <p className="text-sm text-amber-800">最近一次刷新失败，展示上次读取的内容。</p>}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium">想看清单</summary>
          {source.items.length ? <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{source.items.map((work) =>
            <li key={work.id} className="flex min-w-0 gap-2 rounded-lg border border-slate-200 p-2">
              {work.coverUrl && <div className="w-9 shrink-0"><BgmPoster url={work.coverUrl} title={work.title} /></div>}
              <span className="break-words text-sm">{work.title}{work.year ? ` · ${work.year}` : ''}</span>
            </li>)}</ul> : <p className="mt-2 text-sm text-slate-600">暂无想看作品。</p>}
        </details>
        <div>
          <h3 className="text-sm font-semibold">最近操作</h3>
          {source.recent.length ? <ul className="mt-2 divide-y divide-slate-100">{source.recent.map((record) =>
            <li key={record.id} className="py-2 text-sm">
              <p>{record.title ?? '自动入库操作'} · {statuses[record.status] ?? '状态待核实'}</p>
              <p className="text-xs text-slate-600">{new Date(record.startedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
              {record.reason && <p className="break-words text-sm text-amber-800">{record.reason}</p>}
            </li>)}</ul> : <p className="mt-2 text-sm text-slate-600">暂无本人操作记录。</p>}
        </div>
      </section>)}
  </div>
}
