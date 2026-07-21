import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Captions,
  Check,
  CircleHelp,
  ClipboardList,
  Copy,
  ExternalLink,
  Library,
  Loader2,
  LockKeyhole,
  Monitor,
  PlayCircle,
  Search,
  Smartphone,
  TabletSmartphone,
  X,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react'

import { copyTextToClipboard } from '@/lib/copy-to-clipboard'
import { getCurrentEmbyCredential } from '@/lib/api/emby-account'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { useAuth } from '@/lib/use-auth'
import type { EmbyCredential } from '@/types/emby-account'

type DocSection = {
  id: string
  title: string
  eyebrow: string
  summary: string
  bullets: string[]
  figures?: Array<{
    alt: string
    caption: string
    src: string
  }>
  blocks?: Array<{
    title: string
    items: string[]
  }>
  benefitGroups?: Array<{
    title: string
    summary: string
    items: string[]
  }>
  relatedModules?: Array<{
    moduleId: string
    title: string
    description: string
  }>
  workflowSteps?: Array<{
    moduleId: string
    moduleTitle: string
    title: string
    description: string
  }>
  notice?: string
  closingNote?: string
  externalResourceGroups?: Array<{
    title: string
    wide?: boolean
    resources: Array<{
      name: string
      description: string
      href: string
      endpoint?: string
    }>
  }>
}

type GuideModule = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  sectionIds: string[]
}

type PlayerDownload = {
  badge?: string
  id: string
  platform: string
  name: string
  description: string
  href: string
  storeName: string
  icon: LucideIcon
  entrySteps: string[]
  screenshotAlt: string
  screenshotSrc: string
}

function ZoomableImage({
  alt,
  className,
  src,
}: {
  alt: string
  className: string
  src: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <>
      <button
        aria-label={`放大查看：${alt}`}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <img alt={alt} className={className} loading="lazy" src={src} />
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 inline-flex rounded-full bg-slate-950/80 p-2 text-white opacity-90 shadow-lg backdrop-blur transition group-hover:bg-slate-950 group-focus-visible:bg-slate-950"
        >
          <ZoomIn aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      </button>

      {isOpen ? (
        <div
          aria-label={`图片预览：${alt}`}
          aria-modal="true"
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm md:p-8"
          onClick={(event) => {
            if (event.currentTarget === event.target) setIsOpen(false)
          }}
          role="dialog"
        >
          <button
            aria-label="关闭图片预览"
            autoFocus
            className="absolute right-4 top-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:right-6 md:top-6"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          <img
            alt={alt}
            className="max-h-[calc(100vh-5rem)] max-w-full cursor-default rounded-lg object-contain shadow-2xl"
            src={src}
          />
        </div>
      ) : null}
    </>
  )
}

const PLAYBACK_LINE = 'http://107.172.224.11:8096'

const guideModules: GuideModule[] = [
  {
    id: 'overview',
    title: '快速开始',
    description: '了解能做什么、从哪里开始和使用须知',
    icon: BookOpen,
    sectionIds: ['start'],
  },
  {
    id: 'devices',
    title: '设备与播放',
    description: '下载播放器并连接服务器',
    icon: PlayCircle,
    sectionIds: [],
  },
  {
    id: 'resources',
    title: '找资源与入库',
    description: '从搜索、发布选择到手动磁力',
    icon: Search,
    sectionIds: [
      'find-media',
      'choose-release',
      'anime-modes',
      'manual-magnet',
    ],
  },
  {
    id: 'tasks',
    title: '任务与恢复',
    description: '查看进度并处理失败任务',
    icon: ClipboardList,
    sectionIds: ['task-center', 'recovery'],
  },
  {
    id: 'tools',
    title: '字幕管理',
    description: '上传字幕并追踪处理结果',
    icon: Captions,
    sectionIds: ['subtitles'],
  },
  {
    id: 'external',
    title: '外部资源入口',
    description: '查看字幕、BT / 磁力网站与弹幕源',
    icon: Library,
    sectionIds: ['external-resources'],
  },
  {
    id: 'faq',
    title: '常见问题',
    description: '快速理解容易混淆的边界',
    icon: CircleHelp,
    sectionIds: ['faq'],
  },
]

const playerDownloads: PlayerDownload[] = [
  {
    badge: '免费',
    id: 'windows',
    platform: 'Windows',
    name: 'Hills Lite',
    description:
      '从 Microsoft Store 安装后，在播放器中选择添加服务器并填写帮助页提供的线路。',
    href: 'https://apps.microsoft.com/detail/9nxnzfrllwzx',
    storeName: 'Microsoft Store',
    icon: Monitor,
    entrySteps: [
      '打开 Hills Lite，点击左下角“添加服务器”。',
      '填写服务器地址、端口与 Emby 账号，路径保持为空。',
      '保存服务器，登录后即可浏览媒体库。',
    ],
    screenshotAlt: 'Hills Lite 添加 Emby 服务器界面',
    screenshotSrc:
      'https://embywiki.911997.xyz/assets/hillslite.JluEIggX.webp',
  },
  {
    badge: '免费',
    id: 'lenna',
    platform: 'macOS / iOS',
    name: 'Lenna',
    description:
      '免费的 Apple 平台播放器，适合希望直接连接 Emby、无需额外购买播放器的用户。',
    href: 'https://apps.apple.com/us/app/lenna-video-library-player/id6502967807',
    storeName: 'App Store',
    icon: TabletSmartphone,
    entrySteps: [
      '打开 Lenna，进入底部“服务器”，点击右上角“+”。',
      '选择 Emby，并填写顶部提供的服务器线路与账号。',
      '保存服务器；如需在 Apple TV 使用，可按应用提示启用 iCloud 同步。',
    ],
    screenshotAlt: 'Lenna 添加 Emby 服务器界面',
    screenshotSrc: 'https://embywiki.911997.xyz/assets/lenna.BmO-hl9O.webp',
  },
  {
    id: 'apple',
    platform: 'macOS / iOS',
    name: 'SenPlayer',
    description:
      '从 App Store 安装后，在播放器中添加 Emby 媒体服务器并填写帮助页提供的线路。',
    href: 'https://apps.apple.com/app/id6443975850',
    storeName: 'App Store',
    icon: TabletSmartphone,
    entrySteps: [
      '打开 SenPlayer，进入底部“服务器”，点击右上角“+”。',
      '选择 Emby，并填写服务器地址、端口与账号。',
      '关闭 HTTPS，路径保持为空，然后保存并登录。',
    ],
    screenshotAlt: 'SenPlayer 添加 Emby 服务器界面',
    screenshotSrc:
      'https://embywiki.911997.xyz/assets/senplayer.Dt2gyOWR.webp',
  },
  {
    badge: '免费',
    id: 'android',
    platform: 'Android',
    name: 'Yamby',
    description:
      '从 Google Play 安装后，在播放器中添加 Emby 服务器并填写帮助页提供的线路。',
    href: 'https://play.google.com/store/apps/details?id=com.hush.yamby',
    storeName: 'Google Play',
    icon: Smartphone,
    entrySteps: [
      '打开 Yamby，点击服务器页右下角的“+”。',
      '选择添加 Emby 服务器并填写线路与账号。',
      '协议选择 HTTP，路径保持为空，然后登录。',
    ],
    screenshotAlt: 'Yamby 添加 Emby 服务器界面',
    screenshotSrc: 'https://embywiki.911997.xyz/assets/yamby.BbcNLwhE.webp',
  },
]

