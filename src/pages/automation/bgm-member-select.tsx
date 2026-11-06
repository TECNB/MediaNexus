import { useEffect, useState } from 'react'

import { listAdminUsers } from '@/lib/api/admin-users'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import type { AdminUser } from '@/types/admin-users'

export function BgmMemberSelect({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const all: AdminUser[] = []
        let page = 1
        let total = 0
        do {
          const result = await listAdminUsers({ page, page_size: 20 }, controller.signal)
          if (!result.items.length && all.length < result.total) throw new Error('成员列表未完整返回')
          all.push(...result.items)
          total = result.total
          page += 1
        } while (all.length < total)
        if (!controller.signal.aborted) setUsers(all)
      } catch (caught) {
        if (!isJavaRequestCanceledError(caught)) setError(caught instanceof Error ? caught.message : '成员列表读取失败')
      }
    }
    void load()
    return () => controller.abort()
  }, [])

  return <label className="block text-sm">本站任务归属成员
    <select className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2" value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} disabled={!users} required>
      <option value="">{error ? '成员列表读取失败' : users ? '请选择成员' : '正在读取成员'}</option>
      {users?.map((user) => <option key={user.id} value={user.id}>{user.username}{user.role === 'ADMIN' ? '（管理员）' : ''}</option>)}
    </select>
    {error && <span role="alert" className="mt-1 block text-rose-700">{error}</span>}
  </label>
}
