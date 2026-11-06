// Presentation only. Availability and values always come from the settings API.
export const connectionSections = [
  { label: '下载与媒体链路', groups: [
    { id: 'openlist', label: 'OpenList', description: '管理认证、离线工具、等待与重试策略。账号根路径在入库目标中管理。' },
    { id: 'clouddrive2', label: 'CloudDrive2', description: 'gRPC 连接、整理开关与文件可见性等待。既有路径映射只读。' },
    { id: 'autosymlink', label: 'AutoSymlink', description: '连接 Cookie、调用重试和通用扫描参数；账号任务关联由入库目标管理。' },
    { id: 'emby', label: 'Emby', description: '媒体库连接、权限模板、缓存与媒体维护参数。' },
  ] },
  { label: '搜索与整理', groups: [
    { id: 'tmdb', label: 'TMDB', description: '元数据 API、图片地址、读取 Token、语言与超时。' },
    { id: 'prowlarr', label: 'Prowlarr', description: '发布搜索连接与缓存；不改写上游索引器。' },
    { id: 'pansou', label: 'PanSou', description: '网盘搜索地址、用户名与密码、链接检查限制。' },
    { id: 'qas', label: '夸克 / QAS', description: '分别管理夸克 Cookie 与 QAS Token，以及分享目录缓存和分类根目录。' },
    { id: 'smartstrm', label: 'SmartSTRM', description: '整理完成回调；含认证的回调地址按敏感值管理。' },
  ] },
  { label: '通知与订阅', groups: [
    { id: 'wecom', label: '企业微信', description: '应用身份、接收成员与通知跳转地址；连接检查不发送消息。' },
    { id: 'anirss', label: 'Ani-RSS', description: '只读查看连接和可读取的追更位置，不修改订阅。' },
    { id: 'telegram-worker', label: 'Telegram Worker', description: '只读查看连接，不修改 Bot 绑定、收件箱或转发行为。' },
  ] },
]

export const systemSections = [{ label: '系统参数', groups: [
  { id: 'subtitle-upload', label: '字幕限制', description: '上传扩展名、上传与解压大小、条目和压缩比限制。' },
  { id: 'quota', label: '每日创建额度', description: '网站入库任务的每日创建额度。' },
  { id: 'deployment', label: '部署信息', description: '只读查看必要的部署状态，凭据和关键密钥不回显。' },
] }]
