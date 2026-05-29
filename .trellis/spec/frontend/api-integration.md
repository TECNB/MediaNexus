# API Integration

> Rules for integrating Python and Java backend APIs from the frontend.

---

## Current Pattern

The frontend currently uses one Axios instance from `src/lib/axios.ts`:

- Base URL comes from `VITE_API_BASE_URL`.
- Timeout is `API_REQUEST_TIMEOUT_MS`.
- API functions live in `src/lib/api/`.
- Existing endpoints use `/api/v1/...` paths and Python-style response envelopes with `success`, `message`, and `data`.

Existing API modules:

- `src/lib/api/resources.ts` for movies, series, quality profiles, and seasons.
- `src/lib/api/subtitles.ts` for subtitle upload.
- `src/lib/api/magnet-ingest.ts` for magnet ingest.

## Backend Routing Rule

- Existing capabilities continue to use the Python backend unless a task explicitly migrates one capability.
- New Anime capabilities should prefer the Java backend during the first Java phase.
- Do not change existing Python endpoint paths, request fields, response checks, or error behavior as a side effect of adding Java support.
- Keep the request layer extensible enough for two backend base URLs.

## Environment Variables

Recommended direction for future tasks:

- Keep `VITE_API_BASE_URL` as the Python backend base URL for existing capabilities.
- Add a separate Java base URL, such as `VITE_JAVA_API_BASE_URL`, when the first Java-backed frontend task needs it.
- Normalize trailing slashes in each client, as `src/lib/axios.ts` already does for `VITE_API_BASE_URL`.

Do not add the Java environment variable until an actual Java API integration task needs executable code.

## Client Structure

When Java API integration begins, prefer a localized request layer:

- Keep the current `apiClient` for Python APIs.
- Add a dedicated Java client or domain-specific Anime API client instead of rewriting all existing API modules.
- Keep Java Anime API functions near `src/lib/api/anime.ts` or another clearly named Anime API module.
- Keep Python and Java DTOs separate when their response envelopes or field naming differ.
- Map backend-specific errors to concise user-facing Chinese messages at the API or page boundary.

## Contract Rules

- Treat request and response field names as contracts; do not rename them in UI code without a mapper.
- Preserve `AbortSignal` support for search-like requests.
- Preserve canceled-request detection with `isRequestCanceledError` or an equivalent shared helper.
- Validate required IDs before calling APIs, following existing checks for `tmdb_id` and `tvdb_id`.
- For actions that trigger backend workflows, expose the resulting task/status identifier to the UI when the backend provides one.

## Forbidden Patterns

- Do not point all existing API calls at Java just because a Java base URL exists.
- Do not make Anime call Python by default if the task is a new Java capability.
- Do not hard-code localhost URLs inside API modules.
- Do not introduce a second HTTP library.
- Do not add interceptors, auth refresh, or global error handling as part of an unrelated feature.
