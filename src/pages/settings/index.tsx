import { PageContainer } from '@/components/layout/page-container'

export function SettingsPage() {
  return (
    <PageContainer
      title="设置"
      description="系统级配置页已预留，后续可以逐步叠加站点设置、下载目录与接口参数。"
    >
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/90 p-10 shadow-shell">
        <p className="text-lg font-medium text-slate-900">SettingsPage</p>
        <p className="mt-2 text-sm text-slate-500">
          当前为基础占位页，避免过早引入业务配置逻辑。
        </p>
      </div>
    </PageContainer>
  )
}
