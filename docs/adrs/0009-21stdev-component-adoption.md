# ADR-0009: 21st.dev Component Adoption

**Status**: accepted
**Date**: 2026-03-02
**Deciders**: @vvladescu

## Context

ai-grija.ro needs polished UI components — cookie consent banners, modals, subscription forms — without the cost of building them from scratch. 21st.dev is a component registry that publishes production-quality React components with Tailwind CSS and framer-motion animations.

Our stack constraints:

- No Next.js (Cloudflare Workers serves plain HTML/React)
- No shadcn/ui (we use native HTML + Tailwind, not the shadcn component system)
- Tailwind CSS for styling
- Dark theme as default
- framer-motion available (or addable)
- Romanian UI — all visible text must go through the existing i18n system
- Mobile-first: minimum supported viewport is 375px

## Options Considered

### Option A: 21st.dev registry

- **Source**: `21st.dev` — curated React + Tailwind components
- **Quality**: Production-grade, animated, accessible
- **Tradeoff**: Components assume Next.js + shadcn; require adaptation

### Option B: Build from scratch

- **Tradeoff**: Full control but significant time cost for each component. Rejected for non-differentiating UI elements (cookie banners, modals).

### Option C: Headless UI / Radix UI

- **Tradeoff**: Unstyled primitives require significant CSS work. Viable for complex interactive components (dropdowns, dialogs) but not for complete, pre-styled components.

## Decision

**Option A: Adopt 21st.dev as a source for UI components**, adapted to our stack constraints on a per-component basis.

### Adaptation Rules

All 21st.dev components MUST be adapted before use:

| Original pattern | Replacement |
|------------------|-------------|
| `import Link from 'next/link'` | `<a href="...">` or hash navigation |
| `import { useRouter } from 'next/navigation'` | `window.location` or React Router if applicable |
| `import { Button } from '@/components/ui/button'` | Native `<button>` with Tailwind classes |
| Any `@/components/ui/*` shadcn import | Inline native HTML + Tailwind |
| `cn()` from shadcn | `clsx()` or plain template literals |

### Mandatory additions

1. **`data-testid` attributes**: Every interactive element (`<button>`, `<input>`, `<select>`, `<a>`, `<form>`) MUST have a `data-testid` attribute following the convention `component-element` (e.g., `data-testid="cookie-banner-accept-btn"`).
2. **Dark theme**: Components must render correctly on our dark background (`#0a0a0a` / `bg-gray-950`). Verify contrast ratios.
3. **Mobile (375px+)**: Test at 375px viewport minimum. No horizontal scroll, no overflow.
4. **Romanian text**: All user-visible strings replaced via the existing i18n system. No hardcoded English strings.
5. **BDD stories**: For every adopted component, create or update a corresponding story file in `e2e/stories/`.

### framer-motion

framer-motion animations from 21st.dev components are allowed and encouraged. If `framer-motion` is not yet in `package.json`, add it: `npm install framer-motion`.

### Workflow per component

1. Copy component source from 21st.dev
2. Apply adaptation rules above
3. Add `data-testid` to all interactive elements
4. Verify dark theme and 375px viewport
5. Add/update BDD story in `e2e/stories/`
6. Run `npx vitest run` and `npx playwright test` before committing

## Consequences

**Positive**:
- Faster UI development — skip boilerplate for non-differentiating components
- High-quality starting point with animations and accessibility baked in
- Consistent adaptation checklist reduces risk of regression

**Negative**:
- Each component requires manual adaptation (20–60 minutes per component)
- 21st.dev components may use shadcn internals that are non-trivial to extract
- framer-motion adds ~40 kB gzipped if not already present

**Risks**:
- 21st.dev component quality varies — always review adapted output before shipping
- shadcn dependencies may be deeply nested; check transitive imports
