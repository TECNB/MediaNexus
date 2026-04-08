import { Bell, User } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function AppHeader() {
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
                  <AvatarFallback className="bg-transparent text-slate-600">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">用户中心</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>用户中心</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </header>
  )
}
