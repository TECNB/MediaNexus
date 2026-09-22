export type TelegramChannelConfig = {
  id: string
  source_id: number
  source_title: string | null
  source_username: string | null
  forwards_restricted: boolean
  enabled: boolean
  percentile: number
  resource_mode: 'group' | 'hashtag_resource'
  min_video_duration: number
  min_views: number
  min_forwards: number
  min_age_hours: number
  run_weekdays: number[]
  run_month_days: number[]
}

export type TelegramAutomationConfig = {
  enabled: boolean
  target: string
  schedule_time: string
  timezone: string
  channels: TelegramChannelConfig[]
}

export type TelegramChannelInput = {
  id?: string
  source_ref: string
  enabled: boolean
  percentile: number
  resource_mode: 'group' | 'hashtag_resource'
  min_video_duration: number
  min_views: number
  min_forwards: number
  min_age_hours: number
  run_weekdays: number[]
  run_month_days: number[]
}

export type TelegramConfigUpdatePayload = {
  enabled: boolean
  target: string
  channels: TelegramChannelInput[]
}

export type TelegramResolvedSource = {
  source_id: number
  title: string | null
  username: string | null
  forwards_restricted: boolean
}

export type TelegramResourceResult = {
  resourceId: string
  rank: number
  status: string
  caption: string
  hashtags: string[]
  publishedAt: string | null
  sourceMessageCount: number
  videoCount: number
  longVideoCount: number
  maxVideoDurationSeconds: number | null
  views: number | null
  forwards: number | null
  forwardRate: number | null
  threshold: number | null
  sentMessageCount?: number
  forwardedGroupCount?: number
  duplicateGroupCount?: number
}

export type TelegramWorkerResponse = {
  scanned?: number
  scannedResourceCount?: number
  eligibleResourceCount?: number
  selectedResourceCount?: number
  duplicateResourceCount?: number
  forwardedResourceCount?: number
  forwardedGroupCount?: number
  forwardedMessageCount?: number
  baselineSampleSize?: number
  threshold?: number | null
  selectedResources?: TelegramResourceResult[]
  appliedRules?: Record<string, unknown>
  telegramDataAsOf?: string
}

export type TelegramChannelRun = {
  channel_id: string
  source_id: number
  source_title: string | null
  status: string
  attempt_count: number
  selected_resource_count: number
  duplicate_resource_count: number
  forwarded_resource_count: number
  forwarded_message_count: number
  threshold: number | null
  worker_response: TelegramWorkerResponse | null
  error_message: string | null
}

export type TelegramRunProgress = {
  phase: string
  channel_title: string | null
  scanned_messages: number
  baseline_scanned_messages: number
  discovered_resource_count: number
  eligible_resource_count: number
  selected_resource_count: number
  processed_resource_count: number
  forwarded_resource_count: number
  forwarded_message_count: number
}

export type TelegramAutomationRun = {
  id: string
  trigger_type: 'SCHEDULED' | 'MANUAL' | string
  triggered_by_user_id: number | null
  execution_mode: 'FOLLOW' | 'FOLLOW_DRY_RUN' | 'BACKFILL' | 'BACKFILL_DRY_RUN' | string
  status: string
  stage: string
  channel_count: number
  succeeded_channel_count: number
  failed_channel_count: number
  selected_resource_count: number
  duplicate_resource_count: number
  forwarded_resource_count: number
  forwarded_message_count: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  channels: TelegramChannelRun[]
  progress: TelegramRunProgress | null
}

export type TelegramAutomationOverview = {
  config: TelegramAutomationConfig
  worker_available: boolean
  worker_authorized: boolean
  worker_version: string | null
  latest_run: TelegramAutomationRun | null
  current_run: TelegramAutomationRun | null
}

export type TelegramAutomationRunList = {
  items: TelegramAutomationRun[]
  total: number
  page: number
  page_size: number
}

export type TelegramBackfillPayload = {
  top_resources: number
  lookback_days: number
  max_messages: number
  start_mode: 'continue' | 'latest'
  force_resend?: boolean
}
