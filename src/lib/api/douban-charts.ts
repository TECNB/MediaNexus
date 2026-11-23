import { doubanChartOperationBody } from '@/lib/douban-chart-ui'
import { javaApiClient } from '@/lib/java-api'
import type { BgmCatalogCandidate, BgmSeason } from '@/types/bgm-wishlist'
import type { DoubanChartBoard, DoubanChartId, DoubanChartIdentityInput, DoubanChartLimitsInput, DoubanChartOperation, DoubanChartOperations, DoubanChartOverview, DoubanChartSettings } from '@/types/douban-charts'

const base = '/api/v1/douban-charts'
type Response<T> = { code: number; message: string; data: T | null }
function unwrap<T>(response: Response<T>): T {
  if (response.code !== 200 || response.data === null) throw new Error(response.message || '榜单请求失败')
  return response.data
}
export async function getDoubanCharts(signal?: AbortSignal) {
  return unwrap((await javaApiClient.get<Response<DoubanChartOverview>>(base, { signal })).data)
}
export async function getDoubanChart(id: DoubanChartId, signal?: AbortSignal) {
  return unwrap((await javaApiClient.get<Response<DoubanChartBoard>>(`${base}/${id}`, { signal })).data)
}
export async function refreshDoubanChart(id: DoubanChartId, signal?: AbortSignal) {
  return unwrap((await javaApiClient.post<Response<DoubanChartBoard>>(`${base}/${id}/refresh`, undefined, { signal })).data)
}
export async function setDoubanChartAutomation(id: DoubanChartId, enabled: boolean, signal?: AbortSignal) {
  return unwrap((await javaApiClient.put<Response<DoubanChartBoard>>(`${base}/${id}/automation`, { enabled }, { signal })).data)
}
export async function saveDoubanChartLimits(input: DoubanChartLimitsInput, signal?: AbortSignal) {
  return unwrap((await javaApiClient.put<Response<DoubanChartSettings>>(`${base}/settings`, input, { signal })).data)
}
export async function setDoubanChartExclusion(id: DoubanChartId, subjectId: number, excluded: boolean, signal?: AbortSignal) {
  return unwrap((await javaApiClient.put<Response<DoubanChartBoard>>(`${base}/${id}/candidates/${subjectId}/exclusion`, { excluded }, { signal })).data)
}
export async function updateDoubanChartIdentity(id: DoubanChartId, subjectId: number, input: DoubanChartIdentityInput, signal?: AbortSignal) {
  return unwrap((await javaApiClient.put<Response<DoubanChartBoard>>(`${base}/${id}/candidates/${subjectId}/identity`, input, { signal })).data)
}
export async function searchDoubanChartCatalog(query: string, mediaType: 'MOVIE' | 'SERIES', signal?: AbortSignal) {
  return unwrap((await javaApiClient.get<Response<BgmCatalogCandidate[]>>(`${base}/catalog/search`, { params: { query, mediaType }, signal })).data)
}
export async function getDoubanChartSeasons(tmdbId: number, signal?: AbortSignal) {
  return unwrap((await javaApiClient.get<Response<BgmSeason[]>>(`${base}/catalog/SERIES/${tmdbId}/seasons`, { signal })).data)
}
export async function submitDoubanChartOperation(id: DoubanChartId, signal?: AbortSignal, candidateLimit = 20) {
  const body = doubanChartOperationBody(id, candidateLimit)
  return unwrap((await javaApiClient.post<Response<DoubanChartOperation>>(`${base}/${id}/operations`, body, { signal })).data)
}
export async function listDoubanChartOperations(id: DoubanChartId, page: number, signal?: AbortSignal) {
  return unwrap((await javaApiClient.get<Response<DoubanChartOperations>>(`${base}/${id}/operations`, { params: { page, pageSize: 10 }, signal })).data)
}
export async function getDoubanChartOperation(id: string, signal?: AbortSignal) {
  return unwrap((await javaApiClient.get<Response<DoubanChartOperation>>(`${base}/operations/${encodeURIComponent(id)}`, { signal })).data)
}
export async function stopDoubanChartOperation(id: string, signal?: AbortSignal) {
  return unwrap((await javaApiClient.post<Response<DoubanChartOperation>>(`${base}/operations/${encodeURIComponent(id)}/stop`, undefined, { signal })).data)
}
