import type { MediaCapacity } from '@/types/media-library'

const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })

export function capacityText({ storage_bytes: bytes, capacity_status: status }: MediaCapacity) {
  if (status === 'pending') return '统计中'
  if (bytes == null) return '容量未知'
  const unit = bytes > 0 ? Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3)) : 0
  const size = `${number.format(bytes / 1000 ** unit)} ${units[unit]}`
  return status === 'partial' ? `已知 ${size} · 不完整` : size
}
