# Anime Mikan Search Decisions

## Confirmed Decisions

- Use `MediaNexus-Orchestrator` for the new Anime backend capability.
- Keep existing movie and series APIs on Python `MediaNexus-Core`.
- Use REST between Orchestrator and ani-rss, not MCP.
- Use a dedicated frontend Java base URL: `VITE_JAVA_API_BASE_URL`.
- Keep Anime DTOs separate from movie/series DTOs.
- Search only on explicit submit.
- Show search results only; no subscription/download/add flow.
- Do not fetch Mikan subtitle groups in the first slice.
- Do not show a Mikan external-link button.
- Show `exists=true` as `已订阅`.
- Use fixed friendly error copy on the frontend.

## ani-rss Contract Notes

ani-rss Mikan search endpoint shape from reference source:

```text
POST /mikan?text=<keyword>
body: {}
auth: x-api-key header supported
```

The search result includes `weeks[].items[]`. Items include title, cover, url, exists, and score-like fields. The Java backend will flatten those into `items[]` while preserving `week_label`.

## Frontend Contract Notes

The Java backend response envelope is:

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

The frontend should check `code === 200`, not Python's `success === true`.

## Secret Handling

Real ani-rss address and API key may be written only to ignored local `.env` files during implementation. They must not be written to PRD, README, `.env.example`, code, logs, or final answers.
