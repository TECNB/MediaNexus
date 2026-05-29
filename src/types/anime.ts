export type AnimeSearchItem = {
  id: string
  title: string
  cover: string | null
  source_url: string | null
  score: number | null
  exists: boolean
  week_label: string | null
}

export type JavaApiResponse<TData> = {
  code: number
  message: string
  data: TData | null
}

export type AnimeSearchResponseData = {
  items: AnimeSearchItem[]
  total: number
}

export type AnimeSubtitleGroup = {
  id: string
  label: string
  rss: string
  bgm_url: string
  language: string
  item_count: number
  update_day: string | null
}

export type AnimeSubtitleGroupsData = {
  groups: AnimeSubtitleGroup[]
  total: number
}

export type AnimeSubscriptionPayload = {
  rss: string
  bgm_url: string
  subgroup: string
}

export type AnimeSubscriptionPreview = {
  title: string
  season: number | null
  subgroup: string
  preview_count: number
  missing_episodes: number[]
  missing_summary: string | null
  has_missing_episodes: boolean
}

export type AnimeSubscriptionResult = {
  status: 'added' | 'exists'
  added: boolean
  duplicate: boolean
  message: string
  preview: AnimeSubscriptionPreview
}
