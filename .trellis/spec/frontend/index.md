# Frontend Development Guidelines

> Project-specific rules for the MediaNexus frontend.

---

## Overview

MediaNexus is a React + TypeScript + Vite frontend for an Emby shared-resource management workflow. It sits above existing automation systems and should act as a unified operation layer, workflow visualization layer, status observation layer, and recovery center. It must not replace the underlying downloaders, storage services, media server, or existing Python backend.

Current stack:

- React 18 with `react-router-dom` data router in `src/router/index.tsx`.
- TypeScript strict mode with the `@/*` path alias from `tsconfig.json` and `vite.config.ts`.
- Vite 5 build tooling.
- Axios via the shared client in `src/lib/axios.ts`.
- Tailwind CSS with shadcn/Radix-style primitives in `src/components/ui/`.
- Local React state only; no global state library is currently used.

Read the files below before changing frontend behavior. For API or Anime work, the dedicated guides are required context.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Project Context](./project-context.md) | Product role, integration boundaries, non-goals | Active |
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Active |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Active |
| [Hook Guidelines](./hook-guidelines.md) | Effects, data fetching, cancellation patterns | Active |
| [State Management](./state-management.md) | Local state, server state, URL state | Active |
| [API Integration](./api-integration.md) | Python API vs Java API routing rules | Active |
| [Anime Module](./anime-module.md) | Future Anime page and Java API integration rules | Active |
| [Quality Guidelines](./quality-guidelines.md) | Scope control, reviews, verification | Active |
| [Type Safety](./type-safety.md) | Type organization and TypeScript conventions | Active |
