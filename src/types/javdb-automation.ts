import type { OperationalLogEntry } from '@/components/operation-log/operational-log-panel'

export type JavaApiResponse<TData> = {
  code: number
  message: string
  data: TData | null
}

export type JavdbAutomationConfig = {
  enabled: boolean
  daily_enabled: boolean
  weekly_enabled: boolean
  monthly_enabled: boolean
  cracked_only: boolean
  subtitle_only: boolean
  limit_per_ranking: number
  schedule_time: string
  timezone: string
  credential_configured: boolean
  credential_valid: boolean
  last_validated_at: string | null
}

export type JavdbCredentialStatus = {
  credential_configured: boolean
  credential_valid: boolean
  last_validated_at: string | null
}

export type JavdbRankingAppearance = {
  period: 'daily' | 'weekly' | 'monthly' | string
  rank: number
  has_magnet_badge: boolean
}

export type JavdbMagnetCandidate = {
  magnet: string
  original_name: string | null
  infohash: string | null
  has_subtitle: boolean
  is_cracked: boolean
  labels: string[]
  detection_source: string | null
}

export type JavdbAutomationRunItem = {
  code: string
  title: string | null
  detail_url: string | null
  appearances: JavdbRankingAppearance[]
  status: string
  reason: string | null
  candidates: JavdbMagnetCandidate[]
  selected_infohash: string | null
  selected_magnet: string | null
  selected_reason: string | null
  adult_task_id: string | null
  error_message: string | null
}

export type JavdbAutomationRunLog = OperationalLogEntry & {
  run_id: string
}

export type JavdbAutomationRun = {
  id: string
  trigger_type: 'SCHEDULED' | 'MANUAL' | string
  triggered_by_user_id: number | null
  execution_mode: 'DRY_RUN' | 'EXECUTE' | string
  status:
    | 'RUNNING'
    | 'SUCCEEDED'
    | 'PARTIAL_SUCCESS'
    | 'FAILED'
    | 'INTERRUPTED'
    | 'SKIPPED'
    | string
  stage: string
  ranking_entries: number
  unique_movies: number
  duplicate_entries_removed: number
  already_in_emby: number
  history_duplicates: number
  active_duplicates: number
  remaining_movies: number
  submitted_count: number
  adult_task_count: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  items: JavdbAutomationRunItem[]
  logs: JavdbAutomationRunLog[]
}

export type JavdbAutomationOverview = {
  config: JavdbAutomationConfig
  latest_run: JavdbAutomationRun | null
  current_run: JavdbAutomationRun | null
}

export type JavdbAutomationRunList = {
  items: JavdbAutomationRun[]
  total: number
  page: number
  page_size: number
}

export type UpdateJavdbAutomationConfigPayload = {
  enabled: boolean
  daily_enabled: boolean
  weekly_enabled: boolean
  monthly_enabled: boolean
  cracked_only: boolean
  subtitle_only: boolean
  limit_per_ranking: number
  schedule_time: string
}
