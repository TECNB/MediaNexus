export type CreateMovieMagnetIngestPayload = {
  magnet: string
  title: string
  original_title: string
  year: number
}

export type CreateSeriesMagnetIngestPayload = {
  magnet: string
  title: string
  original_title: string
  season_number: number
}

export type IngestMode = 'movie' | 'series' | 'anime'

export type AnimeMagnetSearchItem = {
  id: string
  bgm_id: string
  bgm_url: string
  title: string
  name_cn: string | null
  name: string | null
  cover: string | null
  score: number | null
  eps: number | null
  air_date: string | null
  season: number | null
  platform: string | null
}

export type JavaApiResponse<TData> = {
  code: number
  message: string
  data: TData | null
}

export type AnimeMagnetSearchResponseData = {
  items: AnimeMagnetSearchItem[]
  total: number
}

export type CreateMovieMagnetIngestResponse = {
  save_path?: string
}

export type CreateSeriesMagnetIngestResponse = {
  save_path?: string
}

export type CreateMovieMagnetIngestApiResponse = {
  success: boolean
  message: string
  data: CreateMovieMagnetIngestResponse
}

export type CreateSeriesMagnetIngestApiResponse = {
  success: boolean
  message: string
  data: CreateSeriesMagnetIngestResponse
}
