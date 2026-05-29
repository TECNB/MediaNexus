# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend is a single Vite React app under `src/`. It is organized by broad layer first, then by feature when a feature has reusable components. Keep new work in the closest existing directory instead of creating a new architecture.

---

## Directory Layout

```
src/
├── App.tsx
├── main.tsx
├── components/
│   ├── layout/
│   ├── magnet-ingest/
│   ├── resources/
│   └── ui/
├── data/
├── layouts/
├── lib/
│   ├── api/
│   ├── axios.ts
│   └── utils.ts
├── pages/
│   ├── dashboard/
│   ├── help/
│   ├── magnet-ingest/
│   ├── resources/
│   ├── settings/
│   ├── subtitles/
│   └── tasks/
├── router/
├── styles/
└── types/
```

---

## Module Organization

Use the current patterns:

- Routes are registered in `src/router/index.tsx` and render pages inside `AdminLayout`.
- Page entry files live at `src/pages/<route>/index.tsx`.
- Reusable feature components live at `src/components/<feature>/`.
- Shared shell components live at `src/components/layout/` and `src/layouts/`.
- shadcn/Radix-style primitives live at `src/components/ui/`.
- API functions live at `src/lib/api/<domain>.ts`.
- Shared API/client utilities live in `src/lib/`.
- Domain DTOs and shared UI-facing types live in `src/types/<domain>.ts`.
- Demo data lives in `src/data/` and should not be mixed into API modules.

If a feature is still a single route with no reusable pieces, keep local helper functions and local types inside that page file. Split to `src/components/<feature>/` only when a component is reused or the page becomes hard to scan.

---

## Naming Conventions

- File and folder names use kebab-case: `magnet-ingest`, `media-card.tsx`, `page-container.tsx`.
- React components use PascalCase exports: `ResourceSearchPage`, `MediaCard`, `PageContainer`.
- API functions use verb-first camelCase: `searchMovies`, `getMovieQualityProfiles`, `createMovieMagnetIngest`.
- Type files group related request, response, and item shapes by domain.
- Prefer the `@/*` alias for imports from `src/`, as shown throughout `src/pages/resources/index.tsx`.

---

## Examples

- `src/pages/resources/index.tsx` coordinates search, request cancellation, local add state, and `src/components/resources/*`.
- `src/pages/magnet-ingest/index.tsx` keeps page-specific validation helpers local and calls APIs from `src/lib/api/`.
- `src/components/ui/button.tsx` is the local pattern for reusable UI primitives using `forwardRef`, `cva`, and `cn`.
- `src/lib/api/resources.ts` is the current pattern for typed API wrappers around the shared Axios client.
