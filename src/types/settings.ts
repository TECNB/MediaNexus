export type SettingsValue = string | number | boolean | null | SettingsValue[] | { [key: string]: SettingsValue }
export type SettingsSource = 'DEPLOYMENT' | 'DATABASE' | 'LEGACY_DATABASE'
export type SettingsApplyMode = 'HOT' | 'RESTART'
export type SettingsGroupSummary = { id: string; label: string; applyMode: SettingsApplyMode; writable: boolean }
export type SettingsDirectory = { groups: SettingsGroupSummary[] }
export type SettingsField = {
  key: string
  label: string
  type: 'string' | 'integer' | 'boolean' | 'duration' | 'bytes' | 'string-list'
  writable: boolean
  secret: boolean
}
export type SettingsGroup = {
  id: string
  label: string
  version: number
  updatedAt: string | null
  applyMode: SettingsApplyMode
  status: 'EFFECTIVE' | 'PENDING_RESTART' | 'LIMITED_BY_DEPLOYMENT' | 'UNAVAILABLE'
  restartServices: string[]
  constraints: Record<string, SettingsValue>
  effectiveFingerprint: string
  fields: SettingsField[]
  saved: Record<string, SettingsValue>
  effective: Record<string, SettingsValue>
  sources: Record<string, SettingsSource>
}
export type SettingsUpdate = {
  version: number
  values: Record<string, SettingsValue>
  secrets: Record<string, { action: 'KEEP' } | { action: 'REPLACE'; value: string }>
}
export type SettingsResource = { id: string; name: string; attributes: Record<string, SettingsValue> }
export type SettingsProbe = {
  status: 'OK' | 'NOT_CONFIGURED' | 'UNAUTHORIZED' | 'FAILED' | 'UNSUPPORTED'
  message: string
  checkedAt: string
  source: 'CANDIDATE' | 'EFFECTIVE'
  resources: SettingsResource[]
}

