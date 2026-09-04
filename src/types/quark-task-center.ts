export type QuarkTaskCenterView =
  | 'ALL'
  | 'IN_PROGRESS'
  | 'NEEDS_ATTENTION'
  | 'SUCCEEDED'

export type QuarkTaskCenterProductType = 'MOVIE' | 'SERIES' | 'VARIETY'
export type QuarkTaskCenterSourceType =
  | 'MANUAL_QUARK'
  | 'PANSOU_SEARCH'
  | string

export type QuarkTaskCenterStatus =
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'PARTIAL_SUCCESS'
  | 'UNKNOWN'
  | 'INTERRUPTED'
  | string

export type QuarkTaskCenterSubscriptionFilter =
  | 'ALL'
  | 'SUBSCRIBED'
  | 'ONE_TIME'

export type QuarkTaskCenterItem = {
  task_type: 'QUARK'
  id: string
  product_type: QuarkTaskCenterProductType
  created_by_user_id: number | null
  created_by_username: string | null
  title: string
  status: QuarkTaskCenterStatus
  stage: string
  source_type: QuarkTaskCenterSourceType
  progress_summary: string
  attempt_count: number
  planned_unit_count: number
  completed_unit_count: number
  total_file_count: number
  processed_file_count: number
  failed_file_count: number
  subscription_enabled: boolean
  detail_path: string
  created_at: string | null
  updated_at: string | null
}

export type QuarkTaskCenterListData = {
  items: QuarkTaskCenterItem[]
  total: number
  page: number
  page_size: number
  all_count: number
  in_progress_count: number
  needs_attention_count: number
  succeeded_count: number
  subscribed_count: number
}

export type QuarkTaskCenterListParams = {
  view: QuarkTaskCenterView
  product_type: 'ALL' | QuarkTaskCenterProductType
  source_type: 'ALL' | 'MANUAL_QUARK' | 'PANSOU_SEARCH'
  subscription: QuarkTaskCenterSubscriptionFilter
  keyword?: string
  page: number
  page_size: number
}

export type QuarkTaskCenterFile = {
  id: number
  source_name: string | null
  target_name: string | null
  status: string
  failure_reason: string | null
  created_at: string | null
  updated_at: string | null
}

export type QuarkTaskCenterChild = {
  id: string
  task_name: string
  source_url: string
  save_path: string
  version_label: string | null
  status: QuarkTaskCenterStatus
  failure_reason: string | null
  retry_count: number
  subscription_enabled: boolean
  planned_file_count: number
  processed_file_count: number
  renamed_file_count: number
  ignored_file_count: number
  failed_file_count: number
  unknown_file_count: number
  files: QuarkTaskCenterFile[]
  created_at: string | null
  updated_at: string | null
}

export type QuarkTaskCenterAttempt = {
  id: string
  attempt_no: number
  trigger_type: string
  status: string
  message: string | null
  started_at: string | null
  ended_at: string | null
  created_by_user_id: number | null
}

export type QuarkTaskCenterLog = {
  id: number
  task_id: string
  level: string
  stage: string
  message: string
  detail: string | null
  created_at: string | null
}

export type QuarkTaskCenterProgress = {
  planned_units: number
  completed_units: number
  total_files: number
  processed_files: number
  renamed_files: number
  ignored_files: number
  failed_files: number
  unknown_files: number
}

export type QuarkTaskCenterDetail = {
  task_type: 'QUARK'
  id: string
  product_type: QuarkTaskCenterProductType
  created_by_user_id: number | null
  created_by_username: string | null
  title: string
  status: QuarkTaskCenterStatus
  stage: string
  source_type: QuarkTaskCenterSourceType
  share_urls: string[]
  progress_summary: string
  progress: QuarkTaskCenterProgress
  error_message: string | null
  children: QuarkTaskCenterChild[]
  attempts: QuarkTaskCenterAttempt[]
  logs: QuarkTaskCenterLog[]
  logs_has_older: boolean
  logs_has_newer: boolean
  is_active: boolean
  subscription_enabled: boolean
  finished_at: string | null
  created_at: string | null
  updated_at: string | null
}

export type QuarkTaskCenterLogsData = {
  logs: QuarkTaskCenterLog[]
  has_older: boolean
  has_newer: boolean
  min_log_id: number | null
  max_log_id: number | null
}

export type QuarkTaskCenterAction = {
  id: string
  status: string
  message: string
  detail_path: string
}
