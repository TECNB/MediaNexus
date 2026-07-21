import { checkMediaLibraryPresence } from '@/lib/api/resources'
import type { MediaLibraryPresenceParams } from '@/types/resources'

export async function checkMediaLibraryIngestAllowed(
  params: MediaLibraryPresenceParams,
  fallbackTitle: string,
) {
  try {
    const presence = await checkMediaLibraryPresence(params)
    if (!presence.check_available || !presence.exists) {
      return true
    }

    const title = presence.matched_title?.trim() || fallbackTitle.trim()
    const target =
      params.media_type === 'series' && presence.season_number
        ? `《${title}》第 ${presence.season_number} 季`
        : `《${title}》`

    window.alert(
      `Emby 媒体库中已存在${target}，禁止重复入库。\n\n当前按作品与季度判断，不支持多质量版本。`,
    )
    return false
  } catch {
    return true
  }
}
