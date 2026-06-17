import axios from 'axios'

import apiClient from '@/lib/axios'
import { getJavaErrorMessage, javaApiClient } from '@/lib/java-api'
import type {
  AddMovieResourceRequest,
  AddMovieResourceResponse,
  MovieQualityProfile,
  MovieQualityProfilesResponse,
  MovieSearchItem,
  SeriesSeasonsData,
  SeriesSearchItem,
} from '@/types/resources'

type JavaApiResponse<TData> = {
  code: number
  message: string
  data: TData | null
}

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

async function searchJavaResources<TItem>(
  path: string,
  term: string,
  fallbackMessage: string,
  signal?: AbortSignal,
) {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<{ items: TItem[] }>
    >(path, {
      params: { term: term.trim() },
      signal,
    })

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || fallbackMessage)
    }

    return response.data.data.items
  } catch (error) {
    if (isRequestCanceledError(error)) {
      throw error
    }

    throw new Error(getJavaErrorMessage(error) || fallbackMessage)
  }
}

export async function searchMovies(
  term: string,
  signal?: AbortSignal,
): Promise<MovieSearchItem[]> {
  return searchJavaResources<MovieSearchItem>(
    '/api/v1/resources/movies/search',
    term,
    '电影搜索失败，请稍后重试。',
    signal,
  )
}

export async function getMovieQualityProfiles(
  signal?: AbortSignal,
): Promise<MovieQualityProfile[]> {
  try {
    const response = await apiClient.get<MovieQualityProfilesResponse>(
      '/api/v1/resources/movies/quality-profiles',
      { signal },
    )

    if (!response.data.success) {
      throw new Error(response.data.message || 'quality profiles fetch failed')
    }

    const items = response.data.data?.items

    if (!Array.isArray(items)) {
      throw new Error(response.data.message || 'quality profiles fetch failed')
    }

    return items
  } catch (error) {
    if (isRequestCanceledError(error)) {
      throw error
    }

    throw new Error(
      getAxiosErrorMessage(error) || '质量档位加载失败，请稍后重试。',
    )
  }
}

export async function addMovieResource(
  payload: AddMovieResourceRequest,
): Promise<AddMovieResourceResponse['data']> {
  try {
    const response = await apiClient.post<AddMovieResourceResponse>(
      '/api/v1/resources/movies/add',
      payload,
    )

    if (
      !response.data.success ||
      response.data.data?.status !== 'search_started'
    ) {
      throw new Error(response.data.message || 'failed to start movie search')
    }

    return response.data.data
  } catch (error) {
    throw new Error(
      getAxiosErrorMessage(error) || '搜索发起失败，请稍后重试。',
    )
  }
}

export async function searchSeries(
  term: string,
  signal?: AbortSignal,
): Promise<SeriesSearchItem[]> {
  return searchJavaResources<SeriesSearchItem>(
    '/api/v1/resources/series/search',
    term,
    '剧集搜索失败，请稍后重试。',
    signal,
  )
}

export async function getSeriesSeasons(
  tvdbId: number,
  signal?: AbortSignal,
): Promise<SeriesSeasonsData> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<SeriesSeasonsData>
    >(
      '/api/v1/resources/series/seasons',
      {
        params: { tvdb_id: tvdbId },
        signal,
      },
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'series seasons fetch failed')
    }

    return response.data.data
  } catch (error) {
    if (isRequestCanceledError(error)) {
      throw error
    }

    throw new Error(
      getJavaErrorMessage(error) || '剧集季数加载失败，请稍后重试。',
    )
  }
}

export function isRequestCanceledError(error: unknown) {
  return (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
  )
}
