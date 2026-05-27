---
name: pnpm
description: Use pnpm (not npm or yarn) for all Node package management across the prode Nx monorepo (frontend + backend). Apply whenever installing, updating, removing, or running package scripts / Nx targets in the repo.
---

# pnpm (prode Nx monorepo)

**pnpm is the only supported package manager for this project.** Never run `npm install`, `npm run`, `yarn`, `npx`, or commit `package-lock.json` / `yarn.lock`.

The repo is an **Nx monorepo with pnpm workspaces**: one lockfile and one `node_modules` at the root, projects under `apps/` (`apps/frontend`, `apps/backend`) and shared code under `libs/` (`libs/shared-types`). Dependencies are installed from the repo root; per-project work is driven through **Nx targets**, not by `cd`-ing into a package and running a bare script.

## Command mapping

| Intent | Use | Don't use |
|---|---|---|
| Install all deps | `pnpm install` | `npm install`, `yarn` |
| Add a dep to a project | `pnpm add <pkg> --filter <project>` | `npm install <pkg>` |
| Add a dev dep (root tooling) | `pnpm add -Dw <pkg>` | `npm install --save-dev <pkg>` |
| Remove a dep | `pnpm remove <pkg> --filter <project>` | `npm uninstall <pkg>` |
| Update | `pnpm update [<pkg>]` | `npm update` |
| Run a project task | `pnpm nx <target> <project>` (e.g. `pnpm nx serve backend`) | `npm run dev` |
| Run a root script | `pnpm <script>` | `npm run <script>` |
| One-off binary | `pnpm dlx <pkg>` | `npx <pkg>` |
| Clean reinstall | `pnpm install --frozen-lockfile` (CI) or delete `node_modules` and `pnpm install` | — |

Always install from the **repo root**. Use `--filter <project>` (or `-w` for root-level dev tooling) to target a package — never `cd apps/frontend && pnpm add`. `pnpm <script>` works without `run` for any root script not colliding with a built-in pnpm command; for shadowing names (`test`, `install`) use `pnpm run <script>`.

## Nx targets

Per-project work goes through Nx so caching and the task graph apply. Invoke Nx via pnpm (no global install, no `npx`):

| Intent | Command |
|---|---|
| Serve one app | `pnpm nx serve frontend` / `pnpm nx serve backend` |
| Build one app | `pnpm nx build <project>` |
| Lint / test one project | `pnpm nx lint <project>` / `pnpm nx test <project>` |
| Run a target everywhere | `pnpm nx run-many -t build` (or `test`, `lint`) |
| Only what changed | `pnpm nx affected -t test --base=main` |
| Drizzle migration (backend) | `pnpm nx run backend:migrate` (wraps `drizzle-kit`) |
| Scaffold a project/lib | `pnpm nx g @nx/node:app <name>` / `@nx/react:app` / `@nx/js:lib` |

Prefer `nx affected` in CI over rebuilding the world. Don't bypass Nx by running a tool (`vite`, `tsc`, `drizzle-kit`) directly when a target exists — you lose caching and the dependency graph.

## Lockfile

- The lockfile is **`pnpm-lock.yaml`**. Commit it. Never commit `package-lock.json` or `yarn.lock`.
- If you see a `package-lock.json` in this repo, delete it — it is a mistake.
- CI must use `pnpm install --frozen-lockfile` so the lockfile is the source of truth.

## Engine pinning

`package.json` should declare:

```json
"packageManager": "pnpm@9",
"engines": { "node": ">=20" }
```

Use `corepack enable` once on a fresh machine so the right pnpm version is resolved automatically.

## When writing docs, scripts, or commit messages

- Show `pnpm` commands, not `npm`. Update any `npm install` / `npm run` references when editing existing docs.
- README / CLAUDE.md examples must read `pnpm install`, then Nx targets for project work: `pnpm nx serve frontend`, `pnpm nx build backend`, `pnpm nx run-many -t lint`.
- Dockerfiles and CI workflows for the frontend must install pnpm (via `corepack enable` or the `pnpm/action-setup` action) before running install.

## Workspaces

The repo **is** a pnpm workspace — `pnpm-workspace.yaml` lists `apps/*` and `libs/*`. Cross-package dependencies (e.g. `apps/frontend` consuming `libs/shared-types`) use the `workspace:*` protocol in `package.json`. Never npm/yarn workspaces.

## Don'ts

- No `npx` — use `pnpm dlx`.
- No `package-lock.json` / `yarn.lock` committed.
- No mixing managers in one repo (a single `pnpm-lock.yaml` only).
- Don't add `npm` invocations to scripts inside `package.json`. Scripts can call each other via `pnpm <script>` if needed, but bare script names (e.g. `"build": "tsc -b && vite build"`) are preferred since `pnpm <script>` runs them directly.
