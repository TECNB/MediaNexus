import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  className?: string
  placeholder?: string
  isSubmitting?: boolean
  submitDisabled?: boolean
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  className,
  placeholder = '搜索电影、电视剧、动漫…',
  isSubmitting = false,
  submitDisabled = false,
}: SearchBarProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (submitDisabled) {
          return
        }
        onSubmit()
      }}
      className={cn('w-full max-w-[560px]', className)}
    >
      <div className="group relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-500" />

        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="搜索资源"
          autoComplete="off"
          placeholder={placeholder}
          className="h-16 w-full rounded-[24px] border border-slate-200/80 bg-white pl-14 pr-28 text-[15px] text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.04)] outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200/60"
        />

        <Button
          type="submit"
          size="sm"
          disabled={submitDisabled}
          aria-busy={isSubmitting}
          className="absolute right-2 top-1/2 h-11 -translate-y-1/2 rounded-[18px] bg-slate-900 px-4 text-sm font-semibold text-white shadow-none hover:bg-slate-800"
        >
          {isSubmitting ? '搜索中...' : '搜索'}
        </Button>
      </div>
    </form>
  )
}
