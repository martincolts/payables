# Review Feedback — Action Plan

Plan to address reviewer feedback on the Payables submission. Items are ordered
by impact. Each has concrete steps so it can be picked up later.

## Feedback summary

The product is strong; four cheap fixes are holding the score back:

1. **Ephemeral public URL** — the free Cloudflare Quick Tunnel issues a new
   random `*.trycloudflare.com` URL on every restart. README warnings don't
   help a reviewer; a dead link sinks the submission below others. → Move to a
   **stable URL** (decision: **Tailscale Funnel**).
2. **Private repo** — make `martincolts/payables` public to avoid
   reviewer ↔ recruiter ↔ candidate back-and-forth.
3. **Missing core feature of the reference** — for a Ramp Bill Pay clone, the
   core is **invoice ingestion/capture**. It's currently fully manual and listed
   under "left out." Mocking it inline with the real flow is valid. → Plan only
   for now.
4. **Auth** — password login isn't required; multi-role is a plus. Multi-role
   (admin/approver) already exists end-to-end. → Reduce login friction.

---

## 1. Stable public URL via Tailscale Funnel  *(DONE)*

Replaced the ephemeral Quick Tunnel with a Funnel that gives a permanent
`https://<host>.<tailnet>.ts.net`.

- [x] **`docker-compose.yaml`** — swapped the `cloudflared` service for the
      `tailscale/tailscale` image:
  - [x] State mounted on a named volume (`tailscale_state` → `/var/lib/tailscale`)
        so the node identity (and hostname) persists across restarts.
  - [x] Added `TS_AUTHKEY` + `TS_HOSTNAME` to `.env.example` (and `.env`).
  - [x] `cap_add: [NET_ADMIN]` + `/dev/net/tun` for networking.
  - [x] Declarative Funnel via `TS_SERVE_CONFIG` → `tailscale/funnel.json`
        (serves `frontend:80` on public `:443`, same-origin, no manual command).
- [x] **`README.md`** — removed the "changes every time" warning and the live
      `trycloudflare.com` link; replaced with the fixed `.ts.net` URL and updated
      the `$URL` note in the API walkthrough.
- [x] **Deploy docs** — replaced `CLOUDFLARE.md` with a Tailscale-first
      `DEPLOY.md` (auth key, HTTPS/Funnel enablement, ACL grant, ops table).
- [x] **Validated** — `docker compose config` parses cleanly; the `:?` guard
      correctly requires `TS_AUTHKEY`.
- [ ] **Final verify (needs a host + tailnet)** — `docker compose up -d --build`
      on the deploy host, confirm the `.ts.net` URL serves SPA + `/api` and is
      unchanged after `docker compose restart tailscale`.

## 2. Make the repo public  *(pre-flight DONE — ready to flip)*

- [x] Pre-flight before flipping `martincolts/payables` to public:
  - [x] `.gitignore` ignores `.env` / `.env.*` (except `.env.example`); only the
        three `.env.example` files are tracked — no real `.env` committed.
  - [x] Scanned git history: no `.env` ever committed, no leaked
        `JWT_SECRET` / `POSTGRES_PASSWORD` (local `JWT_SECRET` is just the
        `change-me-in-production` placeholder).
  - [x] `TS_AUTHKEY` lives only in `.env` (gitignored); `.env.example` carries a
        placeholder.
- [ ] **Flip visibility to public** (manual — needs `gh`/GitHub access; `gh` not
      installed locally).
- [ ] Confirm a clean clone builds from the README alone.

## 3. Mocked invoice ingestion  *(implementation plan — not built yet)*

The core Bill Pay feature that's currently manual. Additive to the existing
create-bill flow; manual entry stays as-is.

- [ ] **Backend** (layered: route → service → repo):
  - [ ] `POST /api/bills/extract` accepts an uploaded file (PDF/image), returns
        canned structured fields — `vendorName`, `amount`, `dueDate`,
        `lineItems[]`, plus per-field `confidence`.
  - [ ] Logic behind an `extractionService` with a single `extract(file)`
        method, so a real Textract/DocAI call drops in later with no route/schema
        change (same pattern the README uses for `paymentService`).
  - [ ] No new tables for the mock; file not persisted (or stored transiently).
  - [ ] Add the matching `*.integration.test.ts` per the integration-testing
        skill.
- [ ] **Frontend**:
  - [ ] "Upload invoice" button on the create-bill screen → file picker →
        brief "Extracting…" state → pre-fills the **existing** form fields; user
        reviews and submits through the normal path.
  - [ ] Highlight low-confidence fields to mimic a real review queue.
  - [ ] Use react-toastify for status (per repo skill).
- [ ] Label it clearly as mocked in the UI and in the README "what's mocked"
      section.

## 4. Lower auth friction (multi-role already exists)  *(DONE)*

Multi-role enforcement already exists (`apps/backend/src/middleware/auth.ts`,
seeded admin/approver users) — this is about reducing friction.

- [x] Added **one-click demo-login buttons** (Admin / Approver) on the login
      screen (`apps/frontend/src/pages/Login.tsx`) so the reviewer skips typing
      `password123` — each fills the seeded creds and signs in.
- [x] Surfaced the active role as a chip in the sidebar footer
      (`apps/frontend/src/components/AppShell.tsx`) so multi-role is visible.
- [x] Password login left fully intact (form unchanged; demo buttons are
      additive). Frontend `typecheck` passes.

---

## Suggested order

1. **#1 Tailscale Funnel** and **#2 repo public** — the rejection risks, both
   quick.
2. **#4 demo-login** — small.
3. **#3 invoice ingestion** — build when ready.
