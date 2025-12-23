# Deploying to Vercel (Frontend + Backend)

This repository contains a Svelte frontend and a Node/Prisma backend. You can deploy both to Vercel as two separate projects (recommended) or as one monorepo with two Vercel projects configured.

## Overview
- Frontend: `frontend/` (Vite + Svelte). Build command: `npm run build` (in `frontend/`) and default output.
- Backend: `backend/` — now exposes serverless endpoints under `backend/api/*` suitable for Vercel Functions. NOTE: Streaming (SSE) is not guaranteed on Vercel serverless, so the `/chat/stream` endpoint is implemented as a non-streaming fallback (returns full reply). The frontend supports fallback to non-streaming behavior.

## Steps
1. On Vercel, create TWO projects:
   - Project 1 (Frontend):
     - Link to this repository
     - Root directory: `frontend`
     - Framework preset: Svelte
     - Add Environment Variables (if needed): none required for static frontend
   - Project 2 (Backend):
     - Link to this repository
     - Root directory: `backend`
     - Build Command: `npm run vercel-build`
     - Output Directory: (leave blank)
     - Add Environment Variables (Project Settings → Environment Variables):
       - `DATABASE_URL` (Postgres connection string) — Vercel will pass this to the serverless functions
       - `OPENAI_API_KEY`
       - (Optional) `PORT`

2. Add Environment Variables in the Vercel dashboard for both projects as needed.

3. Deploy
   - Push to `main` and Vercel will build and deploy each project.

## Notes & Limitations
- SSE/long-lived streaming is not reliable on serverless functions; the backend implementation returns full replies. The frontend includes fallback logic to POST `/chat/message` if `EventSource` fails or times out.
- Prisma connection pooling: for production use, prefer a managed Postgres with connection pooling (e.g., Supabase, Neon, Railway DB). You may also consider Prisma Data Proxy if you see connection issues.

## Fallback plan
- If you need real SSE/long-lived streams and persistent processes, deploy the backend on Railway/Render as described in `DEPLOY_RAILWAY.md` and keep frontend on Vercel.

If you want, I can:
- Create the Vercel projects (I need access tokens or you can create the projects and add me as a collaborator), or
- Guide you step-by-step while you create the projects and add env vars.
