export type EmbyWatchRankingPeriod = 'day' | 'month'

export type EmbyWatchRankingSummary = {
  active_user_count: number
  total_watch_seconds: number
  total_play_count: number
  last_watched_at: string | null
}

export type EmbyUserWatchRankingItem = {
  rank: number
  emby_user_id: string
  user_name: string
  watch_seconds: number
  play_count: number
  last_watched_at: string | null
  last_item_name: string | null
}

export type EmbyMediaWatchRankingItem = {
  rank: number
  media_id: string
  title: string
  watch_seconds: number
  play_count: number
  last_played_at: string | null
}

export type EmbyWebhookRecentEvent = {
  event: 'playback.start' | 'playback.stop' | string
  event_time: string | null
  user_name: string
  item_name: string
  watch_seconds: number | null
}

export type EmbyWebhookStatus = {
  secret_configured: boolean
  active_session_count: number
  recent_events: EmbyWebhookRecentEvent[]
}

export type EmbyWatchRankingData = {
  period: EmbyWatchRankingPeriod
  date: string
  month: string
  timezone: string
  generated_at: string
  summary: EmbyWatchRankingSummary
  users: EmbyUserWatchRankingItem[]
  movies: EmbyMediaWatchRankingItem[]
  series: EmbyMediaWatchRankingItem[]
  webhook_status: EmbyWebhookStatus
}

export type EmbyWatchRankingParams = {
  period?: EmbyWatchRankingPeriod
  date?: string
  month?: string
  limit?: number
}
