import { getJavaErrorMessage, javaApiClient } from '@/lib/java-api'
import type {
  SubtitleUploadAssociationPayload,
  SubtitleUploadListData,
  SubtitleUploadLog,
  SubtitleUploadLogListData,
  SubtitleUploadResponse,
} from '@/types/subtitles'

type JavaApiResponse<TData> = {
  code: number
  message: string
  data: TData | null
}

const SUBTITLE_UPLOAD_ERROR_MESSAGE = '字幕上传失败，请稍后重试。'
const SUBTITLE_UPLOAD_TIMEOUT_MS = 180_000

export async function uploadSubtitleByAssociation({
  file,
  overwrite = false,
  mediaType,
  title,
  originalTitle,
  year,
  seasonNumber,
}: SubtitleUploadAssociationPayload): Promise<SubtitleUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('overwrite', String(overwrite))
  formData.append('media_type', mediaType)
  formData.append('title', title)

  if (originalTitle?.trim()) {
    formData.append('original_title', originalTitle.trim())
  }
  if (typeof year === 'number') {
    formData.append('year', String(year))
  }
  if (typeof seasonNumber === 'number') {
    formData.append('season_number', String(seasonNumber))
  }

  try {
    const response = await javaApiClient.post<
      JavaApiResponse<SubtitleUploadResponse>
    >('/api/v1/subtitles/uploads', formData, {
      timeout: SUBTITLE_UPLOAD_TIMEOUT_MS,
    })

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'subtitle upload failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || SUBTITLE_UPLOAD_ERROR_MESSAGE)
  }
}

export async function listSubtitleUploads(): Promise<SubtitleUploadResponse[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<SubtitleUploadListData>
    >('/api/v1/subtitles/uploads')

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'subtitle upload list failed')
    }

    return response.data.data.items
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || '字幕上传记录加载失败。')
  }
}

export async function getSubtitleUpload(
  uploadId: string,
): Promise<SubtitleUploadResponse> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<SubtitleUploadResponse>
    >(`/api/v1/subtitles/uploads/${encodeURIComponent(uploadId)}`)

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'subtitle upload fetch failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || '字幕上传状态加载失败。')
  }
}

export async function listSubtitleUploadLogs(
  uploadId: string,
): Promise<SubtitleUploadLog[]> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<SubtitleUploadLogListData>
    >(`/api/v1/subtitles/uploads/${encodeURIComponent(uploadId)}/logs`)

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || 'subtitle upload logs failed')
    }

    return response.data.data.items
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) || '字幕上传日志加载失败。')
  }
}
