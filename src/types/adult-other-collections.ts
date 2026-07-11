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
  | 'AUTO_WEBHOOK'
  | 'CLEANUP_DRY_RUN'
  | 'CLEANUP_APPLY'

export type AdultOtherCollectionSyncStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export type AdultOtherAutomationItem = {
  embyItemId: string
  itemName: string | null
  itemPath: string | null
  collectionName: string | null
  primaryBefore: boolean
  refreshRequested: boolean
  primaryAfter: boolean
  status:
    | 'WAITING_PRIMARY'
    | 'NATURAL_READY'
    | 'REFRESHED'
    | 'MISSING'
    | 'SKIPPED'
    | 'UNRESOLVED'
  message: string | null
}

export type AdultOtherAutomationCollection = {
  embyCollectionId: string | null
  collectionName: string
  action: AdultOtherCollectionSyncAction
  addedItemCount: number
  imageReady: boolean
  status: 'IMAGE_READY' | 'IMAGE_MISSING' | 'SKIPPED'
  message: string | null
}

export type AdultOtherAutomationRun = {
  id: string
  triggerType: 'NEW_ITEMS' | 'DELETIONS'
  status: AdultOtherCollectionSyncStatus
  stage: string
  eventCount: number
  targetItemCount: number
  naturalPrimaryReadyCount: number
  targetedRefreshCount: number
  finalPrimaryReadyCount: number
  finalPrimaryMissingCount: number
  affectedCollectionCount: number
  createdCollectionCount: number
  updatedCollectionCount: number
  collectionImageReadyCount: number
  deletedCollectionCount: number
  message: string | null
  startedAt: string
  finishedAt: string | null
  items: AdultOtherAutomationItem[]
  collections: AdultOtherAutomationCollection[]
}

export type AdultOtherCollectionSourceFolderChangeStatus =
  | 'HEALTHY'
  | 'PENDING_CREATE'
  | 'PENDING_MEMBERS'
  | 'MIXED'

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
  healthyGroupCount: number
  pendingCreateGroupCount: number
  pendingMemberGroupCount: number
  skippedGroupCount: number
  healthStatus: AdultOtherCollectionSourceFolderChangeStatus
}

export type AdultOtherCollectionInventory = {
  sourceFolderCount: number
  groupCount: number
  healthyGroupCount: number
  pendingCreateGroupCount: number
  pendingMemberGroupCount: number
  skippedGroupCount: number
  sourceFolders: AdultOtherCollectionSourceFolder[]
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
