import { cn } from '@/lib/utils'
import type { ResourceReleaseSource } from '@/types/resources'

type ReleaseSourceSwitchProps = {
  value: ResourceReleaseSource
  onChange: (value: ResourceReleaseSource) => void
  className?: string
}

const sourceOptions: Array<{
  label: string
  value: ResourceReleaseSource
}> = [
  { label: 'Prowlarr', value: 'prowlarr' },
  { label: 'Quark 分享', value: 'quark' },
]

export function ReleaseSourceSwitch({
  value,
  onChange,
  className,
}: ReleaseSourceSwitchProps) {
  return (
    <div
      role="tablist"
      aria-label="资源来源"
      className={cn(
        'grid w-full max-w-[520px] grid-cols-2 gap-1 rounded-[20px] border border-slate-200/80 bg-slate-100/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
        className,
      )}
    >
      {sourceOptions.map((option) => {
        const isActive = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[16px] px-5 py-2.5 text-center text-sm font-semibold transition-colors',
              isActive
                ? 'bg-white text-slate-950 shadow-[0_6px_18px_rgba(15,23,42,0.08)]'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
