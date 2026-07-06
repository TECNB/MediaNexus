import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type {
  AdultOtherCollectionSourceFolder,
  AdultOtherCollectionSyncRun,
} from '@/types/adult-other-collections'

type JavaApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

type SyncRequest = {
  minItemCount: number
  sourceFolderPath?: string | null
}

const ADULT_OTHER_COLLECTIONS_ERROR_MESSAGE =
  'Adult-Other 合集同步请求失败，请稍后重试。'
const ADULT_OTHER_COLLECTIONS_TIMEOUT_MS = 0

export async function getLatestAdultOtherCollectionSyncRun(
  signal?: AbortSignal,
): Promise<AdultOtherCollectionSyncRun | null> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<AdultOtherCollectionSyncRun | null>
    >('/api/v1/admin/emby/adult-other-collections/runs/latest', {
      signal,
      timeout: ADULT_OTHER_COLLECTIONS_TIMEOUT_MS,
    })

    if (response.data.code !== 200) {
      throw new Error(
        response.data.message || ADULT_OTHER_COLLECTIONS_ERROR_MESSAGE,
      )
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) ?? ADULT_OTHER_COLLECTIONS_ERROR_MESSAGE,
    )
  }
}

export async function getAdultOtherCollectionSourceFolders(
  signal?: AbortSignal,
): Promise<AdultOtherCollectionSourceFolder[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<AdultOtherCollectionSourceFolder[]>
    >('/api/v1/admin/emby/adult-other-collections/source-folders', {
      signal,
      timeout: ADULT_OTHER_COLLECTIONS_TIMEOUT_MS,
    })

    if (response.data.code !== 200) {
      throw new Error(
        response.data.message || ADULT_OTHER_COLLECTIONS_ERROR_MESSAGE,
      )
    }

    return response.data.data ?? []
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) ?? ADULT_OTHER_COLLECTIONS_ERROR_MESSAGE,
    )
  }
}

export async function previewAdultOtherCollections(
  request: SyncRequest,
): Promise<AdultOtherCollectionSyncRun> {
  return submitAdultOtherCollectionSync('preview', request)
}

export async function syncAdultOtherCollections(
  request: SyncRequest,
): Promise<AdultOtherCollectionSyncRun> {
  return submitAdultOtherCollectionSync('sync', request)
}

export async function previewAdultOtherCollectionCleanup(
  request: SyncRequest,
): Promise<AdultOtherCollectionSyncRun> {
  return submitAdultOtherCollectionSync('cleanup-preview', request)
}

export async function cleanupAdultOtherCollections(
  request: SyncRequest,
): Promise<AdultOtherCollectionSyncRun> {
  return submitAdultOtherCollectionSync('cleanup', request)
}

async function submitAdultOtherCollectionSync(
  action: 'preview' | 'sync' | 'cleanup-preview' | 'cleanup',
  request: SyncRequest,
) {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<AdultOtherCollectionSyncRun>
    >(`/api/v1/admin/emby/adult-other-collections/${action}`, request, {
      timeout: ADULT_OTHER_COLLECTIONS_TIMEOUT_MS,
    })

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(
        response.data.message || ADULT_OTHER_COLLECTIONS_ERROR_MESSAGE,
      )
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) ?? ADULT_OTHER_COLLECTIONS_ERROR_MESSAGE,
    )
  }
}
