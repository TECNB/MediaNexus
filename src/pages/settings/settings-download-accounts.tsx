import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { checkDownloadAccount, confirmAccountAdoption, getDownloadAccounts, getOnboardingExecutions, previewAccountAdoption, SettingsApiError, updateAccountAccepting, updateAccountDefaults } from '@/lib/api/settings'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import type { AdoptionPlan, DownloadAccount, DownloadAccountList, DownloadCategory, OnboardingExecutionList } from '@/types/settings'
import { AccountBindings, AccountIssues, AccountPairs, accountBytes, accountCardClass, accountControlClass, accountTime, categories, categoryLabels, ConnectionVersions, executionLabels, stageLabels } from './settings-account-ui'
import { SettingsDialog } from './settings-dialog'
import { SettingsOnboarding } from './settings-onboarding'

type Props = { onDirtyChange: (dirty: boolean, pending?: boolean) => void; onNavigate: (url: string) => void }
const checkLabels = { UNKNOWN: '未知', PENDING: '待检查', HEALTHY: '检查正常', FAILED: '检查失败', NEEDS_ACTION: '需要处理' }
const defaultsFor = (data: DownloadAccountList) => Object.fromEntries(categories.map(category => [category, data.categoryDefaults.find(item => item.category === category)?.targetId ?? ''])) as Record<DownloadCategory, string>

