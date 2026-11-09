import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { javaApiClient } from '@/lib/java-api'
import { useAuth } from '@/lib/use-auth'

type AutomationTab = 'javdb' | 'telegram' | 'bgm' | 'douban' | 'wecom'
type Access = Record<'bgm' | 'douban' | 'wecom', boolean>
type Scope = { visible: (tab: AutomationTab) => boolean; loading: boolean; failed: boolean }
const AutomationScope = createContext<Scope>({ visible: () => false, loading: true, failed: false })

export function AutomationAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [answer, setAnswer] = useState<{ id: number; access: Access | null } | null>(null)

  useEffect(() => {
    if (!user || user.role === 'ADMIN') return
    const controller = new AbortController()
    const id = user.id
    function refresh() {
      void javaApiClient.get<{ code: number; data: Access | null }>('/api/v1/automation/access', { signal: controller.signal })
        .then(({ data }) => { if (!controller.signal.aborted) setAnswer({ id, access: data.code === 200 ? data.data : null }) })
        .catch(() => { if (!controller.signal.aborted) setAnswer({ id, access: null }) })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { controller.abort(); window.removeEventListener('focus', refresh) }
  }, [user, pathname])

  const isAdmin = user?.role === 'ADMIN'
  const current = answer?.id === user?.id ? answer : null
  return <AutomationScope.Provider value={{
    visible: (tab) => isAdmin || (tab !== 'javdb' && tab !== 'telegram' && current?.access?.[tab] === true),
    loading: !isAdmin && !current,
    failed: !isAdmin && current?.access === null,
  }}>{children}</AutomationScope.Provider>
}

export function useAutomationAccess() { return useContext(AutomationScope) }

export function AutomationAccessGate({ tab, children }: { tab: AutomationTab; children: ReactNode }) {
  const { visible, loading, failed } = useAutomationAccess()
  if (visible(tab)) return children
  if (loading) return <p role="status" className="text-sm text-slate-600">正在读取自动化权限…</p>
  return <p role="alert" className="rounded-xl bg-white p-5 text-sm text-slate-700">
    {failed ? '无法读取自动化权限，请刷新页面。' : '当前账号没有绑定此自动化入口。'}
  </p>
}
