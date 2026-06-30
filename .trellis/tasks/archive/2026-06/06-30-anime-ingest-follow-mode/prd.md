# 实现动漫整季入库与追更订阅切换

## Goal

在资源搜索的动漫分类中增加“整季入库 / 追更订阅”模式切换。整季入库完整复用电视剧目录搜索、季度选择、发布选择与 OpenList 入库流程；追更订阅保留现有 Ani-RSS 流程，让两种用户意图以清晰文案共存而不增加后端分支。

## Requirements

- 动漫分类显示“整季入库 / 追更订阅”双选分段控件，默认选中“整季入库”；电影和电视剧不显示。
- 整季入库使用现有 `searchSeries`、`getSeriesSeasons`、`MediaCard`、剧集发布选择和剧集入库逻辑，不过滤电视剧目录搜索结果。
- 整季入库仅覆盖剧集型动漫；动画电影继续走电影分类。
- 追更订阅完整保留现有 `searchAnime`、字幕组、订阅预览与 Ani-RSS 订阅逻辑。
- 模式说明文案：
  - 整季入库：`选择季度和清晰度，自动匹配或手动选择发布资源。`
  - 追更订阅：`选择字幕组，通过 Ani-RSS 订阅后续更新。`
- 模式切换保留搜索框输入，中止进行中的请求，清空搜索结果及两条流程的交互状态，不自动重新搜索。
- 离开动漫分类再返回时重置为“整季入库”。
- 发布选择、任务类型和任务日志继续沿用 `series` 语义，不新增动漫整季入库后端能力。

## Acceptance Criteria

- [x] 进入动漫分类时显示模式控件并默认选择“整季入库”。
- [x] 整季入库搜索调用电视剧目录搜索，展示 `MediaCard` 并加载季度。
- [x] 整季入库的添加、查看更多、确认、发布选择和入库完整复用电视剧流程。
- [x] 追更订阅仍展示 `AnimeCard`，字幕组、预览和订阅行为不变。
- [x] 模式切换保留输入词、清空两条流程的状态、中止请求且不自动搜索。
- [x] 离开动漫分类再返回时恢复“整季入库”。
- [x] 电影和电视剧分类的现有行为不变。
- [x] 资源页相关的最小范围验证通过。

## Definition of Done

- 资源页实现模式控件和按模式分流。
- 必要的资源页测试或最小范围静态检查通过。
- 外部产品 PRD 与领域词表保持为事实源。
- 不运行全项目构建、类型检查、Lint 或测试。

## Technical Approach

- 在 `ResourceSearchPage` 增加仅用于前端分流的动漫模式状态。
- 活跃搜索配置由分类和动漫模式共同决定；整季入库选择电视剧搜索配置，追更订阅选择动漫搜索配置。
- 搜索完成后按模式启动电视剧季度初始化或现有动漫卡片初始化。
- 搜索结果布局按当前模式选择电视剧媒体卡片布局或动漫卡片布局。
- 复用现有状态清理逻辑实现模式切换；不增加 API、路由媒体类型、任务类型或数据库结构。

## Decision (ADR-lite)

**Context**：动漫分类同时需要整季入库和持续追更，但现有系统已经分别具备完整的电视剧入库与 Ani-RSS 订阅能力。

**Decision**：模式只作为资源页的 UI 分流，不进入后端领域模型；整季入库完整复用电视剧链路，追更订阅完整保留动漫链路。

**Consequences**：实现范围集中在前端资源页，后续页面继续显示剧集语义；系统不识别缺集，也不提供动画电影或单集补全。

## Out of Scope

- 媒体库扫描、缺集识别、单集补全或自动模式判断。
- 动漫专用整季入库接口、任务类型、卡片、发布算法或数据库结构。
- 电视剧搜索结果的动画类型过滤。
- 动画电影入库。
- 修改发布选择页、任务中心或日志页的动漫文案。
- 跨分类或跨页面持久化模式。
- 修改现有 Ani-RSS 行为。

## Technical Notes

- 外部事实源：`/Users/tengenchang/Library/Mobile Documents/com~apple~CloudDocs/AI-Coding-Docs/Media/ResourceSearch/anime-season-ingest-follow-subscription-prd.md`
- 领域词表：`/Users/tengenchang/Library/Mobile Documents/com~apple~CloudDocs/AI-Coding-Docs/Media/CONTEXT.md`
- 主要实现文件：`src/pages/resources/index.tsx`
- 可能新增组件：`src/components/resources/anime-mode-switch.tsx`
- 不需要外部技术调研；所有能力和组件模式都已存在于仓库。

## Verification

- `eslint src/pages/resources/index.tsx src/components/resources/anime-mode-switch.tsx --report-unused-disable-directives --max-warnings 0`：通过。
- `git diff --check`：通过。
- 本地 Vite 服务启动成功；资源路由被登录页保护，应用内浏览器没有已登录会话，因此未执行登录后的可视化点击验证。
- 按项目约定未运行全项目构建、类型检查、Lint 或测试；仓库当前也没有前端测试套件。

## Spec Update Review

- 本次没有修改 API、数据结构、环境变量或跨层契约。
- 模式切换后的迟到响应保护继续使用现有 `latestRequestIdRef` 模式；`.trellis/spec/frontend/hook-guidelines.md` 已明确要求在搜索词、分类或模式变化时处理取消与过期响应，因此无需重复更新代码规范。
