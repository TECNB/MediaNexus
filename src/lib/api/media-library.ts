import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type {
  MediaLibraryListParams,
  MediaLibraryPageData,
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

export async function getMediaLibraryPoster(
  itemId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await javaApiClient.get<Blob>(
    `/api/v1/admin/media-library/items/${encodeURIComponent(itemId)}/poster`,
    {
      responseType: 'blob',
      signal,
    },
  )

  return response.data
}
