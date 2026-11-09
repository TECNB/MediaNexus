import type { MediaDeletionTask } from './media-library'

export type BgmSourceInput = { bgmUsername: string; ownerUserId: number; enabled: boolean; scheduleTime: string; targetCount: number; quality: '1080p' | '2160p'; initialScope: 'NEW_ONLY' | 'INCLUDE_EXISTING' }
export type BgmSource = BgmSourceInput & { id: string; ownerUsername: string; timezone: string; baselineInitialized: boolean }
export type BgmIdentity = { mediaType: 'MOVIE' | 'SERIES'; tmdbId: number; seasonNumber: number | null; title: string; originalTitle: string | null; year: number | null }
export type BgmTaskLink = { taskType: string; taskId: string; status: string }
export type BgmItem = { subjectId: number; title: string; originalTitle: string | null; coverUrl: string | null; year: number | null; updatedAt: string | null; identity: BgmIdentity | null; libraryStatus: 'UNKNOWN' | 'ABSENT' | 'PRESENT'; availability: string; eligible: boolean; reasons: { code: string; message: string }[]; activeTask: BgmTaskLink | null; associatedTask: BgmTaskLink | null; automaticCandidate: boolean; releaseStatus: string; deletionTask: MediaDeletionTask | null; canDelete: boolean }
export type BgmWishlist = { source: BgmSource; items: BgmItem[]; refreshStatus: 'NEVER' | 'SUCCESS' | 'FAILED'; refreshError: string | null; lastAttemptAt: string | null; lastSuccessAt: string | null }
export type BgmCatalogCandidate = { mediaType: 'MOVIE' | 'SERIES'; tmdbId: number; title: string; originalTitle: string | null; year: number | null; coverUrl: string | null }
export type BgmSeason = { seasonNumber: number; name: string; episodeCount: number | null; airDate: string | null }
export type BgmQuota = { ownerUserId: number; ownerUsername: string; usageDate: string; used: number; limit: number; remaining: number | null; exempt: boolean }
export type BgmAction = 'SINGLE' | 'SELECTED' | 'LATEST' | 'DAILY'
export type BgmItemOutcome = { item: BgmItem; outcome: 'CREATED' | 'FAILED' | 'SKIPPED'; reason: { code: string; message: string } | null; task: BgmTaskLink | null }
export type BgmPreview = { id: string; source: BgmSource; createdAt: string; action: BgmAction; items: BgmItem[]; skipped: BgmItemOutcome[]; quota: BgmQuota; estimatedCreations: number }
export type BgmRun = { id: string; sourceId: string; source: BgmSource; action: BgmAction; triggerType: 'MANUAL' | 'SCHEDULED'; actorUserId: number | null; ownerUserId: number; startedAt: string; finishedAt: string | null; status: string; created: BgmItemOutcome[]; failed: BgmItemOutcome[]; skipped: BgmItemOutcome[]; quotaBefore: BgmQuota | null; quotaAfter: BgmQuota | null; reason: { code: string; message: string } | null }
export type BgmRuns = { items: BgmRun[]; total: number; page: number; pageSize: number }

export type BgmCandidate = { key: string; release: import('./resources').ProwlarrRelease }
export type BgmSearchProgress = { query: string; source: string; status: 'RUNNING' | 'SUCCEEDED' | 'FAILED'; elapsedMs: number; resultCount: number | null }
export type BgmOperationTask = BgmTaskLink & { stage: string | null; error: string | null; notification: string | null }
export type BgmOperationEntry = { item: BgmItem; status: string; startedAt: string; searches: BgmSearchProgress[]; candidates: BgmCandidate[]; selected: BgmCandidate | null; task: BgmOperationTask | null; reason: { code: string; message: string } | null; notification: string | null }
export type BgmOperation = { id: string; source: BgmSource; action: BgmAction; triggerType: 'MANUAL' | 'SCHEDULED'; actorUserId: number | null; startedAt: string; updatedAt: string; status: string; requestedIds: number[]; entries: BgmOperationEntry[]; reason: { code: string; message: string } | null }
export type BgmOperations = { items: BgmOperation[]; total: number; page: number; pageSize: number }
