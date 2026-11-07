# SambungJaga AI — Deployment & Infrastructure Architecture Guide

## 1. Vercel Deployment (Frontend & Serverless Functions)
* **Frontend Application**: Vite + React single-page app deployed to Vercel CDN.
* **Serverless API Endpoints**:
  * `/api/cron-automation`: Unified serverless cron automation handler.
  * `/api/cron-scheduler`: Serverless schedule sweep handler.
  * `/api/cron-worker`: Serverless queue worker job handler.
* **Cron Configuration (`vercel.json`)**:
  * The repository currently schedules `/api/cron-automation` at `0 6 * * *` (06:00 UTC). Confirm execution time, quotas, and cron availability against the deployment plan before relying on it.
  * Every request must include `Authorization: Bearer <CRON_SECRET>`. Caller-supplied Vercel-looking headers are not trusted.

## 2. External scheduler option
For a higher execution frequency than the configured Vercel schedule, an external scheduler may call the endpoint. Verify provider frequency limits and configure the `Authorization` header explicitly:
* **Supabase `pg_cron`**: Schedule an HTTP request in PostgreSQL to `https://<your-app>.vercel.app/api/cron-automation` with `Headers: {"Authorization": "Bearer <CRON_SECRET>"}`.
* **A webhook scheduler**: Send a request to `/api/cron-automation` with `Authorization: Bearer <CRON_SECRET>`. The endpoint does not validate third-party signature headers unless a dedicated adapter is added.

## 3. Persistent 24/7 Server Daemon (Optional Background Node.js Runtime)
For continuous 24/7 background worker execution (e.g. Render, Railway, Fly.io, PM2, Docker):
* Execute: `npm run server:start` (`node scripts/run-server-daemon.js`)
* Supervisors:
  * Worker: `scripts/server-worker.js`
  * Scheduler: `scripts/server-scheduler.js`
  * Health Endpoint: `http://localhost:3001/health`


## 4. Required private environment settings

- `CRON_SECRET`: random secret (minimum 32 characters), different from `SUPABASE_SERVICE_ROLE_KEY`.
- `SUPABASE_PROJECT_URL` and `SUPABASE_SERVICE_ROLE_KEY`: server-only; never prefix these with `VITE_`.
- `FACILITY_ID`: required by the standalone worker/scheduler. Do not use a hard-coded tenant fallback.
- `DB_SSL_REJECT_UNAUTHORIZED=true`: keep certificate validation enabled outside isolated local testing.

Do not expose service-role credentials, database passwords, AI provider keys, or cron secrets in frontend variables.
