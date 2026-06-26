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

export type OpenListQualityTag = '2160p' | '1080p' | '720p'

export type ResourcePublishMediaType = 'movie' | 'series'

export type ResourcePublishPageState = {
  mediaType: ResourcePublishMediaType
  item: SearchableResourceItem
  submittedTerm: string
  qualityTag: OpenListQualityTag
  seasonNumber: number | null
  seasonOptions: number[]
}

export type CreateMovieOpenListIngestPayload = {
  term: string
  title: string
  original_title: string | null
  year: number
  quality: OpenListQualityTag
}

export type CreateSeriesOpenListIngestPayload = {
  term: string
  title: string
  original_title: string | null
  season_number: number
  quality: OpenListQualityTag
}

export type ProwlarrRelease = {
  title: string
  size: number | null
  seeders: number | null
  leechers: number | null
  grabs: number | null
  indexer: string | null
  publish_date: string | null
  indexer_id: number
  download_ref: string
  resolution_tags: OpenListQualityTag[]
  dynamic_range_tags: string[]
  match_source: string | null
  match_query: string | null
}

export type ProwlarrReleaseSearchData = {
  query: string
  items: ProwlarrRelease[]
}

export type MovieReleaseRecommendationPayload = {
  tmdb_id: number | null
  imdb_id: string | null
  title: string
  original_title: string | null
  year: number
  quality: OpenListQualityTag
}

export type MovieReleaseSearchPayload = {
  tmdb_id: number | null
  imdb_id: string | null
  title: string
  original_title: string | null
  year: number
  quality: OpenListQualityTag
}

export type SeriesReleaseRecommendationPayload = {
  tvdb_id: number | null
  tmdb_id: number | null
  imdb_id: string | null
  title: string
  original_title: string | null
  season_number: number
  quality: OpenListQualityTag
}

export type SeriesReleaseSearchPayload = {
  tvdb_id: number | null
  tmdb_id: number | null
  imdb_id: string | null
  title: string
  original_title: string | null
  season_number: number
  quality: OpenListQualityTag
}

export type ProwlarrReleaseRecommendationData = {
  query: string
  item: ProwlarrRelease
  items: ProwlarrRelease[]
}

export type SearchProwlarrReleasesParams = {
  term: string
  media_type: ResourcePublishMediaType
  season_number?: number
}

type SelectedReleasePayload = {
  title: string
  original_title: string | null
  release_title: string
  indexer: string | null
  size: number | null
  indexer_id: number
  download_ref: string
  resolution_tags: OpenListQualityTag[]
  dynamic_range_tags: string[]
}

export type CreateMovieReleaseOpenListIngestPayload =
  SelectedReleasePayload & {
    year: number
  }

export type CreateSeriesReleaseOpenListIngestPayload =
  SelectedReleasePayload & {
    season_number: number
  }
