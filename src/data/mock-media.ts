export type MediaQuality = '4K UHD' | '1080P' | '4K Restored'

export type MockMediaItem = {
  id: string
  title: string
  year: number
  poster: string
  category: 'movie' | 'tv' | 'anime'
  defaultQuality: MediaQuality
}

export const MEDIA_QUALITY_OPTIONS: MediaQuality[] = [
  '4K UHD',
  '1080P',
  '4K Restored',
]

function createPoster(
  startColor: string,
  endColor: string,
  accentColor: string,
): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" fill="none">
      <defs>
        <linearGradient id="bg" x1="40" y1="20" x2="340" y2="560" gradientUnits="userSpaceOnUse">
          <stop stop-color="${startColor}" />
          <stop offset="1" stop-color="${endColor}" />
        </linearGradient>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientTransform="translate(282 120) rotate(140) scale(180 180)" gradientUnits="userSpaceOnUse">
          <stop stop-color="${accentColor}" stop-opacity="0.55" />
          <stop offset="1" stop-color="${accentColor}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="600" rx="28" fill="url(#bg)" />
      <rect x="28" y="28" width="344" height="544" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
      <circle cx="282" cy="120" r="180" fill="url(#glow)" />
      <path d="M68 474C116 424 157 398 203 398C249 398 290 425 334 474V572H68V474Z" fill="rgba(7,10,18,0.34)" />
      <path d="M100 234C138 176 180 146 225 146C270 146 310 177 340 236V402C304 355 260 330 210 330C162 330 125 352 100 377V234Z" fill="rgba(255,255,255,0.1)" />
      <path d="M154 84L264 84L196 188L286 188L142 350L186 224L118 224L154 84Z" fill="rgba(255,255,255,0.12)" />
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const mockMedia: MockMediaItem[] = [
  {
    id: 'blade-runner-2049',
    title: '银翼杀手 2049',
    year: 2017,
    category: 'movie',
    poster: createPoster('#0a1222', '#123f58', '#1fc4ff'),
    defaultQuality: '4K UHD',
  },
  {
    id: 'oppenheimer',
    title: '奥本海默',
    year: 2023,
    category: 'movie',
    poster: createPoster('#0f2230', '#e1c7a3', '#fff2c9'),
    defaultQuality: '4K UHD',
  },
  {
    id: 'spider-verse',
    title: '蜘蛛侠：纵横宇宙',
    year: 2023,
    category: 'anime',
    poster: createPoster('#311842', '#0881a9', '#ff8ed8'),
    defaultQuality: '1080P',
  },
  {
    id: 'dune-part-two',
    title: '沙丘：第二部',
    year: 2024,
    category: 'movie',
    poster: createPoster('#231811', '#8c6a4d', '#f7c58b'),
    defaultQuality: '4K UHD',
  },
  {
    id: 'parasite',
    title: '寄生虫',
    year: 2019,
    category: 'movie',
    poster: createPoster('#06080e', '#56462f', '#f5bf57'),
    defaultQuality: '4K UHD',
  },
  {
    id: 'farewell-my-concubine',
    title: '霸王别姬',
    year: 1993,
    category: 'movie',
    poster: createPoster('#3f2814', '#efe1bb', '#f6d89b'),
    defaultQuality: '4K Restored',
  },
  {
    id: 'chernobyl',
    title: '切尔诺贝利',
    year: 2019,
    category: 'tv',
    poster: createPoster('#202126', '#73777a', '#d0d5cf'),
    defaultQuality: '4K UHD',
  },
  {
    id: 'breaking-bad',
    title: '绝命毒师',
    year: 2008,
    category: 'tv',
    poster: createPoster('#10231b', '#4b6c45', '#d7f599'),
    defaultQuality: '1080P',
  },
  {
    id: 'frieren',
    title: '葬送的芙莉莲',
    year: 2023,
    category: 'anime',
    poster: createPoster('#1d2644', '#77a4a4', '#d7ffe6'),
    defaultQuality: '1080P',
  },
  {
    id: 'arcane',
    title: '英雄联盟：双城之战',
    year: 2021,
    category: 'anime',
    poster: createPoster('#112328', '#7f4b3f', '#ffc18d'),
    defaultQuality: '4K UHD',
  },
]
