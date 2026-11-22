import type { BgmIdentity, BgmOperationEntry } from './bgm-wishlist'

export type DoubanChartId = 'movie_hot_gaia' | 'tv_hot' | 'movie_weekly_best' | 'movie_top250' | 'tv_chinese_best_weekly' | 'tv_global_best_weekly'
export type DoubanChartReason = { code: string; message: string }
export type DoubanChartSubject = {
  id: number
  title: string
  originalTitle: string | null
  coverUrl: string | null
  year: number | null
  mediaType: 'MOVIE' | 'SERIES'
  score: number | null
  votes: number | null
  rank: number | null
  progress: string | null
  observedAt: string | null
}
export type DoubanChartCatalogProgress = {
  status: 'SUCCEEDED' | 'FAILED' | 'IDENTITY_REQUIRED'
  checkedAt: string | null
  identity: BgmIdentity | null
  seriesStatus: string | null
  totalEpisodes: number | null
  pastEpisodes: number | null
  todayEpisodes: number | null
  undatedEpisodes: number | null
  nextEpisodeNumber: number | null
  nextAirDate: string | null
  seasonStatus: 'AIRING' | 'COMPLETE' | 'NOT_AIRED' | 'UNKNOWN' | 'CONFLICT'
  message: string | null
}
export type DoubanChartProgressEvidence = {
  sourceObservedAt: string | null
  checkedAt: string | null
  doubanStatus: 'PENDING' | 'SUPPLIED' | 'NOT_PROVIDED' | 'FAILED' | 'NOT_NEEDED'
  doubanProgress: string | null
  doubanCheckedAt: string | null
  doubanMessage: string | null
  catalog: DoubanChartCatalogProgress | null
}
export type DoubanChartCandidate = {
  subject: DoubanChartSubject
  current: boolean
  firstSeenAt: string
  lastSeenAt: string
  lastRank: number | null
  excluded: boolean
  observations: { checkedAt: string; progress: string | null }[]
  identity: BgmIdentity | null
  reason: DoubanChartReason | null
  progressEvidence?: DoubanChartProgressEvidence | null
}
export type DoubanChartBoard = {
  id: DoubanChartId
  label: string
  autoEnabled: boolean
  ownerUserId: number | null
  refreshStatus: string
  refreshError: string | null
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  nextRunAt: string | null
  candidates: DoubanChartCandidate[]
}
export type DoubanChartSettings = {
  dailyCheckLimit: number | null
  dailyCreateLimit: number | null
  checkedToday: number
  createdToday: number
  scheduleTime: string
  timezone: string
  nextRunAt: string | null
}
export type DoubanChartLimitsInput = Pick<DoubanChartSettings, 'dailyCheckLimit' | 'dailyCreateLimit'>
export type DoubanChartIdentityInput = Pick<BgmIdentity, 'mediaType' | 'tmdbId' | 'seasonNumber'>
export type DoubanChartOverview = { boards: DoubanChartBoard[]; settings: DoubanChartSettings }
export type DoubanChartOperation = {
  id: string
  chartId: DoubanChartId
  chartLabel: string
  triggerType: string
  actorUserId: number | null
  startedAt: string
  updatedAt: string
  status: string
  entries: BgmOperationEntry[]
  reason: DoubanChartReason | null
}
export type DoubanChartOperations = { items: DoubanChartOperation[]; total: number; page: number; pageSize: number }
