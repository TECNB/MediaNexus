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

export type MovieSearchResponse = {
  success: boolean
  message: string
  data: {
    items: MovieSearchItem[]
  }
}
