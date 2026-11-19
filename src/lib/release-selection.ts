import type { ProwlarrRelease, ReleaseComparison } from '@/types/resources'

export function isReleaseSelectionDisabled(release: ProwlarrRelease | null | undefined) {
  return !release || release.evidence?.status === 'NEEDS_PROCESSING' || release.evidence?.status === 'UNSUITABLE'
}

export function requiresUnverifiedRisk(release: ProwlarrRelease, comparison?: ReleaseComparison | null) {
  return release.evidence?.status === 'UNVERIFIED' || (!!comparison && !release.evidence)
}

export const unverifiedReleaseWarning = '未取得可信文件表，无法确认目标内容、容量与可整理性。仍要承担未核验风险并提交？'
