export type MediaLibraryId = 'movies' | 'tv' | 'anime'

export type MediaLibraryItem = {
  item_id: string
  title: string
  year: number | null
  date_created: string | null
  has_primary_image: boolean
  library_id: string
  library_name: string
  type: string
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
}
