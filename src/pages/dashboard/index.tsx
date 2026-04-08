import { PageContainer } from '@/components/layout/page-container'

export function DashboardPage() {
  return (
    <PageContainer
      title="控制台"
      description="这里是后台总览占位页，后续可以逐步补充统计卡片、最近任务和系统动态。"
    >
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/90 p-10 shadow-shell">
        <p className="text-lg font-medium text-slate-900">DashboardPage</p>
        <p className="mt-2 text-sm text-slate-500">
          当前仅完成项目骨架，后续业务模块可直接在这里叠加。
        </p>
      </div>
    </PageContainer>
  )
}
