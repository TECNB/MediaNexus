# Anime Subscription Download UI

## Goal

Extend the Anime resource search cards so users can choose a Mikan subtitle group, inspect a lightweight preview, see missing-episode warnings, and trigger a subscription/download task through the Java Orchestrator.

## Decisions

- Keep this scoped to the existing Anime category in `ResourceSearchPage`.
- Use the Java backend only for Anime subscription APIs.
- After Anime search succeeds, load subtitle groups for every returned card and preview the default selected group.
- Do not implement request limiting yet. Record full-card fan-out as a future optimization.
- Only show Chinese subtitle groups returned by the backend: simplified, simplified/traditional, and traditional.
- Treat missing episodes as a red warning, not a blocker.
- Disable subscription until the selected group has a successful non-empty preview.
- Button copy: `订阅`, `正在订阅…`, `已触发下载`, and `订阅已存在`.
- Success must not claim files are downloaded; only that refresh/download was triggered.
- Show compact preview metadata such as `预览 12 条`, season if available, and red missing episode summary.

## User Flow

1. User searches Anime resources.
2. Each card loads subtitle group options.
3. The first backend-ranked Chinese group is selected by default.
4. The card previews the selected group.
5. The card shows preview count and missing episode warning if present.
6. User may choose another group, which triggers a new preview for that card.
7. User clicks `订阅`.
8. UI shows success, duplicate, or failure close to the card and a short toast.

## API Expectations

- `GET /api/v1/resources/anime/{id}/groups?sourceUrl=...`
- `POST /api/v1/resources/anime/preview`
- `POST /api/v1/resources/anime/subscribe`

The frontend should not expose raw ani-rss endpoint details.

## Non-Goals

- No AniBT or AnimeGarden support.
- No full preview item list in cards.
- No new task-detail navigation unless the backend returns a task id.
- No full-project validation command.

## Future Optimization

The initial implementation sends group/preview requests for every card after search. A later task should consider first-screen lazy loading or a small concurrency queue.
