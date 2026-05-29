# State Management

> How state is managed in this project.

---

## Overview

MediaNexus currently uses local React state, refs, and route state only. There is no global state management library and no dedicated server-state cache.

---

## State Categories

- UI state: local `useState` in the owning page or component, such as selected category, selected quality profile, toast message, and expanded/disabled state.
- Request lifecycle state: explicit status unions plus message fields, as in `ResourceSearchState` and `SeriesSeasonStatus`.
- Server data: stored in local page state after API calls. Examples include resource search results and movie quality profiles.
- Derived state: computed during render from local state where cheap and obvious. Examples include `isSearchSubmitDisabled`, `defaultMovieQualityProfileId`, and `isPushDisabled`.
- URL state: currently only React Router paths are used; filters/search terms are not encoded into query params.

---

## When to Use Global State

Do not introduce global state by default. Consider it only when all are true:

- Multiple unrelated routes need the same mutable client state.
- Passing props would create real complexity.
- The state has a clear owner and reset behavior.
- The task explicitly allows an architecture change.

Authentication/session state may eventually require a shared solution, but it is not present in the current frontend.

---

## Server State

Server state is not centrally cached. Fetch it through `src/lib/api/*` functions and keep it in the page that needs it. If the same endpoint becomes shared by multiple pages, first extract a small API helper or local hook; do not jump directly to a broad server-state library.

When server state can become stale because of user changes, update the local state explicitly or re-fetch the smallest relevant dataset.

---

## Common Mistakes

- Do not introduce Redux, Zustand, Jotai, React Query, or SWR without an explicit task.
- Do not store backend DTOs in global state for convenience.
- Do not let page state survive category/mode switches when it belongs to the previous mode. Existing pages reset mode-specific state on category or ingest-mode changes.
- Do not encode advanced workflows into local state on an unrelated page; create or extend the correct feature surface only when requested.
