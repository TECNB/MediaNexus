import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { AccountBinding, AccountIssue, AccountStage, ConnectionVersion, DefaultChange, DownloadCategory } from '@/types/settings'

export const accountCardClass = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'
export const accountControlClass = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500'
export const categoryLabels: Record<DownloadCategory, string> = { MOVIE: '电影', TV: '剧集', ANIME: '动漫整季', ADULT: 'Adult' }
export const categories: DownloadCategory[] = ['MOVIE', 'TV', 'ANIME', 'ADULT']
export const stageLabels: Record<AccountStage, string> = { OPENLIST_STORAGE: 'OpenList 存储', MEDIA_DIRECTORIES: '媒体目录', CD2_CLOUD: 'CD2 云盘', CD2_MOUNT: 'CD2 系统挂载', MEDIA_READABLE: '媒体路径可读', AS_BINDINGS: 'AutoSymlink 任务', EMBY_PATHS: 'Emby 库目录', READBACK: '关联读回核对', LOCAL_COMMIT: '登记目标与类别默认' }
export const executionLabels = { PENDING: '等待执行', RUNNING: '执行中', CONNECTED: '已接通', SUCCEEDED: '已完成', FAILED: '失败', NEEDS_ACTION: '需要处理', INTERRUPTED: '已中断' }
export function accountTime(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚未观测' }
export function accountBytes(value: number | null) {
  if (value == null) return '未知'
  if (value < 1024) return `${value} B`
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 4)
  return `${(value / 1024 ** power).toFixed(2)} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][power]}`
}
export function AccountPairs({ items }: { items: [string, ReactNode][] }) {
  return <dl className="space-y-3 text-sm">{items.map(([label, value]) => <div key={label} className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><dt className="text-slate-500">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-slate-900">{value ?? '未提供'}</dd></div>)}</dl>
}
export function AccountIssues({ issues }: { issues: AccountIssue[] }) {
  return issues.length ? <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{issues.map((issue, index) => <li key={`${issue.code}-${index}`}><strong>{issue.stage ? `${stageLabels[issue.stage]}：` : ''}{issue.field ? `${issue.field} · ` : ''}</strong>{issue.message}</li>)}</ul> : null
}
export function ConnectionVersions({ versions }: { versions: ConnectionVersion[] }) {
  return <div className="space-y-2"><h3 className="text-sm font-semibold text-slate-900">计划使用的连接与模板版本</h3>{versions.length ? <ul className="flex flex-wrap gap-2">{versions.map(version => <li key={version.integration} className="rounded-lg bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-700">{version.integration} · 连接 {version.effectiveVersion}{version.templateVersion == null ? '' : ` · 模板 ${version.templateVersion}`}</li>)}</ul> : <p className="text-sm text-slate-600">未返回可用的连接版本；请查看计划缺项。</p>}</div>
}
export function DefaultChanges({ changes }: { changes: DefaultChange[] }) {
  return <div className="space-y-2"><h3 className="text-sm font-semibold text-slate-900">拟变更的类别默认</h3>{changes.length ? <ul className="space-y-2 text-sm text-slate-700">{changes.map(change => <li className="break-words" key={change.category}>{categoryLabels[change.category]}：{change.previousTargetId ?? '部署初始配置／尚未设置'} → {change.targetId}</li>)}</ul> : <p className="text-sm text-slate-600">本次未返回类别默认变更。</p>}</div>
}
export function AccountBindings({ bindings, accountId }: { bindings: AccountBinding[]; accountId: string }) {
  return <div className="space-y-4">{bindings.map(binding => <section key={binding.category} className="min-w-0 rounded-xl border border-slate-200 p-4"><h3 className="mb-4 font-medium text-slate-950">{categoryLabels[binding.category]}</h3><AccountPairs items={[
    ['入库根目录', binding.rootPath], ['媒体来源', binding.mediaSourceRoot], ...(binding.animePathTemplate ? [['动漫完整模板', binding.animePathTemplate] as [string, string]] : []), ['AS 任务 UUID', binding.asUuid], ['完整运行请求体', binding.asRequestBodyConfigured ? '已配置 · 服务端持有，不回显' : '未配置'], ['STRM 输出', binding.strmRootPath], ...(binding.embyLibraries?.length ? binding.embyLibraries.map(library => ['Emby 媒体库', `${library.libraryName} · ${library.libraryId} → ${library.path}`] as [string, string]) : [['Emby 媒体库', `${binding.embyLibraryName} · ${binding.embyLibraryId}`] as [string, string]]),
  ]} /></section>)}{bindings.length === 0 && <p className="text-sm text-slate-600">未返回类别关联，不能据此推测任务已配置。</p>}<Link className="inline-flex min-h-11 items-center text-sm font-medium text-slate-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500" to={`?tab=connections&group=autosymlink&account=${encodeURIComponent(accountId)}`}>在 AutoSymlink 面板查看同一份账号绑定</Link></div>
}
