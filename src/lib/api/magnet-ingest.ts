import axios from 'axios'

import apiClient from '@/lib/axios'
import type {
  CreateSeriesMagnetIngestApiResponse,
  CreateSeriesMagnetIngestPayload,
  CreateSeriesMagnetIngestResponse,
  CreateMovieMagnetIngestApiResponse,
  CreateMovieMagnetIngestPayload,
  CreateMovieMagnetIngestResponse,
} from '@/types/magnet-ingest'

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
