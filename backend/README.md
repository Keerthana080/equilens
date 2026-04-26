# EquiLens AI (Backend)

FastAPI service designed to deploy to **Cloud Run**. This backend mocks inference, computes a rolling-window fairness signal, opens incidents, supports bounded remediation, and exports a compliance-style report.

## Run locally

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

Health check:

```bash
curl http://localhost:8080/healthz
```

Seed scripted demo data (opens an incident quickly):

```bash
curl -X POST "http://localhost:8080/seed-demo?n=200"
curl "http://localhost:8080/metrics"
```

Remediate (preference 0 = utility, 1 = fairness):

```bash
curl -X POST http://localhost:8080/remediate -H "Content-Type: application/json" -d "{\"preference\": 1}"
curl "http://localhost:8080/metrics"
```

Export:

```bash
curl "http://localhost:8080/export?jurisdiction=EU"
```

## Deploy to Cloud Run

From `backend/`:

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/equilens-backend
gcloud run deploy equilens-backend --image gcr.io/YOUR_PROJECT_ID/equilens-backend --platform managed --allow-unauthenticated --region europe-west1
```

After deploy, test:

```bash
curl https://YOUR_CLOUD_RUN_URL/healthz
```

