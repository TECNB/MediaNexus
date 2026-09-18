export type MediaLibraryId =
  | 'movies'
  | 'tv'
  | 'variety'
  | 'anime'
  | 'adult-other'
  | 'adult-jav'

export type MediaLibraryItem = {
  item_id: string
  title: string
  year: number | null
  date_created: string | null
  has_primary_image: boolean
  primary_image_tag: string | null
  library_id: string
  library_name: string
  type: string
}

export type MediaMetadataCandidate = {
  candidate_id: string
  name: string
  original_title: string | null
  production_year: number | null
  provider_ids: Record<string, string>
  search_provider_name: string
  overview: string | null
  has_image: boolean
}

export type MediaPosterCandidate = {
  candidate_id: string
  provider_name: string
  width: number | null
  height: number | null
  language: string | null
}

export type MediaIdentifyQuery = {
  library: MediaLibraryId
  query: string
  year?: number
}

export type MediaLibraryPageData = {
  items: MediaLibraryItem[]
  total: number
  page: number
  page_size: number
}

export type MediaLibrarySyncResult = {
  checked_directories: number
  checked_files: number
  removed_directories: number
  removed_items: number
  skipped_items: number
  error_count: number
  elapsed_ms: number
  deep: boolean
}

export type MediaLibraryListParams = {
  library: MediaLibraryId
  page: number
  page_size: 24
  search?: string
  missing_poster?: boolean
}

export type MediaSeason = {
  season_id: string
  name: string
  season_number: number | null
  episode_count: number
  date_created: string | null
}

export type MediaDeletionStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
export type MediaDeletionStage =
  | 'DELETING_CLOUD'
  | 'CLEANING_STRM'
  | 'NOTIFYING_EMBY'
  | 'VERIFYING'
  | 'COMPLETED'

export type MediaDeletionTask = {
  id: string
  library: MediaLibraryId
  item_id: string
  season_id: string | null
  season_number: number | null
  title: string
  target_label: string
  status: MediaDeletionStatus
  stage: MediaDeletionStage
  error_message: string | null
  created_at: string
  updated_at: string
  finished_at: string | null
}
