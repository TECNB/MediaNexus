import { PageContainer } from '@/components/layout/page-container'

export function TaskCenterPage() {
  return (
    <PageContainer
      title="任务中心"
      description="这里预留给抓取、入库、同步等任务流。当前先完成路由接入和统一页面容器。"
    >
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/90 p-10 shadow-shell">
        <p className="text-lg font-medium text-slate-900">TaskCenterPage</p>
        <p className="mt-2 text-sm text-slate-500">
          后续可以在此补充任务列表、执行状态与筛选项。
        </p>
      </div>
    </PageContainer>
  )
}
