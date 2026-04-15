import type { TargetSeasonOption } from '@/types/magnet-ingest'

export type MagnetLibraryCategory = 'movie' | 'tv' | 'anime'

export type MagnetLibraryItem = {
  id: string
  title: string
  originalTitle: string
  year: number
  category: MagnetLibraryCategory
  poster: string
  subtitle: string
}

export type RecentIngestTaskStatus =
  | 'parsing'
  | 'downloading'
  | 'submitted'
  | 'completed'
  | 'failed'

export type RecentIngestTask = {
  id: string
  name: string
  libraryTitle: string
  status: RecentIngestTaskStatus
  time: string
}

export type SystemLogTone = 'default' | 'success' | 'accent' | 'muted'

export type SystemLogEntry = {
  id: string
  timestamp: string
  message: string
  tone?: SystemLogTone
}

export const magnetCategoryLabel: Record<MagnetLibraryCategory, string> = {
  movie: '电影',
  tv: '剧集',
  anime: '动漫',
}

function createPoster(
  startColor: string,
  endColor: string,
  accentColor: string,
): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480" fill="none">
      <defs>
        <linearGradient id="bg" x1="40" y1="20" x2="260" y2="460" gradientUnits="userSpaceOnUse">
          <stop stop-color="${startColor}" />
          <stop offset="1" stop-color="${endColor}" />
        </linearGradient>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientTransform="translate(212 112) rotate(125) scale(164 164)" gradientUnits="userSpaceOnUse">
          <stop stop-color="${accentColor}" stop-opacity="0.52" />
          <stop offset="1" stop-color="${accentColor}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="480" rx="30" fill="url(#bg)" />
      <rect x="20" y="20" width="280" height="440" rx="24" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
      <circle cx="212" cy="112" r="164" fill="url(#glow)" />
      <path d="M72 384C112 344 148 324 188 324C228 324 262 345 288 384V452H72V384Z" fill="rgba(7,10,18,0.34)" />
      <path d="M116 96H206L160 176H224L106 308L138 206H92L116 96Z" fill="rgba(255,255,255,0.14)" />
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const defaultMagnetText = `magnet:?xt=urn:btih:88594AAACBDE778F9A92E2E6759714890A9A8C77&dn=The.Matrix.1999.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.7.1-FGT
magnet:?xt=urn:btih:1B39AB2B34B7C3E8DE2159548CA117A94AB4AF98&dn=Oppenheimer.2023.2160p.UHD.BluRay.REMUX.HDR.HEVC.Atmos`

export const mockLibraryItems: MagnetLibraryItem[] = [
  {
    id: 'the-matrix-1999',
    title: '黑客帝国',
    originalTitle: 'THE MATRIX',
    year: 1999,
    category: 'movie',
    poster: createPoster('#0a1214', '#0f5b59', '#9fffe1'),
    subtitle: 'THE MATRIX · 1999 · 电影',
  },
  {
    id: 'the-matrix-reloaded-2003',
    title: '黑客帝国2：重装上阵',
    originalTitle: 'THE MATRIX RELOADED',
    year: 2003,
    category: 'movie',
    poster: createPoster('#101014', '#386f68', '#8ee3ba'),
    subtitle: 'THE MATRIX RELOADED · 2003 · 电影',
  },
  {
    id: 'the-matrix-revolutions-2003',
    title: '黑客帝国3：矩阵革命',
    originalTitle: 'THE MATRIX REVOLUTIONS',
    year: 2003,
    category: 'movie',
    poster: createPoster('#111217', '#425953', '#a6e0d0'),
    subtitle: 'THE MATRIX REVOLUTIONS · 2003 · 电影',
  },
  {
    id: 'oppenheimer-2023',
    title: '奥本海默',
    originalTitle: 'OPPENHEIMER',
    year: 2023,
    category: 'movie',
    poster: createPoster('#1d1715', '#7e4a2f', '#ffd7aa'),
    subtitle: 'OPPENHEIMER · 2023 · 电影',
  },
  {
    id: 'dune-part-two-2024',
    title: '沙丘：第二部',
    originalTitle: 'DUNE: PART TWO',
    year: 2024,
    category: 'movie',
    poster: createPoster('#231711', '#7d6048', '#f0d1a1'),
    subtitle: 'DUNE: PART TWO · 2024 · 电影',
  },
  {
    id: 'succession-season-4',
    title: '继承之战 第四季',
    originalTitle: 'SUCCESSION SEASON 4',
    year: 2023,
    category: 'tv',
    poster: createPoster('#12151d', '#4d5767', '#e1e8ff'),
    subtitle: 'SUCCESSION SEASON 4 · 2023 · 剧集',
  },
  {
    id: 'frieren-2023',
    title: '葬送的芙莉莲',
    originalTitle: "FRIEREN: BEYOND JOURNEY'S END",
    year: 2023,
    category: 'anime',
    poster: createPoster('#18233f', '#5f8d97', '#d4ffe2'),
    subtitle: "FRIEREN: BEYOND JOURNEY'S END · 2023 · 动漫",
  },
  {
    id: 'bocchi-the-rock-2022',
    title: '孤独摇滚！',
    originalTitle: 'BOCCHI THE ROCK!',
    year: 2022,
    category: 'anime',
    poster: createPoster('#24142e', '#a54a7c', '#ffc8ef'),
    subtitle: 'BOCCHI THE ROCK! · 2022 · 动漫',
  },
]

export const initialRecentTasks: RecentIngestTask[] = [
  {
    id: 'task-1',
    name: 'Oppenheimer.2023.2160p.REMUX',
    libraryTitle: '奥本海默',
    status: 'parsing',
    time: '刚刚',
  },
  {
    id: 'task-2',
    name: 'Succession.S04.1080p.WEB-DL',
    libraryTitle: '继承之战 第四季',
    status: 'downloading',
    time: '14:15',
  },
  {
    id: 'task-3',
    name: 'Frieren.S01E28.1080p.BluRay',
    libraryTitle: '葬送的芙莉莲',
    status: 'submitted',
    time: '13:42',
  },
  {
    id: 'task-4',
    name: 'The.Matrix.1999.2160p.REMUX',
    libraryTitle: '黑客帝国',
    status: 'completed',
    time: '昨天',
  },
  {
    id: 'task-5',
    name: 'Dune.Part.Two.2024.2160p',
    libraryTitle: '沙丘：第二部',
    status: 'failed',
    time: '昨天',
  },
]

export const systemLogEntries: SystemLogEntry[] = [
  {
    id: 'log-1',
    timestamp: '14:21:44',
    message: 'Waiting for user input...',
    tone: 'muted',
  },
  {
    id: 'log-2',
    timestamp: '14:22:08',
    message: '解析磁力链接成功，已提取 metadata hash',
    tone: 'success',
  },
  {
    id: 'log-3',
    timestamp: '14:22:15',
    message: '已识别媒体名称: The Matrix (1999)',
    tone: 'default',
  },
  {
    id: 'log-4',
    timestamp: '14:23:01',
    message: '已绑定媒体库项目: /movies/The Matrix (1999)',
    tone: 'accent',
  },
  {
    id: 'log-5',
    timestamp: '14:23:17',
    message: '已准备推送 OpenList API / PikPak 节点',
    tone: 'accent',
  },
  {
    id: 'log-6',
    timestamp: '14:24:02',
    message: 'Request ID: PKP-8829-XJ-901',
    tone: 'muted',
  },
]

export const targetSeasonOptions: TargetSeasonOption[] = Array.from(
  { length: 20 },
  (_, index) => {
    const value = index + 1
    const seasonLabel = String(value).padStart(2, '0')

    return {
      label: `第 ${value} 季 (Season ${seasonLabel})`,
      value,
    }
  },
)
