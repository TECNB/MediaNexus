# Project Context

> Product and integration boundaries for MediaNexus frontend work.

---

## Product Role

MediaNexus is a resource-management website for Emby shared-link workflows. It is not a replacement for downloaders, cloud drives, media servers, or the existing backend automation. The frontend should make the existing chain easier to operate and observe for shared users and administrators.

Primary responsibilities:

- Provide unified entry points for resource search, ingest, subtitles, magnets, logs, settings, and task observation.
- Make the path from search to playable media visible as stages rather than opaque backend actions.
- Keep user-facing actions simple enough for non-technical shared users.
- Leave low-level automation and storage concerns in backend services.

## Existing Chains

Playback chain:

- CD2 -> AutoSymlink -> `.strm` -> Emby -> VidHub

Resource acquisition chain:

- Prowlarr -> Sonarr / Radarr -> Blackhole -> custom bridge script -> OpenList API -> PikPak

The frontend should describe and observe these steps, but should not hard-code itself as the owner of every low-level integration.

## Backend Boundaries

The existing Python backend, MediaNexus-Core, already owns current resource search, subtitle upload, and Emby refresh capabilities. Existing frontend API calls in `src/lib/api/resources.ts`, `src/lib/api/subtitles.ts`, and `src/lib/api/magnet-ingest.ts` use Python-style `/api/v1/...` endpoints through `src/lib/axios.ts`.

The new Java backend will be introduced gradually. Planned stack:

- Java 17
- Spring Boot 3.x
- MySQL 8
- MyBatis-Plus
- Sa-Token
- Knife4j

Do not break existing Python API calls when adding Java-backed capabilities. During the first Java phase, localize new Java API work to the Anime module unless the task explicitly expands scope.

## Non-Goals For Frontend Tasks

- Do not rewrite existing pages just to prepare for Java.
- Do not redesign the whole shell or global style system in feature tasks.
- Do not replace Axios, React Router, Tailwind, or local state without an explicit architecture task.
- Do not add large workflow pages, task visualization systems, or admin consoles unless the active task asks for them.
- Do not create `docs/`, `notes/`, `test-results/`, or `task-logs/` directories as part of frontend feature work unless explicitly requested.
