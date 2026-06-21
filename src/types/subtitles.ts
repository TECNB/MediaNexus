export type SubtitleUploadStatus = 'idle' | 'submitting' | 'success' | 'error'

export type SubtitleUploadTaskStatus =
  | 'PROCESSING'
  | 'WAITING_FOR_AS'
  | 'FAILED'
  | string

export type SubtitleUploadedFile = {
  original_path: string
  original_name: string
  final_name: string
  size: number
  sha256: string
}

export type SubtitleUploadResponse = {
  id: string
  created_by_user_id: number | null
  media_type: 'MOVIE' | 'SERIES' | string
  status: SubtitleUploadTaskStatus
  stage: string
  title: string
  original_title: string | null
  year: number | null
  season_number: number | null
  target_path: string
  selected_video_name: string | null
  source_file_name: string
  source_size: number | null
  source_sha256: string | null
  file_count: number
  overwrite_enabled: boolean
  files: SubtitleUploadedFile[]
  error_message: string | null
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}

export type SubtitleUploadLog = {
  id: number
  upload_id: string
  level: 'INFO' | 'WARN' | 'ERROR' | string
  stage: string
  message: string
  detail: string | null
  created_at: string | null
}

export type SubtitleUploadListData = {
  items: SubtitleUploadResponse[]
  total: number
}

export type SubtitleUploadLogListData = {
  items: SubtitleUploadLog[]
  total: number
}

export type SubtitleUploadAssociationPayload = {
  file: File
  overwrite?: boolean
  mediaType: 'movie' | 'series'
  title: string
  originalTitle?: string | null
  year?: number | null
  seasonNumber?: number | null
}
