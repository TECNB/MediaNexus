# Prowlarr Resource OpenList Ingest UI

## 2026-06-19 Latest Decision

This section supersedes the earlier first-slice statements below.

- Resource cards split the action into `添加` and `查看更多`.
- `添加` keeps the automatic matching shortcut.
- `查看更多` opens `资源搜索 (电影发布资源选择 - 中文)` and displays all
  downloadable Prowlarr releases returned by Java.
- The release page automatically searches on entry and when a series season is
  changed. It has no internal search input.
- Movie release search sends the submitted outer search term unchanged, matching
  torrra 2.0.7. It does not append the movie year or add Prowlarr category,
  type, limit, or offset parameters.
- Resolution and dynamic-range filters are client-side, linked-count filters
  over the original result order.
- Each release row shows title, size, seeders, leechers, grabs, indexer,
  publish date, and parsed tags.
- The UI must never render `download_ref`, `indexer_id`, guid, magnet URL,
  download URL, or API key.
- Selecting a row creates the existing OpenList ingest task and navigates to
  the real-time task log page.
- Stitch reference:
  - movie release page: `c3d1508f209e4b85850e2bbcab26286f`
  - series release page: `6eeef1d349014e2caece951559f46e4e`

## Goal

Update the MediaNexus resource page to use the new Java Orchestrator
Prowlarr → OpenList ingest flow. The UI should follow the latest Stitch design
direction: spacious two-column resource cards, a lightweight recent ingest log
entry, direct OpenList ingest buttons, and a real-time task log page.

The frontend should not expose Prowlarr release URLs, download URLs, magnet
links, API keys, or an internal release list in this first slice.

## Design References

Use these Stitch screens from project `家庭媒体中心`:

- `资源搜索 (布局修正版)`
  - screen id: `21769f936e894eb6aa36664de461a159`
- `资源搜索 (入库任务实时日志 - 中文)`
  - screen id: `3cb731e57fc0472cb1e23db0e5a0a6f6`
- The resource page's latest card/button revision where `通过 OpenList 入库`
  remains a single-line button.

Follow the design system already visible in the generated screens:

- Chinese-first UI text.
- Monochrome Basalt-style surfaces.
- No heavy borders or shadows.
- Spacious cards with stable poster ratio.
- Search and category controls above results.
- Recent ingest entry as a full-width, low-priority information strip.

## Scope

### In

- Replace movie resource add behavior with OpenList ingest.
- Add series OpenList ingest behavior from resource cards.
- Replace API-loaded movie quality profiles with hardcoded quality tags.
- Add series season selector to series cards.
- Add recent ingest log summary on the resource page.
- Add a real-time ingest log page for movie/series tasks.
- Navigate to the log page after task creation.
- Poll logs while a task is active and stop polling when it reaches terminal
  status.

### Out

- No Prowlarr release list UI.
- No manual release selection.
- No inner search box in cards or dialogs.
- No direct magnet input in this resource-page flow.
- No full task center.
- No Anime resource behavior changes in this task.
- No frontend Prowlarr configuration or API key handling.

## UI Decisions

1. **Primary card action**
   The card button text is `通过 OpenList 入库`, always displayed on one line.

2. **Quality tags**
   The frontend uses a small hardcoded list, for example:
   - `2160p`
   - `1080p`
   - `720p`

   Do not call `getMovieQualityProfiles` on the resource page for this flow.

3. **Series season**
   Series cards expose a season selector. The first slice may use `S01` /
   season 1 as the default when the API has no richer state available.

4. **Recent ingest logs**
   The resource page shows a lightweight recent task summary below search/category
   controls and above resource results. It should include:
   - resource title
   - media type
   - status
   - last update time
   - `查看日志` action

5. **Navigation**
   On successful task creation:
   - movie → `/resources/ingest/movie/:taskId`
   - series → `/resources/ingest/series/:taskId`

## API Direction

Add resource-page API helpers, likely under `src/lib/api/resources.ts` or a
small focused sibling file:

