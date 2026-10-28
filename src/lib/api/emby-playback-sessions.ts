import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type { EmbyPlaybackSnapshot } from '@/types/emby-playback-sessions'

export async function getEmbyPlaybackSessions(
  signal?: AbortSignal,
): Promise<EmbyPlaybackSnapshot> {
  try {
    const response = await javaApiClient.get<{
      code: number
      message: string
      data: EmbyPlaybackSnapshot | null
    }>('/api/v1/admin/emby/playback-sessions', { signal })
    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || '实时观看刷新失败')
    }
    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) throw error
    throw new Error(getJavaErrorMessage(error) ?? '实时观看刷新失败')
  }
}
