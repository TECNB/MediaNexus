export type SubtitleUploadStatus = 'idle' | 'submitting' | 'success' | 'error'

export type SubtitleUploadResponse = {
  target_path: string
  saved_files: string[]
  skipped_files: string[]
}

export type SubtitleUploadApiResponse = {
  success: boolean
  message: string
  data: SubtitleUploadResponse
}

export type SubtitleUploadAssociationPayload = {
  file: File
  overwrite?: boolean
  mediaType: 'movie' | 'series'
  libraryTitle: string
  libraryYear: number
}
