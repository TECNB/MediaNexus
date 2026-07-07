# 调整字幕管理页面

## Goal

让字幕页面的标题和展示内容准确反映字幕管理用途，并移除无实际功能的快捷操作模块，同时更新已接入 AS 刷新后的用户文案。

## Requirements

- 页面主标题由“资源编目”改为“字幕管理”。
- 保留现有字幕上传、媒体关联、最近处理和日志能力。
- 移除右侧“快捷操作”卡片及其两个演示按钮。
- 清理仅由该卡片使用的图标和演示代码。
- 上传成功文案表达“已提交 AS 刷新并等待迁移”，不再暗示系统尚未触发 AS。

## Acceptance Criteria

- [x] `/subtitles` 页面主标题显示“字幕管理”。
- [x] 页面不再显示“快捷操作”、`Force Emby Scan` 或 `Clear Temp Cache`。
- [x] 右侧日志和库概览仍正常展示。
- [x] 上传成功反馈与后端 AS 提交语义一致。
- [x] 无未使用的 `Trash2` 或快捷操作演示逻辑。

## Definition of Done

- 代码审阅确认页面 JSX、导入和文案一致。
- 不运行全项目 typecheck、lint、test 或 build。

## Technical Approach

只修改字幕页面文件：更新 `PageContainer` 标题与描述，删除快捷操作 section，并将上传结果和 toast 文案改成 AS 刷新已提交后的准确表达。保留媒体搜索的演示回调，因为它仍由关联组件使用。

## Decision (ADR-lite)

**Context**: “资源编目”属于资源搜索语义；快捷操作卡片只有演示反馈且与字幕上传主流程无关。

**Decision**: 使用“字幕管理”作为页面标题，直接删除无功能卡片，不以新按钮替代。

**Consequences**: 页面信息层级更聚焦；库概览暂时保留，不扩大本次清理范围。

## Out of Scope

- 实现 Emby 扫描或缓存清理。
- 重做整个字幕页面布局。
- 修改字幕关联搜索或上传 API。
- 将字幕上传纳入统一任务中心。

## Technical Notes

- 页面文件：`src/pages/subtitles/index.tsx`。
- 相关规范：`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/quality-guidelines.md`。
