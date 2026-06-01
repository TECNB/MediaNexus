# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Quality in this project means preserving existing working flows while adding small, understandable improvements. Feature tasks should be narrow, contract-aware, and reversible. The repository owner does not want full-project validation commands run by default.

---

## Forbidden Patterns

- Do not casually refactor existing pages outside the active task scope.
- Do not break or rename existing Python API calls while adding Java support.
- Do not change full-site styling, navigation, or layout as a side effect of feature work.
- Do not introduce large state management libraries, UI frameworks, or HTTP clients without an explicit architecture task.
- Do not add Java API wiring outside the Anime module during the first Java phase unless the task explicitly says so.
- Do not create extra project directories such as `docs/`, `notes/`, `test-results/`, or `task-logs/` unless requested.
- Do not run forbidden full-project commands by default: `tsc --noEmit`, `npm run typecheck`, package-wide lint/test/build commands, or equivalents.

---

## Required Patterns

- Read the relevant page, API module, and type file before editing.
- Keep API changes aligned with the agreed backend contract.
- Preserve all existing loading, empty, error, disabled, and success states touched by the task.
- Use the existing `@/*` alias, Tailwind, `cn`, and local UI primitives.
- Keep new code close to the feature it serves.
- Prefer the smallest scoped verification available when verification is necessary and allowed.
- For reviews, prioritize requirement fit, API contract consistency, obvious correctness, and missing states.

## Commit Requirements

- Every commit in this repository must use the author identity `TECNB <3489044730@qq.com>`.
- Treat this as a required commit gate: verify the configured author before creating, amending, rebasing, cherry-picking, or force-pushing commits.
- Commit messages must follow the basic Conventional Commit shape while keeping the description in Chinese.
- Valid examples:
  - `feat: 接入动漫 Mikan 搜索`
  - `fix: 修复资源搜索取消请求状态`
  - `chore: 归档 Trellis 任务`
- Keep prefixes such as `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, and `test:` in English.
- Do not use English descriptions after the prefix; `feat: connect anime magnet ingest UI` and `chore: ignore codex workspace notes` are invalid.
- Before pushing, inspect recent commits with `git log --format='%h %an <%ae> %s'` and repair violations first.
- If a bad commit is already on the remote, ask for approval and rewrite it with `git push --force-with-lease`.

---

## Testing Requirements

There is no established frontend test suite in the current codebase. Do not invent a test stack inside ordinary feature work.

Verification options, from lightest to heavier:

- Code reading against the touched files and API contract.
- Manual browser smoke check for visible UI changes.
- A narrow command only when the user asks or the task is specifically about a lint/type/test failure.

Respect the project-level instruction not to run full-project validation unless explicitly asked.

---

## Code Review Checklist

- Does the change stay within the requested feature scope?
- Are Python and Java backend responsibilities preserved?
- Do request params, response fields, status strings, and nullability match the contract?
- Are stale requests, cancellation, and mode/category resets handled where relevant?
- Are user-visible states clear for non-technical shared users?
- Did the change avoid global style churn and unrelated page rewrites?
- Did it avoid new major dependencies?
