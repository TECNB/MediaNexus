import { createBrowserRouter, Navigate } from 'react-router-dom'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { AdminLayout } from '@/layouts/admin-layout'
import { LoginPage, RegisterPage } from '@/pages/auth'
import { DashboardPage } from '@/pages/dashboard'
import { DocsPage } from '@/pages/docs'
import { EmbyWatchRankingsPage } from '@/pages/emby-watch-rankings'
import { MagnetIngestPage } from '@/pages/magnet-ingest'
import { LegacyResourceIngestRedirect } from '@/pages/resources/legacy-ingest-redirect'
import { ResourcePublishPage } from '@/pages/resources/publish'
import { ResourceSearchPage } from '@/pages/resources'
import { SettingsPage } from '@/pages/settings'
import { SubtitleManagePage } from '@/pages/subtitles'
import { TaskCenterPage } from '@/pages/tasks'
import { TaskCenterDetailPage } from '@/pages/tasks/detail'
import { UserManagementPage } from '@/pages/users'

export const router = createBrowserRouter([
  { path: '/docs', element: <DocsPage /> },
  { path: '/help', element: <Navigate to="/docs" replace /> },
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
      { path: 'resources', element: <ResourceSearchPage /> },
      { path: 'resources/publish', element: <ResourcePublishPage /> },
      {
        path: 'resources/ingest/:mediaType/:taskId',
        element: <LegacyResourceIngestRedirect />,
      },
      { path: 'magnet-ingest', element: <MagnetIngestPage /> },
      { path: 'tasks', element: <TaskCenterPage /> },
      { path: 'tasks/:taskType/:taskId', element: <TaskCenterDetailPage /> },
      { path: 'subtitles', element: <SubtitleManagePage /> },
      { path: 'emby-watch-rankings', element: <EmbyWatchRankingsPage /> },
      { path: 'users', element: <UserManagementPage /> },
      {
        path: 'settings',
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <Navigate to="/resources" replace /> },
    ],
  },
])
