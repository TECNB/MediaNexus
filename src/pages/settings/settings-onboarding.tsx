import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { authorizeNativeDav, continueOnboardingExecution, createOnboardingPlan, executeOnboardingPlan, getOnboardingExecution, getOnboardingPlan, SettingsApiError } from '@/lib/api/settings'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import type { AccountPathOverrides, DownloadCategory, OnboardingExecution, OnboardingPlan, PikPakAuthorization } from '@/types/settings'
import { AccountIssues, AccountPairs, accountCardClass, accountControlClass, accountTime, categories, categoryLabels, ConnectionVersions, DefaultChanges, executionLabels, stageLabels } from './settings-account-ui'
import { SettingsDialog } from './settings-dialog'

type Props = { registryVersion: number | null; planId: string | null; executionId: string | null; onDirtyChange: (dirty: boolean, pending?: boolean) => void; onNavigate: (url: string) => void; onRefreshRegistry: () => void }
export function SettingsOnboarding({ registryVersion, planId, executionId, onDirtyChange, onNavigate, onRefreshRegistry }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState('')
  const [alias, setAlias] = useState('')
  const [davEndpoint, setDavEndpoint] = useState('https://dav.pikpak.ai/')
  const [davUsername, setDavUsername] = useState('')
  const [davPassword, setDavPassword] = useState('')
  const [selected, setSelected] = useState<DownloadCategory[]>([])
  const [platform, setPlatform] = useState<PikPakAuthorization['platform']>('web')
  const [authMode, setAuthMode] = useState<'password' | 'token'>('password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [paths, setPaths] = useState<Record<string, string>>({})
  const [plan, setPlan] = useState<OnboardingPlan | null>(null)
  const [execution, setExecution] = useState<OnboardingExecution | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!!planId || !!executionId)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [confirmation, setConfirmation] = useState<'execute' | 'continue' | null>(null)
  const scope = useRef<AbortController | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const isForm = !planId && !executionId
  const dirty = !!(davUsername || davPassword) || isForm && !submitted && !!(name || alias || selected.length || username || password || refreshToken || captchaToken || deviceId || Object.values(paths).some(Boolean) || platform !== 'web' || authMode !== 'password')
  useEffect(() => { onDirtyChange(dirty, busy); return () => onDirtyChange(false) }, [dirty, busy, onDirtyChange])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  useEffect(() => {
    const controller = new AbortController()
    scope.current = controller
    let timer: ReturnType<typeof setTimeout> | undefined
    setError(''); setStale(false)
    async function read() {
      try {
        if (executionId) {
          const result = await getOnboardingExecution(executionId, controller.signal)
          if (controller.signal.aborted) return
          setExecution(result)
          if (result.status === 'PENDING' || result.status === 'RUNNING') timer = setTimeout(() => void read(), 3000)
        } else if (planId) {
          const result = await getOnboardingPlan(planId, controller.signal)
          if (!controller.signal.aborted) setPlan(result)
        }
      } catch (reason) {
        if (!controller.signal.aborted && !isJavaRequestCanceledError(reason)) setError(reason instanceof Error ? reason.message : '接入记录读取失败，请重试。')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    if (!isForm) void read()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [planId, executionId, isForm, revision])

  function fail(reason: unknown) {
    if (isJavaRequestCanceledError(reason) || scope.current?.signal.aborted) return
    const conflict = reason instanceof SettingsApiError && reason.status === 409
    setStale(conflict)
    setError(conflict ? '版本或外部证据已变化。未重放操作；请重新读取记录或重新生成计划。' : reason instanceof Error ? reason.message : '操作失败，请修正后重试。')
  }
  async function preview(event: FormEvent) {
    event.preventDefault()
    if (busy || registryVersion == null) return
    if (!name.trim() || !selected.length || (authMode === 'token' ? !refreshToken.trim() : !username.trim() || !password.trim())) {
      setError('请填写显示名、有效授权，并至少选择一个媒体类别。'); return
    }
    const authorization: PikPakAuthorization = { platform, ...(authMode === 'token' ? { refreshToken } : { username: username.trim(), password }), ...(captchaToken.trim() ? { captchaToken } : {}), ...(deviceId.trim() ? { deviceId } : {}) }
    const pathOverrides: AccountPathOverrides = {}
    for (const key of ['ingestPrefix', 'cloudDrivePrefix', 'mediaSourcePrefix'] as const) if (paths[key]) pathOverrides[key] = paths[key]
    for (const category of selected) {
      const override = Object.fromEntries((['rootPath', 'animePathTemplate', 'strmRootPath'] as const).filter(key => paths[`${category}.${key}`]).map(key => [key, paths[`${category}.${key}`]]))
      if (Object.keys(override).length) pathOverrides.categories = { ...pathOverrides.categories, [category]: override }
    }
    setBusy(true); setError('')
    try {
      const result = await createOnboardingPlan({ expectedRegistryVersion: registryVersion, displayName: name.trim(), ...(alias.trim() ? { accountAlias: alias.trim() } : {}), categories: selected, authorization, ...(Object.keys(pathOverrides).length ? { pathOverrides } : {}) }, scope.current?.signal)
      if (scope.current?.signal.aborted) return
      setSubmitted(true); setPassword(''); setRefreshToken(''); setCaptchaToken(''); setDeviceId(''); setUsername(''); setName(''); setAlias(''); setSelected([]); setPaths({})
      onNavigate(`?tab=accounts&plan=${encodeURIComponent(result.id)}`)
    } catch (reason) { fail(reason) }
    finally { if (!scope.current?.signal.aborted) setBusy(false) }
  }
  async function saveNativeDav(event: FormEvent) {
    event.preventDefault()
    if (busy || !plan) return
    setBusy(true); setError('')
    try {
      const result = await authorizeNativeDav(plan, {
        endpoint: davEndpoint.trim(), username: davUsername.trim(), password: davPassword,
      }, scope.current?.signal)
      if (scope.current?.signal.aborted) return
      setPlan(result); setDavUsername(''); setDavPassword('')
    } catch (reason) { fail(reason) }
    finally { if (!scope.current?.signal.aborted) setBusy(false) }
  }

  async function commit() {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (confirmation === 'execute' && plan) {
        const result = await executeOnboardingPlan(plan, scope.current?.signal)
        if (!scope.current?.signal.aborted) onNavigate(`?tab=accounts&execution=${encodeURIComponent(result.id)}`)
      } else if (confirmation === 'continue' && execution) {
        const result = await continueOnboardingExecution(execution, scope.current?.signal)
        if (!scope.current?.signal.aborted) { setExecution(result); setRevision(value => value + 1) }
      }
    } catch (reason) { fail(reason) }
    finally { if (!scope.current?.signal.aborted) { setBusy(false); setConfirmation(null) } }
  }
  const updatePath = (key: string, value: string) => setPaths(previous => ({ ...previous, [key]: value }))

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="?tab=accounts" className="inline-flex min-h-11 items-center text-sm font-medium text-slate-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">返回下载账号</Link>{isForm && <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onRefreshRegistry}>重新读取账号版本</Button>}{!isForm && <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setRevision(value => value + 1)}>重新读取记录</Button>}</div>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800 outline-none focus:ring-2 focus:ring-red-300">{error}</div>}
    {isForm ? <form onSubmit={preview} className={accountCardClass} aria-label="添加 PikPak 账号">
      <h2 className="text-lg font-semibold text-slate-950">添加 PikPak 账号</h2><p className="mt-2 text-xs text-slate-500">注册版本：{registryVersion ?? '尚未读取'}</p><p className="mt-2 text-sm leading-6 text-slate-600">先生成准确的接入计划，确认后才执行外部变更。仅为所选类别建立关联；全部核对通过后才可能切换所选类别的新任务默认。</p>
      <fieldset disabled={busy} className="mt-6 space-y-6"><legend className="sr-only">账号与授权</legend>
        <label className="block space-y-2 text-sm font-medium text-slate-900">显示名<input name="accountDisplayName" className={accountControlClass} value={name} onChange={event => setName(event.target.value)} required /></label>
        <label className="block space-y-2 text-sm font-medium text-slate-900">路径别名（可选）<input name="accountAlias" className={accountControlClass} placeholder="media-b" maxLength={32} pattern="[a-z][a-z0-9-]*" value={alias} onChange={event => setAlias(event.target.value)} aria-describedby="pikpak-alias-help" /></label>
        <p id="pikpak-alias-help" className="text-xs leading-5 text-slate-600">用于 CD2、AS 和 STRM。只填写不含个人信息的短名，例如 media-b；留空由系统分配，不使用邮箱。</p>
        <fieldset><legend className="mb-2 text-sm font-medium text-slate-900">媒体类别（至少选择一项）</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{categories.map(category => <label key={category} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><input type="checkbox" className="h-5 w-5 accent-slate-900" checked={selected.includes(category)} onChange={event => setSelected(previous => event.target.checked ? [...previous, category] : previous.filter(value => value !== category))} />{categoryLabels[category]}</label>)}</div></fieldset>
        <div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium text-slate-900">授权方式<select className={accountControlClass} value={authMode} onChange={event => { setAuthMode(event.target.value as typeof authMode); setPassword(''); setRefreshToken('') }}><option value="password">用户名和密码</option><option value="token">Refresh Token</option></select></label><label className="block space-y-2 text-sm font-medium text-slate-900">平台<select className={accountControlClass} value={platform} onChange={event => setPlatform(event.target.value as typeof platform)}><option value="web">Web</option><option value="android">Android</option><option value="pc">PC</option></select></label></div>
        {authMode === 'token' ? <label className="block space-y-2 text-sm font-medium text-slate-900">Refresh Token<input name="pikpakRefreshToken" type="password" autoComplete="new-password" className={accountControlClass} value={refreshToken} onChange={event => setRefreshToken(event.target.value)} required /></label> : <div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium text-slate-900">用户名／邮箱<input name="pikpakUsername" autoComplete="off" className={accountControlClass} value={username} onChange={event => setUsername(event.target.value)} required /></label><label className="block space-y-2 text-sm font-medium text-slate-900">密码<input name="pikpakPassword" type="password" autoComplete="new-password" className={accountControlClass} value={password} onChange={event => setPassword(event.target.value)} required /></label></div>}
        <p className="text-xs leading-5 text-slate-600">授权仅提交到本站服务端，读取响应不返回原值，不在浏览器持久保存。失败时保留当前输入供修正；成功生成计划后清除授权输入。</p>
        <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer py-2 text-sm font-medium text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">高级路径与风控参数（可选）</summary><p className="mt-3 text-xs leading-5 text-slate-600">留空使用当前部署模板。路径范围及冲突由服务端验证，合法中文和空格可以保留；AS UUID 由真实创建／读回取得。</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{[['ingestPrefix', 'OpenList 账号根路径'], ['cloudDrivePrefix', 'CD2 映射根路径'], ['mediaSourcePrefix', '媒体来源根路径']].map(([key, label]) => <label key={key} className="block min-w-0 space-y-2 text-sm text-slate-800">{label}<input className={accountControlClass} value={paths[key] ?? ''} onChange={event => updatePath(key, event.target.value)} /></label>)}{selected.flatMap(category => (['rootPath', 'strmRootPath', ...(category === 'ANIME' ? ['animePathTemplate'] : [])] as const).map(key => <label key={`${category}.${key}`} className="block min-w-0 space-y-2 text-sm text-slate-800">{categoryLabels[category]} · {key === 'rootPath' ? '入库目录' : key === 'strmRootPath' ? 'STRM 输出' : '完整动漫路径模板'}<input className={accountControlClass} value={paths[`${category}.${key}`] ?? ''} onChange={event => updatePath(`${category}.${key}`, event.target.value)} /></label>))}<label className="block space-y-2 text-sm text-slate-800">Captcha Token<input type="password" autoComplete="new-password" className={accountControlClass} value={captchaToken} onChange={event => setCaptchaToken(event.target.value)} /></label><label className="block space-y-2 text-sm text-slate-800">Device ID<input autoComplete="off" className={accountControlClass} value={deviceId} onChange={event => setDeviceId(event.target.value)} /></label></div></details>
        <div className="flex flex-wrap items-center justify-between gap-4"><p role="status" className="text-sm text-slate-600">{dirty ? '有未提交输入' : '尚未提交接入计划'}</p><Button type="submit" className="min-h-11" disabled={busy || registryVersion == null}>{busy ? '生成计划中…' : '预览接入计划'}</Button></div>
      </fieldset>
    </form> : loading && !plan && !execution ? <p role="status" className={accountCardClass}>正在读取接入记录…</p> : plan ? <section className={`${accountCardClass} space-y-6`} aria-label="接入计划预览">
      <div><h2 className="text-lg font-semibold text-slate-950">{plan.displayName} · 接入计划</h2><p className="mt-2 break-words text-xs text-slate-500">计划 {plan.id} · 版本 {plan.planVersion} · 注册版本 {plan.registryVersion} · {accountTime(plan.updatedAt)}</p></div>
      {plan.authorizationConfigured && plan.resources.some(resource => resource.stage === 'CD2_PLAYBACK_CLOUD') && <form onSubmit={saveNativeDav} className="space-y-4 rounded-xl border border-slate-200 p-4" aria-label="官方 WebDAV 授权">
        <h3 className="font-semibold text-slate-900">{plan.issues.some(issue => issue.code === 'NATIVE_DAV_REQUIRED') ? '等待开启 PikPak 官方 WebDAV' : '官方 WebDAV 授权已验证'}</h3>
        <p className="text-sm leading-6 text-slate-600">在 PikPak「设置 → 访问和集成 → WebDAV」开启并创建专用凭据，再回到这里填写。保存只验证授权，不创建挂载。</p>
        <fieldset disabled={busy || stale} className="grid gap-3 sm:grid-cols-3">
          <legend className="sr-only">官方 WebDAV 凭据</legend>
          <label className="block space-y-2 text-sm font-medium text-slate-900">接入地址<input required name="nativeDavEndpoint" className={accountControlClass} value={davEndpoint} onChange={event => setDavEndpoint(event.target.value)} /></label>
          <label className="block space-y-2 text-sm font-medium text-slate-900">WebDAV 用户名<input required name="nativeDavUsername" autoComplete="off" className={accountControlClass} value={davUsername} onChange={event => setDavUsername(event.target.value)} /></label>
          <label className="block space-y-2 text-sm font-medium text-slate-900">WebDAV 密码<input required type="password" name="nativeDavPassword" autoComplete="new-password" className={accountControlClass} value={davPassword} onChange={event => setDavPassword(event.target.value)} /></label>
        </fieldset>
        <Button type="submit" variant="outline" className="min-h-11" disabled={busy || stale}>验证并保存授权</Button>
      </form>}
      <AccountIssues issues={plan.issues} /><ConnectionVersions versions={plan.connectionVersions} />
      <AccountPairs items={[[ '目标 ID', plan.targetId ], ['媒体类别', plan.categories.map(category => categoryLabels[category]).join('、')], ['OpenList 根路径', plan.ingestPrefix], ['CD2 映射根路径', plan.cloudDrivePrefix], ['媒体来源根路径', plan.mediaSourcePrefix], ['授权状态', plan.authorizationConfigured ? '已受保护保存（最长 24 小时）· 不回显' : '授权未配置或已清除，请重新提供授权并预览']]} />
      <div className="space-y-3"><h3 className="font-semibold text-slate-900">类别路径与媒体库</h3>{plan.bindings.map(binding => <div className="rounded-xl border border-slate-200 p-4" key={binding.category}><h4 className="mb-3 text-sm font-medium text-slate-900">{categoryLabels[binding.category]}</h4><AccountPairs items={[[ '入库目录', binding.rootPath ], ['媒体来源', binding.mediaSourceRoot], ['STRM 输出', binding.strmRootPath], ...(binding.embyLibraries?.length ? binding.embyLibraries.map(library => ['Emby 库目录', `${library.libraryName} · ${library.libraryId} → ${library.path}`] as [string, string]) : [['Emby 库', binding.embyLibraryId ?? '缺少既有媒体库关联'] as [string, string]]), ...(binding.animePathTemplate ? [['动漫模板', binding.animePathTemplate] as [string, string]] : [])]} /></div>)}</div>
      <div className="space-y-3"><h3 className="font-semibold text-slate-900">实际资源变更清单</h3>{plan.resources.length ? <ul className="space-y-3">{plan.resources.map((resource, index) => <li key={index} className="min-w-0 rounded-xl border border-slate-200 p-4 text-sm leading-6"><p className="font-medium text-slate-900">{{ CREATE: '新增', REUSE: '复用', APPEND: '追加', VERIFY: '验证' }[resource.action]} · {stageLabels[resource.stage]}</p><p className="break-words text-slate-700">{resource.summary}</p><p className="break-words text-xs text-slate-500">{resource.resourceType}{resource.resourceId ? ` · ${resource.resourceId}` : ''}{resource.path ? ` · ${resource.path}` : ''}</p></li>)}</ul> : <p className="text-sm text-slate-600">尚无可执行资源清单，请查看缺项。</p>}</div>
      <DefaultChanges changes={plan.defaultChanges} /><p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">执行会在外部软件创建或追加以上资源。只有全部必要关联读回通过后才能切换所选类别默认；未选类别、旧任务和原媒体位置保持原归属。配置接通不代表影片播放已验证。</p>
      <div className="flex flex-wrap gap-3"><Button type="button" className="min-h-11" disabled={busy || !plan.canExecute || stale} onClick={() => setConfirmation('execute')}>确认并执行接入</Button><Link to="?tab=accounts&action=add" className="inline-flex min-h-11 items-center px-3 text-sm text-slate-700 underline">重新填写授权并预览</Link></div>{!plan.canExecute && <p className="text-sm text-amber-900">计划当前不可执行，请先处理以上缺项。</p>}
    </section> : execution ? <section className={`${accountCardClass} space-y-5`} aria-label="接入执行记录">
      <div><h2 className="text-lg font-semibold text-slate-950">{execution.displayName} · {executionLabels[execution.status]}</h2><p className="mt-2 break-words text-xs leading-5 text-slate-500">执行 {execution.id} · 版本 {execution.executionVersion} · 更新于 {accountTime(execution.updatedAt)}</p></div>
      <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-800">{execution.status === 'CONNECTED' && !execution.defaultsCommitted ? '已接通，尚未设为类别默认。' : execution.defaultsCommitted ? '本次执行已完成所记录的类别默认切换；后续人工修改不会被继续操作覆盖。' : '类别默认尚未提交，当前默认保持不变。'} {execution.configurationVerified ? '配置及读取核对通过。' : '配置仍未完成全部核对。'} 影片播放尚未验证。</p>
      {execution.issue && <AccountIssues issues={[execution.issue]} />}
      <ol className="space-y-3">{execution.steps.map((step, index) => <li key={`${step.stage}-${step.category}-${index}`} className="min-w-0 rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-900">{index + 1}. {stageLabels[step.stage]}{step.category ? ` · ${categoryLabels[step.category]}` : ''} · {executionLabels[step.status]}</h3><p className="mt-2 break-words text-sm leading-6 text-slate-700">{step.message ?? '等待服务端返回步骤信息。'}</p><p className="mt-2 text-xs text-slate-500">尝试 {step.attempt} · {accountTime(step.finishedAt ?? step.startedAt)}</p>{step.issue && <div className="mt-3"><AccountIssues issues={[step.issue]} /></div>}{step.resourceRefs.length > 0 && <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-600">{step.resourceRefs.map((resource, resourceIndex) => <li key={resourceIndex} className="break-words">{resource.resourceType} · {resource.resourceId}{resource.path ? ` · ${resource.path}` : ''}</li>)}</ul>}{step.evidence.length > 0 && <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-600">{step.evidence.map((evidence, evidenceIndex) => <li key={evidenceIndex} className="break-words">{evidence.summary} · {accountTime(evidence.observedAt)}</li>)}</ul>}</li>)}</ol>
      <DefaultChanges changes={execution.defaultChanges} />
      <div className="flex flex-wrap gap-3"><Button type="button" className="min-h-11" disabled={busy || !execution.canContinue || stale} onClick={() => setConfirmation('continue')}>{busy ? '提交中…' : '继续接入'}</Button><Link to={`?tab=accounts&plan=${encodeURIComponent(execution.planId)}`} className="inline-flex min-h-11 items-center px-3 text-sm text-slate-700 underline">查看原计划</Link><Link to="?tab=accounts&action=add" className="inline-flex min-h-11 items-center px-3 text-sm text-slate-700 underline">重新提供授权并预览</Link></div>
      <p className="text-xs leading-5 text-slate-600">进度来自服务端持久记录，关闭页面不会中止执行。继续操作会先读回已创建资源，不从固定步骤号盲目重跑。需要新授权时应重新生成计划，本期不能替换原计划授权。</p>
    </section> : <p role="status" className={accountCardClass}>未读取到接入记录，请检查错误并重新读取。</p>}
    {confirmation && <SettingsDialog title={confirmation === 'execute' ? '执行接入计划？' : '继续接入？'} confirmLabel={confirmation === 'execute' ? '确认执行外部变更' : '确认继续'} busy={busy} onCancel={() => setConfirmation(null)} onConfirm={() => void commit()}><p>{confirmation === 'execute' ? '将按预览清单创建、复用或追加外部资源，并在完整核对后按计划提交所选类别默认。' : '将读取持久执行记录和实际外部资源，再继续尚未完成的操作。'}</p><p>必要步骤失败时保留已完成资源和执行记录，不自动删除用户媒体，也不宣称已整体回滚。</p></SettingsDialog>}
  </div>
}
