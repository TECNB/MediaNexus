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

export type IngestMode = 'movie' | 'series' | 'anime'

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

export type AnimeMagnetIngestTaskStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'DOWNLOADING'
  | 'ORGANIZING'
  | 'SUCCEEDED'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'INTERRUPTED'

export type AnimeMagnetIngestTask = {
  id: string
  created_by_user_id: number | null
  status: AnimeMagnetIngestTaskStatus
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

export type AnimeMagnetIngestTaskLog = {
  id: number
  task_id: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | string
  stage: string
  message: string
  detail: string | null
  created_at: string | null
}

export type AnimeMagnetIngestTaskListData = {
  items: AnimeMagnetIngestTask[]
  total: number
}

export type AnimeMagnetIngestTaskLogListData = {
  items: AnimeMagnetIngestTaskLog[]
  total: number
}

export type CreateMovieMagnetIngestResponse = {
  save_path?: string
}

export type CreateSeriesMagnetIngestResponse = {
  save_path?: string
}

export type CreateMovieMagnetIngestApiResponse = {
  success: boolean
  message: string
  data: CreateMovieMagnetIngestResponse
}

export type CreateSeriesMagnetIngestApiResponse = {
  success: boolean
  message: string
  data: CreateSeriesMagnetIngestResponse
}
