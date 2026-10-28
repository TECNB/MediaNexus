import { getJavaErrorMessage, isJavaRequestCanceledError, javaApiClient } from '@/lib/java-api'
import type { EmbyWatchRankingData, EmbyWatchRankingParams, EmbyMediaWatchRankingItem, EmbyUserWatchRankingItem, WatchCategory, WatchSort, WatchPage, WatchPageParams, WatchSession, WatchViewer, PrivateWatchTitle } from '@/types/emby-watch-rankings'
const BASE = '/api/v1/admin/emby/watch-rankings'

async function readWatchStatistics<T>(path: string, params: object, signal?: AbortSignal): Promise<T> {
  try {
    const response = await javaApiClient.get<{ code: number; message: string; data: T | null }>(`${BASE}${path}`, { params, signal })
    if (response.data.code !== 200 || response.data.data === null) throw new Error(response.data.message || '观看统计加载失败')
    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) throw error
    throw new Error(getJavaErrorMessage(error) ?? (error instanceof Error ? error.message : '观看统计加载失败，请稍后重试。'))
  }
}
export const getEmbyWatchRankings = (params: EmbyWatchRankingParams, signal?: AbortSignal) => readWatchStatistics<EmbyWatchRankingData>('', params, signal)
export const getWatchUsers = (params: WatchPageParams, signal?: AbortSignal) => readWatchStatistics<WatchPage<EmbyUserWatchRankingItem>>('/users', params, signal)
export const getWatchWorks = (userId: string, params: WatchPageParams, signal?: AbortSignal) => readWatchStatistics<WatchPage<EmbyMediaWatchRankingItem>>(`/users/${encodeURIComponent(userId)}/works`, params, signal)
export const getWatchSessions = (userId: string, params: WatchPageParams & { media_id?: string; category?: WatchCategory }, signal?: AbortSignal) => readWatchStatistics<WatchPage<WatchSession>>(`/users/${encodeURIComponent(userId)}/sessions`, params, signal)
export const getWatchActivity = (params: WatchPageParams, signal?: AbortSignal) => readWatchStatistics<WatchPage<WatchSession>>('/activity', params, signal)
export const getWatchMedia = (params: WatchPageParams & { category: WatchCategory; sort: WatchSort }, signal?: AbortSignal) => readWatchStatistics<WatchPage<EmbyMediaWatchRankingItem>>('/media', params, signal)
export const getWatchViewers = (params: WatchPageParams & { media_id: string; category: WatchCategory }, signal?: AbortSignal) => readWatchStatistics<WatchPage<WatchViewer>>('/viewers', params, signal)
export const getPrivateWatchTitles = (itemIds: string[], signal?: AbortSignal) => readWatchStatistics<PrivateWatchTitle[]>('/private-titles', { item_ids: itemIds.join(',') }, signal)
