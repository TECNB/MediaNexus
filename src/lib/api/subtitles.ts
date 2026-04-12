import axios from 'axios'

import apiClient from '@/lib/axios'
import type {
  SubtitleUploadApiResponse,
  SubtitleUploadAssociationPayload,
  SubtitleUploadResponse,
} from '@/types/subtitles'

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

export async function uploadSubtitleByAssociation({
  file,
  overwrite = false,
  mediaType,
  libraryTitle,
  libraryYear,
}: SubtitleUploadAssociationPayload): Promise<SubtitleUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('overwrite', String(overwrite))
  formData.append('media_type', mediaType)
  formData.append('library_title', libraryTitle)
  formData.append('library_year', String(libraryYear))

  try {
    const response = await apiClient.post<SubtitleUploadApiResponse>(
      '/api/v1/subtitles/upload',
      formData,
    )

    if (!response.data.success) {
      throw new Error(response.data.message || 'subtitle upload failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(getAxiosErrorMessage(error) || '上传失败，请稍后重试')
  }
}
