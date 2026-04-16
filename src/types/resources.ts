export type MovieSearchItem = {
  id: string
  title: string
  original_title: string | null
  year: number | null
  overview: string | null
  poster: string | null
  tmdb_id: number | null
  imdb_id: string | null
  status: string | null
}

export type SeriesSearchItem = {
  id: string
  title: string
  original_title: string | null
  year: number | null
  overview: string
  poster: string | null
  tvdb_id: number | null
  imdb_id: string | null
  tmdb_id: number | null
  status: string
  network: string | null
  series_type: string | null
}

export type SearchableResourceItem = MovieSearchItem | SeriesSearchItem

export type ResourceSearchResponse<TItem> = {
  success: boolean
  message: string
  data: {
    items: TItem[]
  }
}

export type MovieSearchResponse = ResourceSearchResponse<MovieSearchItem>

export type SeriesSearchResponse = ResourceSearchResponse<SeriesSearchItem>

export type MovieQualityProfile = {
  id: number
  name: string
  is_default: boolean
}

export type MovieQualityProfilesResponse = {
  success: boolean
  message: string
  data: {
    items: MovieQualityProfile[]
  }
}

export type AddMovieResourceRequest = {
  tmdb_id: number
  title: string
  year: number | null
  qualityProfileId: number
}

export type AddMovieResourceResponse = {
  success: boolean
  message: string
  data: {
    status: 'search_started' | string
    action: 'added_then_searched' | 'updated_existing_then_searched' | string
    movie: {
      id: number
      tmdb_id: number
      title: string
      year: number | null
      qualityProfileId: number
    }
  } | null
}

export type SeriesSeasonsData = {
  tvdb_id: number
  title: string
  season_count: number
  season_numbers: number[]
}

export type SeriesSeasonsResponse = {
  success: boolean
  message: string
  data: SeriesSeasonsData
}
