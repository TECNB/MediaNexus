import type { ProwlarrRelease } from '@/types/resources'

export function formatSizeBytes(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '未知大小'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1 }
  return `${size.toFixed(unit > 2 ? 2 : 0)} ${units[unit]}`
}

/** 盘搜大小来自站点四舍五入的报告，不能显示成已核实的精确文件大小。 */
export function formatReleaseSize(release: Pick<ProwlarrRelease, 'size' | 'indexer_id' | 'download_ref'>) {
  const value = formatSizeBytes(release.size)
  if (value === '未知大小') return value
  return release.indexer_id === null && /^magnet:/i.test(release.download_ref) ? `约 ${value}` : value
}
