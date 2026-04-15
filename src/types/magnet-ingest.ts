export type CreateMovieMagnetIngestPayload = {
  magnet: string
  title: string
  original_title: string
  year: number
}

export type IngestMode = 'movie' | 'series'

export type MockSeriesSelection = {
  id: string
  title: string
  subtitle: string
  poster: string
}

export type TargetSeasonOption = {
  label: string
  value: number
}

export type CreateMovieMagnetIngestResponse = {
  save_path?: string
}

export type CreateMovieMagnetIngestApiResponse = {
  success: boolean
  message: string
  data: CreateMovieMagnetIngestResponse
}
