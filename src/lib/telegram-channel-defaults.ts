import type { TelegramChannelInput } from '@/types/telegram-automation'

export function telegramResourceModeDefaults(
  resourceMode: TelegramChannelInput['resource_mode'],
) {
  return resourceMode === 'hashtag_resource'
    ? { resource_mode: resourceMode, min_views: 500, min_forwards: 1 }
    : { resource_mode: resourceMode, min_views: 5000, min_forwards: 10 }
}
