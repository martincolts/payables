---
name: spanish-labels
description: All user-facing labels in the prode frontend MUST be written in Spanish (Argentine / rioplatense). Apply whenever adding or reviewing any visible text in .ts/.tsx files under frontend/src — page titles, button labels, form labels, placeholders, dialog text, snackbars, alerts, empty states, aria-labels, table headers, navigation entries, error messages, confirm() prompts, and the HTML <title> / PWA manifest.
---

# Spanish labels (prode frontend)

The prode app ships in **Argentine Spanish**. Every string the user can read or hear must be in Spanish — no English fallbacks, no mixed-language UIs.

## Scope

This rule applies to all user-facing text, including:

- `<Typography>`, `<Button>`, `<Alert>`, `<Chip>`, `<Snackbar>` content
- `label`, `placeholder`, `helperText`, `aria-label`, `title` props on MUI components
- `header` strings in `ColumnDef` for `@tanstack/react-table`
- Empty-state strings (e.g. `empty` prop on `DataTable`, `"No results"` fallback)
- `window.confirm(...)`, `window.alert(...)`, `window.prompt(...)` messages
- Error messages shown to the user (the string passed to `setError`, default fallbacks like `'Login failed'`)
- The HTML `<title>`, `<meta name="apple-mobile-web-app-title">`, and PWA `manifest.name` / `short_name` / `description` in `vite.config.ts`
- Toast / snackbar / dialog titles and body copy

Out of scope (keep in English):

- Code identifiers: variable names, component names, function names, type names, query keys, route paths.
- Log messages, dev-only `console.*` output.
- Backend API field names — DTOs stay camelCase English.
- Imports, comments aimed at developers, JSDoc.
- Status enum values that come from the backend (`'scheduled'`, `'live'`, `'finalized'`, `'admin'`, `'user'`). If you want to display them in Spanish, map them at the render boundary (e.g. a `statusLabel(s)` helper), don't translate the enum itself.

## Style — Argentine Spanish

- Use **voseo** in informal copy where natural: "Iniciá sesión", "Cargá tu pronóstico", "Todavía no hiciste ningún pronóstico." Avoid Castilian "tú" / "vosotros" forms.
- Use Argentine vocabulary: **DNI** (not "documento de identidad / cédula"), **partido** (not "encuentro" / "juego"), **pronóstico** (not "predicción"), **liga** (not "competición"), **equipo local / visitante** (not "casa / fuera").
- Open questions and exclamations with `¿` / `¡`. Use proper accents (á é í ó ú ñ ¿ ¡).
- Sentence case for buttons and headings, not Title Case: "Nuevo partido", not "Nuevo Partido".
- Keep it concise — mobile-first layout has little room. Prefer "Cerrar sesión" over "Cerrar la sesión", "Guardar" over "Guardar cambios" when context is clear.

## Canonical glossary

Use these translations consistently across the app. If you need a new term, add it here.

| English | Spanish |
|---|---|
| Sign in / Log in | Iniciar sesión |
| Sign in (button, in progress) | Iniciando sesión… |
| Log out / Logout | Cerrar sesión |
| Login failed | Error al iniciar sesión |
| Email | Email |
| Password | Contraseña |
| Government ID | DNI |
| Email or government ID | Email o DNI |
| Name | Nombre |
| Role | Rol |
| Created | Creado |
| Owner | Propietario |
| Leagues | Ligas |
| League | Liga |
| Matches | Partidos |
| Match | Partido |
| Upcoming matches | Próximos partidos |
| Home (team) | Local |
| Away (team) | Visitante |
| Home team | Equipo local |
| Away team | Equipo visitante |
| Home score | Goles local |
| Away score | Goles visitante |
| Kickoff | Inicio |
| Status | Estado |
| Score / Scoreboard | Marcador |
| Predicted | Pronóstico |
| Predictions | Pronósticos |
| My predictions | Mis pronósticos |
| Users | Usuarios |
| User | Usuario |
| New \<x\> (button) | Nuevo/Nueva \<x\> (match gender) |
| Create | Crear |
| Save | Guardar |
| Save & score | Guardar y puntuar |
| Cancel | Cancelar |
| Delete | Eliminar |
| Delete this \<x\>? | ¿Eliminar este/esta \<x\>? |
| Reload | Recargar |
| Go home | Ir al inicio |
| Open menu | Abrir menú |
| No results | Sin resultados |
| Loading… | Cargando… |
| Failed to \<verb\> \<x\> | No se pudo \<verb\> el/la \<x\> |
| The page you are looking for does not exist. | La página que buscás no existe. |
| You haven't made any predictions yet. | Todavía no hiciste ningún pronóstico. |
| App ready to work offline | La app está lista para funcionar sin conexión |
| A new version is available | Hay una nueva versión disponible |
| Sports predictions app | App de pronósticos deportivos |

Brand name **Prode** is a proper noun — leave it as-is in both languages, including "Prode Admin".

## Authoring checklist

When writing or editing a `.tsx`/`.ts` file in `frontend/src/`:

1. Any new string literal that will reach the DOM → write it directly in Spanish; do not write English-first and translate later.
2. Match the glossary above. If the term is missing, pick a translation in the same Argentine register and add it to the glossary in this skill.
3. Watch for easy-to-miss spots: `aria-label`, `title`, `header` in tanstack columns, `empty` on `DataTable`, default fallback messages in `catch` blocks (`err instanceof ApiError ? err.message : 'Failed to …'`).
4. Confirm dialogs (`window.confirm(...)`) — translate the prompt too.
5. When editing `index.html` or `vite.config.ts`, set `lang="es"` and translate the PWA `description`; keep `name`/`short_name` as "Prode".

## Backend strings

API error messages returned from the backend may currently be English. When `ApiError.message` is shown directly to the user, that's a known gap — flag it but don't translate the backend response on the client. If a fallback is needed, prefer a Spanish default (`'Ocurrió un error'`) over passing through the raw English message.
