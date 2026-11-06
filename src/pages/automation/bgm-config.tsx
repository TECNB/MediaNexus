import { Button } from '@/components/ui/button'
import { BgmMemberSelect } from './bgm-member-select'

export type BgmConfigForm = {
  account: string
  ownerId: number | null
  enabled: boolean
  count: number
  time: string
  quality: '1080p' | '2160p'
  firstScope: 'future' | 'all'
}

export function BgmConfig({ value, onChange, onSave, saving, isNew, chooseFirstScope }: {
  value: BgmConfigForm
  onChange: (value: BgmConfigForm) => void
  onSave: () => void
  saving: boolean
  isNew: boolean
  chooseFirstScope: boolean
}) {
  const update = (patch: Partial<BgmConfigForm>) => onChange({ ...value, ...patch })
  return <form className="space-y-4 rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200" onSubmit={(event) => { event.preventDefault(); onSave() }}>
    <div><h2 className="font-semibold text-slate-950">{isNew ? '添加 BGM 想看来源' : '自动入库配置'}</h2><p className="mt-1 text-sm text-slate-500">来源账号与本站任务归属成员分别配置；保存本身不会创建入库任务。</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-sm">BGM 用户名或 ID<input className="mt-1 block w-full rounded-lg border border-slate-200 p-2 disabled:bg-slate-50" value={value.account} required disabled={!isNew} onChange={(e) => update({ account: e.target.value })} /></label>
      <BgmMemberSelect value={value.ownerId} onChange={(ownerId) => update({ ownerId })} />
      <label className="block text-sm">每次成功创建目标<input className="mt-1 block w-full rounded-lg border border-slate-200 p-2" type="number" min="1" step="1" required value={value.count} onChange={(e) => update({ count: Number(e.target.value) })} /></label>
      <label className="block text-sm">每日执行时间（北京时间）<input className="mt-1 block w-full rounded-lg border border-slate-200 p-2" type="time" required value={value.time} onChange={(e) => update({ time: e.target.value })} /></label>
      <label className="block text-sm">发布清晰度<select className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2" value={value.quality} onChange={(e) => update({ quality: e.target.value as BgmConfigForm['quality'] })}><option value="1080p">1080p</option><option value="2160p">2160p（无匹配时回退 1080p）</option></select></label>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.enabled} onChange={(e) => update({ enabled: e.target.checked })} />开启每日自动入库</label>
    {value.enabled && chooseFirstScope && <fieldset className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm"><legend className="font-semibold">首次开启范围</legend><label className="flex gap-2"><input type="radio" name="first-scope" checked={value.firstScope === 'future'} onChange={() => update({ firstScope: 'future' })} />仅处理今后新增</label><label className="flex gap-2"><input type="radio" name="first-scope" checked={value.firstScope === 'all'} onChange={() => update({ firstScope: 'all' })} />包含已有想看（仍按每日目标和额度执行）</label></fieldset>}
    <Button type="submit" disabled={saving || !value.ownerId}>{saving ? '保存中…' : '保存配置'}</Button>
  </form>
}