const docSections: DocSection[] = [
  {
    id: 'start',
    eyebrow: '第一次使用',
    title: '先了解 Emby 与 MediaNexus 的分工',
    summary:
      'Emby 负责整理和播放个人媒体库，MediaNexus 则把搜索、入库、任务跟踪、失败恢复与字幕补充连接成更完整的使用流程。',
    bullets: [],
    benefitGroups: [
      {
        title: 'Emby 能为你带来什么',
        summary: '把自己的媒体内容整理成更统一、更自由的观看体验。',
        items: [
          '片库更统一：电影、电视剧和动漫集中在同一个媒体库中，减少在不同应用之间来回寻找。',
          '播放更自由：同一套媒体库可以连接 Windows、macOS、iOS 和 Android 上的不同播放器。',
          '版本更自主：可以根据设备选择清晰度、HDR 或 Dolby Vision 等版本，并按需补充字幕。',
          '内容更可控：已经整理进个人媒体库的内容由自己统一管理，不会轻易打乱原有收藏。',
        ],
      },
      {
        title: 'MediaNexus 能为你带来什么',
        summary: '减少维护个人媒体库时重复、分散又难以追踪的操作。',
        items: [
          '更省步骤：从搜索作品、选择发布资源到创建入库任务，常用入口集中在一起。',
          '更少盲等：任务状态、处理阶段和失败原因会保留下来，随时可以回来查看。',
          '更容易恢复：资源失效或处理中断时，可以沿原任务更换来源并继续处理。',
          '补充更顺手：缺少字幕或需要外部工具时，有明确的查找、关联和处理路径。',
        ],
      },
    ],
    workflowSteps: [
      {
        moduleId: 'devices',
        moduleTitle: '设备与播放',
        title: '先在自己的设备上连接播放器',
        description:
          '根据 Windows、macOS、iOS 或 Android 设备选择播放器。登录 MediaNexus 后查看线路与个人 Emby 账号，按照对应截图完成服务器连接。连接成功后即可在播放器中浏览媒体库。',
      },
      {
        moduleId: 'resources',
        moduleTitle: '找资源与入库',
        title: '找到想看的内容并创建入库任务',
        description:
          '搜索电影、电视剧或动漫，先核对标题、年份与季度，再选择合适的发布资源。只有已经持有可靠 magnet 时，才使用手动磁力作为补充入口。',
      },
      {
        moduleId: 'tasks',
        moduleTitle: '任务与恢复',
        title: '在任务中心等待并确认结果',
        description:
          '任务创建后无需一直停留在原页面。前往任务中心查看下载、整理和完成状态；遇到失败、中断或部分完成时，再从详情判断是否需要重试或更换来源。',
      },
      {
        moduleId: 'external',
        moduleTitle: '外部资源入口',
        title: '只有需要时再使用外部工具',
        description:
          '站内发布搜索没有合适候选、影片缺少字幕，或播放器支持额外弹幕源时，再到外部资源入口查看对应网站和接口。外部服务并不是正常流程中的必经步骤。',
      },
      {
        moduleId: 'tools',
        moduleTitle: '字幕管理',
        title: '入库后按需补充字幕',
        description:
          '如果播放器中没有合适字幕，准备好字幕文件后回到字幕管理，手动关联正确的电影或剧集并上传，再通过最近处理与日志确认结果。',
      },
    ],
    blocks: [
      {
        title: '使用须知（请务必阅读）',
        items: [
          '线路地址与个人账号仅限本人使用，禁止公开、转发、共享或以其他方式泄漏。',
          'MediaNexus 不提供影视资源下载、存储或爬取服务，请仅管理你依法有权访问的内容。',
          '禁止利用账号、线路或本服务收费共享、转售、代充，或进行任何形式的盈利。',
          '禁止在中国大陆地区的任何平台宣传与本站有关的所有服务，包括但不限于名称、截图、链接等。',
        ],
      },
    ],
    closingNote:
      '如果你认为其中任何一个步骤很麻烦，欢迎订阅爱腾优奈的会员支持正版。',
  },
  {
    id: 'find-media',
    eyebrow: '创建任务前',
    title: '找到想入库的影视',
    summary:
      '资源搜索是优先入口。先选择电影、电视剧或动漫，再从真实目录结果进入自动推荐或发布资源选择。',
    bullets: [
      '搜索页会保留最近搜索，并在结果上方展示最近一次入库，方便继续之前的操作。',
      '目录结果用于确认电影、剧集或动漫条目，注意核对标题、年份、海报和来源平台。',
      '发布资源才是后续会解析 magnet 并创建入库任务的下载来源。',
      '电影选择清晰度；剧集和动漫整季还需要选择目标季。',
    ],
    relatedModules: [
      {
        moduleId: 'external',
        title: '站内搜索没有合适结果？',
        description: '前往外部资源入口查看 BT / 磁力网站导航。',
      },
    ],
    figures: [
      {
        src: '/docs/resource-search-current.jpg',
        alt: 'MediaNexus 真实搜索盗梦空间后的资源搜索页面，展示分类、最近搜索、最近入库和电影结果',
        caption:
          '真实搜索“盗梦空间”后的当前界面。页面会同时保留最近搜索与最近入库，向下即可在结果卡片中选择清晰度和后续操作。',
      },
    ],
    blocks: [
      {
        title: '什么时候从资源搜索开始',
        items: [
          '如果你还没有可靠 magnet，优先从资源搜索开始。它会先帮你确认电影、剧集或动漫条目，再围绕这个条目查找可下载发布资源。',
          '最近搜索会记录分类、动漫模式和关键词；点击历史项可以重新执行相同搜索，也可以单独删除或清空历史。',
          '资源搜索会保留标题、年份、季度、清晰度和后续发布来源等上下文。后面进入任务中心时，这些信息也更容易帮助你判断任务来自哪里。',
        ],
      },
      {
        title: '电影怎么走',
        items: [
          '选择电影分类，输入电影名称，先确认卡片上的标题、年份和海报是不是你要找的作品。',
          '选择目标清晰度后，可以点击电影入库获取自动推荐，也可以点击查看更多进入完整发布资源选择页。',
        ],
      },
      {
        title: '剧集怎么走',
        items: [
          '选择电视剧分类，输入剧名，先确认卡片上的剧集条目。',
          '剧集需要选择目标季，再选择清晰度。没有选季时不要急着提交，因为发布搜索需要知道你要入库哪一季。',
          '选择好目标季和清晰度后，再决定用剧集入库快速确认，还是用查看更多手动挑发布资源。',
        ],
      },
    ],
  },
  {
    id: 'choose-release',
    eyebrow: '发布资源',
    title: '选择发布资源',
    summary:
      '卡片上的入库按钮会打开自动推荐，查看更多会进入完整发布列表。两条路径都需要你在创建任务前确认具体来源。',
    bullets: [
      '入库按钮会等待发布搜索并给出推荐候选，不会静默创建任务。',
      '查看更多用于检查更多候选，适合你想自己判断发布标题、体积、做种和动态范围时使用。',
      '发布搜索可能需要十几秒，慢时接近 30 秒。',
    ],
    figures: [
      {
        src: '/docs/resource-recommendation-current.jpg',
        alt: 'MediaNexus 盗梦空间自动匹配资源弹窗，按标题语言和推荐侧重点展示四个真实候选',
        caption:
          '真实搜索“盗梦空间”后的自动推荐弹窗。候选会区分中文或展示标题、原文标题，并分别给出容量优先和做种优先的选择。',
      },
      {
        src: '/docs/resource-publish-current.jpg',
        alt: 'MediaNexus 发布资源选择页展示盗梦空间的 Prowlarr 搜索结果和 HDR 筛选统计',
        caption:
          '当前发布选择页会统计各分辨率与动态范围的候选数量。筛选后可以对比标题命中、体积、做种、下载、抓取和来源。',
      },
    ],
    blocks: [
      {
        title: '入库按钮：自动发布推荐',
        items: [
          '电影入库、剧集入库和动漫整季入库都不会静默提交。点击后系统会搜索发布资源，再打开候选确认弹窗。',
          '推荐候选会先按中文或展示标题、原文标题分组，并在各组中分别提供容量优先和做种优先的代表版本。',
          '确认前重点看发布标题、命中标题、分辨率、动态范围、体积和做种。如果候选明显不合适，取消后改用查看更多。',
        ],
      },
      {
        title: '查看更多：发布资源选择',
        items: [
          '查看更多适合你想检查完整候选时使用。页面顶部会统计不限、2160p、1080p、720p，以及 Dolby Vision、HDR、SDR、未标注的数量。',
          '候选卡片会展示标题命中方式、大小、做种、下载、抓取、来源和时间。确认后点击使用该发布进行 OpenList 入库。',
          '发布资源选择页依赖你从资源搜索带入的上下文。如果刷新或直接打开时提示缺少资源信息，回到资源搜索重新进入即可。',
        ],
      },
      {
        title: '等待 Prowlarr 搜索',
        items: [
          '入库按钮和查看更多都会触发发布搜索。系统可能会向多个发布索引器查询，通常需要十几秒，慢的时候可能接近 30 秒。',
          '等待期间不要重复点击同一个按钮。重复点击不会让索引器更快，反而可能造成重复请求或让你更难判断当前结果。',
        ],
      },
      {
        title: 'SDR / HDR / DV 怎么选',
        items: [
          'SDR 是普通动态范围，兼容性最好。不确定播放设备支持什么时，优先选择 SDR 更稳。',
          'HDR 是高动态范围，需要播放器、显示设备和播放链路支持。设备支持得好时画面层次更好，不支持时可能偏暗或颜色异常。',
          'DV 是 Dolby Vision，效果可能更好，但兼容性更挑设备。遇到偏绿、偏紫、偏暗等问题时，通常要回头检查播放环境是否稳定支持 DV/HDR。',
        ],
      },
    ],
  },
  {
    id: 'anime-modes',
    eyebrow: '动漫',
    title: '整季入库与追更订阅',
    summary:
      '动漫整季入库用于一次性创建 OpenList 入库任务，追更订阅用于通过 Ani-RSS 获取后续更新。',
    bullets: [
      '整季入库只处理剧集型动漫整季，不处理动画电影。',
      '追更订阅不是 OpenList 入库任务，不会在任务中心按入库日志展示。',
      '两种模式切换后需要重新搜索，已有结果不会跨模式复用。',
    ],
    figures: [
      {
        src: '/docs/anime-season-search-current.jpg',
        alt: 'MediaNexus 动漫整季模式真实搜索全职高手后的结果卡片',
        caption:
          '动漫整季模式真实搜索“全职高手”的结果。确认条目后选择目标季与分辨率，再使用动漫整季入库或查看更多。',
      },
    ],
    blocks: [
      {
        title: '整季入库适合什么',
        items: [
          '整季入库适合已经完结、你想补一整季，或你明确要把某一季动漫作为 OpenList 入库任务处理的情况。',
          '它只处理剧集型动漫整季，不做媒体库缺集扫描，不做单集补全，也不处理动画电影。动画电影应回到电影分类入库。',
          '整季入库会复用剧集式的目录搜索、季数选择、发布资源选择和 OpenList 入库能力，但在用户侧应理解为动漫整季任务。',
        ],
      },
      {
        title: '追更订阅适合什么',
        items: [
          '追更订阅适合正在连载、你希望通过 Ani-RSS 持续获取后续更新的动漫。',
          '它会走动漫搜索、字幕组选择、订阅预览和 Ani-RSS 订阅路线，不会创建一次性的 OpenList 入库任务。',
          '因为追更订阅不是 OpenList 入库任务，所以不要在任务中心里按入库日志寻找它。',
        ],
      },
      {
        title: '切换模式时会发生什么',
        items: [
          '整季入库和追更订阅是两种不同意图。切换时可以保留输入框文字，但已有搜索结果、季数、字幕组、订阅预览和确认状态不会跨模式复用。',
          '切换后请重新提交搜索，让页面使用当前模式对应的搜索方式。',
        ],
      },
    ],
  },
  {
    id: 'manual-magnet',
    eyebrow: '兜底入口',
    title: '手动磁力入库',
    summary:
      '当你已经有可靠 magnet，或发布搜索没有合适资源时，可以使用手动磁力作为兜底入口。',
    bullets: [
      '当前只接受一条以 magnet:? 开头的链接，不会自动拆分多条内容。',
      '提交前必须选择媒体类别，并搜索绑定正确的库项目。',
      '失败恢复时提供新 magnet，属于同一次入库意图下更换下载来源。',
    ],
    figures: [
      {
        src: '/docs/manual-magnet-current.jpg',
        alt: 'MediaNexus 手动磁力入库页面，包含单条磁力输入、类别、库项目绑定和任务日志',
        caption:
          '当前手动磁力页会把 magnet、库项目和媒体类别绑定在一起，并在右侧展示最近任务日志。提交前请完成三项确认。',
      },
    ],
    blocks: [
      {
        title: '为什么和资源搜索分开',
        items: [
          '资源搜索会帮你从目录结果进入发布资源选择，并保存发布标题、索引器、分辨率、动态范围等上下文，所以它更适合作为普通入库的默认入口。',
          '手动磁力更像兜底工具：你已经有可靠 magnet，或者发布搜索找不到合适资源，或者失败恢复时需要换一个下载来源。',
          '页面下方还会展示最近任务；需要完整筛选、恢复或查看尝试链时，再进入任务中心。',
        ],
      },
      {
        title: '使用手动磁力前先确认',
        items: [
          '手动磁力不会经过 Prowlarr 发布资源选择，也不会替你判断发布标题、做种健康度或字幕风险。',
          '提交前请自己确认 magnet 对应的作品、季度、清晰度和文件内容，再选择媒体类别并搜索绑定目标条目。剧集和动漫还要确认季数。',
          '从失败任务里手动提供 magnet 时，它仍然是同一次入库意图下的恢复动作，不是孤立的新任务。',
        ],
      },
      {
        title: '可以从哪里找 magnet',
        items: [
          '独立的“外部资源入口”模块集中列出了 SeedHub、Pomo 等 BT / 磁力网站，适合你已经明确知道要找哪部作品、哪一季、哪种清晰度时使用。',
          '从外部网站复制 magnet 前，请自己核对标题、年份、季度、集数、体积、字幕信息和做种情况。MediaNexus 只负责接收你提交的 magnet 并创建入库任务，不会替外部来源背书。',
          '如果你不确定来源是否可靠，优先回到资源搜索使用入库按钮或查看更多，让系统保留发布标题、索引器、分辨率和动态范围等上下文。',
        ],
      },
    ],
  },
  {
    id: 'task-center',
    eyebrow: '创建任务后',
    title: '查看入库进度',
    summary:
      '任务中心用于查看 OpenList 入库任务的历史与当前状态，帮助你离开原入口后继续跟踪进度。',
    bullets: [
      '任务中心覆盖电影、剧集、动漫整季，以及你有权查看的 Adult 入库任务。',
      '列表用于快速判断状态；详情页用于查看阶段、来源、日志和任务尝试链。',
      '等待中、下载中、整理中、失败和部分完成等状态会在后续章节详细解释。',
    ],
    figures: [
      {
        src: '/docs/task-center-current.jpg',
        alt: 'MediaNexus 任务中心页面，展示状态筛选、类型筛选和入库任务列表',
        caption:
          '任务中心用于离开原入口后继续查看 OpenList 入库任务，列表重点展示状态、阶段、来源和进度摘要。',
      },
      {
        src: '/docs/task-detail-current.jpg',
        alt: 'MediaNexus 入库任务详情页面，展示任务状态、阶段进度、任务尝试链和日志区域',
        caption:
          '任务详情用于查看阶段、整理结果、任务尝试链和日志证据。普通用户优先看状态、阶段、错误和最后 WARN/ERROR。',
      },
    ],
    blocks: [
      {
        title: '任务中心看什么',
        items: [
          '资源搜索、发布资源选择和手动磁力入口创建的 OpenList 入库任务，都可以回到任务中心查看。你不需要留在原页面等任务跑完。',
          '任务中心按用户看到的产品类别理解任务，例如电影、剧集和动漫整季。它不用于查看动漫追更订阅、字幕上传、观看统计或管理动作。',
          '列表里会展示标题、类型、状态、阶段、来源、进度摘要和更新时间。列表不会展示完整 magnet 或完整日志，完整证据请进入任务详情看。',
        ],
      },
      {
        title: '怎么筛选任务',
        items: [
          '顶部可直接切换全部任务、进行中、需要处理和已完成。失败、已中断和部分完成都属于需要处理。',
          '按类型筛选可以聚焦电影、剧集或动漫整季。按来源筛选可以区分手动磁力和发布资源来源。',
          '搜索框适合按标题、发布标题或 magnet hash 找回历史任务。页面不会持续自动轮询，需要时可手动刷新。',
        ],
      },
      {
        title: '怎么看状态和阶段',
        items: [
          '等待中：任务已经创建，正在等待对应执行器处理，不代表没有提交成功。',
          '已提交：任务已经提交给 OpenList，后续等待离线下载状态变化。',
          '下载中：OpenList 正在离线下载。如果长时间没有进展，可能需要后续检查来源是否死种。',
          '整理中：下载完成后，系统正在整理正片、字幕和目标目录。下载完成不等于入库已经完成。',
          '已完成：任务成功收束，可以去媒体库查看结果。',
          '部分完成：有内容入库成功，但仍有跳过或失败内容，需要进入详情确认。',
          '失败：任务没有完成，优先看错误信息和最后的 WARN/ERROR 日志。',
          '已中断：通常是服务重启或执行被打断，需要通过恢复动作重新创建任务尝试。',
        ],
      },
      {
        title: '日志应该怎么看',
        items: [
          '日志是任务执行过程的证据，不要求普通用户逐行排查。',
          '优先看当前状态、当前阶段、错误消息和最后几条 WARN/ERROR。它们通常足够判断任务卡在提交、下载还是整理。',
          '如果任务仍在进行中，详情页可能持续刷新；任务到达终态后，再根据状态决定是否需要恢复。',
        ],
      },
    ],
  },
  {
    id: 'recovery',
    eyebrow: '需要处理',
    title: '处理失败任务',
    summary:
      '失败、中断和部分完成都需要你检查任务详情，再选择合适的恢复方式。',
    bullets: [
      '发布资源来源任务可以重新选择发布资源，也可以手动提供 magnet。',
      '手动磁力任务可以沿用原 magnet 再试一次，也可以换新 magnet。',
      '重试会创建新的任务尝试，原任务日志不会被覆盖。',
    ],
    blocks: [
      {
        title: '哪些任务需要处理',
        items: [
          '失败表示任务没有完成，需要看失败阶段和错误信息。',
          '已中断通常表示任务执行被打断，例如服务重启后未完成的任务，需要重新创建一次任务尝试。',
          '部分完成表示有内容已经成功，但仍有跳过或失败，不要直接当成完全完成。',
        ],
      },
      {
        title: '发布资源来源任务怎么恢复',
        items: [
          '如果原发布资源死种、标题不合适或下载来源失效，可以从任务详情重新选择发布资源。',
          '如果发布搜索结果仍然不理想，也可以改为手动提供 magnet，作为同一次入库意图下的新下载来源。',
          '重新选择发布资源或手动提供 magnet 都会创建新的任务尝试，原任务的状态、来源和日志会保留。',
        ],
      },
      {
        title: '手动磁力任务怎么恢复',
        items: [
          '如果你判断只是临时网络或 OpenList 问题，可以沿用原 magnet 再试一次。',
          '如果原 magnet 可能死种、内容错误或不完整，应替换为新的 magnet。',
          '提交新尝试前，先确认媒体类型、标题、季度和 magnet 内容，避免把错误来源再次提交。',
        ],
      },
      {
        title: '任务尝试链是什么',
        items: [
          '任务重试不会复活或改写原任务，而是创建一个新的任务尝试。',
          '任务尝试链用于把同一个入库意图下的第一次、第二次和后续尝试串起来。这样你可以回看每次用了哪个来源、在哪个阶段失败或成功。',
          '看到多个尝试时，优先看当前尝试的状态；需要追溯原因时，再回看前一次失败尝试的错误和日志。',
        ],
      },
    ],
  },
  {
    id: 'subtitles',
    eyebrow: '入库后',
    title: '补充字幕',
    summary:
      '字幕管理会把上传文件关联到电影或剧集源目录，按目标视频自动重命名，并触发 AutoSymlink 刷新。',
    bullets: [
      '支持 ZIP、SRT、ASS、SUP，单个上传文件最大 50MB。',
      '当前以手动搜索并指定库项目为准；智能自动匹配仍是演示入口。',
      '剧集关联后还要选择目标季，上传结果可在最近处理和右侧日志中追踪。',
    ],
    relatedModules: [
      {
        moduleId: 'external',
        title: '还没有合适的字幕文件？',
        description: '前往外部资源入口查看字幕网站导航。',
      },
    ],
    figures: [
      {
        src: '/docs/subtitles-workspace-current.jpg',
        alt: 'MediaNexus 字幕管理页面，展示字幕上传区域、关联库中项目搜索和上传日志',
        caption:
          '当前字幕工作区包含文件上传、库项目关联、上传日志、最近处理和媒体库刷新。右侧日志会显示解析、目标检查、命名、上传和等待 AS 等阶段。',
      },
      {
        src: '/docs/subtitles-association-current.jpg',
        alt: 'MediaNexus 字幕管理搜索盗梦空间并展示库项目关联候选',
        caption:
          '真实搜索“盗梦空间”的关联结果。请根据标题、原始标题、年份和媒体类型选择正确条目，不要只看关键词相似。',
      },
    ],
    blocks: [
      {
        title: '为什么还要手动字幕',
        items: [
          'OpenList 入库负责把视频文件整理进媒体库，不保证发布资源一定自带合适中文字幕。',
          '有些发布标题看起来质量很好，但可能没有中文、字幕语言不对，或字幕时间轴和实际文件不匹配。',
          '发布标题里出现“中文字幕”也不代表一定适配当前视频版本，MediaNexus 不会凭空生成或替换字幕。',
        ],
      },
      {
        title: '完整操作步骤',
        items: [
          '先选择一个 ZIP、SRT、ASS 或 SUP 文件。上传区会显示文件名与体积，但此时还没有提交。',
          '在关联库中项目里搜索电影或电视剧，核对标题、原始标题、年份和类型后选择条目。当前应保持手动指定项目，不要把演示中的智能自动匹配当成正式能力。',
          '如果选择的是剧集，继续选择目标季。最后点击上传并处理，系统才会接收文件并开始后台流程。',
        ],
      },
      {
        title: '可以从哪里找字幕',
        items: [
          '独立的“外部资源入口”模块集中列出了 SubHD、射手网(伪) ASSRT 等字幕网站，适合在入库后发现缺少中文字幕、字幕语言不对或时间轴不匹配时再去查找。',
          '下载字幕时请核对片名、年份、季集、版本组、片长和帧率。字幕文件即使语言正确，也可能因为片源版本不同而时间轴错位。',
          'MediaNexus 的字幕管理负责把你上传的字幕关联到正确媒体并放到目标位置，不负责自动判断外部字幕是否一定匹配当前视频。',
        ],
      },
      {
        title: '等待 AS 怎么理解',
        items: [
          '后台会依次解析上传文件、检查目标目录、选择目标视频作为命名基准、规划文件名、上传字幕并触发 AutoSymlink。',
          '等待 AS 表示字幕文件已经写入目标位置，正在等待 AutoSymlink 后续迁移。',
          '它不是上传失败，也不代表字幕马上会在播放器中出现。请给后续处理一点时间，再回到播放器确认。',
          '如果最终仍然没有出现字幕，再检查关联条目、季数、文件名和字幕内容是否正确。',
        ],
      },
      {
        title: '最近处理、日志和媒体库刷新',
        items: [
          '最近处理会列出文件名、识别语言、关联项目、状态和时间。点击记录可以切换右侧日志，查看该次上传的具体阶段。',
          '失败时优先看日志中的最后一个阶段和错误信息；等待 AS 则表示 MediaNexus 侧上传已完成。',
          '库概览可以选择一个 Emby 媒体库单独刷新，不会影响其他媒体库。只有确认需要立即同步时再执行刷新。',
        ],
      },
    ],
  },
  {
    id: 'external-resources',
    eyebrow: '站外导航',
    title: '字幕、BT / 磁力与弹幕源',
    summary:
      '当站内发布搜索没有合适结果、入库后需要补充字幕，或播放器支持添加弹幕源时，可以从这里查看对应的第三方网站与接口。',
    bullets: [
      'BT / 磁力网站适合作为站内发布搜索之外的补充入口。',
      '字幕网站适合在视频已入库但缺少合适字幕时使用。',
      '部分播放器允许手动添加弹幕接口，具体入口和支持情况以播放器说明为准。',
      '外部站点的内容与可用性由对应网站提供，使用前请自行核对作品和版本。',
    ],
    notice:
      '部分播放器支持为视频添加弹幕。以下分享的弹幕源以及图标源均来自互联网，不负责维护，一切问题请咨询对应服务商！',
    blocks: [
      {
        title: '从找资源与入库过来',
        items: [
          '优先使用 MediaNexus 的资源搜索和发布资源选择；只有没有合适候选，或你已经知道准确资源时，再使用外部 BT / 磁力网站。',
          '复制 magnet 后回到手动磁力入库，选择媒体类别并绑定正确的库项目再提交。',
        ],
      },
      {
        title: '从字幕管理过来',
        items: [
          '下载前核对片名、年份、季集、版本组、片长和帧率，避免字幕时间轴与当前视频不匹配。',
          '准备好 ZIP、SRT、ASS 或 SUP 文件后，回到字幕管理手动关联正确的库项目并上传。',
        ],
      },
      {
        title: '为播放器添加弹幕源',
        items: [
          '先确认当前播放器是否支持自定义弹幕接口，再把下方完整地址填写到播放器对应位置。不同播放器的入口、格式和兼容性可能不同。',
          '弹幕接口属于独立第三方服务，不由 MediaNexus 提供或维护；接口失效、内容异常或使用问题请直接咨询对应服务商。',
        ],
      },
    ],
    externalResourceGroups: [
      {
        title: '字幕寻找',
        resources: [
          {
            name: 'SubHD',
            description: '查找电影、剧集和动漫字幕，下载前请核对版本与时间轴。',
            href: 'https://subhd.tv/',
          },
          {
            name: '射手网(伪) ASSRT',
            description: '补充查找字幕，下载前请核对片名、季集、片长与帧率。',
            href: 'https://assrt.net/',
          },
        ],
      },
      {
        title: 'BT / 磁力寻找',
        resources: [
          {
            name: 'SeedHub',
            description: '查找 BT / 磁力资源，提交前请确认作品、季度和清晰度。',
            href: 'https://www.seedhub.cc/',
          },
          {
            name: 'Pomo',
            description: '补充查找 BT / 磁力资源，使用前请自行核对来源与内容。',
            href: 'https://pomo.mom/',
          },
        ],
      },
      {
        title: '弹幕源',
        wide: true,
        resources: [
          {
            name: 'DanDanplay',
            description: '弹弹 play 提供的弹幕 API，复制后填写到播放器。',
            href: 'https://www.dandanplay.com/',
            endpoint: 'https://api.dandanplay.net',
          },
          {
            name: 'LogVar 弹幕 API',
            description: '第三方弹幕 API，复制后填写到播放器。',
            href: 'https://github.com/huangxd-/danmu_api',
            endpoint:
              'https://danmu.iyo.us.ci/theft-dastardly-prognosis-hula-age',
          },
          {
            name: 'wangziyang.top',
            description: '第三方弹幕接口。',
            href: 'https://danmu.wangziyang.top/020116',
            endpoint: 'https://danmu.wangziyang.top/020116',
          },
          {
            name: 'appp.pp.ua',
            description: '第三方弹幕接口。',
            href: 'https://dm.appp.pp.ua/danmuapi',
            endpoint: 'https://dm.appp.pp.ua/danmuapi',
          },
          {
            name: 'liuuu.top',
            description: '第三方弹幕接口。',
            href: 'https://dm.liuuu.top/99',
            endpoint: 'https://dm.liuuu.top/99',
          },
          {
            name: 'bbbrb.com',
            description: '第三方弹幕接口。',
            href: 'https://Dm.bbbrb.com/luosen',
            endpoint: 'https://Dm.bbbrb.com/luosen',
          },
          {
            name: '6565n.xyz',
            description: '第三方弹幕接口。',
            href: 'https://dmapi.6565n.xyz/87654321',
            endpoint: 'https://dmapi.6565n.xyz/87654321',
          },
          {
            name: 'dmfl.us.ci',
            description: '第三方弹幕接口。',
            href: 'https://dmfl.us.ci',
            endpoint: 'https://dmfl.us.ci',
          },
        ],
      },
    ],
  },
  {
    id: 'faq',
    eyebrow: '常见问题',
    title: '常见误解',
    summary:
      '这些问题用于澄清使用过程中最容易混淆的边界。',
    bullets: [
      '追更订阅和 OpenList 入库任务是两条不同路径。',
      '任务列表用于快速判断概况，完整证据请进详情页查看。',
      '截图用于对照界面位置，具体操作以页面当前按钮和提示为准。',
    ],
    blocks: [
      {
        title: '为什么任务中心看不到追更订阅',
        items: [
          '追更订阅是 Ani-RSS 订阅路线，不是一次性的 OpenList 入库任务。',
          '任务中心展示的是 OpenList 入库任务，所以不会把追更订阅展示成入库日志。',
        ],
      },
      {
        title: '为什么任务列表不直接显示完整 magnet',
        items: [
          '列表用于快速判断任务概况，完整 magnet 和完整日志会让页面变得很难扫读。',
          '需要排查来源时，进入任务详情查看来源信息、错误和日志证据。',
        ],
      },
    ],
  },
]

