# EquiLens AI — Equity Dial (Solution Challenge 2026 MVP)

EquiLens AI is a **web-based MVP** that makes AI fairness *visible and interactive* for judges: a live **Equity Dial** shows measurable bias in AI decisions and performs **real-time remediation** while providing a short, plain‑language explanation.

This repo uses **mock data** (no database) so the end-to-end experience is fast, secure, and demo-ready.

## What the judges will see (in 30 seconds)

- **Bias detection**: a bar chart of **approval rate by group** (A vs B).
- **Fairness metric**: **Disparate Impact Ratio (DIR = B/A)** shown at the top.
- **Equity Dial**: a large slider that calls the backend and **updates the chart instantly**.
- **Gemini explanation**: Gemini returns **exactly 2 sentences** explaining *why a record was flagged* and *what remediation changed*.

## Architecture

- **Backend**: FastAPI (`backend/app/main.py`)
  - Simulates a biased **Loan Approval** scoring dataset.
  - Computes **approval rates** and **Disparate Impact Ratio**.
  - `/api/remediate` takes `fairness_strength` (0→1) and adjusts the decision threshold to balance approval rates.
  - Gemini integration via `google-generativeai` (env vars only).
- **Frontend**: React + Tailwind (`frontend/`)
  - Single-page “enterprise” dashboard (chart + slider + explanation panel).
  - Calls `/api/metrics` and `/api/remediate` (proxied in dev).
- **Deployment**: single container for **Google Cloud Run**
  - Multi-stage Docker build compiles the React app and serves it from FastAPI.

## Security (important for judging)

- **No secrets are hardcoded**
- You must create a local `.env` from `.env.example`
- `.env` is ignored by git via `.gitignore`

## Environment variables

Create `.env` in the repo root:

```bash
copy .env.example .env
```

Set at minimum:

- `GEMINI_API_KEY`
- `GOOGLE_CLOUD_PROJECT` (recommended)

## Run locally (Docker)

From the repo root:

```bash
docker compose up --build
```

Then open:

- Web UI: `http://localhost:8080`
- API health: `http://localhost:8080/api/healthz`

## Run locally (no Docker)

Backend (terminal 1):

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

Frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

Open the UI at `http://localhost:5173`. The dev server proxies `/api/*` to `http://localhost:8080`.

## API overview

- `GET /api/metrics`
  - Returns approval rates by group + DIR + current thresholds.
- `POST /api/remediate`
  - Body: `{ "fairness_strength": 0..1 }`
  - Returns updated metrics + a Gemini 2‑sentence explanation.
- `POST /api/reset`
  - Regenerates the mock dataset and resets thresholds.

## Deploy to Google Cloud Run

Build and deploy from repo root:

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/equilens-ai
gcloud run deploy equilens-ai \
  --image gcr.io/YOUR_PROJECT_ID/equilens-ai \
  --platform managed \
  --allow-unauthenticated \
  --region us-central1 \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
```

## How this addresses “Unbiased AI Decision”

EquiLens AI demonstrates an end-to-end fairness workflow:

- **Detect**: quantify disparate outcomes with DIR and group approval rates.
- **Explain**: communicate bias flags in plain language using Gemini.
- **Remediate**: change the decision policy in real time (Equity Dial) and immediately re-measure the impact.

This creates a judge-friendly, interactive story: “We found bias, measured it, explained it, and reduced it — live.”

