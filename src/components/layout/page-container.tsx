import type { ReactNode } from 'react'

type PageContainerProps = {
  title: string
  description: string
  children: ReactNode
}

export function PageContainer({
  title,
  description,
  children,
}: PageContainerProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
          The Archive
        </p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  )
}
