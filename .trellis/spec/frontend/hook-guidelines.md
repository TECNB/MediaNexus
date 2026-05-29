# Hook Guidelines

> How hooks are used in this project.

---

## Overview

The project currently uses React built-in hooks directly in page components. There are no shared custom hooks and no React Query/SWR layer. Keep stateful logic local until reuse or complexity clearly justifies extracting a hook.

---

## Custom Hook Patterns

Only introduce a custom hook when:

- The same stateful behavior is needed by multiple pages or components.
- A single page has become difficult to reason about because effect and cancellation logic dominates rendering.
- The hook can expose a small domain-specific API instead of leaking implementation details.

If a hook is introduced, place it close to its feature first. Create a shared hooks directory only after there is more than one truly shared hook.

---

## Data Fetching

Current data fetching pattern:

- API modules in `src/lib/api/` call the shared Axios client.
- Pages call API functions from event handlers or effects.
- Request cancellation uses `AbortController` and Axios `signal`.
- Race protection uses request id refs, as in `latestRequestIdRef` in `src/pages/resources/index.tsx`.
- Canceled requests are ignored with `isRequestCanceledError`.
- User-facing failures are stored in local state and rendered as page/card messages.

When adding fetches, preserve cleanup in `useEffect` return callbacks and avoid updating state from stale responses.

---

## Naming Conventions

- State variables use domain names: `movieSearchStatus`, `seriesSeasonOptions`, `movieQualityProfilesMessage`.
- Status unions should be explicit local types: `'idle' | 'loading' | 'success' | 'empty' | 'error'`.
- Refs for request lifecycle should name what they protect: `activeRequestControllerRef`, `latestSearchRequestIdRef`.
- Helper functions inside pages should use verb-first names: `handleSearchSubmit`, `resetSeriesModeState`, `normalizeSeasonNumbers`.

---

## Common Mistakes

- Do not add React Query, Zustand, Redux, or another state/fetching library for one page.
- Do not fire API requests directly during render.
- Do not ignore stale-response races when a search term, category, or selected resource can change quickly.
- Do not swallow errors silently; map them to a clear local message.
- Do not let unmounted components update state after an in-flight request resolves.
