import type { MediaCapacity } from '@/types/media-library'

const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })

export function capacityText({ storage_bytes: bytes, capacity_status: status }: MediaCapacity) {
  if (bytes == null) return status === 'pending' ? '统计中' : '容量未知'
  const unit = bytes > 0 ? Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3)) : 0
  return `${number.format(bytes / 1000 ** unit)} ${units[unit]}`
}
