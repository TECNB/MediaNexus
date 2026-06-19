import axios from 'axios'

import { getJavaErrorMessage, javaApiClient } from '@/lib/java-api'
import type {
  AnimeMagnetIngestTask,
  AnimeMagnetIngestTaskListData,
  AnimeMagnetIngestTaskLog,
  AnimeMagnetIngestTaskLogListData,
  AnimeMagnetSearchItem,
  AnimeMagnetSearchResponseData,
  CreateAnimeMagnetIngestTaskPayload,
  CreateSeriesMagnetIngestPayload,
  CreateSeriesMagnetIngestResponse,
  CreateMovieMagnetIngestPayload,
  CreateMovieMagnetIngestResponse,
  JavaApiResponse,
  MagnetIngestTaskLog,
  MovieMagnetIngestTask,
  MovieMagnetIngestTaskListData,
  MovieMagnetIngestTaskLogListData,
  SeriesMagnetIngestTask,
  SeriesMagnetIngestTaskListData,
  SeriesMagnetIngestTaskLogListData,
} from '@/types/magnet-ingest'

const JAVA_ANIME_MAGNET_SEARCH_ERROR_MESSAGE = '动漫搜索失败，请稍后重试。'
const JAVA_ANIME_MAGNET_TASK_ERROR_MESSAGE = '动漫磁力任务处理失败，请稍后重试。'
const JAVA_MAGNET_TASK_ERROR_MESSAGE = '磁力任务处理失败，请稍后重试。'

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
    const response = await javaApiClient.post<
      JavaApiResponse<CreateMovieMagnetIngestResponse>
    >(
      '/api/v1/magnet-ingest/movies/tasks',
      payload,
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'movie magnet ingest failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || JAVA_MAGNET_TASK_ERROR_MESSAGE)
  }
}

export async function listMovieMagnetIngestTasks(): Promise<
  MovieMagnetIngestTask[]
> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<MovieMagnetIngestTaskListData>
    >('/api/v1/magnet-ingest/movies/tasks')

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'movie magnet tasks failed')
    }

    return response.data.data.items
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || JAVA_MAGNET_TASK_ERROR_MESSAGE)
  }
}

export async function getMovieMagnetIngestTask(
  taskId: string,
): Promise<MovieMagnetIngestTask> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<MovieMagnetIngestTask>
    >(`/api/v1/magnet-ingest/movies/tasks/${encodeURIComponent(taskId)}`)

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'movie magnet task failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || JAVA_MAGNET_TASK_ERROR_MESSAGE)
  }
}

export async function listMovieMagnetIngestTaskLogs(
  taskId: string,
): Promise<MagnetIngestTaskLog[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<MovieMagnetIngestTaskLogListData>
    >(`/api/v1/magnet-ingest/movies/tasks/${encodeURIComponent(taskId)}/logs`)

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'movie magnet task logs failed')
    }

    return response.data.data.items
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || JAVA_MAGNET_TASK_ERROR_MESSAGE)
  }
}

export async function createSeriesMagnetIngest(
  payload: CreateSeriesMagnetIngestPayload,
): Promise<CreateSeriesMagnetIngestResponse> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<CreateSeriesMagnetIngestResponse>
    >(
      '/api/v1/magnet-ingest/series/tasks',
      payload,
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'series magnet ingest failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || JAVA_MAGNET_TASK_ERROR_MESSAGE)
  }
}

export async function listSeriesMagnetIngestTasks(): Promise<
  SeriesMagnetIngestTask[]
> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<SeriesMagnetIngestTaskListData>
    >('/api/v1/magnet-ingest/series/tasks')

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'series magnet tasks failed')
    }

    return response.data.data.items
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || JAVA_MAGNET_TASK_ERROR_MESSAGE)
  }
}

export async function getSeriesMagnetIngestTask(
  taskId: string,
): Promise<SeriesMagnetIngestTask> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<SeriesMagnetIngestTask>
    >(`/api/v1/magnet-ingest/series/tasks/${encodeURIComponent(taskId)}`)

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'series magnet task failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || JAVA_MAGNET_TASK_ERROR_MESSAGE)
  }
}

export async function listSeriesMagnetIngestTaskLogs(
  taskId: string,
): Promise<MagnetIngestTaskLog[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<SeriesMagnetIngestTaskLogListData>
    >(`/api/v1/magnet-ingest/series/tasks/${encodeURIComponent(taskId)}/logs`)

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'series magnet task logs failed')
    }

    return response.data.data.items
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || JAVA_MAGNET_TASK_ERROR_MESSAGE)
  }
}
