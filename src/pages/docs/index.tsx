import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react'

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
}

const docSections: DocSection[] = [
  {
    id: 'start',
    eyebrow: '开始前',
    title: '先理解 MediaNexus 做什么',
    summary:
      'MediaNexus 面向准备使用或已经在使用站点的普通用户，帮助你完成资源搜索、发布资源选择、OpenList 入库、任务跟踪和字幕补充。',
    bullets: [
      '这份说明面向普通用户的日常使用路径。',
      '重点覆盖资源入库、任务跟踪、失败恢复和字幕补充。',
      '后续章节会按“想完成什么任务”组织，方便你直接定位操作步骤。',
    ],
  },
  {
    id: 'find-media',
    eyebrow: '创建任务前',
    title: '找到想入库的影视',
    summary:
      '资源搜索是优先入口。你会先找到目录结果，再通过添加或查看更多选择具体发布资源。',
    bullets: [
      '目录结果用于确认电影、剧集或动漫条目。',
      '发布资源才是后续会解析 magnet 并创建入库任务的下载来源。',
      '电影选择清晰度；剧集和动漫整季还需要选择目标季。',
    ],
    figures: [
      {
        src: '/docs/resource-search.jpg',
        alt: 'MediaNexus 资源搜索页面，包含搜索框、电影电视剧动漫分类和最近入库任务',
        caption:
          '资源搜索是创建入库任务的优先入口。先选分类和搜索词，再从目录结果进入添加或查看更多。',
      },
      {
        src: '/docs/resource-search-inception-results.jpg',
        alt: 'MediaNexus 资源搜索页搜索盗梦空间后的电影卡片结果',
        caption:
          '输入具体片名后，先确认卡片上的标题、年份、海报和简介是否匹配，再选择分辨率并决定自动添加或查看更多。',
      },
    ],
    blocks: [
      {
        title: '什么时候从资源搜索开始',
        items: [
          '如果你还没有可靠 magnet，优先从资源搜索开始。它会先帮你确认电影、剧集或动漫条目，再围绕这个条目查找可下载发布资源。',
          '资源搜索会保留标题、年份、季度、清晰度和后续发布来源等上下文。后面进入任务中心时，这些信息也更容易帮助你判断任务来自哪里。',
        ],
      },
      {
        title: '电影怎么走',
        items: [
          '选择电影分类，输入电影名称，先确认卡片上的标题、年份和海报是不是你要找的作品。',
          '选择目标清晰度后，可以点击添加走自动发布选择，也可以点击查看更多进入发布资源选择。',
        ],
      },
      {
        title: '剧集怎么走',
        items: [
          '选择电视剧分类，输入剧名，先确认卡片上的剧集条目。',
          '剧集需要选择目标季，再选择清晰度。没有选季时不要急着提交，因为发布搜索需要知道你要入库哪一季。',
          '选择好目标季和清晰度后，再决定用添加快速确认，还是用查看更多手动挑发布资源。',
        ],
      },
    ],
  },
  {
    id: 'choose-release',
    eyebrow: '发布资源',
    title: '选择发布资源',
    summary:
      '添加是自动发布选择，查看更多是手动发布资源选择。两条路径都需要你在创建入库任务前确认来源。',
    bullets: [
      '添加会等待发布搜索并给出推荐候选，不会静默入库。',
      '查看更多用于检查更多候选，适合你想自己判断发布标题、体积、做种和动态范围时使用。',
      '发布搜索可能需要十几秒，慢时接近 30 秒。',
    ],
    figures: [
      {
        src: '/docs/resource-recommendation-series.jpg',
        alt: 'MediaNexus 剧集入库自动匹配资源推荐弹窗，展示多个候选、推荐依据和确认入库按钮',
        caption:
          '点击剧集入库后会先打开推荐确认弹窗，不会静默提交。这里可以对比推荐候选、推荐依据、体积、做种、动态范围、字幕风险和来源，再决定取消或确认入库。',
      },
      {
        src: '/docs/resource-publish-results.jpg',
        alt: 'MediaNexus 发布资源选择页展示盗梦空间的 Prowlarr 搜索结果和 HDR 筛选统计',
        caption:
          '点击查看更多后会进入发布资源选择页。这里可以按分辨率、Dolby Vision、HDR、SDR 等标签筛选，并对比体积、做种、下载、来源后再选择发布。',
      },
    ],
    blocks: [
      {
        title: '添加：自动发布选择',
        items: [
          '添加不是静默入库。点击后系统会围绕你选中的目录结果搜索发布资源，并返回推荐候选让你确认。',
          '确认弹窗里重点看发布标题、分辨率、动态范围标签、体积、做种数、索引器来源和是否有字幕风险。如果发布标题明显不对，取消后改用查看更多手动选择。',
          '推荐规则只需要理解到判断层面：系统会优先考虑有做种、分辨率匹配、标题相关、动态范围合适且健康度更好的发布资源。具体排序算法不需要用户记忆。',
        ],
      },
      {
        title: '查看更多：发布资源选择',
        items: [
          '查看更多适合你想检查多个候选时使用。页面会展示发布搜索计划返回的发布资源，并保留命中来源。',
          '如果你不确定自动推荐是否合适，可以在这里对比标题、大小、做种、动态范围和来源，再手动选择一个发布入库。',
          '发布资源选择页依赖你从资源搜索带入的上下文。如果刷新或直接打开时提示缺少资源信息，回到资源搜索重新进入即可。',
        ],
      },
      {
        title: '等待 Prowlarr 搜索',
        items: [
          '添加和查看更多都会触发发布搜索。系统可能会向多个发布索引器查询，通常需要十几秒，慢的时候可能接近 30 秒。',
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
      '手动磁力不会经过 Prowlarr 发布资源选择。',
      '你需要自己判断 magnet 是否对应正确片源。',
      '失败恢复时提供新 magnet，属于同一次入库意图下更换下载来源。',
    ],
    blocks: [
      {
        title: '为什么和资源搜索分开',
        items: [
          '资源搜索会帮你从目录结果进入发布资源选择，并保存发布标题、索引器、分辨率、动态范围等上下文，所以它更适合作为普通入库的默认入口。',
          '手动磁力更像兜底工具：你已经有可靠 magnet，或者发布搜索找不到合适资源，或者失败恢复时需要换一个下载来源。',
        ],
      },
      {
        title: '使用手动磁力前先确认',
        items: [
          '手动磁力不会经过 Prowlarr 发布资源选择，也不会替你判断发布标题、做种健康度或字幕风险。',
          '提交前请自己确认 magnet 对应的作品、季度、清晰度和文件内容。尤其是剧集和动漫整季，错误来源会直接影响后续整理结果。',
          '从失败任务里手动提供 magnet 时，它仍然是同一次入库意图下的恢复动作，不是孤立的新任务。',
        ],
      },
      {
        title: '可以从哪里找 magnet',
        items: [
          'SeedHub（https://www.seedhub.cc/）可以作为手动磁力来源之一，适合你已经明确知道要找哪部作品、哪一季、哪种清晰度时使用。',
          '从外部网站复制 magnet 前，请自己核对标题、年份、季度、集数、体积、字幕信息和做种情况。MediaNexus 只负责接收你提交的 magnet 并创建入库任务，不会替外部来源背书。',
          '如果你不确定来源是否可靠，优先回到资源搜索使用添加或查看更多，让系统保留发布标题、索引器、分辨率和动态范围等上下文。',
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
      '任务中心覆盖电影、剧集和动漫整季入库任务。',
      '列表用于快速判断状态；详情页用于查看阶段、来源、日志和任务尝试链。',
      '等待中、下载中、整理中、失败和部分完成等状态会在后续章节详细解释。',
    ],
    figures: [
      {
        src: '/docs/task-center.jpg',
        alt: 'MediaNexus 任务中心页面，展示状态筛选、类型筛选和入库任务列表',
        caption:
          '任务中心用于离开原入口后继续查看 OpenList 入库任务，列表重点展示状态、阶段、来源和进度摘要。',
      },
      {
        src: '/docs/task-detail.jpg',
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
          '按状态筛选可以快速找进行中、已完成或需要处理的任务。失败、已中断和部分完成都属于需要处理。',
          '按类型筛选可以聚焦电影、剧集或动漫整季。按来源筛选可以区分手动磁力和发布资源来源。',
          '搜索框适合按标题、发布标题或 magnet hash 找回历史任务。',
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
      '资源入库解决的是视频文件进入媒体库，不保证每个发布都自带合适中文字幕。',
    bullets: [
      '播放时没有字幕、语言不对或时间轴不匹配时，再去字幕管理处理。',
      '上传前需要搜索并关联电影或剧集。',
      '等待 AS 表示字幕已放到目标位置并等待后续处理。',
    ],
    figures: [
      {
        src: '/docs/subtitles.jpg',
        alt: 'MediaNexus 字幕管理页面，展示字幕上传区域、关联库中项目搜索和上传日志',
        caption:
          '字幕管理用于在入库后补充字幕。先上传字幕文件，再关联正确的电影或剧集项目。',
      },
    ],
    blocks: [
      {
        title: '为什么还要手动字幕',
        items: [
          'OpenList 入库负责把视频文件整理进媒体库，不保证发布资源一定自带合适中文字幕。',
          '有些发布标题看起来质量很好，但可能没有中文、字幕语言不对，或字幕时间轴和实际文件不匹配。',
          '自动推荐只会提示可能存在字幕风险，不会凭空生成或替换字幕。',
        ],
      },
      {
        title: '什么时候去字幕管理',
        items: [
          '播放时发现没有字幕、字幕语言不对、时间轴明显提前或延后，再去字幕管理处理。',
          '上传前先搜索并关联电影或剧集。剧集字幕还需要确认目标季，避免字幕放错位置。',
          '常见字幕文件可以是 srt、ass、sup，也可以上传包含字幕的 zip 包。',
        ],
      },
      {
        title: '可以从哪里找字幕',
        items: [
          'SubHD（https://subhd.tv/）可以作为字幕来源之一，适合在入库后发现缺少中文字幕、字幕语言不对或时间轴不匹配时再去查找。',
          '下载字幕时请核对片名、年份、季集、版本组、片长和帧率。字幕文件即使语言正确，也可能因为片源版本不同而时间轴错位。',
          'MediaNexus 的字幕管理负责把你上传的字幕关联到正确媒体并放到目标位置，不负责自动判断外部字幕是否一定匹配当前视频。',
        ],
      },
      {
        title: '等待 AS 怎么理解',
        items: [
          '等待 AS 表示字幕文件已经写入目标位置，正在等待后续媒体库或 AutoSymlink 侧处理。',
          '它不是上传失败，也不代表字幕马上会在播放器中出现。请给后续处理一点时间，再回到播放器确认。',
          '如果最终仍然没有出现字幕，再检查关联条目、季数、文件名和字幕内容是否正确。',
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

export function DocsPage() {
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
            <Link
              className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              to="/login"
            >
              登录
            </Link>
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

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 md:grid-cols-[260px_minmax(0,1fr)] md:px-8">
        <aside className="md:sticky md:top-6 md:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              目录
            </p>
            <nav className="mt-3 space-y-1">
              {docSections.map((section) => (
                <a
                  className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                  href={`#${section.id}`}
                  key={section.id}
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          <section className="rounded-2xl bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              User Guide
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              MediaNexus 公开使用说明
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              这份文档面向准备使用或已经在使用 MediaNexus 的普通用户。它会先建立完整阅读目录，
              后续按任务补齐资源搜索、发布资源选择、任务中心和字幕补充等说明。
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {['公开可读', '任务型目录', '普通用户端'].map((item) => (
                <div
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                  key={item}
                >
                  <CheckCircle2 className="h-4 w-4 text-slate-950" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          {docSections.map((section) => (
            <section
              className="scroll-mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.035)] md:p-8"
              id={section.id}
              key={section.id}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {section.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {section.summary}
              </p>
              <ul className="mt-5 space-y-3">
                {section.bullets.map((bullet) => (
                  <li
                    className="flex gap-3 text-sm leading-6 text-slate-600"
                    key={bullet}
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-950" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              {section.figures ? (
                <div className="mt-6 grid gap-4">
                  {section.figures.map((figure) => (
                    <figure
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      key={figure.src}
                    >
                      <img
                        alt={figure.alt}
                        className="block w-full object-cover"
                        loading="lazy"
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
                <div className="mt-6 grid gap-4">
                  {section.blocks.map((block) => (
                    <div
                      className="rounded-2xl bg-slate-50 p-4"
                      key={block.title}
                    >
                      <h3 className="text-sm font-semibold text-slate-950">
                        {block.title}
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {block.items.map((item) => (
                          <li
                            className="text-sm leading-6 text-slate-600"
                            key={item}
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
