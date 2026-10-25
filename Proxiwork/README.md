# ProxiWork

Single-project Vercel deployment with a Vite React frontend and FastAPI API.

## Local setup

1. Copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY` to the Supabase project URL and public publishable/anon key. This file must be inside `frontend/`; the root `Proxiwork/.env.local` is not loaded by Vite when the frontend is built. `VITE_*` values are browser-visible, so never put a service-role key there.
2. Copy `backend/.env.example` to a local backend environment file if server-side Supabase or database access is added. To enable CV suggestions, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `OPENAI_API_KEY` as server environment variables. Do not commit these values. For example, in PowerShell: `$env:OPENAI_API_KEY="..."`.
3. Apply every migration in `supabase/migrations/` in filename order with the Supabase CLI (`supabase db push`) or SQL Editor. They create the RLS-protected tables, private `cvs` storage bucket, job-search history, and the authenticated skill-insert policy required by onboarding.
4. In one terminal run `py -m uvicorn backend.api.index:app --reload --port 8000`.
5. In another run `Set-Location frontend; npm run dev`.

The health check is `http://localhost:8000/api/health` and returns `{ "status": "ok" }`.

## Vercel

Import this repository as **one** Vercel project. If the Git repository root is the parent directory of this folder, set the Vercel project **Root Directory** to `Proxiwork`. `vercel.json` builds `frontend/`, routes `/api/*` to root `api/index.py`, lets the filesystem serve Vite's generated `/assets/*` files, and rewrites client routes to the Vite SPA entrypoint.

In **Vercel Project Settings -> Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Production (and Preview if required), then redeploy. For the server-side CV suggestion endpoint, also add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `OPENAI_API_KEY`; never prefix these with `VITE_`. The server verifies the signed-in user before forwarding a selected CV to OpenAI and returns suggestions only—the app persists profile changes only after the user saves them. `frontend/.env.production` deliberately contains only `VITE_API_BASE_URL=/api`; do not commit real Supabase or OpenAI credentials.

## Validation

- `Set-Location frontend; npm run lint`
- `Set-Location frontend; npm run vercel-build`
- `py -m uvicorn backend.api.index:app --port 8000`

Live authentication, RLS, storage, and job workflows require a configured Supabase project and applied migration. No sample production jobs or credentials are included.
