import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type {
  MediaLibraryListParams,
  MediaLibraryItem,
  MediaLibraryPageData,
  MediaIdentifyQuery,
  MediaMetadataCandidate,
  MediaPosterCandidate,
  MediaLibraryId,
  MediaLibrarySyncResult,
  MediaDeletionTask,
  MediaSeason,
} from '@/types/media-library'

type JavaApiResponse<TData> = {
  code: number
  message: string
  data: TData | null
}

const MEDIA_LIBRARY_ERROR_MESSAGE = '媒体库加载失败，请稍后重试。'

export async function getMediaLibraryItems(
  params: MediaLibraryListParams,
  signal?: AbortSignal,
): Promise<MediaLibraryPageData> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<MediaLibraryPageData>
    >('/api/v1/admin/media-library/items', {
      params: {
        library: params.library,
        page: params.page,
        page_size: params.page_size,
        search: params.search || undefined,
        missing_poster: params.missing_poster || undefined,
      },
      signal,
    })

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || MEDIA_LIBRARY_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) ?? MEDIA_LIBRARY_ERROR_MESSAGE,
    )
  }
}

export async function syncMediaLibrary(library: MediaLibraryId) {
  const response = await javaApiClient.post<JavaApiResponse<MediaLibrarySyncResult>>(
    '/api/v1/admin/media-library/sync',
    null,
    { params: { library }, timeout: 120000 },
  )
  if (response.data.code !== 200 || !response.data.data) {
    throw new Error(response.data.message || '媒体库同步失败')
  }
  return response.data.data
}

export async function getMediaLibraryPoster(
  itemId: string,
  signal?: AbortSignal,
  imageTag?: string | null,
): Promise<Blob> {
  const response = await javaApiClient.get<Blob>(
    `/api/v1/admin/media-library/items/${encodeURIComponent(itemId)}/poster`,
    {
      responseType: 'blob',
      signal,
      params: { v: imageTag || undefined },
    },
  )

  return response.data
}

const itemPath = (itemId: string) =>
  `/api/v1/admin/media-library/items/${encodeURIComponent(itemId)}`

export async function searchMediaMetadata(
  itemId: string,
  query: MediaIdentifyQuery,
  signal?: AbortSignal,
) {
  const response = await javaApiClient.get<JavaApiResponse<MediaMetadataCandidate[]>>(
    `${itemPath(itemId)}/metadata-candidates`,
    { params: query, signal, timeout: 90000 },
  )
  if (response.data.code !== 200 || !Array.isArray(response.data.data)) {
    throw new Error(response.data.message || '识别候选加载失败')
  }
  return response.data.data
}

export async function getMediaPosterCandidates(
  itemId: string,
  library: MediaLibraryId,
  signal?: AbortSignal,
) {
  const response = await javaApiClient.get<JavaApiResponse<MediaPosterCandidate[]>>(
    `${itemPath(itemId)}/poster-candidates`,
    { params: { library }, signal, timeout: 90000 },
  )
  if (response.data.code !== 200 || !Array.isArray(response.data.data)) {
    throw new Error(response.data.message || '候选封面加载失败')
  }
  return response.data.data
}

export async function getMediaCandidateImage(
  itemId: string,
  candidateId: string,
  mode: 'identify' | 'poster',
  query: MediaIdentifyQuery,
  signal?: AbortSignal,
) {
  const resource = mode === 'identify' ? 'metadata-candidates' : 'poster-candidates'
  const response = await javaApiClient.get<Blob>(
    `${itemPath(itemId)}/${resource}/${encodeURIComponent(candidateId)}/image`,
    { params: query, responseType: 'blob', signal, timeout: 90000 },
  )
  return response.data
}

export async function applyMediaMetadata(
  itemId: string,
  query: MediaIdentifyQuery,
  candidateId: string,
  replaceAllImages: boolean,
) {
  const response = await javaApiClient.post<JavaApiResponse<MediaLibraryItem>>(
    `${itemPath(itemId)}/identify`,
    { ...query, candidate_id: candidateId, replace_all_images: replaceAllImages },
    { timeout: 90000 },
  )
  if (response.data.code !== 200 || !response.data.data) {
    throw new Error(response.data.message || '重新识别失败')
  }
  return response.data.data
}

export async function selectMediaPoster(
  itemId: string,
  library: MediaLibraryId,
  candidateId: string,
) {
  const response = await javaApiClient.post<JavaApiResponse<MediaLibraryItem>>(
    `${itemPath(itemId)}/poster-selection`,
    { library, candidate_id: candidateId },
    { timeout: 90000 },
  )
  if (response.data.code !== 200 || !response.data.data) {
    throw new Error(response.data.message || '封面替换失败')
  }
  return response.data.data
}

export async function getMediaSeasons(
  itemId: string,
  library: MediaLibraryId,
  signal?: AbortSignal,
) {
  const response = await javaApiClient.get<JavaApiResponse<MediaSeason[]>>(
    `${itemPath(itemId)}/seasons`,
    { params: { library }, signal },
  )
  if (response.data.code !== 200 || !Array.isArray(response.data.data)) {
    throw new Error(response.data.message || '季度加载失败')
  }
  return response.data.data
}

export async function createMediaDeletion(
  itemId: string,
  library: MediaLibraryId,
  seasonId?: string,
) {
  const response = await javaApiClient.post<JavaApiResponse<MediaDeletionTask>>(
    `${itemPath(itemId)}/deletions`,
    { library, season_id: seasonId || null },
  )
  if (response.data.code !== 200 || !response.data.data) {
    throw new Error(response.data.message || '删除任务创建失败')
  }
  return response.data.data
}

export async function getMediaDeletions(signal?: AbortSignal) {
  const response = await javaApiClient.get<JavaApiResponse<MediaDeletionTask[]>>(
    '/api/v1/admin/media-library/deletions',
    { signal },
  )
  if (response.data.code !== 200 || !Array.isArray(response.data.data)) {
    throw new Error(response.data.message || '删除任务加载失败')
  }
  return response.data.data
}

export async function retryMediaDeletion(taskId: string) {
  const response = await javaApiClient.post<JavaApiResponse<MediaDeletionTask>>(
    `/api/v1/admin/media-library/deletions/${encodeURIComponent(taskId)}/retry`,
  )
  if (response.data.code !== 200 || !response.data.data) {
    throw new Error(response.data.message || '删除任务重试失败')
  }
  return response.data.data
}
