export type EmbyWatchRankingPeriod = 'day' | 'month'
export type WatchCategory = 'movie' | 'series' | 'adult' | 'unknown'
export type WatchSort = 'duration' | 'viewers' | 'plays'

export type EmbyWatchRankingSummary = {
  active_user_count: number
  total_watch_seconds: number
  total_play_count: number
  total_work_count: number
  last_watched_at: string | null
  calendar_session_count: number
  legacy_session_count: number
}
export type EmbyUserWatchRankingItem = {
  rank: number
  emby_user_id: string
  user_name: string
  watch_seconds: number
  play_count: number
  work_count: number
  last_watched_at: string | null
  last_item_name: string | null
  last_item_id: string | null
  last_media_id: string | null
  last_category: WatchCategory
  last_season_number: number | null
  last_episode_number: number | null
}
export type EmbyMediaWatchRankingItem = {
  rank: number
  media_id: string
  title: string
  category: WatchCategory
  content_label: string | null
  poster_item_id: string | null
  watch_seconds: number
  play_count: number
  viewer_count: number
  last_played_at: string | null
  season_number: number | null
  episode_number: number | null
}
export type WatchSession = {
  id: string
  media_id: string
  item_id: string
  title: string
  category: WatchCategory
  season_number: number | null
  episode_number: number | null
  start_time: string
  stop_time: string | null
  stop_time_source: 'event' | 'superseded' | 'unknown' | null
  watch_seconds: number
  range_watch_seconds: number
  accounting_basis: 'calendar' | 'legacy'
  device_name: string | null
  client_name: string | null
  emby_user_id: string
  user_name: string
  state: 'settled' | 'playing' | 'paused' | 'unverified'
  observed_at: string | null
}
export type WatchViewer = { emby_user_id: string; user_name: string; watch_seconds: number; play_count: number }
export type WatchPage<T> = { items: T[]; page: number; page_size: number; total: number }
export type PrivateWatchTitle = { item_id: string; media_id: string; title: string }
export type EmbyWebhookRecentEvent = {
  event: string
  item_id: string
  media_id: string
  category: WatchCategory
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
export type WatchPageParams = EmbyWatchRankingParams & { page: number; page_size: number }
