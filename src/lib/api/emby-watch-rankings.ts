import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type {
  EmbyWatchRankingData,
  EmbyWatchRankingParams,
} from '@/types/emby-watch-rankings'

type JavaApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

const EMBY_WATCH_RANKINGS_ERROR_MESSAGE =
  'Emby 观看统计加载失败，请稍后重试。'

export async function getEmbyWatchRankings(
  params: EmbyWatchRankingParams,
  signal?: AbortSignal,
): Promise<EmbyWatchRankingData> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<EmbyWatchRankingData>
    >('/api/v1/admin/emby/watch-rankings', {
      params: {
        date: params.date,
        limit: params.limit,
      },
      signal,
    })

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(
        response.data.message || EMBY_WATCH_RANKINGS_ERROR_MESSAGE,
      )
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) ?? EMBY_WATCH_RANKINGS_ERROR_MESSAGE,
    )
  }
}
