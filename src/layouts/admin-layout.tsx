import { Outlet } from 'react-router-dom'

import { AppHeader } from '@/components/layout/app-header'
import { Sidebar } from '@/components/layout/sidebar'

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <Sidebar />

      <div className="min-w-0">
        <AppHeader />

        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
