# Component Guidelines

> How components are built in this project.

---

## Overview

Components are plain React function components written in TypeScript. The project uses Tailwind classes directly, `cn` from `src/lib/utils.ts` for conditional classes, lucide icons, and a small shadcn/Radix-style `src/components/ui/` layer.

Do not casually replace existing page composition or global visual style. Most feature work should add or adjust a small component near the page it serves.

---

## Component Structure

Follow the local ordering used in `src/pages/resources/index.tsx` and `src/components/resources/media-card.tsx`:

- Imports first, with React/library imports before project imports.
- Local union types and props types near the top.
- Small pure helper functions before the exported component.
- One exported component per reusable component file unless small private subcomponents improve page readability.
- Keep page-only subcomponents inside the page file when they are not reused.

For UI primitives, follow `src/components/ui/button.tsx`: use `forwardRef` only when the primitive needs ref forwarding or `asChild` behavior.

---

## Props Conventions

- Use a local `type <ComponentName>Props = { ... }` for feature components.
- Export prop-related types only when another module imports them. Example: `MediaCardAddStatus` is exported from `src/components/resources/media-card.tsx`.
- Callback props should describe the domain action: `onAddMovie`, `onQualityProfileChange`, `onChange`.
- Keep DTO types in `src/types/`, not in component props, when they represent backend contracts.
- Use optional props with explicit defaults in the function parameter list, as in `MediaCard`.

---

## Styling Patterns

Use Tailwind utility classes. The project currently favors a calm slate/white operational UI with rounded controls, subtle borders, and compact cards.

Follow existing styling sources:

- Global design tokens are in `src/styles/globals.css` and `tailwind.config.js`.
- Layout shell styling lives in `src/layouts/admin-layout.tsx`, `src/components/layout/sidebar.tsx`, and `src/components/layout/page-container.tsx`.
- Conditional styling uses `cn`, as in `CategorySwitch` and `SidebarLink`.
- Icons come from `lucide-react` when a familiar symbol exists.

Avoid one-off global CSS additions unless a utility cannot express the behavior. Do not make a full-site color, spacing, or typography change inside a feature task.

---

## Accessibility

Preserve the accessibility patterns already present:

- Interactive elements use native `button`, `select`, and `input` elements where possible.
- Buttons include `type="button"` when they do not submit a form.
- Segmented choices expose ARIA state, as in `CategorySwitch` with `role="tablist"`, `role="tab"`, and `aria-selected`.
- Loading, empty, error, and disabled states must be visible in the UI, not only logged.
- Use meaningful `alt` text for media posters and graceful image fallbacks.
- Use `role="alert"` for user-visible error notices when appropriate, as in the resource quality profile notice.

---

## Common Mistakes

- Do not move a whole page into a new component hierarchy just because one small feature is changing.
- Do not introduce a new UI framework; extend the local `src/components/ui/` primitives only when needed.
- Do not place backend response-shape normalization inside deeply nested presentational components.
- Do not hide advanced or risky actions inside generic buttons without status feedback.
- Do not add visible instructional copy that explains implementation details to non-technical shared users.
