import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { bindWeComMember, getWeComAccounts, getWeComMembers, unbindWeComMember } from '@/lib/api/settings'
import type { WeComAccounts, WeComDirectory } from '@/types/settings'
import { accountCardClass, accountControlClass } from './settings-account-ui'
import { SettingsDialog } from './settings-dialog'

export function SettingsWeComBindings() {
  const [accounts, setAccounts] = useState<WeComAccounts | null>(null)
  const [directory, setDirectory] = useState<WeComDirectory | null>(null)
  const [revision, setRevision] = useState(0)
  const [userId, setUserId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [accountsError, setAccountsError] = useState('')
  const [membersError, setMembersError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setAccounts(null)
    setDirectory(null)
    setAccountsError('')
    setMembersError('')
    getWeComAccounts(controller.signal).then(setAccounts).catch((error: Error) => {
      if (!controller.signal.aborted) setAccountsError(error.message)
    })
    getWeComMembers(controller.signal).then(setDirectory).catch((error: Error) => {
      if (!controller.signal.aborted) setMembersError(error.message)
    })
    return () => controller.abort()
  }, [revision])

  const account = accounts?.accounts.find(item => String(item.id) === userId)
  const members = directory?.members ?? []
  const sameApp = accounts && directory && accounts.scope.corpId === directory.scope.corpId
    && accounts.scope.agentId === directory.scope.agentId
  const label = (id: string) => {
    const member = members.find(item => item.id === id)
    return member && member.name !== id ? `${member.name}（${id}）` : id
  }

  async function update(action: 'bind' | 'unbind') {
    if (!account || !accounts) return
    setBusy(true)
    setConfirm(false)
    setSaveError('')
    setMessage('')
    try {
      if (action === 'unbind') await unbindWeComMember(account.id, accounts.scope)
      else await bindWeComMember(account.id, accounts.scope, memberId)
      setMemberId('')
      setMessage(action === 'unbind' ? '已解除绑定。' : '已保存绑定。')
      setRevision(value => value + 1)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '绑定请求失败，请刷新后核对当前状态。')
    } finally {
      setBusy(false)
    }
  }

  return <section className={accountCardClass} aria-labelledby="wecom-bindings-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="wecom-bindings-title" className="text-lg font-semibold text-slate-950">用户通知绑定</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">现有入库任务通知只发给任务所属用户绑定的企微成员。未绑定时，任务正常运行，企微不推送。</p>
      </div>
      <Button variant="outline" type="button" className="min-h-11" disabled={busy} onClick={() => {
        setMemberId(''); setMessage(''); setSaveError(''); setRevision(value => value + 1)
      }}>刷新成员与绑定</Button>
    </div>

    <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void update('bind') }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 space-y-2 text-sm font-medium text-slate-900">
          <span>站内用户</span>
          <select className={accountControlClass} value={userId} disabled={!accounts || busy} onChange={event => {
            setUserId(event.target.value); setMemberId(''); setSaveError(''); setMessage('')
          }}>
            <option value="">{!accounts && !accountsError ? '正在读取站内用户…' : '请选择站内用户'}</option>
            {accounts?.accounts.map(item => <option key={item.id} value={item.id}>
              {item.username}{item.role === 'ADMIN' ? '（管理员）' : ''}{item.memberId ? ' · 已绑定' : ''}
            </option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-2 text-sm font-medium text-slate-900">
          <span>企微成员</span>
          <select className={accountControlClass} value={memberId} disabled={!sameApp || !account || busy || !members.length}
            aria-describedby="wecom-members-status" onChange={event => { setMemberId(event.target.value); setSaveError(''); setMessage('') }}>
            <option value="">{!directory && !membersError ? '正在读取企微成员…' : '请选择企微成员'}</option>
            {members.map(item => {
              const assigned = accounts?.accounts.some(row => row.id !== account?.id && row.memberId?.toLowerCase() === item.id.toLowerCase())
              return <option key={item.id} value={item.id} disabled={assigned}>{label(item.id)}{assigned ? ' · 已绑定其他用户' : ''}</option>
            })}
          </select>
        </label>
      </div>
      {accountsError && <p role="alert" className="text-sm text-red-700">{accountsError}</p>}
      <p id="wecom-members-status" role={membersError ? 'alert' : 'status'} className={membersError ? 'text-sm text-red-700' : 'text-sm text-slate-600'}>
        {membersError || (directory && !members.length ? '当前应用没有可选成员，请检查企业微信后台的应用可见范围。'
          : directory && accounts && !sameApp ? '应用配置已变更，请刷新成员与绑定。' : '仅显示当前企业微信应用可见的成员。')}
      </p>
      {account && <p className="break-words text-sm text-slate-700">当前绑定：{account.memberId ? label(account.memberId) : '未绑定'}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={!sameApp || !account || !memberId || account.memberId === memberId || busy}>
          {busy ? '正在提交…' : '保存绑定'}
        </Button>
        {account?.memberId && <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setConfirm(true)}>解除绑定</Button>}
      </div>
      {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    </form>
    {confirm && account && <SettingsDialog title="解除企微绑定？" confirmLabel="解除绑定"
      onCancel={() => setConfirm(false)} onConfirm={() => void update('unbind')}>
      <p>{account.username} 后续将不再收到企微任务通知，站内任务不受影响。</p>
    </SettingsDialog>}
  </section>
}
