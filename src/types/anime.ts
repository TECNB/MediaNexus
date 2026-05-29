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
