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

export type IngestMode = 'movie' | 'series'

export type TargetSeasonOption = {
  label: string
  value: number
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
