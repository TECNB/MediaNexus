import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/lib/use-auth'

function ProtectedRouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] px-6 text-slate-900">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-shell">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950"
        />
        正在恢复登录状态
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { status } = useAuth()

  if (status === 'loading') {
    return <ProtectedRouteLoading />
  }

  if (status === 'unauthenticated') {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  return children
}
