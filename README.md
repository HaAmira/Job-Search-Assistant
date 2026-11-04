# Hidani Tech Assessment — AI Job Chat Assistant

A React/Vite frontend and Node.js/Express/TypeScript backend for resume parsing, job matching, conversational job search, and application tracking.

## Features

- PDF/DOC/DOCX resume upload, parsing with Groq when configured, and deterministic fallback parsing.
- Deterministic job ranking and natural-language filters.
- MongoDB-backed anonymous bearer sessions and application history.
- Duplicate application prevention using a unique `(sessionId, jobId)` index.
- Job data loaded from `backend/data/jobs.json`; an optional scraper gathers listings from public job feeds.
- CORS and in-memory per-IP rate limiting.

## Requirements

- Node.js 20 or later and npm.
- MongoDB locally or a MongoDB Atlas database.
- Groq API key is optional; without it, parsing and intent detection use deterministic fallbacks.

## Install

Run these commands from the repository root:

```bash
cd backend
npm ci
cd ../frontend
npm ci
cd ..
```

The root `package.json` provides convenience scripts and does not require separate root dependencies for the application.

## Environment setup

### Backend

Copy the root template to `backend/.env`:

```powershell
Copy-Item .env.example backend/.env
```

On macOS/Linux:

```bash
cp .env.example backend/.env
```

Set the following backend values in `backend/.env`:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | Local URI such as `mongodb://127.0.0.1:27017/hidani_jobs`, or an Atlas connection string. Keep credentials private. |
| `GROQ_API_KEY` | No | Private Groq API key. Leave the placeholder if using deterministic fallback only. |
| `GROQ_MODEL` | No | Groq model ID accessible to your account; default is `openai/gpt-oss-20b`. |
| `CLIENT_URL` | Production | Exact frontend origin, without a path or trailing slash. Multiple comma-separated origins are supported. |
| `PORT` | No | Backend listening port; defaults to `5000` locally. Render supplies this in production. |
| `NODE_ENV` | No | Set to `production` in deployment. |
| `TRUST_PROXY` | No | Set to `true` behind Render's proxy so IP-based rate limiting can use the client IP. |
| `MAX_FILE_SIZE_MB` | No | Maximum in-memory resume upload size; defaults to `5`. |
| `UPLOAD_DIR` | No | Retained for compatibility; uploads are processed in memory. |

Never commit `.env` files or put the Groq key or MongoDB credentials in frontend variables.

### Frontend

For local development, leave `VITE_API_URL` unset; Vite proxies `/api` requests to `http://localhost:5000`.

For direct local API requests, copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL=http://localhost:5000/api`.

For Vercel, configure this build-time variable in the Vercel project:

```text
VITE_API_URL=https://<your-render-service>.onrender.com/api
```

This value is public frontend configuration (the API base URL), not a secret. Do not put credentials in any `VITE_` variable. Redeploy after changing it.

## Development

Start the backend and frontend in separate terminals from the repository root:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

The backend listens on port `5000` by default; the Vite development server listens on port `5173`.

## Tests and production builds

Run from the repository root:

```bash
npm run test:backend
npm run build:backend
npm run build:frontend
```

Equivalent package-local commands are `cd backend && npm test && npm run build` and `cd frontend && npm run build`.

Validate the bundled job data:

```bash
npm run validate:jobs
```

The scraper makes external requests and can replace the catalog only after the new data validates. Do not run `npm run scrape` as part of tests or when offline.

## Anonymous session security

The application does not implement user accounts or password authentication. It uses a cryptographically random session bearer ID stored in browser local storage. Possession of this ID grants access to the associated resume, conversation, and applications; treat it like a password and do not share it. This design does not provide account recovery or identity verification. Existing IDs from the older weak format are replaced with new secure IDs; old anonymous sessions are not migrated.

Rate limiting is per process and per client IP. It is suitable for a single instance but is not shared across instances; use a shared store such as Redis before scaling the backend horizontally.

## Deployment

### Render backend

The root `render.yaml` configures the backend service (`rootDir: backend`). Deploy it on Render and set:

- `MONGODB_URI` to the private Atlas/local-service connection URI.
- `CLIENT_URL` to the exact HTTPS Vercel frontend origin, for example `https://your-app.vercel.app` (no trailing slash). Separate multiple allowed origins with commas.
- `GROQ_API_KEY` only if using Groq features. Keep it in Render's secret environment settings.
- `GROQ_MODEL` to a model available to the configured Groq account.
- `NODE_ENV=production` and `TRUST_PROXY=true` are set in `render.yaml`.

Render provides `PORT`; do not hardcode a deployment port. The backend production CORS check fails fast when `CLIENT_URL` is not configured.

### Vercel frontend

Configure the Vercel project root/build directory as `frontend`, use `frontend/vercel.json`, and set the `VITE_API_URL` environment variable to the deployed Render URL ending in `/api`. No backend credentials belong in Vercel frontend variables. The frontend and backend must both be deployed and their origins configured before end-to-end operation can be verified.

The checked-in configuration does not prove that hosted services, production MongoDB connectivity, or live Groq model access are working. Verify those in the respective provider dashboards and with deployment health/API checks.

## API overview

- `POST /api/chat`
- `POST /api/resume/upload`, `GET /api/resume`, `PUT /api/resume`
- `GET /api/jobs`, `GET /api/jobs/:jobId`
- `POST /api/applications`, `GET /api/applications`
- `GET /api/session`
- `GET /health`

Session-scoped endpoints require the `x-session-id` bearer header. Job listing can be used without a session for guest recommendations.
