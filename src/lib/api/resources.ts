import axios from 'axios'

import apiClient from '@/lib/axios'
import type { MovieSearchResponse } from '@/types/resources'

export function searchMovies(term: string, signal?: AbortSignal) {
  return apiClient
    .get<MovieSearchResponse>('/api/v1/resources/movies/search', {
      params: { term: term.trim() },
      signal,
    })
    .then((response) => {
      if (!response.data.success) {
        throw new Error(response.data.message || 'Movie search failed')
      }

      return response
    })
}

export function isRequestCanceledError(error: unknown) {
  return (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
  )
}
