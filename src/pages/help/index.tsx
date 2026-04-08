import { PageContainer } from '@/components/layout/page-container'

export function HelpPage() {
  return (
    <PageContainer
      title="帮助"
      description="帮助页入口已完成，后续可以补充操作说明、FAQ 与常见排障内容。"
    >
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/90 p-10 shadow-shell">
        <p className="text-lg font-medium text-slate-900">HelpPage</p>
        <p className="mt-2 text-sm text-slate-500">
          当前仅保留页面容器和路由占位，不提前扩展复杂内容。
        </p>
      </div>
    </PageContainer>
  )
}
