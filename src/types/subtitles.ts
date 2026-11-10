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
  targetId?: string | null
}

export type SubtitleLocation = {
  target_id: string
  target_name: string
}

export type SubtitleLocationQuery = Omit<
  SubtitleUploadAssociationPayload,
  'file' | 'overwrite' | 'targetId'
>

export type SubtitleLanguage = 'unknown' | 'chs' | 'cht'

export type SubtitlePreparationPayload = Omit<SubtitleUploadAssociationPayload, 'overwrite'> & {
  language?: SubtitleLanguage
}

export type SubtitlePreparedFile = {
  id: string
  original_path: string
  original_name: string
  extension: string
  language: SubtitleLanguage
  language_source: string
  episode_number: number | null
  video_name: string | null
  final_name: string | null
  size: number
  sha256: string
  status: 'READY' | 'CONFLICT' | 'UNMATCHED' | 'AMBIGUOUS'
  conflict_reason: 'REMOTE_EXISTS' | 'DUPLICATE_CANDIDATE' | null
  warnings: string[]
}

export type SubtitlePreparation = {
  id: string
  expires_at: string
  target_id: string
  target_path: string
  files: SubtitlePreparedFile[]
  skipped_entries: unknown[]
  warnings: string[]
}

export type SubtitleCommitFile = {
  id: string
  language?: SubtitleLanguage
  video_name?: string
}

export type SubtitleFileCheckStatus = 'COMPLETE' | 'PENDING' | 'UNAVAILABLE'

export type SubtitleCheckedFile = {
  name: string
  expected_size: number | null
  actual_size: number | null
  present: boolean
  matches_size: boolean
}

export type SubtitleFileCheckLocation = {
  status: SubtitleFileCheckStatus
  files: SubtitleCheckedFile[]
  message: string | null
}

export type SubtitleUploadCheck = {
  status: SubtitleFileCheckStatus
  source: SubtitleFileCheckLocation
  output: SubtitleFileCheckLocation
}
