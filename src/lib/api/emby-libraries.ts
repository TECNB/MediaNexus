import { getJavaErrorMessage, javaApiClient } from '@/lib/java-api'
import type {
  EmbyLibraryListData,
  EmbyLibraryRefreshResult,
  EmbyLibrarySummary,
} from '@/types/emby-library'

type JavaApiResponse<TData> = {
  code: number
  message: string
  data: TData | null
}

export async function listEmbyLibraries(): Promise<EmbyLibrarySummary[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<EmbyLibraryListData>
    >('/api/v1/emby/libraries')

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'Emby library list failed')
    }

    return response.data.data.items
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || 'Emby 媒体库加载失败。')
  }
}

export async function refreshEmbyLibrary(
  libraryId: string,
): Promise<EmbyLibraryRefreshResult> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<EmbyLibraryRefreshResult>
    >(`/api/v1/emby/libraries/${encodeURIComponent(libraryId)}/refresh`)

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'Emby library refresh failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || 'Emby 媒体库刷新失败。')
  }
}
