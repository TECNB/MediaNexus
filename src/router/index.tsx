import { createBrowserRouter, Navigate } from 'react-router-dom'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { AutomationAccessGate } from '@/lib/automation-access'
import { useAuth } from '@/lib/use-auth'
import { MemberWishlistPage } from '@/pages/automation/member-wishlist'
import type { WishlistProvider } from '@/types/bgm-wishlist'
import { AdminLayout } from '@/layouts/admin-layout'
import { LoginPage, RegisterPage } from '@/pages/auth'
import { DashboardPage } from '@/pages/dashboard'
import { EmbyWatchRankingsPage } from '@/pages/emby-watch-rankings'
import { DocsPage } from '@/pages/docs'
import { AutomationPage } from '@/pages/automation'
import { TelegramAutomationPage } from '@/pages/automation/telegram'
import { WeComAutomationPage } from '@/pages/automation/wecom'
import { BgmWishlistPage } from '@/pages/automation/bgm-wishlist'
import { MagnetIngestPage } from '@/pages/magnet-ingest'
import { MediaLibraryPage } from '@/pages/media-library'
import { LegacyResourceIngestRedirect } from '@/pages/resources/legacy-ingest-redirect'
import { ResourcePublishPage } from '@/pages/resources/publish'
import { ResourceSearchPage } from '@/pages/resources'
import { SettingsPage } from '@/pages/settings'
import { SubtitleManagePage } from '@/pages/subtitles'
import { TaskCenterPage } from '@/pages/tasks'
import { TaskCenterDetailPage } from '@/pages/tasks/detail'
import { QuarkTaskCenterDetailPage } from '@/pages/tasks/quark-detail'
import { UserManagementPage } from '@/pages/users'

function WishlistAutomationRoute({ provider }: { provider: WishlistProvider }) {
  const { user } = useAuth()
  return <AutomationAccessGate tab={provider === 'DOUBAN' ? 'douban' : 'bgm'}>
    {user?.role === 'ADMIN' ? <BgmWishlistPage key={provider} provider={provider} />
      : <MemberWishlistPage key={provider} provider={provider} />}
  </AutomationAccessGate>
}

export const router = createBrowserRouter([
  { path: '/help', element: <DocsPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/resources" replace /> },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'media-library',
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <MediaLibraryPage />
          </ProtectedRoute>
        ),
      },
      { path: 'resources', element: <ResourceSearchPage /> },
      { path: 'resources/publish', element: <ResourcePublishPage /> },
      {
        path: 'resources/ingest/:mediaType/:taskId',
        element: <LegacyResourceIngestRedirect />,
      },
      { path: 'magnet-ingest', element: <MagnetIngestPage /> },
      { path: 'tasks', element: <TaskCenterPage /> },
      { path: 'tasks/quark/:taskId', element: <QuarkTaskCenterDetailPage /> },
      { path: 'tasks/:taskType/:taskId', element: <TaskCenterDetailPage /> },
      { path: 'subtitles', element: <SubtitleManagePage /> },
      { path: 'emby-watch-rankings', element: <ProtectedRoute requiredRole="ADMIN"><EmbyWatchRankingsPage /></ProtectedRoute> },
      { path: 'users', element: <UserManagementPage /> },
      {
        path: 'settings',
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'automation',
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <AutomationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'automation/telegram',
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <TelegramAutomationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'automation/bgm-wishlist',
        element: (
          <WishlistAutomationRoute provider="BGM" />
        ),
      },
      {
        path: 'automation/douban-wishlist',
        element: (
          <WishlistAutomationRoute provider="DOUBAN" />
        ),
      },
      {
        path: 'automation/wecom',
        element: <AutomationAccessGate tab="wecom"><WeComAutomationPage /></AutomationAccessGate>,
      },
      { path: '*', element: <Navigate to="/resources" replace /> },
    ],
  },
])
