import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SearchBar({ value, onChange, className }: SearchBarProps) {
  return (
    <label
      className={cn(
        'group relative block w-full max-w-[560px]',
        className,
      )}
    >
      <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-500" />

      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="搜索资源"
        autoComplete="off"
        placeholder="搜索电影、电视剧、动漫…"
        className="h-16 w-full rounded-[24px] border border-slate-200/80 bg-white pl-14 pr-5 text-[15px] text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.04)] outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200/60"
      />
    </label>
  )
}
