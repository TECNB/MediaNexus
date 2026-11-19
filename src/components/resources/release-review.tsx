import { formatReleaseSize, formatSizeBytes, releaseTitleSize } from '@/lib/release-size'
import type { ProwlarrRelease, ReleaseEvidence } from '@/types/resources'

const evidenceLabels: Record<ReleaseEvidence['status'], string> = {
  RECOMMENDABLE: '可推荐', NEEDS_PROCESSING: '包含目标待处理', UNSUITABLE: '不适合本次目标', UNVERIFIED: '未核验',
}

const subtitleMarker = /简繁|簡繁|简体|簡體|繁体|繁體|中文字幕|中字|\b(?:chs|cht|sc|tc)\b/i

const reviewLabels = {
  VERSION_UNKNOWN: '版本待核对',
  SEASON_UNKNOWN: '季度未知',
  SEASON_PACK_UNCERTAIN: '整季待核对',
  SUBTITLES_UNMARKED: '未标注中文字幕',
} as const

type ReviewFlag = keyof typeof reviewLabels
type Props = { release: ProwlarrRelease; seasonNumber?: number | null; hasComparison?: boolean }

function reviewFlags(release: ProwlarrRelease, seasonNumber?: number | null): ReviewFlag[] {
  const flags = release.review_flags ?? []
  // 已保存的操作记录没有结构化字段；兼容旧盘搜命中说明。
  const legacy = release.review_flags?.length ? '' : release.match_source ?? ''
  return [
    flags.includes('VERSION_UNKNOWN') || legacy.includes('年份/版本待核对') ? 'VERSION_UNKNOWN' : null,
    flags.includes('SEASON_UNKNOWN') || legacy.includes('季度未知') || (seasonNumber != null && !release.season_tags.length) ? 'SEASON_UNKNOWN' : null,
    flags.includes('SEASON_PACK_UNCERTAIN') || legacy.includes('整季/混季证据不足') ? 'SEASON_PACK_UNCERTAIN' : null,
    flags.includes('SUBTITLES_UNMARKED') || legacy.includes('字幕语言未标明') || !subtitleMarker.test(release.title) ? 'SUBTITLES_UNMARKED' : null,
  ].filter((flag): flag is ReviewFlag => flag !== null)
}

export function ReleaseReviewBadges({ release, seasonNumber, hasComparison }: Props) {
  const [primary] = reviewFlags(release, seasonNumber)
  return <span className="flex flex-wrap items-center gap-2 text-xs">
    {(release.evidence || hasComparison) && <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-900">{evidenceLabels[release.evidence?.status ?? 'UNVERIFIED']}</span>}
    {release.evidence?.preview && <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">尝鲜 / 抢先（正常版优先）</span>}
    {!!release.resolution_tags.length && <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{release.resolution_tags.join(' / ')}</span>}
    {primary && <span className="rounded-md bg-amber-100 px-2 py-1 font-semibold text-amber-900">{reviewLabels[primary]}</span>}
  </span>
}

export function ReleaseReviewDetails({ release, seasonNumber, hasComparison, children }: Props & { children?: React.ReactNode }) {
  const [primary, ...otherFlags] = reviewFlags(release, seasonNumber)
  const size = formatReleaseSize(release)
  const matchSource = releaseTitleSize(release)
    ? release.match_source?.replace('；体积未知', '')
    : release.match_source
  const evidence = release.evidence
  return <details className="mt-2 min-w-0 text-xs text-slate-600">
    <summary className="w-fit cursor-pointer rounded-sm py-1 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">查看详情</summary>
    <div className="space-y-1 break-words [overflow-wrap:anywhere]">
      {(evidence || hasComparison) && <>
        <p>{evidence?.reason || '尚未取得可信文件表，目标内容未核验。'}</p>
        <p>总包容量：{formatSizeBytes(evidence?.total_bytes ?? null)} · 目标容量：{formatSizeBytes(evidence?.target_bytes ?? null)} · 目标文件：{evidence?.target_files ?? '未知'}</p>
        <p>文件名中的画质、字幕与版本仅为声明，不代表实测或可播放。</p>
      </>}
      {otherFlags.length > 0 && <p>{otherFlags.map((flag) => reviewLabels[flag]).join(' · ')}</p>}
      <p>来源：{release.indexer || '未知'} · 季度：{release.season_tags.join(' / ') || '未标明'}</p>
      <p>体积：{size} · 做种：{release.seeders ?? '未知'}{release.dynamic_range_tags.length > 0 && ` · ${release.dynamic_range_tags.join(' / ')}`}</p>
      {matchSource && <p>匹配依据：{matchSource}</p>}
      {release.match_query && <p>搜索词：{release.match_query}</p>}
      {primary !== 'SUBTITLES_UNMARKED' && !otherFlags.includes('SUBTITLES_UNMARKED') && <p>标题标注了中文字幕，内容未经核验。</p>}
      {release.seeders == null && <p>可下载性未知。</p>}
      {children}
    </div>
  </details>
}
