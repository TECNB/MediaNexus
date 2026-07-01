export type CreateMovieMagnetIngestPayload = {
  magnet: string
  title: string
  original_title: string
  year: number
}

export type CreateSeriesMagnetIngestPayload = {
  magnet: string
  title: string
  original_title: string
  season_number: number
}

export type AdultMagnetCategory = 'JAV' | 'OTHER'

export type CreateAdultMagnetIngestTaskPayload = {
  category: AdultMagnetCategory
  magnets: string[]
}

export type IngestMode = 'movie' | 'series' | 'anime' | 'adult'

export type CreateAnimeMagnetIngestTaskPayload = {
  magnet: string
  bgm_id: string
  bgm_url: string
  title: string
  name_cn: string | null
  name: string | null
  season_number: number
}

export type AnimeMagnetSearchItem = {
  id: string
  bgm_id: string
  bgm_url: string
  title: string
  name_cn: string | null
  name: string | null
  cover: string | null
  score: number | null
  eps: number | null
  air_date: string | null
  season: number | null
  platform: string | null
}

export type JavaApiResponse<TData> = {
  code: number
  message: string
  data: TData | null
}

export type AnimeMagnetSearchResponseData = {
  items: AnimeMagnetSearchItem[]
  total: number
}

export type MagnetIngestTaskStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'DOWNLOADING'
  | 'ORGANIZING'
  | 'SUCCEEDED'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'INTERRUPTED'

export type AnimeMagnetIngestTaskStatus = MagnetIngestTaskStatus

export type AnimeMagnetIngestTask = {
  id: string
  created_by_user_id: number | null
  status: MagnetIngestTaskStatus
  stage: string
  bgm_id: string
  title: string
  season_number: number
  magnet_hash: string
  save_path: string
  temp_path: string
  organized_count: number
  skipped_count: number
  error_message: string | null
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}

export type AdultMagnetIngestTask = {
  id: string
  created_by_user_id: number | null
  category: AdultMagnetCategory
  status: MagnetIngestTaskStatus
  stage: string
  date_folder: string
  target_path: string
  magnet_count: number
  submitted_count: number
  succeeded_count: number
  failed_count: number
  duplicate_count: number
  kept_count: number
  deleted_count: number
  error_message: string | null
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}

export type MovieMagnetIngestTask = {
  id: string
  created_by_user_id: number | null
  status: MagnetIngestTaskStatus
  stage: string
  title: string
  original_title: string | null
  year: number
  source_type: 'MANUAL_MAGNET' | 'PROWLARR_RELEASE' | string
  release_title: string | null
  release_indexer: string | null
  release_size: number | null
  resolution_tags: string[]
  quality_tag: string | null
  dynamic_range_tags: string[]
  magnet_hash: string
  save_path: string
  temp_path: string
  organized_count: number
  skipped_count: number
  error_message: string | null
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}

export type SeriesMagnetIngestTask = {
  id: string
  created_by_user_id: number | null
  status: MagnetIngestTaskStatus
  stage: string
  title: string
  original_title: string | null
  season_number: number
  task_product_type?: 'SERIES' | 'ANIME'
  source_type: 'MANUAL_MAGNET' | 'PROWLARR_RELEASE' | string
  release_title: string | null
  release_indexer: string | null
  release_size: number | null
  resolution_tags: string[]
  quality_tag: string | null
  dynamic_range_tags: string[]
  series_name: string
  season_folder: string
  magnet_hash: string
  save_path: string
  temp_path: string
  organized_count: number
  skipped_count: number
  error_message: string | null
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}

export type MagnetIngestTaskLog = {
  id: number
  task_id: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | string
  stage: string
  message: string
  detail: string | null
  created_at: string | null
}

export type AnimeMagnetIngestTaskLog = MagnetIngestTaskLog

export type AdultMagnetIngestTaskLog = MagnetIngestTaskLog

export type AnimeMagnetIngestTaskListData = {
  items: AnimeMagnetIngestTask[]
  total: number
}

export type AnimeMagnetIngestTaskLogListData = {
  items: MagnetIngestTaskLog[]
  total: number
}

export type MovieMagnetIngestTaskListData = {
  items: MovieMagnetIngestTask[]
  total: number
}

export type MovieMagnetIngestTaskLogListData = {
  items: MagnetIngestTaskLog[]
  total: number
}

export type SeriesMagnetIngestTaskListData = {
  items: SeriesMagnetIngestTask[]
  total: number
}

export type SeriesMagnetIngestTaskLogListData = {
  items: MagnetIngestTaskLog[]
  total: number
}

export type AdultMagnetIngestTaskListData = {
  items: AdultMagnetIngestTask[]
  total: number
}

export type AdultMagnetIngestTaskLogListData = {
  items: MagnetIngestTaskLog[]
  total: number
}

export type CreateMovieMagnetIngestResponse = MovieMagnetIngestTask

export type CreateSeriesMagnetIngestResponse = SeriesMagnetIngestTask

export type CreateAdultMagnetIngestTaskResponse = AdultMagnetIngestTask
