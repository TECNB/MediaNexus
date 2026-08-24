export type QuarkIngestMediaType = 'movie' | 'series' | 'variety'

export type CreateMovieQuarkIngestPayload = {
  share_url: string
  title: string
  original_title: string | null
  year: number
}

export type CreateSeasonQuarkIngestPayload = {
  share_url: string
  title: string
  original_title: string | null
  season_number: number
  tmdb_id: number | null
}

export type QuarkIngestTaskResult = {
  id: string
  status: 'PLANNED' | 'STARTED' | 'SCHEDULED' | 'PARTIAL' | 'FAILED'
  media_type: 'MOVIE' | 'SERIES' | 'VARIETY'
  task_name: string
  save_path: string
  immediate_execution_started: boolean
  created_task_count: number
  planned_task_count: number
  warnings: string[]
  message: string
}

export type QuarkIngestTaskList = {
  items: QuarkIngestTaskResult[]
  total: number
}

export type QuarkIngestTaskLog = {
  id: number
  task_id: string
  level: string
  stage: string
  message: string
  detail: string | null
  created_at: string | null
}

export type QuarkIngestTaskLogList = {
  items: QuarkIngestTaskLog[]
  total: number
}

export type QuarkSharePreviewNode = {
  name: string
  directory: boolean
  size: number
  children: QuarkSharePreviewNode[]
}

export type QuarkIngestPreviewTask = {
  task_name: string
  version_label: string | null
  rename_enabled: boolean
}

export type QuarkIngestPreview = {
  ready: boolean
  media_type: 'MOVIE' | 'SERIES' | 'VARIETY'
  save_path: string
  planned_task_count: number
  video_count: number
  subtitle_count: number
  directory_count: number
  max_depth: number
  entries: QuarkSharePreviewNode[]
  tasks: QuarkIngestPreviewTask[]
  warnings: string[]
  message: string
}
