# Deploying with Docker Compose + Cloudflare Quick Tunnel

This deploys the whole app (Postgres + backend + frontend behind nginx) on
any Linux host and exposes it on a free random `*.trycloudflare.com` URL —
no domain, no Cloudflare account, no port-forwarding required.

Ideal for a Proxmox LXC container or VM.

---

## What you get

```
                          ┌──────────────────────────┐
   public internet ──────▶│ *.trycloudflare.com (HTTPS) │
                          └────────────┬─────────────┘
                                       │
                              cloudflared (container)
                                       │
                                       ▼
                          ┌──────────────────────────┐
                          │   nginx (frontend:80)    │
                          │  / → SPA                 │
                          │  /api, /health → backend │
                          └────────────┬─────────────┘
                                       │
                                       ▼
                          ┌──────────────────────────┐
                          │      backend:8080        │
                          └────────────┬─────────────┘
                                       │
                                       ▼
                          ┌──────────────────────────┐
                          │      postgres:5432       │
                          └──────────────────────────┘
```

Frontend and backend share one origin, so no CORS gymnastics and only one
tunnel is needed.

---

## 1. Prereqs on the host (Proxmox LXC / VM / any Linux)

Install Docker + the compose plugin:

```bash
curl -fsSL https://get.docker.com | sh
```

On a Proxmox **LXC** container, make sure it's a privileged container or has
`nesting=1` and `keyctl=1` features enabled, otherwise Docker won't start.
(Datacenter → your LXC → Options → Features.)

You do **not** need to install `cloudflared` on the host — it runs as a
container, defined in `docker-compose.yaml`.

---

## 2. Configure environment

```bash
git clone <this repo> payable
cd payable
cp .env.example .env
# Edit .env — at minimum change JWT_SECRET and POSTGRES_PASSWORD.
```

Notes:
- `APP_PORT` is the host port nginx publishes on. Default `80`. Change it
  (e.g. `8080`) if something already binds to 80 on the host. The tunnel
  reaches nginx **inside** the docker network, so the published port only
  matters if you also want to hit the app directly from the host LAN.
- `DATABASE_URL` is **not** set here — compose builds it from the
  `POSTGRES_*` vars and injects it into the backend container.

---

## 3. Boot it

```bash
docker compose up -d --build
```

Watch it come up:

```bash
docker compose ps
docker compose logs -f backend
```

---

## 4. Run migrations + (optional) seed

The backend image ships with `drizzle-kit`, so you can run migrations
inside the running backend container:

```bash
docker compose exec backend pnpm exec drizzle-kit migrate
# Optional demo data:
docker compose exec backend pnpm exec tsx src/db/seed.ts
```

---

## 5. Get your public URL

The `cloudflared` container starts a **Quick Tunnel** automatically and
prints the URL to its logs.

```bash
docker compose logs cloudflared | grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com'
```

You'll see something like:

```
https://shiny-otter-vacation-1234.trycloudflare.com
```

That's your public URL. HTTPS is included. Open it in a browser — you
should land on the SPA, and the API calls will hit the backend.

To follow logs live (e.g. after restart):

```bash
docker compose logs -f cloudflared
```

---

## ⚠️ Important caveats of Quick Tunnels

- **The URL changes every time `cloudflared` restarts.** Quick Tunnels are
  ephemeral by design.
- They're meant for demos/testing, not production traffic. There is no SLA.
- Rate limits are modest but fine for personal/portfolio use.

### If you want a **stable** URL later

You have two options, both still free-ish:

1. **Named Cloudflare Tunnel** (recommended if you ever buy a domain) —
   requires a free Cloudflare account and a domain on Cloudflare DNS. You
   replace the `command:` in the `cloudflared` service with
   `tunnel run --token <TUNNEL_TOKEN>` and route a hostname to the tunnel
   in the Cloudflare Zero Trust dashboard. Domains can be had for ~$1/yr
   (`.xyz`) or free via Freenom-style providers.
2. **Tailscale Funnel** — stable `https://<host>.<tailnet>.ts.net` URL
   without a domain. Swap the `cloudflared` service for the `tailscale/tailscale`
   image and run `tailscale funnel 80`.

---

## Common ops

| Task                            | Command                                                  |
|---------------------------------|----------------------------------------------------------|
| Rebuild after a code change     | `docker compose up -d --build`                           |
| Tail backend logs               | `docker compose logs -f backend`                         |
| Show the current tunnel URL     | `docker compose logs cloudflared \| grep trycloudflare`  |
| Restart the tunnel (new URL!)   | `docker compose restart cloudflared`                     |
| Stop everything                 | `docker compose down`                                    |
| Wipe the database               | `docker compose down -v` (⚠️ deletes the volume)         |
| Open a psql shell               | `docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB` |

---

## Troubleshooting

- **`cloudflared` keeps restarting / no URL** — check `docker compose logs cloudflared`.
  Quick Tunnels occasionally fail if the host can't reach `*.argotunnel.com`
  on UDP/443. Most home networks are fine; restrictive corporate networks
  may need `--protocol http2`.
- **502 from the tunnel** — nginx is up but can't reach the backend.
  Check `docker compose logs backend`; most often it's a missing
  `JWT_SECRET` or `POSTGRES_*` mismatch.
- **Frontend loads but API calls 404** — confirm the nginx config is the
  one in `apps/frontend/nginx.conf` and that the backend container is
  named `backend` on the compose network (it is, by default).
