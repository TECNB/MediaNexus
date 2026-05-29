# Anime Module

> Future rules for Anime page/API integration.

---

## Scope

The Anime module is the first planned Java-backed frontend area. Current UI only shows an Anime unavailable state inside `src/pages/resources/index.tsx`; do not implement Anime behavior until a task explicitly asks for it.

When Anime work begins, keep changes local to the Anime route/category and its API module as much as possible.

## User Experience Rules

Anime workflows are for non-technical shared users first. The UI should:

- Use simple Chinese labels and avoid backend-system jargon.
- Show the primary resource result, match confidence/status, and next action clearly.
- Keep advanced configuration collapsed by default.
- Let users perform ingest/add actions directly on a resource card whenever possible.
- Show loading, empty, error, success, and already-added states close to the affected resource.
- After a successful ingest/add action, guide the user to task details or a workflow status page if that exists.

## Page and Component Direction

Do not redesign the whole `ResourceSearchPage` to add Anime. Prefer one of these incremental paths:

- Extend the existing category switch and search content only where necessary.
- Add Anime-specific resource cards under `src/components/resources/` or `src/components/anime/` if the data shape diverges from movies/series.
- Keep Anime API functions in a dedicated API module.
- Keep advanced Anime matching/import settings in a collapsible section rather than making them the first-screen experience.

## Workflow Direction

Anime should eventually express the chain from search to playable media as stages. Do not create a complex task-flow page until there is a dedicated task for it. Early Anime UI may link to the existing task center or a future task detail route only if the backend returns a task identifier and the task scope includes navigation.

## API Direction

- New Anime capabilities should use the Java backend first.
- Existing movie, series, subtitles, and magnet capabilities should keep using Python.
- Keep Anime request/response types separate from movie/series types until contracts prove they can be shared safely.
- If Java response envelopes differ from Python envelopes, write explicit mappers rather than forcing Java into the Python type shape.

## Forbidden Patterns

- Do not make Anime a mock-only feature when the task is about real Java API integration.
- Do not change movie/series behavior while wiring Anime.
- Do not expose raw Sonarr/Radarr/Prowlarr/OpenList/PikPak concepts as mandatory user choices.
- Do not expand advanced settings by default.
- Do not add a large workflow visualization surface in the same task as the first Anime API connection.
