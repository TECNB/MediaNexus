# Stitch Resource Screen Notes

Stitch project: `家庭媒体中心`

## Screens

- `资源搜索 (布局修正版)`
  - Screen id: `21769f936e894eb6aa36664de461a159`
  - Purpose: resource search page layout for Prowlarr/OpenList direct ingest.
- `资源搜索 (入库任务实时日志 - 中文)`
  - Screen id: `3cb731e57fc0472cb1e23db0e5a0a6f6`
  - Purpose: task status and real-time logs after OpenList ingest.
- `资源搜索 (电影发布资源选择 - 中文)`
  - Screen id: `c3d1508f209e4b85850e2bbcab26286f`
  - Purpose: choose a concrete movie release returned by Prowlarr.
- `资源搜索 (剧集发布资源选择 - 中文)`
  - Screen id: `6eeef1d349014e2caece951559f46e4e`
  - Purpose: choose a concrete series-season release returned by Prowlarr.

## Resource search page details

- Keep sidebar and page container consistent with existing MediaNexus layout.
- Search bar and category switch sit above results.
- Recent ingest log is a full-width lightweight row below search/category and
  above result cards; it must not squeeze the search input.
- Resource cards use a two-column desktop layout.
- Poster area keeps normal media poster ratio and must not stretch.
- Card information is spacious, not a compressed horizontal strip.
- Movie and series cards have:
  - poster
  - media-type badge
  - Chinese title
  - original title/year where available
  - short overview
  - quality selector
  - direct ingest button
- Series cards also include a season selector.
- The button text is exactly `通过 OpenList 入库` and remains on one line.

## Real-time log page details

- Chinese-first page.
- Show task metadata and status summary near the top.
- Show OpenList node/status card where useful.
- Show task progress/stage list.
- Show real-time logs as the main diagnostic area.
- Do not add a full task center in this slice.
