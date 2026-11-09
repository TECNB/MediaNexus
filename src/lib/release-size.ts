import type { ProwlarrRelease } from '@/types/resources'

export function formatSizeBytes(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '未知大小'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1 }
  return `${size.toFixed(unit > 2 ? 2 : 0)} ${units[unit]}`
}

type ReleaseSizeFields = Pick<ProwlarrRelease, 'size' | 'indexer_id' | 'download_ref' | 'title'>

/** 标题末尾的单一容量标签只供展示，不作为种子大小或整季的证据。 */
export function releaseTitleSize(release: ReleaseSizeFields) {
  if (release.size != null || release.indexer_id !== null || !/^magnet:/i.test(release.download_ref)) return null
  const title = release.title.trim()
  const amounts = [...title.matchAll(/(?:^|[\s.([【_-])([0-9]+(?:\.[0-9]+)?)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB)(?=$|[\s)\]】._-])/gi)]
  const [amount] = amounts
  if (amounts.length !== 1 || !amount || !/^\s*[)\]】]*$/.test(title.slice((amount.index ?? 0) + amount[0].length))) return null
  return `${amount[1]} ${amount[2].toUpperCase().replace('IB', 'iB')}`
}

/** 盘搜大小来自站点四舍五入的报告，不能显示成已核实的精确文件大小。 */
export function formatReleaseSize(release: ReleaseSizeFields) {
  const value = formatSizeBytes(release.size)
  if (value === '未知大小') {
    const titleSize = releaseTitleSize(release)
    return titleSize ? `标题标注 ${titleSize}` : value
  }
  return release.indexer_id === null && /^magnet:/i.test(release.download_ref) ? `约 ${value}` : value
}