export type DownloadCategory = 'MOVIE' | 'TV' | 'ANIME' | 'ADULT'
export type AccountStage = 'OPENLIST_STORAGE' | 'MEDIA_DIRECTORIES' | 'CD2_CLOUD' | 'CD2_MOUNT' | 'MEDIA_READABLE' | 'AS_BINDINGS' | 'EMBY_PATHS' | 'READBACK' | 'LOCAL_COMMIT'
export type AccountIssue = { code: string; stage: AccountStage | null; field: string | null; message: string }
export type AccountCheck = { stage: AccountStage; state: 'UNKNOWN' | 'PENDING' | 'HEALTHY' | 'FAILED' | 'NEEDS_ACTION'; checkedAt: string | null; message: string | null }
export type AccountCapacity = { totalBytes: number | null; usedBytes: number | null; freeBytes: number | null; observedAt: string | null; state: 'AVAILABLE' | 'UNAVAILABLE'; message: string | null }
export type CategoryDefault = { category: DownloadCategory; targetId: string | null }
export type DefaultChange = { category: DownloadCategory; previousTargetId: string | null; targetId: string }
export type AccountLibraryPath = { libraryId: string; libraryName: string; relativePath: string; path: string }
export type AccountBinding = {
  category: DownloadCategory; rootPath: string; animePathTemplate: string | null; asUuid: string; asRequestBodyConfigured: boolean
  mediaSourceRoot: string; strmRootPath: string; embyLibraryId: string; embyLibraryName: string
  embyLibraries?: AccountLibraryPath[]
}
export type DownloadAccount = {
  id: string; displayName: string; status: 'CONNECTED'; acceptingNewTasks: boolean; defaultCategories: DownloadCategory[]
  ingestPrefix: string; cloudDrivePrefix: string; mediaSourcePrefix: string
  openListStorageId: number; openListMountPath: string; cloudName: string; cloudPath: string; mountPoint: string
  bindings: AccountBinding[]; capacity: AccountCapacity; checks: AccountCheck[]; createdAt: string; updatedAt: string
}
export type DownloadAccountList = { registryVersion: number; managed: boolean; accounts: DownloadAccount[]; categoryDefaults: CategoryDefault[] }
export type DownloadAccountDetail = { registryVersion: number; managed: boolean; account: DownloadAccount }
export type AccountEvidence = { stage: AccountStage; resourceType: string; resourceId: string; observedAt: string; fingerprint: string; summary: string }
export type ConnectionVersion = { integration: 'OPENLIST' | 'CD2' | 'AUTOSYMLINK' | 'EMBY'; effectiveVersion: number; templateVersion: number | null }
export type AdoptionPlan = {
  id: string; planVersion: number; registryVersion: number; targetId: string; displayName: string; canConfirm: boolean
  proposedAccount: DownloadAccount | null; connectionVersions: ConnectionVersion[]; evidence: AccountEvidence[]; issues: AccountIssue[]; createdAt: string
}
export type PikPakAuthorization = { platform: 'android' | 'web' | 'pc'; username?: string; password?: string; refreshToken?: string; captchaToken?: string; deviceId?: string }
export type CategoryPathOverride = { rootPath?: string; animePathTemplate?: string; strmRootPath?: string }
export type AccountPathOverrides = { ingestPrefix?: string; cloudDrivePrefix?: string; mediaSourcePrefix?: string; categories?: Partial<Record<DownloadCategory, CategoryPathOverride>> }
export type OnboardingPlanRequest = { expectedRegistryVersion: number; displayName: string; categories: DownloadCategory[]; authorization: PikPakAuthorization; pathOverrides?: AccountPathOverrides }
export type PlannedAccountBinding = { category: DownloadCategory; rootPath: string; animePathTemplate: string | null; mediaSourceRoot: string; strmRootPath: string; embyLibraryId: string | null; embyLibraries?: AccountLibraryPath[] }
export type PlannedAccountResource = { stage: AccountStage; action: 'CREATE' | 'REUSE' | 'APPEND' | 'VERIFY'; resourceType: string; resourceId: string | null; path: string | null; summary: string }
export type OnboardingPlan = {
  id: string; planVersion: number; registryVersion: number; targetId: string; displayName: string; categories: DownloadCategory[]
  ingestPrefix: string; cloudDrivePrefix: string; mediaSourcePrefix: string; bindings: PlannedAccountBinding[]; connectionVersions: ConnectionVersion[]
  defaultChanges: DefaultChange[]; resources: PlannedAccountResource[]; authorizationConfigured: boolean; canExecute: boolean; issues: AccountIssue[]; createdAt: string; updatedAt: string
}
export type OnboardingExecutionStatus = 'PENDING' | 'RUNNING' | 'CONNECTED' | 'SUCCEEDED' | 'FAILED' | 'NEEDS_ACTION' | 'INTERRUPTED'
export type OnboardingStep = {
  stage: AccountStage; category: DownloadCategory | null; status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'NEEDS_ACTION' | 'INTERRUPTED'; attempt: number
  resourceRefs: { resourceType: string; resourceId: string; path: string | null }[]; evidence: AccountEvidence[]; message: string | null; issue: AccountIssue | null; startedAt: string | null; finishedAt: string | null
}
export type OnboardingExecution = {
  id: string; executionVersion: number; planId: string; planVersion: number; targetId: string; displayName: string; categories: DownloadCategory[]; status: OnboardingExecutionStatus; currentStage: AccountStage | null
  steps: OnboardingStep[]; defaultChanges: DefaultChange[]; defaultsCommitted: boolean; configurationVerified: boolean; playbackVerified: false; issue: AccountIssue | null; canContinue: boolean; createdAt: string; updatedAt: string; finishedAt: string | null
}
export type OnboardingExecutionList = { items: OnboardingExecution[]; total: number }
