---
name: react-best-practices
description: Idiomatic React + TypeScript style for the prode frontend — mobile-first PWA, components, hooks, TanStack Query/Table, React Router, MUI, and fetch usage. Apply when writing or reviewing any .ts/.tsx file in the frontend project.
---

# React Best Practices (prode frontend)

## Stack (mandatory)

- **Build:** Vite + React 18 + TypeScript (strict mode).
- **Routing:** `react-router-dom` v6 (data routers / `createBrowserRouter`).
- **Data fetching:** `@tanstack/react-query` v5. Never call `fetch` inside a component — always go through a query/mutation hook.
- **Tables:** `@tanstack/react-table` v8 (headless). Render with MUI `Table` primitives.
- **HTTP:** native `fetch`. **No axios.** All requests go through `src/api/client.ts`.
- **UI:** Material UI v5 (`@mui/material`, `@mui/icons-material`). Use the theme — no inline hex colors.
- **PWA:** `vite-plugin-pwa` with Workbox. The app must remain installable and offline-capable — every change must preserve this.
- **Form factor:** **mobile-first**. Design and style for `xs` first; layer larger breakpoints additively.

## Project layout

```
frontend/src/
├── api/             # one file per backend resource; pure functions returning typed promises
│   ├── client.ts    # fetch wrapper: base URL, auth header, JSON parse, error mapping
│   └── *.ts         # auth.ts, leagues.ts, matches.ts, ...
├── auth/            # AuthContext, useAuth, token storage
├── components/      # reusable presentational + small composite components
├── hooks/           # cross-cutting custom hooks (useDebounce, usePagination, ...)
├── pages/           # one file per route view; composes components + query hooks
├── queries/         # useXxxQuery / useXxxMutation hooks wrapping api/* with React Query
├── routes/          # router config + ProtectedRoute
├── theme/           # MUI theme
└── types/           # shared TS types mirroring backend DTOs (camelCase)
```

## Components

- Function components only. No class components.
- Default export the page component; named exports for everything else.
- Keep components under ~150 lines — split when bigger.
- Props are an explicit `type Props = { ... }` (or `interface`) declared above the component. Don't inline-type props.
- Don't prop-drill more than 2 levels — lift to context or co-locate state.
- Children-as-render-prop is a code smell here; prefer composition.

## Hooks

- Hook names start with `use`. Custom hooks live in `src/hooks/` or `src/queries/`.
- All deps listed in `useEffect` / `useMemo` / `useCallback`. If lint complains, fix the dep, don't disable the rule.
- Don't `useEffect` to derive state from props — compute during render or use `useMemo`.
- Don't `useEffect` to sync with an external store — use `useSyncExternalStore` or React Query.

## TanStack Query

- One hook per query, lives in `src/queries/`. Name: `useLeaguesQuery`, `useMatchQuery(id)`, `useSubmitPredictionMutation`.
- **Query keys are arrays, hierarchical, and stable:** `['leagues', { page, q }]`, `['leagues', id]`, `['me', 'predictions']`. Centralize key factories per resource if they grow.
- `queryFn` calls the `api/*` function. No `fetch` here.
- Invalidate by prefix after mutations: `queryClient.invalidateQueries({ queryKey: ['leagues'] })`.
- Default `staleTime` is set globally in `queryClient`. Override per-query only when needed.
- Use `enabled` for dependent queries; never gate with `if (!id) return`.
- Handle loading/error in the component via `isLoading` / `isError` — don't throw to Suspense unless the whole tree uses it.

## TanStack Table

- Use the headless API: `useReactTable({ data, columns, getCoreRowModel, ... })`.
- Define `columns` outside the component or with `useMemo` (referential stability matters).
- Server-driven pagination: pass `manualPagination: true`, control `pageIndex`/`pageSize` via state, and let the API drive `pageCount`.
- Render with MUI `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell` — keep table styling consistent.

## React Router

- One `createBrowserRouter` config in `src/routes/router.tsx`.
- Protect routes with a `<ProtectedRoute />` wrapper that reads from `AuthContext`.
- Use `useNavigate`, `useParams`, `useSearchParams` — don't read `window.location` directly.
- Search/filter state for list pages lives in the URL (`useSearchParams`), not component state.

## fetch (no axios)

- All requests go through `apiFetch` in `src/api/client.ts`:
  - Prepends `VITE_API_BASE_URL`.
  - Adds `Authorization: Bearer <token>` if present.
  - Sets `Content-Type: application/json` for bodies.
  - Parses JSON; throws a typed `ApiError { status, code, message }` on non-2xx.
  - Handles 401 by attempting one refresh, then retrying once.
- Resource files (`api/leagues.ts`) export plain async functions: `listLeagues(params): Promise<Page<League>>`.
- Never call `fetch` directly in a component, hook, or query function outside `api/`.

## Mobile-first design

**Mandatory.** This app runs primarily on phones, installed as a PWA. Every screen must look and feel native on a small viewport first; desktop is an enhancement.