```ts
createMovieOpenListIngest(payload)
createSeriesOpenListIngest(payload)
```

Movie payload:

```ts
{
  title: string
  original_title: string | null
  year: number
  quality: '2160p' | '1080p' | '720p' | string
}
```

Series payload:

```ts
{
  title: string
  original_title: string | null
  season_number: number
  quality: '2160p' | '1080p' | '720p' | string
}
```

Use Java API client and standard Java response envelope handling.

Reuse existing task APIs in `src/lib/api/magnet-ingest.ts`:

- `listMovieMagnetIngestTasks`
- `listSeriesMagnetIngestTasks`
- `listMovieMagnetIngestTaskLogs`
- `listSeriesMagnetIngestTaskLogs`

Add task detail helpers only if the log page needs them and no existing helper
already covers the requirement.

## Types

Extend frontend task types with:

- `quality_tag: string | null`
- `dynamic_range_tags: string[]`

Keep response mapping explicit. Do not add broad `any` shapes.

## Resource Page Behavior

### Initial State

- Show search bar and category switch.
- Show recent ingest summary if a recent movie/series task exists.
- Show existing idle copy for empty search.

### Search

- Existing movie/series/anime search behavior remains.
- Movie/series cards render in the new two-column design.
- Anime cards remain out of scope unless layout changes are unavoidable.

### Ingest

Movie card:

1. User chooses quality tag.
2. User clicks `通过 OpenList 入库`.
3. Disable that card's button while request is pending.
4. On success, navigate to real-time log page.
5. On failure, show backend message near the card/toast.

Series card:

1. User chooses season and quality tag.
2. User clicks `通过 OpenList 入库`.
3. Same pending/success/error behavior as movie.

## Real-Time Log Page

Route:

`/resources/ingest/:mediaType/:taskId`

Supported media types:

- `movie`
- `series`

Behavior:

- Load task details/logs on entry.
- Poll logs while status is not terminal.
- Stop polling when status is one of:
  - `SUCCEEDED`
  - `PARTIAL_SUCCESS`
  - `FAILED`
  - `INTERRUPTED`
- Show:
  - task title
  - media type
  - status
  - quality tag
  - dynamic range tags
  - save path
  - task step summary
  - real-time log list
- Provide a way back to the resource page.

## Files

Expected frontend additions:

- `src/pages/resources/ingest-log.tsx` or equivalent route page
- optional resource-specific task log components if reuse keeps the page tidy

Expected frontend modifications:

- `src/pages/resources/index.tsx`
- `src/components/resources/media-card.tsx`
- `src/router/index.tsx`
- `src/lib/api/resources.ts`
- `src/types/resources.ts`
- `src/types/magnet-ingest.ts`

## Non-Goals

- No release list.
- No release modal.
- No release candidate cache.
- No direct Prowlarr calls from frontend.
- No frontend configuration checks for Prowlarr/OpenList.
- No full task center.
- No full-project validation command unless explicitly requested.

## Acceptance Criteria

- [ ] Resource cards follow the latest Stitch layout closely enough for
      implementation: stable poster ratio, spacious two-column cards, readable
      labels, and single-line `通过 OpenList 入库` buttons.
- [ ] Movie card creates a Prowlarr/OpenList ingest task through Java.
- [ ] Series card creates a Prowlarr/OpenList ingest task through Java.
- [ ] Movie quality profiles are no longer loaded on the resource page.
- [ ] Quality options are hardcoded as lightweight tags.
- [ ] Task creation success navigates to the real-time log page.
- [ ] Real-time log page shows task state and logs for movie and series tasks.
- [ ] Recent ingest summary appears on the resource page and links to logs.
- [ ] Backend errors are shown directly; no frontend configuration-disable logic
      is introduced.
- [ ] Anime behavior remains unchanged.

## Definition of Done

- UI behavior matches the PRD and Stitch design references.
- TypeScript types are explicit and local to the feature.
- Existing resource search still works for movie, series, and anime.
- Existing manual magnet ingest page remains functional.
- Only scoped verification is run unless the user explicitly requests broader
  validation.
