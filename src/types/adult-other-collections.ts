export type AdultOtherCollectionSyncAction =
  | 'CREATE'
  | 'UPDATE'
  | 'UNCHANGED'
  | 'SKIPPED'
  | 'DELETE'
  | 'REVIEW'
  | 'MISSING_COLLECTION'

export type AdultOtherCollectionSyncMode =
  | 'DRY_RUN'
  | 'APPLY'
  | 'CLEANUP_DRY_RUN'
  | 'CLEANUP_APPLY'

export type AdultOtherCollectionSyncStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export type AdultOtherCollectionSourceFolderChangeStatus =
  | 'NEVER_SYNCED'
  | 'UNCHANGED'
  | 'INCREASED'
  | 'DECREASED'
  | 'CHANGED'
  | 'MISSING'

export type AdultOtherCollectionSyncGroup = {
  collectionName: string
  sourceFolderPath: string
  itemCount: number
  eligible: boolean
  action: AdultOtherCollectionSyncAction
  embyCollectionId: string | null
  addedItemCount: number
  skipReason: string | null
  sampleItemNames: string[]
}

export type AdultOtherCollectionSourceFolder = {
  path: string
  label: string
  itemCount: number
  groupCount: number
  latestPreviewAt: string | null
  latestSyncAt: string | null
  lastSyncedItemCount: number | null
  lastSyncedGroupCount: number | null
  itemDelta: number | null
  groupDelta: number | null
  changeStatus: AdultOtherCollectionSourceFolderChangeStatus
}

export type AdultOtherCollectionSyncRun = {
  id: string
  mode: AdultOtherCollectionSyncMode
  status: AdultOtherCollectionSyncStatus
  minItemCount: number
  sourceFolderPath: string | null
  totalItemCount: number
  groupedItemCount: number
  skippedItemCount: number
  groupCount: number
  eligibleGroupCount: number
  createdCollectionCount: number
  updatedCollectionCount: number
  unchangedCollectionCount: number
  deletedCollectionCount: number
  reviewCollectionCount: number
  itemAddCount: number
  errorMessage: string | null
  startedAt: string
  finishedAt: string | null
  groups: AdultOtherCollectionSyncGroup[]
}
