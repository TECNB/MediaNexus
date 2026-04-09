import axios from 'axios'

import apiClient from '@/lib/axios'
import type {
  MovieSearchItem,
  MovieSearchResponse,
  SeriesSearchItem,
  SeriesSearchResponse,
} from '@/types/resources'

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

export function isRequestCanceledError(error: unknown) {
  return (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
  )
}
