import { cn } from '@/lib/utils'

export type ResourceCategoryValue = 'movie' | 'tv' | 'anime'

type CategorySwitchProps = {
  value: ResourceCategoryValue
  onChange: (value: ResourceCategoryValue) => void
  className?: string
}

const categoryOptions: Array<{
  label: string
  value: ResourceCategoryValue
}> = [
  { label: '电影', value: 'movie' },
  { label: '电视剧', value: 'tv' },
  { label: '动漫', value: 'anime' },
]

export function CategorySwitch({
  value,
  onChange,
  className,
}: CategorySwitchProps) {
  return (
    <div
      role="tablist"
      aria-label="资源分类"
      className={cn(
        'inline-flex items-center gap-1 rounded-[20px] border border-slate-200/80 bg-slate-100/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
        className,
      )}
    >
      {categoryOptions.map((option) => {
        const isActive = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-w-[92px] rounded-[16px] px-5 py-2 text-sm font-medium text-center transition-colors',
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
