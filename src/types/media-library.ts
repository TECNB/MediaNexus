export type MediaLibraryId =
  | 'movies'
  | 'tv'
  | 'anime'
  | 'adult-other'
  | 'adult-jav'

export type MediaLibraryItem = {
  item_id: string
  title: string
  year: number | null
  date_created: string | null
  has_primary_image: boolean
  primary_image_tag: string | null
  library_id: string
  library_name: string
  type: string
}

export type MediaMetadataCandidate = {
  candidate_id: string
  name: string
  original_title: string | null
  production_year: number | null
  provider_ids: Record<string, string>
  search_provider_name: string
  overview: string | null
  has_image: boolean
}

export type MediaPosterCandidate = {
  candidate_id: string
  provider_name: string
  width: number | null
  height: number | null
  language: string | null
}

export type MediaIdentifyQuery = {
  library: MediaLibraryId
  query: string
  year?: number
}

export type MediaLibraryPageData = {
  items: MediaLibraryItem[]
  total: number
  page: number
  page_size: number
}

export type MediaLibraryListParams = {
  library: MediaLibraryId
  page: number
  page_size: 24
  search?: string
  missing_poster?: boolean
}
