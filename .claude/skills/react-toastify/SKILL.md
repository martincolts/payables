---
name: react-toastify
description: All transient user feedback in the prode frontend (errors, success, info, warning) MUST be shown via react-toastify toasts — not MUI <Alert>, window.alert, inline error state, or custom snackbars. Apply when writing or reviewing any .ts/.tsx file under frontend/src that surfaces an error, confirmation, or status message to the user.
---

# react-toastify (prode frontend)

Use [`react-toastify`](https://www.npmjs.com/package/react-toastify) for **every** transient notification the user sees:

- API / mutation errors (login failure, create/update/delete errors, query `isError`)
- Success confirmations (created, saved, deleted, pronóstico cargado, sesión iniciada)
- Info messages (PWA offline ready, PWA update available, "Sin resultados", etc. when shown as a toast)
- Warnings

Do **not** use:

- MUI `<Alert>` for transient feedback (only acceptable for *persistent* inline form-level validation hints that belong inside a form layout, not as the primary error surface)
- `window.alert` / `window.confirm` / `window.prompt`
- Local `useState<string | null>` "error" state rendered as an `<Alert>`
- Ad-hoc Snackbars

Inline form validation tied to a single field (e.g. helperText on a TextField) is fine — toasts are for action results, not field-level hints.

## Setup

Install with **pnpm** (see [[pnpm]] skill):

```sh
pnpm add react-toastify
```

Mount `<ToastContainer>` once, at the top of the app tree (in `App.tsx` or `main.tsx`), and import the stylesheet there as well:

```tsx
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ...
<ToastContainer
  position="top-center"
  autoClose={4000}
  newestOnTop
  closeOnClick
  pauseOnFocusLoss={false}
  pauseOnHover
  theme="colored"
/>
```

Mobile-first: prefer `position="top-center"` so toasts don't collide with the bottom nav / FAB.

## Usage

Import `toast` directly, do not wrap it in a custom hook unless adding real behavior:

```tsx
import { toast } from 'react-toastify';

toast.success('Pronóstico guardado');
toast.error('No se pudo guardar el pronóstico');
toast.info('Hay una nueva versión disponible');
toast.warning('Tu sesión está por expirar');
```

### Error handling pattern

Replace local error state + `<Alert>` with a toast in the catch block:

```tsx
// ❌ Don't
const [error, setError] = useState<string | null>(null);
try { await mutate(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Falló'); }
// ...
{error && <Alert severity="error">{error}</Alert>}

// ✅ Do
try {
  await mutate();
  toast.success('Guardado');
} catch (e) {
  toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar');
}
```

For TanStack Query, surface `isError` via a `useEffect` that fires `toast.error` once per error, or use the mutation's `onError` / `onSuccess` callbacks — preferred:

```tsx
const mutation = useMutation({
  mutationFn: createMatch,
  onSuccess: () => toast.success('Partido creado'),
  onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo crear el partido'),
});
```

For queries, prefer `onError`-style handling via a wrapper or `useEffect(() => { if (isError) toast.error(...) }, [isError])` — do not render an `<Alert>` block as the primary error UI.

### `toast.promise` for async flows

```tsx
toast.promise(api.save(payload), {
  pending: 'Guardando…',
  success: 'Guardado',
  error: 'No se pudo guardar',
});
```

## Copy

All toast text MUST follow the [[spanish-labels]] skill: Argentine Spanish, sentence case, voseo where natural, proper accents and `¿` / `¡`.

Examples:

| Situation | Toast |
|---|---|
| Login OK | `toast.success('Sesión iniciada')` |
| Login failed | `toast.error('Error al iniciar sesión')` |
| Created | `toast.success('Creado')` / `'Partido creado'` / `'Usuario creado'` |
| Updated | `toast.success('Guardado')` |
| Deleted | `toast.success('Eliminado')` |
| Generic failure | `toast.error('Algo salió mal')` |
| PWA offline ready | `toast.info('Listo para usar sin conexión')` |
| PWA update available | `toast.info('Hay una nueva versión disponible')` |

Keep messages short — toasts auto-dismiss and there's no room for paragraphs.

## Don't

- Don't stack multiple toasts for the same event — one toast per user action.
- Don't put toast IDs / dedupe logic everywhere; only use `toastId` when a render loop could fire the same toast repeatedly (e.g. inside a `useEffect` watching `isError`).
- Don't translate the API error message yourself if the backend already returns Spanish copy — just pass `err.message`.
- Don't import the CSS in every file — import once where `<ToastContainer>` is mounted.
