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
