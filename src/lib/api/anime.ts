import axios from 'axios'

import { API_REQUEST_TIMEOUT_MS } from '@/lib/axios'
import type {
  AnimeSearchItem,
  AnimeSearchResponseData,
  JavaApiResponse,
} from '@/types/anime'

const JAVA_ANIME_SEARCH_ERROR_MESSAGE = '动漫搜索失败，请稍后重试。'

const javaApiBaseUrl =
  import.meta.env.VITE_JAVA_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''

const javaApiClient = axios.create({
  baseURL: javaApiBaseUrl || undefined,
  timeout: API_REQUEST_TIMEOUT_MS,
})

export async function searchAnime(
  term: string,
  signal?: AbortSignal,
): Promise<AnimeSearchItem[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<AnimeSearchResponseData>
    >('/api/v1/resources/anime/search', {
      params: { term: term.trim() },
      signal,
    })

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(JAVA_ANIME_SEARCH_ERROR_MESSAGE)
    }

    return response.data.data.items
  } catch (error) {
    if (
      axios.isCancel(error) ||
      (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
    ) {
      throw error
    }

    throw new Error(JAVA_ANIME_SEARCH_ERROR_MESSAGE)
  }
}
