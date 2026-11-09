import { useCallback, useEffect, useState } from 'react'
import { Cable, HardDrive, Settings2, ShieldCheck } from 'lucide-react'
import { Link, useBeforeUnload, useBlocker, useNavigate, useSearchParams } from 'react-router-dom'

import { PageContainer } from '@/components/layout/page-container'
import { cn } from '@/lib/utils'
import { getSettingsDirectory } from '@/lib/api/settings'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import type { SettingsGroupSummary } from '@/types/settings'
import { Button } from '@/components/ui/button'
import { SettingsWeComBindings } from './settings-wecom-bindings'
import { SettingsGroupEditor } from './settings-group-editor'
import { SettingsDialog } from './settings-dialog'
import { DownloadAccounts, SettingsAccountBindings } from './settings-download-accounts'
import { connectionSections, systemSections } from './settings-catalog'

const tabs = [
  { id: 'accounts', label: '下载账号', icon: HardDrive },
  { id: 'connections', label: '软件连接', icon: Cable },
  { id: 'system', label: '系统参数', icon: Settings2 },
]

export function SettingsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [nextUrl, setNextUrl] = useState<string | null>(null)
  const onNavigate = useCallback((url: string) => { setEditing({ dirty: false, pending: false }); setNextUrl(url) }, [])
  const [editing, setEditing] = useState({ dirty: false, pending: false })
  const onDirtyChange = useCallback((dirty: boolean, pending = false) => setEditing({ dirty, pending }), [])
  const blocker = useBlocker(editing.dirty || editing.pending)
  useEffect(() => { if (nextUrl) { navigate(nextUrl); setNextUrl(null) } }, [nextUrl, navigate])
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => { if (editing.dirty || editing.pending) { event.preventDefault(); event.returnValue = '' } }, [editing]))
  const tab = tabs.some(item => item.id === params.get('tab')) ? params.get('tab') : 'accounts'

  return (
    <PageContainer title="设置中心" description="管理软件连接与系统参数，查看配置来源和实际生效状态。">
      <nav aria-label="设置中心" className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Link key={id} to={`?tab=${id}`} aria-current={tab === id ? 'page' : undefined}
            className={cn('flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500', tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
            <Icon aria-hidden="true" className="hidden h-4 w-4 sm:block" />{label}
          </Link>
        ))}
      </nav>
      {tab === 'accounts' ? <DownloadAccounts key={params.toString()} onDirtyChange={onDirtyChange} onNavigate={onNavigate} /> : <SettingsGroups tab={tab === 'system' ? 'system' : 'connections'} onDirtyChange={onDirtyChange} />}
      {blocker.state === 'blocked' && <SettingsDialog title={editing.pending ? "配置请求仍在进行" : editing.dirty ? "离开未保存的配置？" : "继续离开设置？"} confirmLabel={editing.dirty ? "丢弃修改并离开" : "继续离开"} confirmDisabled={editing.pending} onCancel={() => blocker.reset()} onConfirm={() => blocker.proceed()}><p>{editing.pending ? "请先留在页面等待请求完成，再核对保存结果。关闭页面不代表服务端操作已取消。" : editing.dirty ? "当前修改尚未保存，离开将丢失这些修改。" : "配置请求已经完成，可以继续离开。"}</p></SettingsDialog>}
      <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />仅管理员可管理 · 凭据不回显 · 连接检查不执行下载或清理</p>
    </PageContainer>
  )
}

function SettingsGroups({ tab, onDirtyChange }: { tab: 'system' | 'connections'; onDirtyChange: (dirty: boolean, pending?: boolean) => void }) {
  const [params] = useSearchParams()
  const [directory, setDirectory] = useState<SettingsGroupSummary[] | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    getSettingsDirectory(controller.signal).then(result => { if (!controller.signal.aborted) setDirectory(result.groups) }).catch(reason => { if (!controller.signal.aborted && !isJavaRequestCanceledError(reason)) setError(reason instanceof Error ? reason.message : '配置目录读取失败。') })
    return () => controller.abort()
  }, [revision])
  const sections = tab === 'connections' ? connectionSections : systemSections
  const groups = sections.flatMap(section => section.groups)
  const selectedId = params.get('group') ?? groups.find(item => directory?.some(summary => summary.id === item.id))?.id ?? groups[0].id
  const group = groups.find(item => item.id === selectedId)
  const available = directory?.some(item => item.id === selectedId)
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
    <nav aria-label={tab === 'connections' ? '软件分组' : '系统参数分组'} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 lg:self-start">
      {sections.map(section => <div key={section.label}><p className="px-3 pb-2 pt-1 text-xs font-medium text-slate-500">{section.label}</p><div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">{section.groups.map(item => <Link key={item.id} to={`?tab=${tab}&group=${item.id}`} aria-current={selectedId === item.id ? 'page' : undefined} className={cn('flex min-h-11 items-center rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500', selectedId === item.id ? 'bg-slate-100 font-semibold text-slate-950' : 'text-slate-600 hover:bg-slate-50')}>{item.label}</Link>)}</div></div>)}
    </nav>
    <div className="min-w-0 space-y-5">
      {error ? <section className="rounded-2xl border border-red-200 bg-white p-5"><p role="alert" className="text-sm text-red-700">{error}</p><Button type="button" variant="outline" className="mt-4 min-h-11" onClick={() => setRevision(value => value + 1)}>重新读取配置目录</Button></section> : !directory ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-6">正在读取配置目录…</p> : available && group ? <><p className="px-1 text-sm leading-6 text-slate-600">{group.description}</p><SettingsGroupEditor key={selectedId} id={selectedId} onDirtyChange={onDirtyChange} /></> : <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-slate-950">{group?.label ?? '未识别的配置组'}</h2><p role="status" className="mt-3 text-sm text-slate-600">{group ? '服务尚未提供该配置组，未读取或修改任何配置。' : '该深链接不属于当前面板，请从分组导航选择配置。'}</p></section>}
      {available && selectedId === 'wecom' && <SettingsWeComBindings />}
      {selectedId === 'autosymlink' && <SettingsAccountBindings />}
      {tab === 'system' && <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h3 className="font-medium text-slate-900">其他参数</h3><p className="mt-2 text-sm text-slate-600">每项配置仅在所属面板维护。</p><div className="mt-4 flex flex-wrap gap-2">{[{ id: 'openlist', label: '入库与下载' }, { id: 'tmdb', label: '元数据与搜索' }, { id: 'wecom', label: '消息通知' }].map(item => <Link key={item.id} to={`?tab=connections&group=${item.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">{item.label}</Link>)}</div></section>}
    </div>
  </div>
}
