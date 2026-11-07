import { javaApiClient } from '@/lib/java-api'
import type { BgmCatalogCandidate, BgmItem, BgmPreview, BgmRun, BgmRuns, BgmSeason, BgmSource, BgmSourceInput, BgmWishlist } from '@/types/bgm-wishlist'

const base = '/api/v1/admin/bgm-wishlist'
type Response<T> = { code: number; message: string; data: T | null }
function unwrap<T>(response: Response<T>): T {
  if (response.code !== 200 || response.data === null) throw new Error(response.message || '请求失败')
  return response.data
}
export async function listBgmSources(signal?: AbortSignal) { return unwrap((await javaApiClient.get<Response<BgmSource[]>>(`${base}/sources`, { signal })).data) }
export async function saveBgmSource(input: BgmSourceInput, id?: string) {
  const response = id ? await javaApiClient.put<Response<BgmSource>>(`${base}/sources/${encodeURIComponent(id)}`, input) : await javaApiClient.post<Response<BgmSource>>(`${base}/sources`, input)
  return unwrap(response.data)
}
export async function getBgmWishlist(id: string, signal?: AbortSignal) { return unwrap((await javaApiClient.get<Response<BgmWishlist>>(`${base}/sources/${encodeURIComponent(id)}/items`, { signal })).data) }
export async function refreshBgmWishlist(id: string) { return unwrap((await javaApiClient.post<Response<BgmWishlist>>(`${base}/sources/${encodeURIComponent(id)}/refresh`)).data) }
export async function searchBgmCatalog(query: string, signal?: AbortSignal) { return unwrap((await javaApiClient.get<Response<BgmCatalogCandidate[]>>(`${base}/catalog/search`, { params: { query }, signal })).data) }
export async function getBgmSeasons(tmdbId: number, signal?: AbortSignal) { return unwrap((await javaApiClient.get<Response<BgmSeason[]>>(`${base}/catalog/SERIES/${tmdbId}/seasons`, { signal })).data) }
export async function updateBgmIdentity(id: string, subjectId: number, input: { mediaType: 'MOVIE' | 'SERIES'; tmdbId: number; seasonNumber: number | null }) { return unwrap((await javaApiClient.put<Response<BgmItem>>(`${base}/sources/${encodeURIComponent(id)}/items/${subjectId}/identity`, input)).data) }
export async function previewBgmItems(id: string, subjectIds: number[]) { return unwrap((await javaApiClient.post<Response<BgmPreview>>(`${base}/sources/${encodeURIComponent(id)}/preview`, { subjectIds })).data) }
export async function previewBgmLatest(id: string) { return unwrap((await javaApiClient.post<Response<BgmPreview>>(`${base}/sources/${encodeURIComponent(id)}/preview-latest`)).data) }
export async function executeBgmPreview(id: string, previewId: string) { return unwrap((await javaApiClient.post<Response<BgmRun>>(`${base}/sources/${encodeURIComponent(id)}/execute`, { previewId })).data) }
export async function listBgmRuns(id: string, page: number, signal?: AbortSignal) { return unwrap((await javaApiClient.get<Response<BgmRuns>>(`${base}/runs`, { params: { sourceId: id, page, pageSize: 20 }, signal })).data) }

export async function submitBgmOperation(id: string, subjectIds?: number[]) {
  const path = `${base}/sources/${encodeURIComponent(id)}/operations${subjectIds ? '' : '/latest'}`
  return unwrap((await javaApiClient.post<Response<import('@/types/bgm-wishlist').BgmOperation>>(path, subjectIds ? { subjectIds } : undefined)).data)
}
export async function listBgmOperations(id: string, page: number, signal?: AbortSignal) {
  return unwrap((await javaApiClient.get<Response<import('@/types/bgm-wishlist').BgmOperations>>(`${base}/sources/${encodeURIComponent(id)}/operations`, { params: { page, pageSize: 20 }, signal })).data)
}
export async function getBgmOperation(id: string, signal?: AbortSignal) {
  return unwrap((await javaApiClient.get<Response<import('@/types/bgm-wishlist').BgmOperation>>(`${base}/operations/${encodeURIComponent(id)}`, { signal })).data)
}
export async function confirmBgmCandidate(id: string, subjectId: number, candidateKey: string) {
  return unwrap((await javaApiClient.post<Response<import('@/types/bgm-wishlist').BgmOperation>>(`${base}/operations/${encodeURIComponent(id)}/confirm`, { subjectId, candidateKey })).data)
}
export async function searchBgmOperation(id: string, subjectId: number) {
  return unwrap((await javaApiClient.post<Response<import('@/types/bgm-wishlist').BgmOperation>>(`${base}/operations/${encodeURIComponent(id)}/search`, { subjectId })).data)
}
export async function deferBgmOperation(id: string, subjectId: number) {
  return unwrap((await javaApiClient.post<Response<import('@/types/bgm-wishlist').BgmOperation>>(`${base}/operations/${encodeURIComponent(id)}/defer`, { subjectId })).data)
}
export async function supplyBgmOperation(id: string, subjectId: number, identity: { mediaType: 'MOVIE' | 'SERIES'; tmdbId: number; seasonNumber: number | null }, release: import('@/types/resources').ProwlarrRelease) {
  return unwrap((await javaApiClient.post<Response<import('@/types/bgm-wishlist').BgmOperation>>(`${base}/operations/${encodeURIComponent(id)}/supply`, { subjectId, identity, release })).data)
}
