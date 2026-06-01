# Anime Magnet Ingest UI

## Goal

Connect the existing `Magnet Ingest` page's Anime mode to the new Java
Orchestrator Anime season magnet task API. Users should search/select an Anime
result, paste a whole-season magnet link, submit it, and inspect recent task
status/logs from the same page.

## Decisions

- Keep work local to the existing manual magnet ingest page and API/type files.
- Anime mode submits whole-season magnets, not per-episode magnets.
- Do not ask for episode number.
- Do not ask for subgroup in the first slice.
- Do not expose OpenList/PikPak/ANI-RSS internals as required user choices.
- Do not build a full task center.
- Keep movie and series behavior unchanged.

## UI Behavior

- Anime search remains powered by the existing Java Bangumi search endpoint.
- The submit button is enabled for Anime when:
  - one Anime result is selected
  - one valid magnet link is present
- On submit, call the Java Anime magnet task creation endpoint.
- Show success with task id/status.
- Replace or supplement the static recent task table with real Anime magnet
  recent tasks when Anime mode is selected.
- Allow viewing a task's per-task log timeline from the page.
- Keep loading, error, empty, success, and duplicate/reused-task states close to
  the affected UI.

## API Direction

- Add Java API functions to `src/lib/api/magnet-ingest.ts` or a clearly scoped
  Anime magnet helper in the same family.
- Keep Java response envelope mapping explicit.
- Keep Anime request/response types separate from movie/series payloads.

## Non-Goals

- No global log panel.
- No manual rename review UI.
- No media library refresh UI.
- No changes to movie/series magnet ingest behavior.
- No full-project validation command.

## Acceptance Criteria

- Anime mode can submit a selected Anime + whole-season magnet to Orchestrator.
- A returned task is displayed with status.
- Recent Anime magnet tasks can be loaded.
- Per-task logs can be displayed for a selected task.
- Existing movie and series submit flows still call their current endpoints.
