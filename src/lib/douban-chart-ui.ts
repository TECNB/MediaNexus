import type { DoubanChartId } from '@/types/douban-charts'

export function paginateDoubanChartCandidates<T>(items: T[], page: number, pageSize = 20) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const start = (currentPage - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page: currentPage, totalPages, start }
}

export function doubanChartOperationBody(id: DoubanChartId, candidateLimit: number) {
  return id === 'movie_hot_gaia' || id === 'tv_hot' ? { candidateLimit } : undefined
}
