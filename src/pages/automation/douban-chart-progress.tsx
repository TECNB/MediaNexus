import type { DoubanChartCandidate, DoubanChartCatalogProgress } from '@/types/douban-charts'

const seasonLabels: Record<DoubanChartCatalogProgress['seasonStatus'], string> = {
  AIRING: '更新中', COMPLETE: '已完结', NOT_AIRED: '尚未开播', UNKNOWN: '待补证', CONFLICT: '待核实（来源冲突）',
}
function checkedAt(value: string | null) {
  return value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '暂无'
}

/** Sources stay separate: catalogue dates do not become Douban progress or ingestion permission. */
export function DoubanChartProgress({ candidate }: { candidate: DoubanChartCandidate }) {
  if (candidate.subject.mediaType !== 'SERIES') return null
  const stored = candidate.progressEvidence
  const sameIdentity = !candidate.identity || !stored?.catalog?.identity || (
    candidate.identity.tmdbId === stored.catalog.identity.tmdbId
    && candidate.identity.seasonNumber === stored.catalog.identity.seasonNumber
  )
  const evidence = stored?.sourceObservedAt === candidate.subject.observedAt && sameIdentity ? stored : null
  const catalog = evidence?.catalog
  const douban = candidate.subject.progress || (evidence?.doubanStatus === 'SUPPLIED' ? evidence.doubanProgress : null)
  const doubanLabel = douban ? `豆瓣${candidate.subject.progress ? '榜单' : '详情'}进度：${douban}` : '豆瓣未提供更新进度'
  const catalogLabel = catalog?.status === 'SUCCEEDED'
    ? `当前季：${seasonLabels[catalog.seasonStatus]}（目录证据）`
    : catalog?.status === 'IDENTITY_REQUIRED' ? '目录 / 目标季待确认'
      : catalog?.status === 'FAILED' ? '目录补查失败' : '目录证据待补查'
  return <section className="mt-3 min-w-0 space-y-2" aria-label={`${candidate.subject.title}的进度证据`}>
    <p className="break-words text-sm font-medium text-slate-900">{doubanLabel}</p>
    <p className={`break-words text-xs leading-5 ${catalog?.seasonStatus === 'CONFLICT' || catalog?.status === 'FAILED' ? 'text-amber-800' : 'text-slate-700'}`}>{catalogLabel}</p>
    <details>
      <summary className="min-h-11 cursor-pointer rounded py-3 text-xs text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">进度来源与补查详情</summary>
      <div className="space-y-2 break-words rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-700">
        <p>豆瓣榜单：{candidate.subject.progress || '未提供'} · 观测于 {checkedAt(candidate.subject.observedAt)}</p>
        {!evidence || evidence.doubanStatus === 'PENDING' ? <p>{candidate.current ? '后台排队补查中，每批最多 3 部；无需保持页面打开。' : '历史候选：当前仅展示历史来源观测；目录补证优先覆盖当前在榜作品。'}</p>
          : evidence.doubanStatus === 'NOT_NEEDED' ? <p>榜单已提供进度，未额外查询豆瓣详情。</p>
            : <p className={evidence.doubanStatus === 'FAILED' ? 'text-amber-800' : undefined}>豆瓣详情：{evidence.doubanStatus === 'SUPPLIED' ? evidence.doubanProgress : evidence.doubanStatus === 'FAILED' ? '本次补查失败' : '仍未提供更新进度'} · 检查于 {checkedAt(evidence.doubanCheckedAt)}</p>}
        {evidence?.doubanMessage && (candidate.current || evidence.doubanStatus !== 'PENDING') && <p>{evidence.doubanMessage}</p>}
        {!catalog ? <p>TMDB：等待目录补证。</p> : <>
          <p>TMDB：{catalog.status === 'FAILED' ? '本次补查失败，不能据此判断播出状态' : catalog.status === 'IDENTITY_REQUIRED' ? '作品或目标季未唯一确认，请纠正匹配' : `${catalog.identity?.title ?? '目录'} · 第 ${catalog.identity?.seasonNumber ?? '待确认'} 季 · 共 ${catalog.totalEpisodes ?? '未知'} 集`}</p>
          {catalog.status === 'SUCCEEDED' && <>
            <p>系列状态：{catalog.seriesStatus || '未提供'}（不等于当前季状态）</p>
            <p>目录日期：已过去 {catalog.pastEpisodes ?? '未知'} 集 · 当日 {catalog.todayEpisodes ?? '未知'} 集 · 日期缺失 {catalog.undatedEpisodes ?? '未知'} 集</p>
            {catalog.nextEpisodeNumber != null && catalog.nextAirDate && <p>下一集目录安排：E{String(catalog.nextEpisodeNumber).padStart(2, '0')} · {catalog.nextAirDate}（非片源上线保证）</p>}
          </>}
          {catalog.message && <p>{catalog.message}</p>}
          <p>目录检查于 {checkedAt(catalog.checkedAt)}</p>
        </>}
        <p>目录补证不替代豆瓣完结事实，也不表示已找到片源或已入库。</p>
      </div>
    </details>
  </section>
}