- **Breakpoints (MUI):** `xs` (0–600) is the baseline. Style for `xs` with the bare `sx` value, then layer up with object syntax: `sx={{ p: 2, sm: 3, md: 4 }}` (i.e. start small, scale up). Never write a "desktop first" rule and override it for mobile.
- **Viewport units:** prefer `100dvh` over `100vh` (mobile browser chrome makes `vh` wrong). Respect safe areas with `env(safe-area-inset-*)` for fixed bottom nav, FABs, etc.
- **Touch targets:** minimum 44×44 px. Buttons and icon buttons in this project enforce this via theme defaults.
- **Navigation:** mobile uses a top `AppBar` (with hamburger `Drawer`) plus a fixed `BottomNavigation`. Desktop (`md+`) uses top nav only. Use `useMediaQuery(theme.breakpoints.up('md'))` to switch — don't render both and hide with CSS.
- **Containers/padding:** scale spacing per breakpoint (`px: { xs: 1.5, sm: 3 }`, `py: { xs: 2, sm: 3, md: 4 }`). Don't use a single fixed value.
- **Tables:** wrap in horizontally-scrollable `TableContainer`. Mark low-priority columns with `meta: { hideOnMobile: true }` so `DataTable` collapses them on `xs`.
- **Forms:** full-bleed on `xs` (no rounded card, fill the screen), card layout on `sm+`. Use `inputMode` / `type` correctly so mobile keyboards match (`type="email"`, `inputMode="numeric"`, etc.). Avoid horizontal forms — stack fields vertically.
- **Typography:** keep base sizes readable on phones (≥ 0.95rem body, ≥ 1.25rem h5). Use the theme's per-variant media queries to scale up on larger screens.
- **Hover-only affordances are forbidden.** Anything important must be visible/tappable without hover.
- **Test on a real mobile viewport** (Chrome DevTools device mode at least) before claiming a feature is done.

## PWA

The app is installable and offline-capable via `vite-plugin-pwa`. Don't break this.

- **Manifest** lives in `vite.config.ts` (`VitePWA({ manifest: ... })`). When changing app name, colors, or icons, update the manifest there.
- **Icons:** `public/pwa-192x192.png`, `public/pwa-512x512.png`, and a maskable `public/pwa-maskable-512x512.png`. Provide all three; the maskable one needs ~20% safe-zone padding.
- **Service worker:** auto-update mode (`registerType: 'autoUpdate'`). Update prompts are rendered by `src/pwa/PWAUpdatePrompt.tsx` — mounted once in `main.tsx`. Don't register the SW elsewhere.
- **Caching strategy:**
  - App shell (JS/CSS/HTML/static assets) → precached by Workbox at build time.
  - `/api/*` → `NetworkFirst` with a 5s timeout and short TTL. **Do not** cache mutations (`POST`/`PATCH`/`DELETE`) — Workbox's runtime caching only matches GETs by default; keep it that way.
  - Auth endpoints (`/auth/*`) should never be served from cache. If you add a new strategy, exclude them explicitly.
- **Navigation fallback:** `index.html` is served for SPA routes; `/api/*` is denylisted so API 404s aren't masked.
- **`<head>` requirements** (already in `index.html`): viewport with `viewport-fit=cover`, `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`. Don't remove these.
- **Offline UX:** React Query keeps the last successful response in cache; show that data with a subtle "offline" indicator rather than an error when `navigator.onLine === false`. Mutations made offline should fail clearly — don't silently queue them unless we add explicit background sync.
- **Dev:** the SW is disabled in dev (`devOptions.enabled: false`). Test PWA behavior with `pnpm nx build frontend && pnpm nx preview frontend`.

## Material UI

- Theme defined in `src/theme/theme.ts`; wrap app in `<ThemeProvider>` + `<CssBaseline />`.
- Use `sx` prop for one-off styles; pull repeated styles into `styled()` components.
- Spacing via theme: `sx={{ mt: 2, px: 3 }}` — never hardcoded `px`.
- Use MUI form components (`TextField`, `Button`, `Select`); pair with `react-hook-form` if forms get complex (add when needed, don't preinstall).
- Icons from `@mui/icons-material`; avoid emoji.

## TypeScript

- `strict: true`. No `any` — use `unknown` and narrow, or define the type.
- Backend DTOs come from the `libs/shared-types` library where possible; otherwise mirror them in `src/types/` with **camelCase** field names (matches the backend's Drizzle/Zod DTOs).
- Discriminated unions over boolean flags for state machines.
- `as` casts only at trust boundaries (parsed JSON, `localStorage`); never to silence errors.

## State management

- Server state → React Query. Client state → `useState` / `useReducer`.
- Global client state (auth user, theme mode) → React Context. No Redux/Zustand unless a need actually appears.
- URL is state too — filters, pagination, tabs belong in `useSearchParams`.

## Errors & loading

- Every page that fetches data must render: loading skeleton, error state, empty state, content. Don't ship pages with `if (isLoading) return null`.
- Transient feedback (mutation errors, success confirmations, warnings) → **`react-toastify` toasts** (see [[react-toastify]] skill). Never use `window.alert`, MUI `Snackbar`, or standalone `<Alert>` components outside of dialogs for this purpose.
- Inline `<Alert>` inside a `<Dialog>` is acceptable for form-level validation errors that belong next to the form, not as a floating notification.
- Wrap the router in an `<ErrorBoundary>` for render-time crashes.

## Files & naming

- Components and pages: `PascalCase.tsx` (`LeaguesPage.tsx`, `DataTable.tsx`).
- Hooks: `useCamelCase.ts`.
- Plain modules: `camelCase.ts` (`client.ts`, `leagues.ts`).
- One component per file (small subcomponents in the same file are fine).

## Don'ts

- No default exports for non-page modules — named exports only.
- No `useEffect` for data fetching.
- No `fetch` outside `src/api/`.
- No inline styles with hex colors — use theme tokens.
- No `any`, no `// @ts-ignore`, no `eslint-disable` without a comment explaining why.
- No barrel files (`index.ts` re-exports) unless they're providing a public API.
