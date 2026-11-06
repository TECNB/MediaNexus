import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import type { BgmAction, BgmItem, BgmItemOutcome, BgmPreview, BgmQuota, BgmRun } from '@/types/bgm-wishlist'
import { BgmPoster } from './bgm-poster'

const actions: Record<BgmAction, string> = { SINGLE: '单部入库', SELECTED: '勾选批量入库', LATEST: '最新优先入库', DAILY: '每日自动入库' }
export function beijingTime(value: string | null) {
  if (!value) return '尚未结束'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date)
}
function destination(item: BgmItem) {
  const target = item.identity
  if (!target) return '目录待匹配'
  return target.mediaType === 'MOVIE' ? `电影库 · ${target.title}` : `动漫库 · ${target.title} · 第 ${target.seasonNumber ?? '待确认'} 季`
}
function Quota({ quota }: { quota: BgmQuota }) {
  return <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><strong>任务归属：{quota.ownerUsername}</strong><p className="mt-1">{quota.exempt ? `管理员免每日创建次数限制 · 今日已用 ${quota.used}` : `今日已用 ${quota.used} / ${quota.limit} · 剩余 ${quota.remaining ?? '未知'} 次`}</p><p className="mt-1 text-xs text-slate-500">额度是每日创建次数，不是存储容量；北京时间次日 00:00 恢复，预览不预留额度。创建失败也可能消耗额度。</p></div>
}
function Cards({ items, label }: { items: { item: BgmItem; reason?: string | null; task?: BgmItemOutcome['task'] }[]; label: string }) {
  if (!items.length) return null
  return <div className="space-y-2"><h4 className="font-semibold">{label}（{items.length}）</h4><div className="grid gap-3 sm:grid-cols-2">{items.map(({ item, reason, task }, index) => <article key={`${item.subjectId}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 p-3"><div className="w-16 shrink-0"><BgmPoster url={item.coverUrl} title={item.title} /></div><div className="min-w-0 text-sm"><strong>{item.title || item.originalTitle || `BGM #${item.subjectId}`}</strong><p className="mt-1 text-slate-500">{item.year ?? '年份未知'} · {destination(item)}</p>{reason && <p className="mt-1 text-rose-700">{reason}</p>}{task && <Link className="mt-2 inline-block text-sky-700 underline" to={`/tasks/${encodeURIComponent(task.taskType.toLowerCase())}/${encodeURIComponent(task.taskId)}`}>查看任务／恢复</Link>}</div></article>)}</div></div>
}
function Skipped({ items }: { items: BgmItemOutcome[] }) {
  if (!items.length) return null
  return <details className="rounded-xl bg-slate-50 p-4 text-sm"><summary className="cursor-pointer font-semibold">已跳过（{items.length}）</summary><ul className="mt-3 space-y-2">{items.map((entry, index) => <li key={`${entry.item.subjectId}-${index}`}>{entry.item.title} · {entry.reason?.message ?? '原因未提供'}</li>)}</ul></details>
}
export function PreviewPanel({ preview, working, onConfirm, onClose }: { preview: BgmPreview; working: boolean; onConfirm: () => void; onClose: () => void }) {
  return <section className="space-y-4 rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200" aria-label="入库预览">
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-semibold">{actions[preview.action]}预览</h2><p className="mt-1 text-sm text-slate-500">确认后仅处理本次预览范围，执行前会重新检查；创建任务不表示已在库。</p></div><Button type="button" size="sm" variant="outline" disabled={working} onClick={onClose}>关闭</Button></div>
    <Quota quota={preview.quota} /><p className="text-sm text-slate-600">符合初步条件 {preview.items.length} 项，按当前额度预计可创建 {preview.estimatedCreations} 项；实际用量与结果以执行后为准。</p>
    <Cards label="本次预览作品" items={preview.items.map((item) => ({ item }))} /><Skipped items={preview.skipped} />
    <Button type="button" disabled={working || preview.estimatedCreations <= 0} onClick={onConfirm}>{working ? '提交中…' : `确认并立即入库（预计 ${preview.estimatedCreations} 项）`}</Button>
  </section>
}
export function RunDetails({ run }: { run: BgmRun }) {
  const quota = run.quotaAfter ?? run.quotaBefore
  return <div className="space-y-4 pt-4"><p className="text-sm text-slate-600">{actions[run.action]} · {run.triggerType === 'SCHEDULED' ? '自动化触发 · 定时调度器' : `手动触发 · ${run.actorUserId == null ? '操作人未知' : `管理员 #${run.actorUserId}`}`} · 来源 {run.source.bgmUsername} · 归属 {run.source.ownerUsername}</p><p className="text-sm text-slate-500">开始 {beijingTime(run.startedAt)} · 结束 {beijingTime(run.finishedAt)}（北京时间） · {run.status}</p>{run.reason && <p role="alert" className="text-sm text-rose-700">{run.reason.message}</p>}{quota && <Quota quota={quota} />}<Cards label="已创建" items={run.created.map((entry) => ({ item: entry.item, task: entry.task }))} /><Cards label="创建失败" items={run.failed.map((entry) => ({ item: entry.item, reason: entry.reason?.message, task: entry.task }))} /><Skipped items={run.skipped} /><p className="text-xs text-slate-500">任务创建不表示已在库；任务失败请在任务中心恢复。</p></div>
}
export function RunTitle({ run }: { run: BgmRun }) { return <span>{actions[run.action]} · {run.triggerType === 'SCHEDULED' ? '自动化触发' : '手动触发'} · {beijingTime(run.startedAt)} · 创建 {run.created.length} / 失败 {run.failed.length} / 跳过 {run.skipped.length}</span> }
