# Deploying with Docker Compose + Tailscale Funnel

This deploys the whole app (Postgres + backend + frontend behind nginx) on
any Linux host and exposes it on a **stable** `https://<host>.<tailnet>.ts.net`
URL — no domain, no port-forwarding, and the URL does **not** change when you
restart or redeploy.

Ideal for a Proxmox LXC container or VM.

---

## What you get

```
                          ┌───────────────────────────────┐
   public internet ──────▶│ <host>.<tailnet>.ts.net (HTTPS) │
                          └───────────────┬───────────────┘
                                          │
                                 tailscale (container, Funnel)
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
`nesting=1` and `keyctl=1` enabled, otherwise Docker won't start.
(Datacenter → your LXC → Options → Features.) The Tailscale container also
needs access to `/dev/net/tun`; on LXC enable the **TUN/TAP** device.

You do **not** need to install Tailscale on the host — it runs as a container,
defined in `docker-compose.yaml`.

---

## 2. Get a Tailscale auth key + enable Funnel (one-time)

1. Create a free account at https://tailscale.com and create a **tailnet**.
2. Generate a **reusable** auth key:
   https://login.tailscale.com/admin/settings/keys → *Generate auth key* →
   enable **Reusable** (and **Ephemeral** if you don't want the node to linger
   after `docker compose down`). Copy the `tskey-auth-…` value.
3. **Enable HTTPS** for your tailnet (required for Funnel):
   https://login.tailscale.com/admin/dns → *Enable MagicDNS* + *Enable HTTPS*.
4. **Allow Funnel** in your tailnet policy (ACL). Add a `nodeAttrs` grant for
   the Funnel attribute, e.g.:

   ```jsonc
   "nodeAttrs": [
     { "target": ["*"], "attr": ["funnel"] }
   ]
   ```

   (Or scope `target` to a tag you assign the container.)

---

## 3. Configure environment

```bash
git clone <this repo> payable
cd payable
cp .env.example .env
# Edit .env — at minimum set:
#   JWT_SECRET, POSTGRES_PASSWORD
#   TS_AUTHKEY   (the tskey-auth-… from step 2)
#   TS_HOSTNAME  (first label of the public URL, e.g. "payables")
```

Notes:
- The public URL becomes `https://<TS_HOSTNAME>.<your-tailnet>.ts.net`.
- `APP_PORT` is the host port nginx publishes on (default `80`). With Funnel
  you don't need to publish it at all — the tunnel reaches nginx **inside** the
  docker network — but it's handy for hitting the app from the host LAN.
- `DATABASE_URL` is **not** set here; compose builds it from the `POSTGRES_*`
  vars and injects it into the backend container.
- **Keep `TS_AUTHKEY` out of git.** `.env` is gitignored; only `.env.example`
  (with a placeholder) is committed.

---

## 4. Boot it

```bash
docker compose up -d --build
```

Watch it come up:

```bash
docker compose ps
docker compose logs -f tailscale
```

---

## 5. Run migrations + (optional) seed

The backend image ships with `drizzle-kit`:

```bash
docker compose exec backend pnpm exec drizzle-kit migrate
# Optional demo data:
docker compose exec backend pnpm exec tsx src/db/seed.ts
```

---

## 6. Get (confirm) your public URL

The URL is deterministic — `https://<TS_HOSTNAME>.<your-tailnet>.ts.net` — but
you can confirm the device is up and Funnel is serving:

```bash
docker compose exec tailscale tailscale status
docker compose exec tailscale tailscale funnel status
```

Open the URL in a browser — you should land on the SPA, and the API calls hit
the backend over the same origin. HTTPS (with a valid cert) is automatic.

---

## How the Funnel is configured

The `tailscale` service mounts [`tailscale/funnel.json`](tailscale/funnel.json)
as its `TS_SERVE_CONFIG`. That file declaratively serves `frontend:80` on the
public `:443` Funnel and turns Funnel on — no manual `tailscale funnel` command,
and it re-applies automatically on every restart. The device identity (and thus
the stable hostname) lives in the `tailscale_state` volume.

---

## Common ops

| Task                            | Command                                                       |
|---------------------------------|---------------------------------------------------------------|
| Rebuild after a code change     | `docker compose up -d --build`                                |
| Tail backend logs               | `docker compose logs -f backend`                              |
| Show tunnel / Funnel status     | `docker compose exec tailscale tailscale funnel status`       |
| Restart the tunnel (same URL)   | `docker compose restart tailscale`                            |
| Stop everything                 | `docker compose down`                                         |
| Wipe the database               | `docker compose down -v` (⚠️ also drops the tailscale state)  |
| Open a psql shell               | `docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB` |

> Note: `docker compose down -v` removes the `tailscale_state` volume too. If
> you used a non-ephemeral auth key the node will re-register on next boot with
> the same hostname (so the same URL), as long as the hostname isn't already
> taken by a lingering node — clean up stale nodes in the admin console.

---

## Troubleshooting

- **`tailscale` keeps restarting / never authenticates** — check
  `docker compose logs tailscale`. Most often the `TS_AUTHKEY` is expired or
  not reusable, or the container can't reach `/dev/net/tun` (enable TUN on LXC).
- **URL returns a Tailscale 502 / "no Funnel"** — Funnel isn't allowed for the
  node. Confirm HTTPS is enabled for the tailnet and the `funnel` nodeAttr
  grant covers this device (step 2).
- **Frontend loads but API calls 404** — confirm nginx is using
  `apps/frontend/nginx.conf` and the backend container is named `backend` on
  the compose network (it is, by default).

---

## Alternative: Cloudflare Named Tunnel

If you'd rather use Cloudflare and already own a domain on Cloudflare DNS, you
can swap the `tailscale` service for `cloudflare/cloudflared` running a **named**
tunnel (`tunnel run --token <TUNNEL_TOKEN>`) and route a hostname to it in the
Zero Trust dashboard. That also yields a stable URL, but requires a domain.
Tailscale Funnel is the no-domain default here.
