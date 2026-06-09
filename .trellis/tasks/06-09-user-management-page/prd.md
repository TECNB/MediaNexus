# User Management Page

## Goal

Implement the MediaNexus frontend user management page based on the Stitch
screen `用户管理 (管理员)`.

## Requirements

- Add an administrator-only sidebar entry `用户管理` at `/users`.
- Hide the entry from normal users.
- Show a 403 page for normal users who visit `/users` directly.
- Display summary metrics: total users, normal users, and today's highest usage.
- Allow editing the global default quota from `0` through `9`.
- List users with server pagination, search, role filter, and sort controls.
- Show username, ID, email, role, today's usage/effective quota, quota source,
  status, created time, updated time, and row actions.
- Show usage breakdown for magnet ingest creation and anime subscription
  creation in a lightweight hover surface.
- Allow normal users' quota override to be edited in a modal, including restore
  to global default.
- Allow normal users' current-day usage to be reset without confirmation.
- Disable quota/reset actions for admin users.
- Use existing Java API client and MediaNexus backstage visual patterns.
