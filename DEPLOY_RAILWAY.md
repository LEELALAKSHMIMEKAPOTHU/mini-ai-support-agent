# Deploying the Backend to Railway

This project uses Express + Prisma. The recommended production database is Postgres (Railway provisioned). Below are the steps to deploy the backend to Railway.

## 1) Add repository to Railway
- In Railway, link your GitHub repository (this repo).
- Choose the `backend/` folder as the project root (Railway will detect Node).

## 2) Set environment variables (Railway secrets)
- In Railway project settings, add:
  - `DATABASE_URL` — a Postgres connection string (Railway will provision a Postgres DB or you can use an external one).
  - `OPENAI_API_KEY` — your OpenAI API key.
  - (Optional) `PORT` — if you need a custom port.

## 3) Automatic build & migration
- The included GitHub Actions workflow (`.github/workflows/deploy-backend-railway.yml`) will:
  - Install dependencies
  - Generate Prisma client
  - Build TypeScript
  - Run `prisma migrate deploy` using `DATABASE_URL` from GitHub Secrets (not Railway). If you'd rather run migrations directly on Railway, you can run them manually from a Railway shell or set up a CI step to do it.

## 4) How to deploy from GitHub Actions
- Set these GitHub repository secrets:
  - `DATABASE_URL` — production DB URL (Railway DB or external)
  - `RAILWAY_API_TOKEN` — your Railway CLI token
  - `RAILWAY_PROJECT_ID` — the Railway project id

When you push to `main`, the workflow will run and deploy to Railway.

## Notes
- This repo includes a `Procfile` (`backend/Procfile`) and `postinstall` script to generate the Prisma client.
- Use a managed Postgres in production — **do not** rely on SQLite for production.
