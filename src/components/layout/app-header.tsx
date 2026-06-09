import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, ShieldCheck, User } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/use-auth'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function getUserFallback(username?: string | null) {
  const firstLetter = username?.trim().charAt(0).toUpperCase()
  return firstLetter || <User className="h-4 w-4" />
}

function getRoleLabel(role?: string) {
  return role === 'ADMIN' ? '管理员' : '普通用户'
}

export function AppHeader() {
  const navigate = useNavigate()
  const { signOut, user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur md:px-8">
      <div aria-hidden="true" className="h-10 w-24" />

      <TooltipProvider delayDuration={100}>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              >
                <Bell className="h-4 w-4" />
                <span className="sr-only">通知</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>通知</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-slate-100"
              >
                <Avatar className="h-8 w-8 border border-slate-200 bg-slate-50">
                  <AvatarFallback className="bg-transparent text-xs font-semibold text-slate-700">
                    {getUserFallback(user?.username)}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">用户中心</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{user?.email ?? '用户中心'}</TooltipContent>
          </Tooltip>

          <div className="hidden min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex">
            <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">
                {user?.username ?? 'MediaNexus'}
              </p>
              <p className="text-[0.6875rem] leading-none text-slate-500">
                {getRoleLabel(user?.role)}
              </p>
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                disabled={isSigningOut}
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">退出登录</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>退出登录</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </header>
  )
}