export function DownloadAccounts({ onDirtyChange, onNavigate }: Props) {
  const [params] = useSearchParams()
  const [data, setData] = useState<DownloadAccountList | null>(null)
  const [executionList, setExecutionList] = useState<OnboardingExecutionList | null>(null)
  const [draft, setDraft] = useState<Record<DownloadCategory, string>>({ MOVIE: '', TV: '', ANIME: '', ADULT: '' })
  const [adoptionName, setAdoptionName] = useState('')
  const [adoption, setAdoption] = useState<AdoptionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [stale, setStale] = useState(false)
  const [confirm, setConfirm] = useState<'defaults' | 'adopt' | 'reload' | DownloadAccount | null>(null)
  const scope = useRef<AbortController | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const onboarding = params.get('action') === 'add' || params.has('plan') || params.has('execution')
  const changes = data ? categories.filter(category => draft[category] && draft[category] !== (data.categoryDefaults.find(item => item.category === category)?.targetId ?? '')).map(category => ({ category, targetId: draft[category] })) : []
  const dirty = changes.length > 0 || !!adoptionName
  useEffect(() => { if (!onboarding) onDirtyChange(dirty, !!busy); return () => { if (!onboarding) onDirtyChange(false) } }, [dirty, busy, onboarding, onDirtyChange])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  useEffect(() => {
    const controller = new AbortController()
    scope.current = controller
    setLoading(true); setError(''); setHistoryError('')
    getDownloadAccounts(controller.signal).then(result => {
      if (!controller.signal.aborted) { setData(result); setDraft(defaultsFor(result)); setStale(false) }
    }).catch(reason => {
      if (!controller.signal.aborted && !isJavaRequestCanceledError(reason)) setError(reason instanceof Error ? reason.message : '下载账号读取失败。')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    getOnboardingExecutions(controller.signal).then(result => {
      if (!controller.signal.aborted) setExecutionList(result)
    }).catch(reason => {
      if (!controller.signal.aborted && !isJavaRequestCanceledError(reason)) setHistoryError(reason instanceof Error ? reason.message : '执行记录读取失败。')
    })
    return () => controller.abort()
  }, [revision])
  function fail(reason: unknown) {
    if (scope.current?.signal.aborted || isJavaRequestCanceledError(reason)) return
    const conflict = reason instanceof SettingsApiError && reason.status === 409
    setStale(conflict)
    setError(conflict ? '注册版本或资源证据已变化。修改已保留，未自动重放；请重新读取账号或重新预览接管计划。' : reason instanceof Error ? reason.message : '操作失败，修改已保留。')
  }
  async function previewAdoption() {
    if (!data || busy) return
    setBusy('adoption'); setError(''); setMessage('')
    try {
      const result = await previewAccountAdoption(data.registryVersion, adoptionName.trim() || undefined, scope.current?.signal)
      if (!scope.current?.signal.aborted) { setAdoption(result); setAdoptionName(''); setStale(false) }
    } catch (reason) { fail(reason) }
    finally { if (!scope.current?.signal.aborted) setBusy('') }
  }
  async function check(account: DownloadAccount) {
    if (busy) return
    let checked = false
    setBusy(account.id); setError(''); setMessage('')
    try {
      await checkDownloadAccount(account.id, scope.current?.signal)
      checked = true
      const current = await getDownloadAccounts(scope.current?.signal)
      if (!scope.current?.signal.aborted) {
        setData(current); setDraft(defaultsFor(current))
        setMessage('已读取实际链路检查快照，请查看各阶段结果；本次未执行下载、挂载或扫描。')
      }
    } catch (reason) {
      fail(reason)
      if (checked && !scope.current?.signal.aborted) { setStale(true); setError('链路检查已执行，但账号概览未能刷新。请重新读取后再修改账号。') }
    }
    finally { if (!scope.current?.signal.aborted) setBusy('') }
  }
  async function commit() {
    if (!data || busy || confirm == null) return
    if (confirm === 'reload') { setConfirm(null); setAdoptionName(''); setAdoption(null); setRevision(value => value + 1); return }
    let acceptingCommitted = false
    setBusy('commit'); setError(''); setMessage('')
    try {
      if (confirm === 'defaults') {
        const result = await updateAccountDefaults(data.registryVersion, changes, scope.current?.signal)
        if (scope.current?.signal.aborted) return
        setData(result); setDraft(defaultsFor(result)); setMessage('已更新所选类别的后续新任务默认。未选类别和既有任务保持原归属。')
      } else if (confirm === 'adopt' && adoption) {
        await confirmAccountAdoption(adoption, scope.current?.signal)
        if (scope.current?.signal.aborted) return
        setAdoption(null); setRevision(value => value + 1); setMessage('已登记经过确认的主号关联，复用原有资源。')
      } else if (typeof confirm === 'object') {
        const result = await updateAccountAccepting(confirm.id, data.registryVersion, !confirm.acceptingNewTasks, scope.current?.signal)
        acceptingCommitted = true
        const current = await getDownloadAccounts(scope.current?.signal)
        if (scope.current?.signal.aborted) return
        setData(current); setDraft(defaultsFor(current))
        setMessage(result.account.acceptingNewTasks ? '已恢复接收新任务。' : '已停止接收新任务；现有媒体、外部挂载与旧任务访问保持。')
      }
      setStale(false)
    } catch (reason) {
      fail(reason)
      if (acceptingCommitted && !scope.current?.signal.aborted) { setStale(true); setError('接收资格已提交，但账号概览读取失败。请重新读取确认当前状态。') }
    }
    finally { if (!scope.current?.signal.aborted) { setBusy(''); setConfirm(null) } }
  }
  const selected = data?.accounts.find(account => account.id === params.get('account'))

  return <div className="space-y-5">
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800 outline-none focus:ring-2 focus:ring-red-300">{error}<button type="button" disabled={!!busy} className="ml-2 min-h-11 underline" onClick={() => dirty ? setConfirm('reload') : setRevision(value => value + 1)}>重新读取账号</button></div>}
    {onboarding ? <SettingsOnboarding key={params.get('plan') ?? params.get('execution') ?? 'new'} registryVersion={data?.registryVersion ?? null} planId={params.get('plan')} executionId={params.get('execution')} onDirtyChange={onDirtyChange} onNavigate={onNavigate} onRefreshRegistry={() => setRevision(value => value + 1)} /> : <>
      <section className={accountCardClass}><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">下载账号与入库目标</h2><p className="mt-2 text-sm leading-6 text-slate-600">按类别管理新任务的默认目标，查看实际容量、挂载和媒体库关联。</p>{data && <p className="mt-2 text-xs text-slate-500">注册版本 {data.registryVersion} · {data.managed ? '已接管' : '部署初始配置、未接管'}</p>}</div><div className="flex flex-wrap gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={!!busy || loading} onClick={() => dirty ? setConfirm('reload') : setRevision(value => value + 1)}>重新读取</Button><Button asChild className="min-h-11"><Link to="?tab=accounts&action=add">添加 PikPak 账号</Link></Button></div></div><p className="mt-4 text-xs leading-5 text-slate-500">已登记接通表示曾通过完整读回；当前健康以各阶段观测为准。切换默认只影响后续新任务，旧任务、Ani-RSS、Telegram 和已有媒体保留原归属。</p></section>
      {loading && !data ? <p role="status" className={accountCardClass}>正在读取下载账号…</p> : data && <>
        <section className={accountCardClass} aria-labelledby="category-defaults-title"><h2 id="category-defaults-title" className="font-semibold text-slate-950">各类别默认入库目标</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{categories.map(category => {
          const currentId = data.categoryDefaults.find(item => item.category === category)?.targetId
          const current = data.accounts.find(item => item.id === currentId)
          return <label key={category} className="block min-w-0 space-y-2 rounded-xl border border-slate-200 p-4 text-sm font-medium text-slate-900">{categoryLabels[category]}<span className="block break-words text-xs font-normal text-slate-600">当前：{!data.managed ? '部署初始配置、未接管' : current?.displayName ?? '尚未设置有效默认'}</span><select aria-label={`${categoryLabels[category]}默认入库目标`} className={accountControlClass} value={draft[category]} disabled={!data.managed || !!busy || loading} onChange={event => { setDraft(previous => ({ ...previous, [category]: event.target.value })); setMessage('') }}><option value="" disabled>请选择已接通且接收任务的账号</option>{data.accounts.filter(account => (account.acceptingNewTasks && account.bindings.some(binding => binding.category === category)) || account.id === currentId).map(account => <option key={account.id} value={account.id} disabled={!account.acceptingNewTasks || !account.bindings.some(binding => binding.category === category)}>{account.displayName}{account.acceptingNewTasks ? '' : '（已停止接收）'}</option>)}</select></label>
        })}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-slate-600">{changes.length ? '有未保存的类别默认修改；请先保存或重新读取后再执行其他账号操作。' : '仅选择本次需要变更的类别，其他类别保持不变。'}</p><Button type="button" className="min-h-11" disabled={!changes.length || !!busy || stale} onClick={() => setConfirm('defaults')}>保存类别默认</Button></div></section>
        {!data.managed && <section className={`${accountCardClass} space-y-4`}><h2 className="font-semibold text-slate-950">接管现有主号</h2><p className="text-sm leading-6 text-slate-600">读取现有路径与上游资源生成关联预览。证据充分并确认后，仅登记本站目标与绑定，不创建或修改上游资源。</p><label className="block space-y-2 text-sm text-slate-800">主号显示名（可选）<input name="adoptionDisplayName" className={accountControlClass} disabled={!!busy} value={adoptionName} onChange={event => setAdoptionName(event.target.value)} /></label><Button type="button" variant="outline" className="min-h-11" disabled={!!busy || !!changes.length} onClick={() => void previewAdoption()}>{busy === 'adoption' ? '读取证据中…' : '预览主号接管'}</Button>
          {adoption && <div className="space-y-5 rounded-xl border border-slate-200 p-4"><h3 className="font-medium text-slate-900">{adoption.displayName} · 接管预览</h3><p className="text-xs text-slate-500">计划版本 {adoption.planVersion} · 注册版本 {adoption.registryVersion}</p><AccountIssues issues={adoption.issues} /><ConnectionVersions versions={adoption.connectionVersions} />{adoption.proposedAccount ? <><AccountPairs items={[[ 'OpenList 存储', `${adoption.proposedAccount.openListStorageId} · ${adoption.proposedAccount.openListMountPath}`], ['CD2 云盘', `${adoption.proposedAccount.cloudName} · ${adoption.proposedAccount.cloudPath}`], ['挂载', adoption.proposedAccount.mountPoint]]} /><AccountBindings bindings={adoption.proposedAccount.bindings} accountId={adoption.proposedAccount.id} /></> : <p className="text-sm text-amber-900">现有证据不足，尚不能形成合法账号关联。</p>}<ul className="space-y-2 text-xs leading-5 text-slate-600">{adoption.evidence.map((evidence, index) => <li key={index} className="break-words">{stageLabels[evidence.stage]} · {evidence.resourceType} · {evidence.resourceId} · {evidence.summary} · {accountTime(evidence.observedAt)}</li>)}</ul><Button type="button" className="min-h-11" disabled={!!busy || !adoption.canConfirm || !adoption.proposedAccount || stale || adoption.registryVersion !== data.registryVersion} onClick={() => setConfirm('adopt')}>确认接管已有主号</Button></div>}
        </section>}
        {params.has('account') ? selected ? <section className={`${accountCardClass} space-y-5`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">{selected.displayName} · 账号详情</h2><Link to="?tab=accounts" className="inline-flex min-h-11 items-center text-sm text-slate-700 underline">查看全部账号</Link></div><AccountDetail account={selected} /><AccountBindings bindings={selected.bindings} accountId={selected.id} /></section> : <p role="alert" className={accountCardClass}>当前账号列表中未找到该目标，请重新读取或检查深链接。</p> : null}
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">{data.accounts.map(account => <section key={account.id} className={`${accountCardClass} space-y-4`}><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">{account.displayName}</h2><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">{account.acceptingNewTasks ? '接收新任务' : '停止接收新任务'}</span></div><AccountCapacityView account={account} /><p className="text-sm text-slate-600">类别默认：{account.defaultCategories.length ? account.defaultCategories.map(category => categoryLabels[category]).join('、') : '无'}</p><ul className="space-y-2 text-xs leading-5 text-slate-600">{account.checks.map(item => <li key={item.stage}>{stageLabels[item.stage]} · {checkLabels[item.state]} · {accountTime(item.checkedAt)}{item.message ? ` · ${item.message}` : ''}</li>)}</ul><div className="flex flex-wrap gap-3"><Button asChild variant="outline" className="min-h-11"><Link to={`?tab=accounts&account=${encodeURIComponent(account.id)}`}>账号详情</Link></Button><Button type="button" variant="outline" className="min-h-11" disabled={!!busy || dirty} onClick={() => void check(account)}>{busy === account.id ? '检查中…' : '检查实际链路'}</Button><Button type="button" variant="ghost" className="min-h-11" disabled={!!busy || dirty || stale || (account.acceptingNewTasks && account.defaultCategories.length > 0)} onClick={() => setConfirm(account)}>{account.acceptingNewTasks ? '停止接收新任务' : '恢复接收新任务'}</Button></div>{account.acceptingNewTasks && account.defaultCategories.length > 0 && <p className="text-xs leading-5 text-slate-500">仍承担类别默认，请先切换这些类别后再停止接收。</p>}</section>)}</div>
        {data.accounts.length === 0 && <p role="status" className={accountCardClass}>尚无已登记的接通账号。未接管时现有入口沿用部署初始配置；接入中的部分资源在执行记录中查看。</p>}
      </>}
      <section className={`${accountCardClass} space-y-4`}><h2 className="font-semibold text-slate-950">接入执行记录</h2>{historyError ? <p role="alert" className="text-sm text-red-700">{historyError}</p> : !executionList ? <p role="status" className="text-sm text-slate-600">正在读取执行记录…</p> : executionList.items.length ? <ul className="space-y-3">{executionList.items.map(execution => <li key={execution.id}><Link to={`?tab=accounts&execution=${encodeURIComponent(execution.id)}`} className="block min-h-11 rounded-xl border border-slate-200 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"><p className="break-words text-sm font-medium text-slate-900">{execution.displayName} · {executionLabels[execution.status]}</p><p className="mt-1 text-xs leading-5 text-slate-600">{execution.categories.map(category => categoryLabels[category]).join('、')} · {accountTime(execution.updatedAt)} · {execution.defaultsCommitted ? '本次默认切换已提交' : '默认尚未提交'}</p></Link></li>)}</ul> : <p className="text-sm text-slate-600">暂无已保留的接入执行记录。</p>}</section>
    </>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">{message}</p>}
    {confirm && <SettingsDialog title={confirm === 'defaults' ? '切换所选类别默认？' : confirm === 'adopt' ? '登记主号关联？' : confirm === 'reload' ? '丢弃修改并重新读取？' : confirm.acceptingNewTasks ? '停止接收新任务？' : '恢复接收新任务？'} confirmLabel={confirm === 'reload' ? '丢弃并重新读取' : '确认'} busy={!!busy} onCancel={() => setConfirm(null)} onConfirm={() => void commit()}>
      {confirm === 'defaults' ? <><ul className="space-y-2">{changes.map(change => <li key={change.category}>{categoryLabels[change.category]}：{data?.accounts.find(account => account.id === data.categoryDefaults.find(item => item.category === change.category)?.targetId)?.displayName ?? '尚未设置'} → {data?.accounts.find(account => account.id === change.targetId)?.displayName ?? change.targetId}</li>)}</ul><p>只影响所选类别的后续新任务；其他类别、旧任务和已有媒体保持原归属。</p></> : confirm === 'adopt' ? <p>仅登记已读回确认的现有资源，不新建挂载或覆盖原 AS 任务，不迁移已有媒体。</p> : confirm === 'reload' ? <p>未保存的类别默认修改和显示名输入将被丢弃，重新读取当前注册版本。</p> : <p>{confirm.displayName} 将{confirm.acceptingNewTasks ? '停止' : '恢复'}接收新任务。挂载、旧任务重试、字幕与既有媒体访问保留。</p>}
    </SettingsDialog>}
  </div>
}

function AccountCapacityView({ account }: { account: DownloadAccount }) {
  const capacity = account.capacity
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-medium text-slate-900">容量观测 · {capacity.state === 'AVAILABLE' ? '可用' : '暂不可用'}</p><p className="mt-2 text-sm text-slate-700">已用 {accountBytes(capacity.usedBytes)} ／ 总量 {accountBytes(capacity.totalBytes)} · 剩余 {accountBytes(capacity.freeBytes)}</p><p className="mt-2 text-xs leading-5 text-slate-500">{accountTime(capacity.observedAt)}{capacity.message ? ` · ${capacity.message}` : ''}</p></div>
}
function AccountDetail({ account }: { account: DownloadAccount }) {
  return <><AccountCapacityView account={account} /><AccountPairs items={[[ '目标 ID', account.id ], ['OpenList 存储', `${account.openListStorageId} · ${account.openListMountPath}`], ['OpenList 账号根', account.ingestPrefix], ['CD2 云盘', `${account.cloudName} · ${account.cloudPath}`], ['CD2 映射根', account.cloudDrivePrefix], ['本地挂载', account.mountPoint], ['媒体来源根', account.mediaSourcePrefix], ['更新时间', accountTime(account.updatedAt)]]} /><p className="text-xs leading-5 text-slate-500">已登记的路径和资源身份只读，不支持重绑或删除仍被历史任务引用的目标。</p></>
}

export function SettingsAccountBindings() {
  const [params] = useSearchParams()
  const [data, setData] = useState<DownloadAccountList | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    getDownloadAccounts(controller.signal).then(result => { if (!controller.signal.aborted) setData(result) }).catch(reason => { if (!controller.signal.aborted && !isJavaRequestCanceledError(reason)) setError(reason instanceof Error ? reason.message : '账号绑定读取失败。') })
    return () => controller.abort()
  }, [revision])
  const accounts = params.has('account') ? data?.accounts.filter(account => account.id === params.get('account')) : data?.accounts
  return <section className={`${accountCardClass} space-y-5`} aria-label="按账号的 AutoSymlink 绑定"><h2 className="text-lg font-semibold text-slate-950">按账号与类别的 AS 任务</h2><p className="text-sm leading-6 text-slate-600">与账号详情读取同一份关联，不在软件页另设全站唯一分类 UUID。</p>{error ? <div role="alert" className="text-sm text-red-700">{error}<Button type="button" variant="outline" className="ml-2 min-h-11" onClick={() => setRevision(value => value + 1)}>重新读取绑定</Button></div> : !data ? <p role="status" className="text-sm text-slate-600">正在读取账号绑定…</p> : accounts?.length ? accounts.map(account => <section key={account.id} className="space-y-4"><h3 className="font-semibold text-slate-900">{account.displayName}</h3><AccountBindings bindings={account.bindings} accountId={account.id} /><Link className="inline-flex min-h-11 items-center text-sm text-slate-700 underline" to={`?tab=accounts&account=${encodeURIComponent(account.id)}`}>查看该账号详情</Link></section>) : <p className="text-sm text-slate-600">{params.has('account') ? '未找到该账号关联，请核对深链接。' : data.managed ? '未返回已登记的账号绑定。' : '部署初始配置、未接管；此处尚无已确认的账号绑定。'}</p>}</section>
}
