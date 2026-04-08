import { PageContainer } from '@/components/layout/page-container'

export function SubtitleManagePage() {
  return (
    <PageContainer
      title="字幕管理"
      description="字幕相关能力先保留入口，当前以统一占位视图承接后续功能扩展。"
    >
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/90 p-10 shadow-shell">
        <p className="text-lg font-medium text-slate-900">
          SubtitleManagePage
        </p>
        <p className="mt-2 text-sm text-slate-500">
          后续可在这里增加字幕上传、匹配和版本管理。
        </p>
      </div>
    </PageContainer>
  )
}
