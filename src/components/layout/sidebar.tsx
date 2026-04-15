import type { LucideIcon } from 'lucide-react'
import {
  Captions,
  CircleHelp,
  LayoutGrid,
  Search,
  Settings,
  SquareCheckBig,
  Zap,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import { SidebarBrand } from './sidebar-brand'

type NavigationItem = {
  icon: LucideIcon
  label: string
  to: string
}

const primaryItems: NavigationItem[] = [
  { icon: LayoutGrid, label: '控制台', to: '/dashboard' },
  { icon: Search, label: '资源搜索', to: '/resources' },
  { icon: Zap, label: 'Magnet Ingest', to: '/magnet-ingest' },
  { icon: SquareCheckBig, label: '任务中心', to: '/tasks' },
  { icon: Captions, label: '字幕管理', to: '/subtitles' },
]

const secondaryItems: NavigationItem[] = [
  { icon: Settings, label: '设置', to: '/settings' },
  { icon: CircleHelp, label: '帮助', to: '/help' },
]

function SidebarLink({ icon: Icon, label, to }: NavigationItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl border-l-2 px-4 py-3 text-sm font-medium transition-all',
          isActive
            ? 'border-slate-950 bg-white text-slate-950 shadow-shell ring-1 ring-slate-200'
            : 'border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-900',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
      <span>{label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside className="border-b border-slate-200 bg-slate-50 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
      <div className="flex h-full flex-col">
        <SidebarBrand />

        <ScrollArea className="flex-1">
          <div className="flex h-full flex-col justify-between px-3 pb-4">
            <nav className="space-y-1">
              {primaryItems.map((item) => (
                <SidebarLink key={item.to} {...item} />
              ))}
            </nav>

            <div className="mt-8 space-y-4">
              <Separator className="bg-slate-200" />

              <nav className="space-y-1">
                {secondaryItems.map((item) => (
                  <SidebarLink key={item.to} {...item} />
                ))}
              </nav>
            </div>
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}
