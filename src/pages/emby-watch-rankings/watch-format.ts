const WATCH_ZONE = 'Asia/Shanghai'

export function todayInShanghai() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WATCH_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}

export function watchDuration(seconds: number) {
  if (seconds < 60) return `${Math.floor(seconds)} 秒`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  return hours ? `${hours} 小时 ${minutes} 分` : `${minutes} 分钟`
}

export function watchTime(value: string | null) {
  if (!value) return '时间未知'
  // The statistics contract stores Shanghai LocalDateTime; zoneless strings must
  // not be interpreted in the browser's local timezone.
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}+08:00`
  const date = new Date(zoned)
  if (Number.isNaN(date.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: WATCH_ZONE, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

export function episodeLabel(season: number | null, episode: number | null) {
  if (season === null && episode === null) return null
  return `${season === null ? 'S??' : `S${String(season).padStart(2, '0')}`}${episode === null ? 'E??' : `E${String(episode).padStart(2, '0')}`}`
}
