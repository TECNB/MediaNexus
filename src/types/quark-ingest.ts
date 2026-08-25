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

export type QuarkSourceSelection = {
  source_candidate_id: string
  season_number: number | null
  ignored: boolean
  follow_updates: boolean
}

export type QuarkMultiSourcePayload = {
  share_url: string
  title: string
  original_title: string | null
  tmdb_id: number | null
  preview_id?: string | null
  follow_updates_enabled: boolean
  sources: QuarkSourceSelection[]
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

export type QuarkRenamePreview = {
  source_name: string
  target_name: string
  episode_number: number | null
  status: 'READY' | 'UNCHANGED' | 'EXCLUDED' | 'UNRECOGNIZED' | 'CONFLICT' | string
  message: string | null
}

export type QuarkSourceTreeNode = {
  name: string
  directory: boolean
  size: number
  source_candidate_id: string | null
  source_kind: 'LEAF_DIRECTORY' | 'DIRECT_FILES' | string | null
  relative_path: string
  detected_season: number | null
  season_status: 'AUTO' | 'UNRECOGNIZED' | 'MIXED' | string | null
  children: QuarkSourceTreeNode[]
}

export type QuarkSourcePlan = {
  source_candidate_id: string
  source_name: string
  relative_path: string
  source_kind: string
  detected_season: number | null
  season_status: string
  selected_season: number | null
  ignored: boolean
  follow_updates: boolean
  save_path: string | null
  task_name: string | null
  status: string
  files: QuarkRenamePreview[]
  errors: string[]
  warnings: string[]
}

export type QuarkMultiSourcePreview = {
  ready: boolean
  preview_id: string
  media_type: 'SERIES' | 'VARIETY'
  save_root: string
  root_source_candidate_id: string | null
  entries: QuarkSourceTreeNode[]
  sources: QuarkSourcePlan[]
  warnings: string[]
  message: string
}

export type QuarkSourceTaskResult = {
  source_candidate_id: string
  task_name: string
  status: string
  message: string
}

export type QuarkMultiSourceTaskResult = {
  id: string
  status: 'STARTED' | 'SCHEDULED' | 'PARTIAL' | 'FAILED' | string
  media_type: 'SERIES' | 'VARIETY'
  save_root: string
  immediate_execution_started: boolean
  planned_task_count: number
  created_task_count: number
  sources: QuarkSourceTaskResult[]
  warnings: string[]
  message: string
}
