import { getJavaErrorMessage, javaApiClient } from '@/lib/java-api'
import type { JavaApiResponse } from '@/types/magnet-ingest'
import type {
  CreateMovieQuarkIngestPayload,
  CreateSeasonQuarkIngestPayload,
  QuarkIngestPreview,
  QuarkIngestTaskResult,
} from '@/types/quark-ingest'

const QUARK_INGEST_ERROR_MESSAGE = 'Quark 入库任务创建失败，请稍后重试。'
const QUARK_PREVIEW_ERROR_MESSAGE = 'Quark 分享预览失败，请稍后重试。'

async function createQuarkIngestTask(
  path: string,
  payload: CreateMovieQuarkIngestPayload | CreateSeasonQuarkIngestPayload,
): Promise<QuarkIngestTaskResult> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<QuarkIngestTaskResult>
    >(path, payload)

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'quark ingest task failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || QUARK_INGEST_ERROR_MESSAGE)
  }
}

export function createMovieQuarkIngestTask(
  payload: CreateMovieQuarkIngestPayload,
) {
  return createQuarkIngestTask('/api/v1/quark-ingest/movies/tasks', payload)
}

export function createSeriesQuarkIngestTask(
  payload: CreateSeasonQuarkIngestPayload,
) {
  return createQuarkIngestTask('/api/v1/quark-ingest/series/tasks', payload)
}

export function createVarietyQuarkIngestTask(
  payload: CreateSeasonQuarkIngestPayload,
) {
  return createQuarkIngestTask('/api/v1/quark-ingest/variety/tasks', payload)
}

async function previewQuarkIngest(
  path: string,
  payload: CreateMovieQuarkIngestPayload | CreateSeasonQuarkIngestPayload,
  signal?: AbortSignal,
): Promise<QuarkIngestPreview> {
  try {
    const response = await javaApiClient.post<JavaApiResponse<QuarkIngestPreview>>(
      path,
      payload,
      { signal, timeout: 30_000 },
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'quark ingest preview failed')
    }
    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || QUARK_PREVIEW_ERROR_MESSAGE)
  }
}

export function previewMovieQuarkIngest(
  payload: CreateMovieQuarkIngestPayload,
  signal?: AbortSignal,
) {
  return previewQuarkIngest('/api/v1/quark-ingest/movies/preview', payload, signal)
}

export function previewSeriesQuarkIngest(
  payload: CreateSeasonQuarkIngestPayload,
  signal?: AbortSignal,
) {
  return previewQuarkIngest('/api/v1/quark-ingest/series/preview', payload, signal)
}

export function previewVarietyQuarkIngest(
  payload: CreateSeasonQuarkIngestPayload,
  signal?: AbortSignal,
) {
  return previewQuarkIngest('/api/v1/quark-ingest/variety/preview', payload, signal)
}