function ConnectionInfoSection({
  hasCopiedLine,
  isAuthenticated,
  onCopyLine,
}: {
  hasCopiedLine: boolean
  isAuthenticated: boolean
  onCopyLine: () => void
}) {
  const [credential, setCredential] = useState<EmbyCredential | null>(null)
  const [credentialStatus, setCredentialStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [credentialError, setCredentialError] = useState<string | null>(null)
  const [copiedCredentialField, setCopiedCredentialField] = useState<
    'username' | 'password' | null
  >(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setCredential(null)
      setCredentialStatus('idle')
      setCredentialError(null)
      return
    }

    const controller = new AbortController()
    setCredentialStatus('loading')
    setCredentialError(null)
    void getCurrentEmbyCredential(controller.signal)
      .then((data) => {
        setCredential(data)
        setCredentialStatus('success')
      })
      .catch((error) => {
        if (isJavaRequestCanceledError(error)) {
          return
        }
        setCredentialStatus('error')
        setCredentialError(
          error instanceof Error ? error.message : 'Emby 账号加载失败',
        )
      })

    return () => controller.abort()
  }, [isAuthenticated])

  async function copyCredentialField(
    field: 'username' | 'password',
    value: string,
  ) {
    try {
      await copyTextToClipboard(value)
      setCopiedCredentialField(field)
      setCredentialError(null)
    } catch {
      setCredentialError('复制失败，请手动选择并复制。')
    }
  }

  return (
    <section
      className="mt-8 scroll-mt-8 border-y border-slate-200 py-8"
      id="connection-info"
    >
      <h2 className="text-xl font-semibold text-slate-950">线路与账号</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        MediaNexus 当前仅提供一条播放线路。所有播放器都使用同一组服务器信息，无需在每个平台重复查看。
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {isAuthenticated ? (
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              播放线路
            </p>
            <code className="mt-3 block select-all break-all rounded-xl bg-white/10 px-4 py-3 text-sm text-white">
              {PLAYBACK_LINE}
            </code>
            <button
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onClick={onCopyLine}
              type="button"
            >
              {hasCopiedLine ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Copy aria-hidden="true" className="h-4 w-4" />
              )}
              {hasCopiedLine ? '已复制' : '复制完整线路'}
            </button>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 text-xs">
              {[
                ['协议', 'HTTP'],
                ['端口', '8096'],
                ['服务器地址', '107.172.224.11'],
                ['路径', '留空'],
              ].map(([term, detail]) => (
                <div key={term}>
                  <dt className="text-slate-400">{term}</dt>
                  <dd className="mt-1 break-all font-mono text-white">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
              <LockKeyhole aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-950">
              登录后查看播放线路
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              登录 MediaNexus 后，这里会显示服务器地址、协议和端口。
            </p>
            <Link
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
              state={{
                from: {
                  pathname: '/help',
                  search: '',
                  hash: '#player-access',
                },
              }}
              to="/login"
            >
              登录查看线路
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!isAuthenticated ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
              <LockKeyhole aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-950">
              登录后查看 Emby 账号
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              登录 MediaNexus 后，这里会显示你的 Emby 用户名和托管密码。
            </p>
          </div>
        ) : credentialStatus === 'loading' ? (
          <div className="flex min-h-56 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载 Emby 账号
          </div>
        ) : credential?.managed && credential.username && credential.password ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Emby 账号
            </p>
            <h3 className="mt-3 text-base font-semibold text-slate-950">
              使用以下凭据登录播放器
            </h3>
            <div className="mt-4 space-y-3">
              {[
                ['username', '用户名', credential.username],
                ['password', '密码', credential.password],
              ].map(([field, label, value]) => (
                <div
                  className="rounded-xl bg-slate-50 p-3"
                  key={field}
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <code className="select-all break-all font-mono text-sm font-semibold text-slate-950">
                      {value}
                    </code>
                    <button
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950"
                      onClick={() =>
                        void copyCredentialField(
                          field as 'username' | 'password',
                          value,
                        )
                      }
                      type="button"
                    >
                      {copiedCredentialField === field ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedCredentialField === field ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Emby 密码由 MediaNexus 托管。如需排查权限，请联系管理员。
            </p>
            {credentialError ? (
              <p className="mt-3 text-sm text-rose-600" role="alert">
                {credentialError}
              </p>
            ) : null}
          </div>
        ) : credentialStatus === 'error' ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <h3 className="text-base font-semibold text-rose-900">
              Emby 账号加载失败
            </h3>
            <p className="mt-2 text-sm leading-6 text-rose-700">
              {credentialError}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-950">
              历史 Emby 账号
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              你的账号创建于自动开通功能之前，无需补全或迁移。现有 Emby 登录方式保持不变。
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function PlayerAccessSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [hasCopiedLine, setHasCopiedLine] = useState(false)

  async function handleCopyLine() {
    try {
      await copyTextToClipboard(PLAYBACK_LINE)
      setHasCopiedLine(true)
    } catch {
      setHasCopiedLine(false)
    }
  }

  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-[0_18px_40px_rgba(15,23,42,0.035)] sm:px-8 sm:py-10"
      id="module-devices"
    >
      <span className="block scroll-mt-8" id="player-access" />
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
        设备与播放
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        在各个设备上观看
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
        选择设备对应的播放器，从官方商店下载安装，再把登录后显示的线路手动添加为
        Emby 服务器。不同播放器的按钮位置略有差异，但需要填写的信息相同。
      </p>
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
        <p className="font-semibold">播放前提醒</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            播放线路需要科学上网访问。如果出现加载缓慢或卡顿，请先检查当前是否使用香港节点；不推荐香港节点，建议切换其他可用地区节点后重试。
          </li>
          <li>
            推荐播放器均为第三方应用，可能存在买断、订阅或应用内购买；相关费用由应用商店和开发者收取，与
            MediaNexus 无关。
          </li>
        </ul>
      </div>

      <ConnectionInfoSection
        hasCopiedLine={hasCopiedLine}
        isAuthenticated={isAuthenticated}
        onCopyLine={handleCopyLine}
      />

      <section className="scroll-mt-8 pt-10" id="device-overview">
        <h2 className="text-xl font-semibold text-slate-950">选择你的设备</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Windows 和 Android 各保留一个推荐选择；macOS / iOS
          同时提供免费的 Lenna 和功能更丰富的 SenPlayer。
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {playerDownloads.map((player) => {
            const PlayerIcon = player.icon

            return (
              <a
                className="group rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                href={`#${player.id}-guide`}
                key={player.id}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
                  <PlayerIcon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {player.platform}
                </span>
                <span className="mt-1 flex items-center gap-2 font-semibold text-slate-950">
                  {player.name}
                  {player.badge ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {player.badge}
                    </span>
                  ) : null}
                </span>
              </a>
            )
          })}
        </div>
      </section>

      <section
        className="scroll-mt-8 border-t border-slate-200 pt-10 mt-10"
        id="setup-flow"
      >
        <h2 className="text-xl font-semibold text-slate-950">通用接入流程</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ['01', '下载播放器', '从对应设备的官方应用商店完成安装。'],
            ['02', '添加服务器', '在播放器中找到添加服务器或添加 Emby 的入口。'],
            ['03', '填写线路', '复制顶部线路；若播放器拆分字段，请按协议、地址和端口分别填写。'],
            ['04', '登录媒体库', '保存服务器，再使用你的 Emby 账号登录。'],
          ].map(([number, title, description]) => (
            <div className="flex gap-4 rounded-2xl bg-slate-50 p-4" key={number}>
              <span className="font-mono text-sm font-semibold text-sky-700">
                {number}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {playerDownloads.map((player) => {
        const PlayerIcon = player.icon

        return (
          <section
            className="mt-10 scroll-mt-8 border-t border-slate-200 pt-10"
            id={`${player.id}-guide`}
            key={player.id}
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {player.platform}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-950">
                    {player.name}
                  </h2>
                  {player.badge ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {player.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {player.description}
                </p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <PlayerIcon aria-hidden="true" className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
              <div>
                <a
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                  href={player.href}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  从 {player.storeName} 下载
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </a>
                <ol className="mt-6 space-y-4">
                  {player.entrySteps.map((step, index) => (
                    <li className="flex gap-3 text-sm leading-6" key={step}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {index + 1}
                      </span>
                      <span className="text-slate-600">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-3">
                <ZoomableImage
                  alt={player.screenshotAlt}
                  className="mx-auto block max-h-[560px] w-full rounded-xl object-contain"
                  src={player.screenshotSrc}
                />
                <figcaption className="px-2 pb-1 pt-3 text-center text-xs leading-5 text-slate-500">
                  {player.name} 添加服务器界面截图
                </figcaption>
              </figure>
            </div>
          </section>
        )
      })}
    </article>
  )
}

function ExternalResourceGroups({
  groups,
}: {
  groups: NonNullable<DocSection['externalResourceGroups']>
}) {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null)

  async function copyEndpoint(endpoint: string) {
    await copyTextToClipboard(endpoint)
    setCopiedEndpoint(endpoint)
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
          <Library aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            常用站点
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            按用途选择对应网站，并自行核对片名、年份、季度、版本和字幕时间轴。
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <div
            className={`rounded-2xl bg-white p-4 ${
              group.wide ? 'lg:col-span-2' : ''
            }`}
            key={group.title}
          >
            <h4 className="text-sm font-semibold text-slate-950">
              {group.title}
            </h4>
            <div
              className={`mt-3 grid gap-3 ${
                group.wide ? 'md:grid-cols-2' : ''
              }`}
            >
              {group.resources.map((resource) => (
                <div
                  className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  key={resource.name}
                >
                  {resource.endpoint ? (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <span>
                          <span className="block text-sm font-semibold text-slate-950">
                            {resource.name}
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-slate-600">
                            {resource.description}
                          </span>
                        </span>
                        <button
                          aria-label={`复制 ${resource.name} 弹幕源地址`}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                          onClick={() => {
                            const endpoint = resource.endpoint
                            if (endpoint) void copyEndpoint(endpoint)
                          }}
                          type="button"
                        >
                          {copiedEndpoint === resource.endpoint ? (
                            <Check aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : (
                            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                          )}
                          {copiedEndpoint === resource.endpoint
                            ? '已复制'
                            : '复制地址'}
                        </button>
                      </div>
                      <code className="mt-3 block select-all break-all rounded-lg bg-slate-100 px-2.5 py-2 text-xs leading-5 text-slate-700">
                        {resource.endpoint}
                      </code>
                    </>
                  ) : (
                    <>
                      <a
                        className="group flex items-start justify-between gap-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                        href={resource.href}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        <span className="text-sm font-semibold text-slate-950 group-hover:text-sky-700">
                          {resource.name}
                        </span>
                        <ExternalLink
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-sky-700"
                        />
                      </a>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {resource.description}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type OutlineItem = {
  id: string
  title: string
  depth: 1 | 2
}

const deviceOutlineItems: OutlineItem[] = [
  { id: 'connection-info', title: '线路与账号', depth: 1 },
  { id: 'device-overview', title: '选择你的设备', depth: 1 },
  { id: 'setup-flow', title: '通用接入流程', depth: 1 },
  { id: 'windows-guide', title: 'Windows · Hills Lite', depth: 1 },
  { id: 'lenna-guide', title: 'macOS / iOS · Lenna', depth: 1 },
  { id: 'apple-guide', title: 'macOS / iOS · SenPlayer', depth: 1 },
  { id: 'android-guide', title: 'Android · Yamby', depth: 1 },
]

function getModuleIdFromHash(hash: string) {
  const target = hash.replace(/^#/, '')
  const directModule = guideModules.find(
    (module) => target === `module-${module.id}`,
  )

  if (directModule) return directModule.id

  if (
    target === 'player-access' ||
    deviceOutlineItems.some((item) => item.id === target)
  ) {
    return 'devices'
  }

  const matchingModule = guideModules.find((module) =>
    module.sectionIds.some(
      (sectionId) =>
        target === sectionId || target.startsWith(`${sectionId}-part-`),
    ),
  )

  return matchingModule?.id ?? 'overview'
}

function getOutlineItems(
  module: GuideModule,
  sections: DocSection[],
): OutlineItem[] {
  if (module.id === 'devices') return deviceOutlineItems

  return sections.flatMap((section) => [
    { id: section.id, title: section.title, depth: 1 as const },
    ...(section.benefitGroups?.map((group, index) => ({
      id: `${section.id}-benefit-${index + 1}`,
      title: group.title,
      depth: 2 as const,
    })) ?? []),
    ...(section.workflowSteps
      ? [
          {
            id: `${section.id}-workflow`,
            title: '完整使用流程',
            depth: 2 as const,
          },
        ]
      : []),
    ...(section.blocks?.map((block, index) => ({
      id: `${section.id}-part-${index + 1}`,
      title: block.title,
      depth: 2 as const,
    })) ?? []),
  ])
}

function DocumentationSection({
  onSelectModule,
  section,
}: {
  onSelectModule: (moduleId: string) => void
  section: DocSection
}) {
  return (
    <section
      className="scroll-mt-8 border-b border-slate-200 py-10 last:border-b-0 last:pb-0"
      id={section.id}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {section.eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {section.title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {section.summary}
      </p>
      {section.bullets.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {section.bullets.map((bullet) => (
            <li
              className="flex gap-3 text-sm leading-6 text-slate-600"
              key={bullet}
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-700" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {section.benefitGroups ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {section.benefitGroups.map((group, index) => (
            <div
              className="scroll-mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6"
              id={`${section.id}-benefit-${index + 1}`}
              key={group.title}
            >
              <h3 className="text-lg font-semibold text-slate-950">
                {group.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {group.summary}
              </p>
              <ul className="mt-5 space-y-3">
                {group.items.map((item) => (
                  <li className="flex gap-3 text-sm leading-6 text-slate-600" key={item}>
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm ring-1 ring-slate-200">
                      <Check aria-hidden="true" className="h-3 w-3" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {section.notice ? (
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold leading-7 text-amber-950">
          {section.notice}
        </p>
      ) : null}

      {section.workflowSteps ? (
        <div
          className="mt-10 scroll-mt-8 border-t border-slate-200 pt-10"
          id={`${section.id}-workflow`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
            建议顺序
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            按照这条路径开始
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            每一步只保留当前需要做的事情；需要具体按钮位置和截图时，再进入对应模块查看完整说明。
          </p>
          <ol className="mt-8 space-y-0">
            {section.workflowSteps.map((step, index) => (
              <li
                className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-4 pb-6 last:pb-0"
                key={step.moduleId}
              >
                {index < section.workflowSteps!.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-[17px] top-9 w-px bg-slate-200"
                  />
                ) : null}
                <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sm font-bold text-sky-800 shadow-sm">
                  {index + 1}
                </span>
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 transition hover:border-slate-300 hover:bg-slate-50">
                  <h4 className="text-base font-semibold text-slate-950">
                    {step.title}
                  </h4>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {step.description}
                  </p>
                  <button
                    className="group mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                    onClick={() => onSelectModule(step.moduleId)}
                    type="button"
                  >
                    查看“{step.moduleTitle}”完整说明
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition group-hover:translate-x-0.5"
                    />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {section.relatedModules ? (
        <div
          className={`mt-6 grid gap-3 ${
            section.relatedModules.length > 1 ? 'sm:grid-cols-2' : ''
          }`}
        >
          {section.relatedModules.map((relatedModule) => (
            <button
              className="group flex w-full items-center justify-between gap-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-5 text-left transition hover:border-sky-200 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              key={relatedModule.moduleId}
              onClick={() => onSelectModule(relatedModule.moduleId)}
              type="button"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  {relatedModule.title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  {relatedModule.description}
                </span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-sky-700 transition group-hover:translate-x-0.5"
              />
            </button>
          ))}
        </div>
      ) : null}

      {section.figures ? (
        <div className="mt-7 grid gap-5">
          {section.figures.map((figure) => (
            <figure
              className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
              key={figure.src}
            >
              <ZoomableImage
                alt={figure.alt}
                className="block w-full object-cover"
                src={figure.src}
              />
              <figcaption className="border-t border-slate-200 px-4 py-3 text-sm leading-6 text-slate-600">
                {figure.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {section.blocks ? (
        <div className="mt-8 space-y-8">
          {section.blocks.map((block, index) => (
            <div
              className="scroll-mt-8"
              id={`${section.id}-part-${index + 1}`}
              key={block.title}
            >
              <h3 className="text-base font-semibold text-slate-950">
                {block.title}
              </h3>
              <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
                {block.items.map((item) => (
                  <p className="text-sm leading-7 text-slate-600" key={item}>
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {section.externalResourceGroups ? (
        <ExternalResourceGroups groups={section.externalResourceGroups} />
      ) : null}

      {section.closingNote ? (
        <p className="mt-8 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold leading-7 text-white">
          {section.closingNote}
        </p>
      ) : null}
    </section>
  )
}

export function DocsPage() {
  const { isAuthenticated, status: authStatus } = useAuth()
  const [activeModuleId, setActiveModuleId] = useState(() =>
    getModuleIdFromHash(
      typeof window === 'undefined' ? '' : window.location.hash,
    ),
  )

  useEffect(() => {
    function handleHashChange() {
      setActiveModuleId(getModuleIdFromHash(window.location.hash))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const activeModule =
    guideModules.find((module) => module.id === activeModuleId) ??
    guideModules[0]!
  const activeSections = docSections.filter((section) =>
    activeModule.sectionIds.includes(section.id),
  )
  const outlineItems = getOutlineItems(activeModule, activeSections)

  function selectModule(moduleId: string) {
    setActiveModuleId(moduleId)
    window.history.pushState(null, '', `#module-${moduleId}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-slate-950">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <Link
            className="inline-flex items-center gap-3 text-slate-950"
            to="/"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
              <BookOpen className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">MediaNexus</span>
              <span className="block text-xs text-slate-500">使用说明</span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-3 text-sm font-medium">
            {authStatus === 'unauthenticated' ? (
              <Link
                className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                to="/login"
              >
                登录
              </Link>
            ) : null}
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-white transition hover:bg-slate-800"
              to="/resources"
            >
              进入应用
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-5 py-8 md:px-8">
        <div className="mb-5 lg:hidden">
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
            htmlFor="help-module"
          >
            帮助模块
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            id="help-module"
            onChange={(event) => selectModule(event.target.value)}
            value={activeModule.id}
          >
            {guideModules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_190px]">
          <aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              使用帮助
            </p>
            <nav aria-label="帮助模块" className="mt-3 space-y-1">
              {guideModules.map((module) => {
                const ModuleIcon = module.icon
                const isActive = module.id === activeModule.id

                return (
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                      isActive
                        ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
                    }`}
                    key={module.id}
                    onClick={() => selectModule(module.id)}
                    type="button"
                  >
                    <ModuleIcon
                      aria-hidden="true"
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        isActive ? 'text-sky-700' : 'text-slate-400'
                      }`}
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {module.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        {module.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className="min-w-0">
            {activeModule.id === 'devices' ? (
              <PlayerAccessSection isAuthenticated={isAuthenticated} />
            ) : (
              <article
                className="rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-[0_18px_40px_rgba(15,23,42,0.035)] sm:px-8 sm:py-10"
                id={`module-${activeModule.id}`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  MediaNexus 使用帮助
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {activeModule.title}
                </h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {activeModule.description}
                </p>
                <div className="mt-10 border-t border-slate-200">
                  {activeSections.map((section) => (
                    <DocumentationSection
                      key={section.id}
                      onSelectModule={selectModule}
                      section={section}
                    />
                  ))}
                </div>
              </article>
            )}
          </div>

          <aside className="hidden xl:sticky xl:top-6 xl:block xl:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              本页导航
            </p>
            <nav aria-label="本页导航" className="mt-4 border-l border-slate-200">
              {outlineItems.map((item) => (
                <a
                  className={`block border-l border-transparent py-1.5 text-xs leading-5 text-slate-500 transition hover:border-slate-950 hover:text-slate-950 ${
                    item.depth === 2 ? 'pl-5' : 'pl-3 font-medium'
                  }`}
                  href={`#${item.id}`}
                  key={item.id}
                >
                  {item.title}
                </a>
              ))}
            </nav>
          </aside>
        </div>
      </div>
    </main>
  )
}
