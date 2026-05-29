# Anime Mikan Search Integration

## Summary

Enable the existing `anime` category on the Resource Search page to perform a real Mikan anime search through the Java `MediaNexus-Orchestrator` backend.

This is a display-only first slice. It should show Mikan anime candidates in the same visual family as existing movie/series cards, but it must not add subscription, download, subtitle group selection, or workflow/task actions.

Backend counterpart: `MediaNexus-Orchestrator/.trellis/tasks/05-29-anime-mikan-search-api`.

## Goals

- Make the `anime` category searchable from `src/pages/resources/index.tsx`.
- Call the Java backend using a dedicated Java API base URL.
- Keep movie and series search behavior unchanged.
- Display Anime search results with a clean Anime-specific data type and card branch.
- Show loading, empty, error, idle, and success states for Anime.
- Update stale UI copy that currently says Anime is not connected.

## Non-Goals

- Do not implement Anime subscription, download, add, or task workflows.
- Do not fetch or display subtitle groups in this slice.
- Do not expose Mikan external-link actions in the card.
- Do not force Anime data into movie/series DTOs.
- Do not migrate movie/series APIs from Python to Java.
- Do not run full-project typecheck/lint/build/test unless explicitly requested.

## User Experience

Anime search should behave like movie and series search:

- User chooses the Anime category.
- User enters a keyword.
- Search triggers only on Enter or the Search button.
- Results render as a poster grid.
- Empty and error states are user-friendly Chinese copy.

Anime card content:

- Cover image from Mikan.
- Title.
- Score with one decimal only when `score > 0`.
- Source/group label: `Mikan` or `Mikan · <week_label>`.
- `已订阅` badge only when `exists === true`.

Anime card must not show:

- Movie quality profile selector.
- `添加` button.
- Mikan external-link button.
- `暂无简介`.
- Subtitle group details.

## API Integration

Add a Java API request path separate from the Python API client.

Recommended frontend files:

- `src/types/anime.ts`
- `src/lib/api/anime.ts`
- A Java axios client or domain-local requester that reads `VITE_JAVA_API_BASE_URL`.

Environment contract:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_JAVA_API_BASE_URL=/java-api
```

`VITE_API_BASE_URL` remains the Python backend base URL for existing capabilities.

Java response envelope:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [],
    "total": 0
  }
}
```

The Anime API wrapper should treat `code === 200` as success and map failures to `动漫搜索失败，请稍后重试。`.

Endpoint:

```text
GET /api/v1/resources/anime/search?term=<keyword>
```

## Frontend Types

Use a dedicated Anime type instead of extending `SearchableResourceItem`.

Expected UI-facing item:

```ts
export type AnimeSearchItem = {
  id: string
  title: string
  cover: string | null
  source_url: string | null
  score: number | null
  exists: boolean
  week_label: string | null
}
```

Expected Java envelope type:

```ts
export type JavaApiResponse<TData> = {
  code: number
  message: string
  data: TData | null
}
```

Expected search response data:

```ts
export type AnimeSearchResponseData = {
  items: AnimeSearchItem[]
  total: number
}
```

## Implementation Notes

- Make `anime` a searchable category in `ResourceSearchPage`.
- Remove the current Anime unsupported placeholder path.
- Keep the current abort/cancel request behavior.
- Keep search explicit-submit only; do not add debounce or auto-search.
- Keep movie quality profile loading scoped to `movie`.
- Introduce Anime-specific card rendering either by adding a clear Anime branch to the existing card component or by adding a small Anime card component under `src/components/resources/`.
- Do not change movie/series DTOs or existing API functions.

## Error States

Frontend should show fixed friendly copy:

- Idle: prompt user to enter an Anime name.
- Loading: indicate Anime search is running.
- Empty: `没有搜索结果`.
- Error: `动漫搜索失败，请稍后重试。`.

Do not display raw ani-rss or Java backend internals to users.

## Configuration Changes

Update tracked example config only with fake/local values:

```text
VITE_JAVA_API_BASE_URL=/java-api
```

When implementation happens, local ignored `MediaNexus/.env` may be updated with the real Java base URL if needed.

## Acceptance Criteria

- Anime category no longer shows a "暂未接入" placeholder.
- Searching Anime calls the Java endpoint and renders returned items.
- Movie and series search still use the existing Python API paths.
- Anime cards render cover/title/score/source/badge correctly.
- `exists=true` shows `已订阅`; `exists=false` shows no subscription action.
- No Anime add/download/subscription controls appear.
- Java response `code !== 200`, network failure, or canceled request are handled without stale results.
- No secret values are committed to tracked files.

## Verification Guidance

Follow repository instructions:

- Do not run full-project validation commands by default.
- Prefer static review and scoped manual verification.
- If runtime verification is needed, use the smallest practical check against the Anime page/API path.
