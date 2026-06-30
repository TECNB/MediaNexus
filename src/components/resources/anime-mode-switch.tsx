import { cn } from '@/lib/utils'

export type AnimeResourceMode = 'season-ingest' | 'follow-subscription'

type AnimeModeSwitchProps = {
  value: AnimeResourceMode
  onChange: (value: AnimeResourceMode) => void
  className?: string
}

const animeModeOptions: Array<{
  label: string
  value: AnimeResourceMode
}> = [
  { label: '整季入库', value: 'season-ingest' },
  { label: '追更订阅', value: 'follow-subscription' },
]

export function AnimeModeSwitch({
  value,
  onChange,
  className,
}: AnimeModeSwitchProps) {
  return (
    <div
      role="tablist"
      aria-label="动漫处理模式"
      className={cn(
        'inline-flex items-center gap-1 rounded-[18px] border border-slate-200/80 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      {animeModeOptions.map((option) => {
        const isActive = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-w-[112px] rounded-[14px] px-4 py-2 text-center text-sm font-medium transition-colors',
              isActive
                ? 'bg-slate-950 text-white shadow-[0_6px_18px_rgba(15,23,42,0.12)]'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
