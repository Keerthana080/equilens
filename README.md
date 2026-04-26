# EquiLens AI — Algorithmic Fairness Auditor

> **Detect, visualize, and remediate bias in ML-driven loan approval decisions — in real time.**


---

## What is EquiLens AI?

EquiLens AI is an AI fairness auditing tool that simulates a biased loan approval model and lets you interactively remediate it. It visualizes disparate impact across demographic groups, surfaces flagged records, and uses **Google Gemini** to generate plain-language explanations of bias — all in a live dashboard.

The core interaction is the **Equity Dial** — a slider that adjusts decision thresholds in real time to bring approval rates closer together between Group A and Group B, reducing the Disparate Impact Ratio (DIR) toward fairness.

---

## Features

- **Live Bias Dashboard** — real-time approval rates, DIR score, and threshold visualization for two demographic groups
- **Flagged Record Detection** — automatically surfaces the most biased rejection case (high-score denial from Group B)
- **The Equity Dial** — interactive slider to tune fairness strength from 0 (accuracy-leaning) to 1 (fairness-leaning)
- **Gemini AI Explanation** — 2-sentence plain-language justification powered by Google Gemini 2.5 Flash
- **Disparate Impact Ratio (DIR)** — industry-standard metric; DIR < 0.80 flags potential adverse impact
- **Reset Demo Dataset** — regenerates a fresh synthetic loan dataset on demand

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Python + FastAPI |
| AI Explanation | Google Gemini 2.5 Flash (`google-genai` SDK) |
| Data | Synthetic loan dataset (scripted bias simulation) |
| Dev Server | Uvicorn |

---

## Project Structure

```
equilensAI/
├── backend/
│   ├── app/
│   │   └── main.py          # FastAPI app — bias simulation, metrics, Gemini integration
│   ├── .env                 # API keys (not committed)
│   ├── requirements.txt
│   └── test.py
├── frontend/
│   ├── src/
│   └── ...
├── .env.example
├── docker-compose.yaml
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free)

### 1. Clone the repository

```bash
git clone https://github.com/Keerthana080/equilens.git
cd equilensAI
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file with your Gemini API key
python -c "open('.env', 'w', encoding='utf-8').write('GEMINI_API_KEY=your_api_key_here\n')"
```

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

### 4. Run the app

**Backend** (from `backend/` folder):
```bash
python -m uvicorn app.main:app --reload --port 8080
```

**Frontend** (from `frontend/` folder):
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## How It Works

1. On startup, the backend generates a **240-record synthetic loan dataset** with a scripted bias — Group B applicants receive a consistent score penalty of 0.10 despite similar financial features.
2. The frontend fetches live metrics from `/api/metrics` showing approval rates and DIR for both groups.
3. When you move the **Equity Dial**, a POST to `/api/remediate` adjusts Group B's decision threshold to close the approval gap.
4. The backend picks the most flagged record (highest-scoring denial in Group B) and sends it to **Gemini 2.5 Flash** for a plain-language bias explanation.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/metrics` | Current approval rates, DIR, thresholds |
| POST | `/api/remediate` | Apply fairness strength, get explanation |
| POST | `/api/reset` | Regenerate dataset, reset thresholds |
| GET | `/api/healthz` | Health check |

---

## Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
GEMINI_API_KEY=your_gemini_api_key_here

# Optional overrides
GEMINI_MODEL=gemini-2.5-flash
EQUILENS_DATASET_SIZE=240
EQUILENS_SEED=26
EQUILENS_DEFAULT_THRESHOLD_A=0.62
EQUILENS_DEFAULT_THRESHOLD_B=0.62
```

---

## Key Concepts

**Disparate Impact Ratio (DIR)** = `approval_rate_B / approval_rate_A`
- DIR < 0.80 → potential adverse impact (the 4/5ths rule)
- DIR = 1.0 → perfectly equal approval rates

**Equity Dial** interpolates Group B's threshold between the biased default (`0.62`) and a fully equalized threshold, giving users real-time control over the accuracy vs. fairness tradeoff.

---

## Demo

- 🔗 **Live Demo:** [your-demo-link-here]
- 🎥 **Demo Video:** [your-video-link-here]

---

## License

MIT
