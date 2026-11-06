import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LockKeyhole, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { checkSettingsGroup, getSettingsGroup, getSettingsResources, restoreSettingsGroup, SettingsApiError, updateSettingsGroup } from '@/lib/api/settings'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import type { SettingsField, SettingsGroup, SettingsProbe, SettingsSource, SettingsUpdate, SettingsValue } from '@/types/settings'
import { SettingsDialog } from './settings-dialog'

const controlClass = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-600'
const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6'
const sourceLabels: Record<SettingsSource, string> = { DEPLOYMENT: '部署初始值', DATABASE: '本站数据库', LEGACY_DATABASE: '原有数据库配置' }
const probeLabels = { OK: '检查通过', NOT_CONFIGURED: '尚未配置', UNAUTHORIZED: '认证或权限不足', FAILED: '检查失败', UNSUPPORTED: '当前不支持' }

function display(value: SettingsValue | undefined): string {
  if (value == null) return '未设置'
  if (typeof value === 'boolean') return value ? '已开启' : '已关闭'
  if (Array.isArray(value)) return value.map(item => String(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
function configured(value: SettingsValue | undefined) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && value?.configured === true
}
function draftValue(field: SettingsField, value: SettingsValue | undefined): string | boolean {
  if (field.type === 'boolean') return value === true
  if (value == null) return ''
  return Array.isArray(value) ? value.join(', ') : String(value)
}
function initialDraft(group: SettingsGroup) {
  return Object.fromEntries(group.fields.filter(field => !field.secret).map(field => [field.key, draftValue(field, group.saved[field.key])]))
}
function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚无保存记录'
}

export function SettingsGroupEditor({ id, onDirtyChange }: { id: string; onDirtyChange: (dirty: boolean, pending?: boolean) => void }) {
  const [group, setGroup] = useState<SettingsGroup | null>(null)
  const [draft, setDraft] = useState<Record<string, string | boolean>>({})
  const [replacements, setReplacements] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [probe, setProbe] = useState<SettingsProbe | null>(null)
  const [resources, setResources] = useState<SettingsProbe | null>(null)
  const [confirm, setConfirm] = useState<'restore' | 'reload' | null>(null)
  const requestScope = useRef<AbortController | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const dirty = !!group && (Object.keys(replacements).length > 0 || group.fields.some(field => field.writable && !field.secret && draft[field.key] !== draftValue(field, group.saved[field.key])))
  const writable = group?.fields.some(field => field.writable) ?? false

  useEffect(() => { onDirtyChange(dirty, !!busy); return () => onDirtyChange(false) }, [dirty, busy, onDirtyChange])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  useEffect(() => {
    const controller = new AbortController()
    requestScope.current = controller
    setLoading(true); setError(''); setConflict(false); setGroup(null); setProbe(null); setResources(null)
    getSettingsGroup(id, controller.signal).then(next => {
      if (!controller.signal.aborted) { setGroup(next); setDraft(initialDraft(next)); setReplacements({}); setFieldErrors({}); setMessage('') }
    }).catch(reason => {
      if (!controller.signal.aborted && !isJavaRequestCanceledError(reason)) setError(reason instanceof Error ? reason.message : '配置读取失败，请重试。')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, revision])

  function edited() { setError(''); setFieldErrors({}); setMessage(''); setProbe(null) }
  function payload(): SettingsUpdate | null {
    if (!group) return null
    const values: SettingsUpdate['values'] = {}
    const secrets: SettingsUpdate['secrets'] = {}
    const errors: Record<string, string> = {}
    for (const field of group.fields) {
      if (!field.writable) continue
      if (field.secret) {
        if (!(field.key in replacements)) secrets[field.key] = { action: 'KEEP' }
        else if (!replacements[field.key].trim()) errors[field.key] = `请输入新的${field.label}，或取消替换以保持原凭据。`
        else secrets[field.key] = { action: 'REPLACE', value: replacements[field.key] }
        continue
      }
      if (draft[field.key] === draftValue(field, group.saved[field.key])) continue
      const raw = draft[field.key]
      let value: SettingsValue = raw
      if (field.type === 'integer' || field.type === 'bytes') {
        const number = Number(raw)
        if (String(raw).trim() === '' || !Number.isSafeInteger(number) || (field.type === 'bytes' && number <= 0)) errors[field.key] = field.type === 'bytes' ? '请输入正整数字节数。' : '请输入有效整数。'
        value = number
      } else if (field.type === 'string-list') value = String(raw).split(/[,\n]/).map(item => item.trim()).filter(Boolean)
      values[field.key] = value
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length) { setError('请修正标出的字段后重试，修改尚未保存。'); return null }
    return { version: group.version, values, secrets }
  }
  function accepted(next: SettingsGroup) {
    setGroup(next); setDraft(initialDraft(next)); setReplacements({}); setFieldErrors({}); setConflict(false); setProbe(null); setResources(null)
  }
  async function perform(action: 'save' | 'check' | 'resources' | 'restore') {
    if (!group || busy) return
    const update = action === 'save' || (action === 'check' && dirty) ? payload() : undefined
    if (update === null) return
    const signal = requestScope.current?.signal
    setBusy(action); setError(''); setMessage(''); if (action === 'check') setProbe(null); if (action === 'resources') setResources(null)
    try {
      if (action === 'save') {
        const next = await updateSettingsGroup(id, update!, signal)
        if (signal?.aborted) return
        accepted(next)
        setMessage(next.status === 'UNAVAILABLE' ? '配置已保存，但当前配置不可核对。请检查部署加密密钥后重新读取。' : next.effectiveFingerprint === 'UNAVAILABLE' ? '配置已保存；接入指纹不可用，请检查部署加密密钥后重新预览接入。' : next.status === 'PENDING_RESTART' ? '配置已保存，当前生效值仍为旧值。请按提示重启相关本站服务。' : next.status === 'LIMITED_BY_DEPLOYMENT' ? '配置已保存，但实际生效限制受部署上限约束。' : '配置已保存并生效。请以连接检查结果确认外部服务状态。')
      } else if (action === 'restore') {
        const next = await restoreSettingsGroup(id, group.version, signal)
        if (signal?.aborted) return
        accepted(next); setConfirm(null)
        setMessage('已恢复部署初始值。请核对各字段来源及当前生效状态。')
      } else {
        const result = action === 'check' ? await checkSettingsGroup(id, update, signal) : await getSettingsResources(id, signal)
        if (signal?.aborted) return
        if (action === 'check') setProbe(result)
        else setResources(result)
      }
    } catch (reason) {
      if (signal?.aborted || isJavaRequestCanceledError(reason)) return
      setConfirm(null)
      const stale = reason instanceof SettingsApiError && reason.status === 409
      setConflict(stale)
      setError(stale ? '配置版本已变化。修改已保留；请重新读取最新配置后再编辑，不会自动覆盖其他管理员的修改。' : reason instanceof Error ? reason.message : '操作失败，修改已保留，请重试。')
    } finally { if (!signal?.aborted) setBusy('') }
  }
  function reload() { if (dirty) setConfirm('reload'); else setRevision(value => value + 1) }
  function submit(event: FormEvent) { event.preventDefault(); void perform('save') }

  if (loading) return <section className={cardClass} role="status" aria-busy="true">正在读取配置…</section>
  if (!group) return <section className={cardClass}><div role="alert" className="text-sm text-red-700">{error || '未读取到配置。'}</div><Button type="button" className="mt-4 min-h-11" variant="outline" onClick={reload}>重新读取</Button></section>

  return <form onSubmit={submit} className="space-y-5" aria-label={`${group.label}配置`}>
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">{group.label}</h2><p className="mt-2 text-xs leading-5 text-slate-600">版本 {group.version} · 更新时间：{formatTime(group.updatedAt)}</p></div><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-800">{group.status === 'UNAVAILABLE' ? '配置不可核对' : group.status === 'PENDING_RESTART' ? '已保存 · 待重启生效' : group.status === 'LIMITED_BY_DEPLOYMENT' ? '受部署上限限制' : '当前配置已生效'}</span></div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{group.applyMode === 'HOT' ? '热更新用于后续请求；执行中的任务保留原配置快照。' : '保存后需重启相关本站服务，页面不会自动重启。'}{!writable && ' 本面板只读。'}</p>
      {(group.status === 'UNAVAILABLE' || group.effectiveFingerprint === 'UNAVAILABLE') && <p role="status" className="mt-4 text-sm leading-6 text-amber-800">{group.status === 'UNAVAILABLE' ? '当前配置无法核对，请检查部署加密密钥并重新读取。' : '接入指纹不可用；配置仍可读取，请检查部署加密密钥后重新预览接入。'}</p>}
      {group.status === 'PENDING_RESTART' && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">当前仍使用下方生效值。需重启：{group.restartServices.length ? group.restartServices.join('、') : '服务清单未返回，请核对部署说明'}。</p>}
      {group.status === 'LIMITED_BY_DEPLOYMENT' && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">保存的上传限制高于部署允许值；实际上传以当前生效值及下方请求上限为准。</p>}
      {id === 'subtitle-upload' && group.constraints && Object.keys(group.constraints).length > 0 && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-medium text-slate-900">部署上传上限</h3><dl className="mt-3 space-y-2 text-sm text-slate-700">{[['multipartMaxFileSizeBytes', '单文件上限'], ['multipartMaxRequestSizeBytes', '整个请求上限']].map(([key, label]) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd>{group.constraints[key] === -1 ? '不限' : `${display(group.constraints[key])} 字节`}</dd></div>)}</dl><p className="mt-3 text-xs leading-5 text-slate-600">整个请求还包含表单元数据和其他字段，文件达到标称大小时不保证请求能够通过。部署上限只读，修改后需重启 {display(group.constraints.multipartRestartService)}；本站上传限制在此范围内热更新。</p></div>}
      <div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={!!busy} onClick={() => void perform('check')}>{busy === 'check' ? '检查中…' : dirty ? '检查未保存配置' : '检查连接'}</Button><Button type="button" variant="outline" className="min-h-11" disabled={!!busy} onClick={() => void perform('resources')}>{busy === 'resources' ? '读取中…' : '读取实际资源'}</Button><Button type="button" variant="ghost" className="min-h-11" disabled={!!busy} onClick={reload}><RefreshCw aria-hidden="true" className="h-4 w-4" />重新读取</Button></div>
      <p className="mt-3 text-xs leading-5 text-slate-500">检查不保存配置，不下载、不删除文件、不发送消息。资源读取使用当前生效配置；可读不代表已验证写权限或影片播放。</p>
    </section>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800 outline-none focus:ring-2 focus:ring-red-300"><p>{error}</p>{conflict && <button type="button" className="mt-2 min-h-11 underline" onClick={reload}>重新读取最新配置</button>}{Object.entries(fieldErrors).length > 0 && <ul className="mt-2 list-inside list-disc">{group.fields.filter(field => fieldErrors[field.key]).map(field => <li key={field.key}><a href={`#settings-${field.key}`} onClick={event => { event.preventDefault(); document.getElementById(`settings-${field.key}`)?.focus() }} className="underline">{field.label}：{fieldErrors[field.key]}</a></li>)}</ul>}</div>}
    <fieldset disabled={!!busy} className={cardClass}>
      <legend className="sr-only">{group.label}字段</legend>
      <div className="grid min-w-0 gap-6 xl:grid-cols-2">{group.fields.map(field => {
        const fieldId = `settings-${field.key}`
        const saved = group.saved[field.key]
        const effective = group.effective[field.key]
        const hintId = `${fieldId}-hint`
        const fieldError = fieldErrors[field.key]
        return <div key={field.key} className="min-w-0 space-y-2">
          <label htmlFor={fieldId} className="block text-sm font-medium text-slate-900">{field.label}{!field.writable && <span className="ml-2 text-xs font-normal text-slate-500">只读</span>}</label>
          {field.secret ? <>
            <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"><LockKeyhole aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{configured(saved) ? '已配置 · 不回显' : '未配置'}</span>{field.writable && <button type="button" aria-label={`${field.key in replacements ? '取消替换' : '替换'}${field.label}`} aria-expanded={field.key in replacements} className="ml-auto min-h-9 rounded-lg px-3 font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500" onClick={() => { edited(); setReplacements(previous => { const next = { ...previous }; if (field.key in next) delete next[field.key]; else next[field.key] = ''; return next }) }}>{field.key in replacements ? '取消替换' : '替换'}</button>}</div>
            {field.key in replacements && <input id={fieldId} name={field.key} type="password" autoComplete="new-password" spellCheck={false} aria-label={`新${field.label}`} aria-describedby={hintId} aria-invalid={!!fieldError} className={controlClass} value={replacements[field.key]} onChange={event => { edited(); setReplacements(previous => ({ ...previous, [field.key]: event.target.value })) }} />}
          </> : !field.writable ? <div id={fieldId} className="min-h-11 break-words rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{display(saved)}</div> : field.type === 'boolean' ? <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"><input id={fieldId} name={field.key} type="checkbox" className="h-5 w-5 accent-slate-900" checked={draft[field.key] === true} aria-describedby={hintId} onChange={event => { edited(); setDraft(previous => ({ ...previous, [field.key]: event.target.checked })) }} />{draft[field.key] === true ? '已开启' : '已关闭'}</label> : <input id={fieldId} name={field.key} className={controlClass} type={field.type === 'integer' || field.type === 'bytes' ? 'number' : 'text'} step={field.type === 'integer' || field.type === 'bytes' ? 1 : undefined} min={field.type === 'bytes' ? 1 : undefined} aria-describedby={hintId} aria-invalid={!!fieldError} value={String(draft[field.key] ?? '')} onChange={event => { edited(); setDraft(previous => ({ ...previous, [field.key]: event.target.value })) }} />}
          <div id={hintId} className="space-y-1 break-words text-xs leading-5 text-slate-600">
            {field.type === 'duration' && <p>ISO 8601 时长，例如 PT10S（10 秒）。具体下限由服务端校验。</p>}{field.type === 'bytes' && <p>单位：字节。例如 1048576 = 1 MiB。</p>}{field.type === 'string-list' && <p>多项用英文逗号分隔。</p>}
            {field.secret && <p>默认保持原凭据，空输入不表示删除；需要变更时显式替换。</p>}
            <p>保存来源：{sourceLabels[group.sources[field.key]] ?? '来源未提供'}</p>
            <p>已保存：{field.secret ? configured(saved) ? '已配置' : '未配置' : display(saved)}</p>
            <p>当前生效：{field.secret ? configured(effective) ? '已配置' : '未配置' : display(effective)}</p>
          </div>
          {fieldError && <p className="text-sm text-red-700">{fieldError}</p>}
        </div>
      })}</div>
    </fieldset>
    {probe && <ProbePanel title="连接检查" probe={probe} />}
    {resources && <ProbePanel title="实际资源" probe={resources} />}
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-medium text-slate-900">{dirty ? '有未保存修改' : writable ? '暂无未保存修改' : '本面板只读'}</p><p className="mt-1 text-xs leading-5 text-slate-600">保存仅提交本组已修改的可写字段，其他值保持原样。</p></div>{writable && <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={!!busy} onClick={() => setConfirm('restore')}>恢复部署初始值</Button><Button type="submit" className="min-h-11" disabled={!dirty || !!busy || conflict}>{busy === 'save' ? '保存中…' : '保存本组配置'}</Button></div>}</div>
      {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">{message}</p>}
    </section>
    {confirm && <SettingsDialog title={confirm === 'restore' ? '恢复部署初始值？' : '丢弃修改并重新读取？'} confirmLabel={confirm === 'restore' ? '确认恢复' : '丢弃并重新读取'} busy={!!busy} onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm === 'restore') void perform('restore'); else { setConfirm(null); setRevision(value => value + 1) } }}>
      {confirm === 'restore' ? <><p>将移除 {group.label} 的本站覆盖配置，改用部署初始值。凭据也可能重新采用部署配置；这与停用集成不同。</p><p>以下来源将回到部署初始值，具体以恢复后的字段状态为准。已有目标及历史资源引用保留。</p><ul className="space-y-1">{group.fields.filter(field => group.sources[field.key] !== 'DEPLOYMENT').map(field => <li key={field.key}>{field.label}：{sourceLabels[group.sources[field.key]] ?? '来源未提供'} → 部署初始值</li>)}</ul>{dirty && <p>当前未保存的修改也会被丢弃。</p>}</> : <p>当前表单修改将被丢弃，重新读取最新版本；不会自动重放或覆盖其他人的修改。</p>}
    </SettingsDialog>}
  </form>
}

function ProbePanel({ title, probe }: { title: string; probe: SettingsProbe }) {
  return <section className={cardClass} aria-label={title}>
    <h3 className="font-semibold text-slate-900">{title} · {probeLabels[probe.status]}</h3><p role="status" className="mt-2 break-words text-sm leading-6 text-slate-700">{probe.message}</p><p className="mt-2 text-xs text-slate-500">{probe.source === 'CANDIDATE' ? '未保存候选配置' : '当前生效配置'} · {formatTime(probe.checkedAt)}</p>
    {probe.resources.length > 0 ? <ul className="mt-4 space-y-3">{probe.resources.map(resource => <li key={resource.id} className="min-w-0 rounded-xl border border-slate-200 p-4"><h4 className="break-words text-sm font-medium text-slate-900">{resource.name}</h4><p className="mt-1 break-all text-xs text-slate-500">{resource.id}</p><dl className="mt-3 space-y-2 text-sm">{Object.entries(resource.attributes).map(([key, value]) => <div key={key} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><dt className="break-words text-slate-500">{key}</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-slate-800">{display(value)}</dd></div>)}</dl></li>)}</ul> : <p className="mt-4 text-sm text-slate-600">{probe.status === 'OK' ? '未返回可展示的资源。' : '当前没有可展示的资源；请查看上方检查状态。'}</p>}
  </section>
}
