# Type Safety

> Type safety patterns in this project.

---

## Overview

The frontend uses TypeScript in strict mode. Types should preserve backend contracts clearly and make UI status handling explicit. There is no runtime validation library in the current project.

---

## Type Organization

- Shared backend DTOs and domain types live in `src/types/<domain>.ts`.
- Page-only state types and status unions can stay inside the page file.
- Component prop types should stay beside the component unless exported for reuse.
- Keep request payload and response types together in the domain type file.
- Use `import type` for type-only imports, as shown throughout the project.

Examples:

- `src/types/resources.ts` defines movie/series search items, response envelopes, quality profiles, add payloads, and season responses.
- `src/types/magnet-ingest.ts` defines ingest payloads and responses.
- `src/types/subtitles.ts` defines subtitle upload payloads and response shapes.

---

## Validation

There is no Zod/Yup/io-ts layer. Validate critical values with small local checks before calling APIs:

- Check numeric IDs before add/load actions, as in `tmdb_id` and `tvdb_id` handling.
- Trim user input before searching or submitting.
- Guard optional strings before showing original titles, overview text, or image URLs.
- Check response `success` and required `data` fields inside API wrappers.

If runtime validation becomes necessary for Java contracts, add it in a focused API-contract task rather than inside a UI feature.

---

## Common Patterns

- Use discriminating helper functions for union-like DTOs. Example: `isSeriesSearchItem` checks for `tvdb_id`.
- Use explicit status union types: `ResourceSearchStatus`, `MovieQualityProfilesStatus`, `SubmitStatus`.
- Use generic helpers when the shape is truly shared. Example: `searchResources<TResponse extends { success: boolean; message: string }>` in `src/lib/api/resources.ts`.
- Prefer `Record<Union, Value>` for copy/status maps so every case is covered.
- Use `satisfies` when constraining object literals without losing specific values, as in the current Anime unavailable-state copy.

---

## Forbidden Patterns

- Do not use `any` for backend responses.
- Do not force Java API responses into Python response types if the envelopes differ.
- Do not use broad type assertions to bypass nullability; check values first.
- Do not mix API DTO types with unrelated UI-only state in the same type unless it reflects the real contract.
- Do not make optional backend fields required in frontend types just to simplify rendering.
