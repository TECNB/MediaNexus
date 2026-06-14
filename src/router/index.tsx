import { createBrowserRouter, Navigate } from 'react-router-dom'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { AdminLayout } from '@/layouts/admin-layout'
import { LoginPage, RegisterPage } from '@/pages/auth'
import { DashboardPage } from '@/pages/dashboard'
import { EmbyWatchRankingsPage } from '@/pages/emby-watch-rankings'
import { HelpPage } from '@/pages/help'
import { MagnetIngestPage } from '@/pages/magnet-ingest'
import { ResourceSearchPage } from '@/pages/resources'
import { SettingsPage } from '@/pages/settings'
import { SubtitleManagePage } from '@/pages/subtitles'
import { TaskCenterPage } from '@/pages/tasks'
import { UserManagementPage } from '@/pages/users'

export const router = createBrowserRouter([
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
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'resources', element: <ResourceSearchPage /> },
      { path: 'magnet-ingest', element: <MagnetIngestPage /> },
      { path: 'tasks', element: <TaskCenterPage /> },
      { path: 'subtitles', element: <SubtitleManagePage /> },
      { path: 'emby-watch-rankings', element: <EmbyWatchRankingsPage /> },
      { path: 'users', element: <UserManagementPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: '*', element: <Navigate to="/resources" replace /> },
    ],
  },
])
