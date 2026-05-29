import axios from 'axios'

import { API_REQUEST_TIMEOUT_MS } from '@/lib/axios'
import type {
  AnimeSearchItem,
  AnimeSearchResponseData,
  AnimeSubtitleGroup,
  AnimeSubtitleGroupsData,
  AnimeSubscriptionPayload,
  AnimeSubscriptionPreview,
  AnimeSubscriptionResult,
  JavaApiResponse,
} from '@/types/anime'

const JAVA_ANIME_SEARCH_ERROR_MESSAGE = '动漫搜索失败，请稍后重试。'
const JAVA_ANIME_GROUPS_ERROR_MESSAGE = '字幕组加载失败，请稍后重试。'
const JAVA_ANIME_PREVIEW_ERROR_MESSAGE = '字幕组预览失败，请稍后重试。'
const JAVA_ANIME_SUBSCRIBE_ERROR_MESSAGE = '订阅失败，请稍后重试。'

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

export async function getAnimeSubtitleGroups(
  itemId: string,
  sourceUrl: string,
  signal?: AbortSignal,
): Promise<AnimeSubtitleGroup[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<AnimeSubtitleGroupsData>
    >(`/api/v1/resources/anime/${encodeURIComponent(itemId)}/groups`, {
      params: { sourceUrl: sourceUrl.trim() },
      signal,
    })

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.groups)
    ) {
      throw new Error(JAVA_ANIME_GROUPS_ERROR_MESSAGE)
    }

    return response.data.data.groups
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }

    throw new Error(
      getJavaErrorMessage(error) ?? JAVA_ANIME_GROUPS_ERROR_MESSAGE,
    )
  }
}

export async function previewAnimeSubscription(
  payload: AnimeSubscriptionPayload,
  signal?: AbortSignal,
): Promise<AnimeSubscriptionPreview> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<AnimeSubscriptionPreview>
    >('/api/v1/resources/anime/preview', payload, { signal })

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(JAVA_ANIME_PREVIEW_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }

    throw new Error(
      getJavaErrorMessage(error) ?? JAVA_ANIME_PREVIEW_ERROR_MESSAGE,
    )
  }
}

export async function subscribeAnime(
  payload: AnimeSubscriptionPayload,
): Promise<AnimeSubscriptionResult> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<AnimeSubscriptionResult>
    >('/api/v1/resources/anime/subscribe', payload)

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(JAVA_ANIME_SUBSCRIBE_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) ?? JAVA_ANIME_SUBSCRIBE_ERROR_MESSAGE,
    )
  }
}

function getJavaErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message

    if (typeof message === 'string' && message.trim()) {
      return message.trim()
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return null
}

function isJavaRequestCanceledError(error: unknown) {
  return (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
  )
}
