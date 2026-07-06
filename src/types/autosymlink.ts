export type AutoSymlinkRefreshTarget = 'MOVIE' | 'TV' | 'ANIME' | 'ADULT'

export type AutoSymlinkRefreshStatus = 'SUBMITTED' | 'SKIPPED' | 'FAILED'

export type AutoSymlinkRefreshResult = {
  target: AutoSymlinkRefreshTarget
  status: AutoSymlinkRefreshStatus
  message: string
  detail: string | null
  startedAt: string
  finishedAt: string
}
