import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AdminLayout } from '@/layouts/admin-layout'
import { DashboardPage } from '@/pages/dashboard'
import { HelpPage } from '@/pages/help'
import { MagnetIngestPage } from '@/pages/magnet-ingest'
import { ResourceSearchPage } from '@/pages/resources'
import { SettingsPage } from '@/pages/settings'
import { SubtitleManagePage } from '@/pages/subtitles'
import { TaskCenterPage } from '@/pages/tasks'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/resources" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'resources', element: <ResourceSearchPage /> },
      { path: 'magnet-ingest', element: <MagnetIngestPage /> },
      { path: 'tasks', element: <TaskCenterPage /> },
      { path: 'subtitles', element: <SubtitleManagePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: '*', element: <Navigate to="/resources" replace /> },
    ],
  },
])
