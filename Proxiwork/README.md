# ProxiWork

Single-project Vercel deployment with a Vite React frontend and FastAPI API.

## Local setup

1. Copy `frontend/.env.example` to `frontend/.env.local` and add the Supabase project URL and **publishable** key. `VITE_*` values are browser-visible; never put a service-role key there.
2. Copy `backend/.env.example` to a local backend environment file if server-side Supabase or database access is added. Do not commit it.
3. Apply `supabase/migrations/202610210001_proxiwork_schema.sql` with the Supabase CLI (`supabase db push`) or SQL Editor. It creates RLS-protected tables and a private `cvs` storage bucket.
4. In one terminal run `py -m uvicorn backend.api.index:app --reload --port 8000`.
5. In another run `Set-Location frontend; npm run dev`.

The health check is `http://localhost:8000/api/health` and returns `{ "status": "ok" }`.

## Vercel

Import this repository as **one** Vercel project. If the Git repository root is the parent directory of this folder, set the Vercel project **Root Directory** to `Proxiwork`. `vercel.json` builds `frontend/`, routes `/api/*` to root `api/index.py`, lets the filesystem serve Vite's generated `/assets/*` files, and rewrites client routes to the Vite SPA entrypoint. Configure the public frontend Supabase variables and any server-only backend variables in **Vercel Project Settings -> Environment Variables**. `frontend/.env.production` deliberately contains only `VITE_API_BASE_URL=/api`.

## Validation

- `Set-Location frontend; npm run lint`
- `Set-Location frontend; npm run vercel-build`
- `py -m uvicorn backend.api.index:app --port 8000`

Live authentication, RLS, storage, and job workflows require a configured Supabase project and applied migration. No sample production jobs or credentials are included.
