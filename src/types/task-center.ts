import type { MagnetIngestTaskStatus } from '@/types/magnet-ingest'

export type OpenListTaskCenterTaskType = 'MOVIE' | 'SERIES' | 'ANIME' | 'ADULT'

export type OpenListTaskCenterProductType =
  | 'MOVIE'
  | 'SERIES'
  | 'ANIME'
  | 'ADULT'

export type OpenListTaskCenterView =
  | 'ALL'
  | 'IN_PROGRESS'
  | 'NEEDS_ATTENTION'
  | 'SUCCEEDED'

export type OpenListTaskCenterProductFilter =
  | 'ALL'
  | OpenListTaskCenterProductType

export type OpenListTaskCenterSourceType =
  | 'MANUAL_MAGNET'
  | 'PROWLARR_RELEASE'
  | string

export type OpenListTaskCenterSourceFilter =
  | 'ALL'
  | 'MANUAL_MAGNET'
  | 'PROWLARR_RELEASE'

export type OpenListTaskCenterItem = {
  task_type: OpenListTaskCenterTaskType
  id: string
  product_type: OpenListTaskCenterProductType
  created_by_user_id: number | null
  created_by_username: string | null
  title: string
  status: MagnetIngestTaskStatus
  stage: string
  source_type: OpenListTaskCenterSourceType
  release_title: string | null
  progress_summary: string
  detail_path: string
  created_at: string | null
  updated_at: string | null
}

export type OpenListTaskCenterListData = {
  items: OpenListTaskCenterItem[]
  total: number
  page: number
  page_size: number
  all_count: number
  in_progress_count: number
  needs_attention_count: number
  succeeded_count: number
}

export type OpenListTaskCenterListParams = {
  view: OpenListTaskCenterView
  product_type: OpenListTaskCenterProductFilter
  source_type: OpenListTaskCenterSourceFilter
  keyword?: string
  page: number
  page_size: number
}

export type OpenListTaskCenterLog = {
  id: number
  task_id: string
  level: 'INFO' | 'WARN' | 'ERROR' | string
  stage: string
  message: string
  detail: string | null
  created_at: string | null
}

export type OpenListTaskCenterProgress = {
  organized_count: number | null
  skipped_count: number | null
  submitted_count: number | null
  succeeded_count: number | null
  failed_count: number | null
  duplicate_count: number | null
  kept_count: number | null
  deleted_count: number | null
}

export type OpenListTaskCenterDetail = {
  task_type: OpenListTaskCenterTaskType
  id: string
  product_type: OpenListTaskCenterProductType
  created_by_user_id: number | null
  created_by_username: string | null
  title: string
  status: MagnetIngestTaskStatus
  stage: string
  source_type: OpenListTaskCenterSourceType
  release_title: string | null
  release_indexer: string | null
  release_size: number | null
  resolution_tags: string[]
  quality_tag: string | null
  dynamic_range_tags: string[]
  progress_summary: string
  progress: OpenListTaskCenterProgress
  error_message: string | null
  last_warning_or_error_log: OpenListTaskCenterLog | null
  logs: OpenListTaskCenterLog[]
  is_active: boolean
  pending_explanation: string | null
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}
