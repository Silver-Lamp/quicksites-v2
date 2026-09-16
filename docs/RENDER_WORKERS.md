# Owner-run render workers (the Mac minis)

> Added 2026-09-16. Offloads headless-browser work from Vercel serverless functions to machines
> the owner runs at home. **An optimisation with a hard fallback, never a dependency**: if no
> worker is alive, everything renders on Vercel exactly as before.

## What moves, what does not

| Work | Where it runs with a worker alive | Without one |
|---|---|---|
| URL-rebuild catalog reads (`lib/rebuild/renderedCatalog.ts`, kind `catalog`) | the worker | Vercel serverless Chromium |
| Verify renders (kind `verify`) — the worker supports it; the probe route deliberately keeps forcing the serverless driver so it keeps testing the runtime | worker-ready, not routed yet | Vercel |
| Postgres, auth, public site hosting | **unchanged** — Supabase and Vercel | — |

## How it works

1. A route calls `renderViaQueue(kind, url, opts, local)` (`lib/jobs/renderQueue.ts`).
2. If `RENDER_WORKERS_ENABLED=1` **and** a row in `render_workers` heartbeated within 30s with
   that capability, a `render_jobs` row is inserted; otherwise `local()` runs immediately.
3. A worker claims the job with `claim_render_job()` (`FOR UPDATE SKIP LOCKED`, so two minis
   polling at once are safe), renders it with the **same page-side script** the serverless path
   uses, and writes `result` or `error`.
4. The route polls every 500ms. Worker result → used. Not claimed within **6s** → job expired,
   `local()` runs. Worker failure or the deadline → `local()` runs. Every non-worker path ends
   in the render the process would have done anyway.

The job row carries a **URL and options, never JavaScript**. The worker picks the script from a
fixed map keyed by `kind`, and passes every URL through the same `assertPublicHttpUrl()` guard as
the serverless scrapers, so a tampered row cannot run code on the mini or make it browse the
home LAN. Both tables are service-role only.

## Setting up a Mac mini

The worker runs from a checkout of this repo. The **service-role key on that machine is full
database access** — treat the mini as a server: no shared logins, disk encryption on, nothing
else running as that user.

```bash
# once
git clone git@github.com:Silver-Lamp/quicksites-v2.git ~/quicksites && cd ~/quicksites
nvm use && npm ci
npx playwright install chromium
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
RENDER_WORKER_ID=mini-1          # mini-2 on the other box
RENDER_WORKER_CONCURRENCY=2
EOF

# keep the box awake and on the network
sudo pmset -a sleep 0 disksleep 0 displaysleep 10 womp 1 autorestart 1

# run it
npm run render:worker
```

Verify from anywhere: `GET /api/admin/render-workers` shows `alive: true` for the worker and the
last 25 jobs. Then set **`RENDER_WORKERS_ENABLED=1`** in Vercel (production) and redeploy;
`/status` reports `render_workers: ready`. Until that flag is set, workers idle and Vercel
renders — safe order: worker first, flag second.

### Run on boot (launchd)

`~/Library/LaunchAgents/ai.quicksites.render-worker.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>ai.quicksites.render-worker</string>
  <key>WorkingDirectory</key><string>/Users/YOU/quicksites</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>-lc</string><string>source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run render:worker</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/YOU/Library/Logs/render-worker.log</string>
  <key>StandardErrorPath</key><string>/Users/YOU/Library/Logs/render-worker.log</string>
</dict></plist>
```

`launchctl load ~/Library/LaunchAgents/ai.quicksites.render-worker.plist`. Auto-login must be on
for a LaunchAgent to start after a power cut (or use a LaunchDaemon). Updating the worker is
`git pull && npm ci` and a `launchctl kickstart -k gui/$(id -u)/ai.quicksites.render-worker`.

## Operating it

- **Two minis = two workers.** Both poll the same queue; `SKIP LOCKED` divides the work. One
  down → the other takes everything; both down → Vercel takes everything.
- **Nothing pages you when both are down**, by design of the fallback; the signal is the
  `via`/`driver` field on rebuild summaries and the admin route. Add a heartbeat alert only once
  a workload actually depends on the minis.
- **Cost:** none beyond electricity. What it saves is Vercel function-seconds on the 120s
  rebuild route and the serverless Chromium cold start (roughly 5s per render).
- **Kill switch:** unset `RENDER_WORKERS_ENABLED` (Vercel) or stop the worker; either way the
  next render runs serverless.

## Adding a job kind

1. Add the page-side script to `JS_BY_KIND` in `scripts/render-worker.ts` and the kind to the
   `render_jobs.kind` check constraint (a migration).
2. Call `renderViaQueue('<kind>', url, opts, local, defaultRenderQueueDeps())` from the route.
3. Restart the workers so they advertise the new capability.
