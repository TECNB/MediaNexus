import axios from 'axios'

import apiClient from '@/lib/axios'
import type {
  AddMovieResourceRequest,
  AddMovieResourceResponse,
  MovieQualityProfile,
  MovieQualityProfilesResponse,
  MovieSearchItem,
  MovieSearchResponse,
  SeriesSeasonsData,
  SeriesSeasonsResponse,
  SeriesSearchItem,
  SeriesSearchResponse,
} from '@/types/resources'

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

async function searchResources<TResponse extends { success: boolean; message: string }>(
  path: string,
  term: string,
  signal?: AbortSignal,
) {
  const response = await apiClient.get<TResponse>(path, {
    params: { term: term.trim() },
    signal,
  })

  if (!response.data.success) {
    throw new Error(response.data.message || 'Resource search failed')
  }

  return response.data
}

export async function searchMovies(
  term: string,
  signal?: AbortSignal,
): Promise<MovieSearchItem[]> {
  const response = await searchResources<MovieSearchResponse>(
    '/api/v1/resources/movies/search',
    term,
    signal,
  )

  return response.data.items
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
  const response = await searchResources<SeriesSearchResponse>(
    '/api/v1/resources/series/search',
    term,
    signal,
  )

  return response.data.items
}

export async function getSeriesSeasons(
  tvdbId: number,
  signal?: AbortSignal,
): Promise<SeriesSeasonsData> {
  try {
    const response = await apiClient.get<SeriesSeasonsResponse>(
      '/api/v1/resources/series/seasons',
      {
        params: { tvdb_id: tvdbId },
        signal,
      },
    )

    if (!response.data.success) {
      throw new Error(response.data.message || 'series seasons fetch failed')
    }

    return response.data.data
  } catch (error) {
    if (isRequestCanceledError(error)) {
      throw error
    }

    throw new Error(
      getAxiosErrorMessage(error) || '剧集季数加载失败，请稍后重试。',
    )
  }
}

export function isRequestCanceledError(error: unknown) {
  return (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
  )
}
