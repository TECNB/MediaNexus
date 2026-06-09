import axios from 'axios'

import apiClient from '@/lib/axios'
import { getJavaErrorMessage, javaApiClient } from '@/lib/java-api'
import type {
  AnimeMagnetIngestTask,
  AnimeMagnetIngestTaskListData,
  AnimeMagnetIngestTaskLog,
  AnimeMagnetIngestTaskLogListData,
  AnimeMagnetSearchItem,
  AnimeMagnetSearchResponseData,
  CreateAnimeMagnetIngestTaskPayload,
  CreateSeriesMagnetIngestApiResponse,
  CreateSeriesMagnetIngestPayload,
  CreateSeriesMagnetIngestResponse,
  CreateMovieMagnetIngestApiResponse,
  CreateMovieMagnetIngestPayload,
  CreateMovieMagnetIngestResponse,
  JavaApiResponse,
} from '@/types/magnet-ingest'

const JAVA_ANIME_MAGNET_SEARCH_ERROR_MESSAGE = '动漫搜索失败，请稍后重试。'
const JAVA_ANIME_MAGNET_TASK_ERROR_MESSAGE = '动漫磁力任务处理失败，请稍后重试。'

function getAxiosErrorMessage(error: unknown) {
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

export async function searchAnimeMagnetItems(
  term: string,
  signal?: AbortSignal,
): Promise<AnimeMagnetSearchItem[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<AnimeMagnetSearchResponseData>
    >('/api/v1/magnet-ingest/anime/search', {
      params: { term: term.trim() },
      signal,
    })

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'anime magnet search failed')
    }

    return response.data.data.items
  } catch (error) {
    if (
      axios.isCancel(error) ||
      (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
    ) {
      throw error
    }

    throw new Error(
      getJavaErrorMessage(error) || JAVA_ANIME_MAGNET_SEARCH_ERROR_MESSAGE,
    )
  }
}

export async function createAnimeMagnetIngestTask(
  payload: CreateAnimeMagnetIngestTaskPayload,
): Promise<AnimeMagnetIngestTask> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<AnimeMagnetIngestTask>
    >('/api/v1/magnet-ingest/anime/tasks', payload)

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'anime magnet task failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) || JAVA_ANIME_MAGNET_TASK_ERROR_MESSAGE,
    )
  }
}

export async function listAnimeMagnetIngestTasks(): Promise<
  AnimeMagnetIngestTask[]
> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<AnimeMagnetIngestTaskListData>
    >('/api/v1/magnet-ingest/anime/tasks')

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'anime magnet tasks failed')
    }

    return response.data.data.items
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) || JAVA_ANIME_MAGNET_TASK_ERROR_MESSAGE,
    )
  }
}

export async function listAnimeMagnetIngestTaskLogs(
  taskId: string,
): Promise<AnimeMagnetIngestTaskLog[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<AnimeMagnetIngestTaskLogListData>
    >(`/api/v1/magnet-ingest/anime/tasks/${encodeURIComponent(taskId)}/logs`)

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'anime magnet task logs failed')
    }

    return response.data.data.items
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) || JAVA_ANIME_MAGNET_TASK_ERROR_MESSAGE,
    )
  }
}

export async function createMovieMagnetIngest(
  payload: CreateMovieMagnetIngestPayload,
): Promise<CreateMovieMagnetIngestResponse> {
  try {
    const response = await apiClient.post<CreateMovieMagnetIngestApiResponse>(
      '/api/v1/magnet-ingest/movies',
      payload,
    )

    if (!response.data.success) {
      throw new Error(response.data.message || 'movie magnet ingest failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getAxiosErrorMessage(error) || '推送失败，请稍后重试')
  }
}

export async function createSeriesMagnetIngest(
  payload: CreateSeriesMagnetIngestPayload,
): Promise<CreateSeriesMagnetIngestResponse> {
  try {
    const response = await apiClient.post<CreateSeriesMagnetIngestApiResponse>(
      '/api/v1/magnet-ingest/series',
      payload,
    )

    if (!response.data.success) {
      throw new Error(response.data.message || 'series magnet ingest failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getAxiosErrorMessage(error) || '推送失败，请稍后重试')
  }
}
