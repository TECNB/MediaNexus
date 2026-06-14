<!-- 本文件为 Claude Code 的项目规则，内容镜像自 AGENTS.md（Codex/通用规则的来源）。两者要求保持一致；修改规则时请同步更新 AGENTS.md。 -->
<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

On Claude Code, Trellis context is auto-injected via the SessionStart / UserPromptSubmit hooks in `.claude/`, and Trellis skills under `.claude/skills/` are auto-invoked. Equivalent helpers for other tools live in `.agents/skills/` (reusable Trellis skills) and `.codex/agents/` (optional custom subagents).

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update` (note: `trellis update` currently rewrites this block in AGENTS.md only — keep this copy in sync manually).

<!-- TRELLIS:END -->

## Commit Rules

- This is a hard requirement, not a preference: every commit in this repository must use `TECNB <3489044730@qq.com>`.
- Before creating, amending, rebasing, cherry-picking, or force-pushing commits, run or otherwise verify `git config user.name` and `git config user.email`.
- Commit messages must use Conventional Commit prefixes and Chinese descriptions.
- Keep the prefix in English and the summary in Chinese, for example:
  - `feat: 接入动漫 Mikan 搜索`
  - `fix: 修复动漫搜索错误态`
  - `chore: 归档 Trellis 任务`
- Forbidden: English summaries after the prefix, such as `feat: connect anime mikan search` or `chore: ignore codex workspace notes`.
- If a recent commit violates these rules, fix it before pushing; if it has already been pushed, ask for approval and repair it with `git push --force-with-lease`.
