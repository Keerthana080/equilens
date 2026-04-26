from __future__ import annotations

# ── load_dotenv at the very top, before anything reads env vars ──
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'), override=True)

import re
import random
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Literal, Optional, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from google import genai  # type: ignore[import-not-found]
except Exception:
    genai = None

app = FastAPI(title="EquiLens AI (Equity Dial) API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Group = Literal["A", "B"]
Decision = Literal[0, 1]


class MetricsResponse(BaseModel):
    n_records: int
    approval_rate_A: float
    approval_rate_B: float
    disparate_impact_ratio_B_over_A: float
    threshold_A: float
    threshold_B: float
    fairness_strength: float


class RemediateRequest(BaseModel):
    fairness_strength: float = Field(ge=0, le=1)


class FlaggedRecord(BaseModel):
    id: str
    group: Group
    credit_score: int
    income_k: float
    debt_to_income: float
    score: float
    decision: Decision
    threshold_used: float


class RemediateResponse(BaseModel):
    metrics: MetricsResponse
    flagged_record: Optional[FlaggedRecord] = None
    gemini_explanation: str


@dataclass(frozen=True)
class LoanRecord:
    id: str
    group: Group
    credit_score: int
    income_k: float
    debt_to_income: float
    score: float


DATASET_SIZE = int(os.getenv("EQUILENS_DATASET_SIZE", "240"))
DEFAULT_THRESHOLD_A = float(os.getenv("EQUILENS_DEFAULT_THRESHOLD_A", "0.62"))
DEFAULT_THRESHOLD_B = float(os.getenv("EQUILENS_DEFAULT_THRESHOLD_B", "0.62"))

_rng_seed = int(os.getenv("EQUILENS_SEED", "26"))
random.seed(_rng_seed)

_dataset: List[LoanRecord] = []
_fairness_strength: float = 0.0
_threshold_A: float = DEFAULT_THRESHOLD_A
_threshold_B: float = DEFAULT_THRESHOLD_B


def _clamp01(x: float) -> float:
    return float(min(max(x, 0.0), 1.0))


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + pow(2.718281828, -x))


def _simulate_loan_dataset(n: int) -> List[LoanRecord]:
    out: List[LoanRecord] = []
    for i in range(n):
        group: Group = "A" if i % 2 == 0 else "B"

        credit_score = int(random.gauss(690, 55))
        credit_score = int(min(max(credit_score, 300), 850))

        income_k = float(max(18.0, random.gauss(72, 22)))
        debt_to_income = float(_clamp01(random.gauss(0.33, 0.14)))

        z = (
            (credit_score - 650) / 80.0
            + (income_k - 60) / 40.0
            - (debt_to_income - 0.30) / 0.18
        )
        base = _sigmoid(z) * 0.95

        if group == "B":
            base -= 0.10

        base += random.uniform(-0.02, 0.02)
        score = float(_clamp01(base))

        out.append(
            LoanRecord(
                id=f"loan-{i+1:04d}",
                group=group,
                credit_score=credit_score,
                income_k=round(income_k, 1),
                debt_to_income=round(debt_to_income, 3),
                score=score,
            )
        )
    return out


def disparate_impact_ratio(approval_rate_a: float, approval_rate_b: float) -> float:
    if approval_rate_a <= 0:
        return 0.0
    return float(approval_rate_b / approval_rate_a)


def _decision_for(rec: LoanRecord, threshold_a: float, threshold_b: float) -> Tuple[int, float]:
    t = threshold_a if rec.group == "A" else threshold_b
    return (1 if rec.score >= t else 0), t


def _approval_rates(threshold_a: float, threshold_b: float) -> Tuple[float, float]:
    a_total = 0
    a_yes = 0
    b_total = 0
    b_yes = 0
    for r in _dataset:
        d, _ = _decision_for(r, threshold_a, threshold_b)
        if r.group == "A":
            a_total += 1
            a_yes += d
        else:
            b_total += 1
            b_yes += d
    ra = (a_yes / a_total) if a_total else 0.0
    rb = (b_yes / b_total) if b_total else 0.0
    return float(ra), float(rb)


def _metrics() -> MetricsResponse:
    ra, rb = _approval_rates(_threshold_A, _threshold_B)
    return MetricsResponse(
        n_records=len(_dataset),
        approval_rate_A=ra,
        approval_rate_B=rb,
        disparate_impact_ratio_B_over_A=disparate_impact_ratio(ra, rb),
        threshold_A=float(_threshold_A),
        threshold_B=float(_threshold_B),
        fairness_strength=float(_fairness_strength),
    )


def _solve_threshold_for_rate(group: Group, target_rate: float, fixed_threshold_other: float) -> float:
    target_rate = _clamp01(target_rate)
    thresholds = [x / 100 for x in range(30, 86)]
    best_t = 0.62
    best_err = 9e9

    for t in thresholds:
        if group == "A":
            ra, _ = _approval_rates(t, fixed_threshold_other)
            err = abs(ra - target_rate)
        else:
            _, rb = _approval_rates(fixed_threshold_other, t)
            err = abs(rb - target_rate)
        if err < best_err:
            best_err = err
            best_t = float(t)
    return best_t


def _pick_flagged_record() -> Optional[FlaggedRecord]:
    candidates: List[Tuple[LoanRecord, int, float]] = []
    for r in _dataset:
        d, t = _decision_for(r, _threshold_A, _threshold_B)
        if r.group == "B" and d == 0 and r.score >= 0.55:
            candidates.append((r, d, t))
    if not candidates:
        for r in _dataset:
            d, t = _decision_for(r, _threshold_A, _threshold_B)
            if d == 0 and abs(r.score - t) <= 0.04:
                candidates.append((r, d, t))
    if not candidates:
        return None

    r, d, t = sorted(candidates, key=lambda x: x[0].score, reverse=True)[0]
    return FlaggedRecord(
        id=r.id,
        group=r.group,
        credit_score=r.credit_score,
        income_k=r.income_k,
        debt_to_income=r.debt_to_income,
        score=float(r.score),
        decision=d,  # ── Fix: pass d directly, do not call Decision(d) ──
        threshold_used=float(t),
    )


def gemini_two_sentence_explanation(flagged: Optional[FlaggedRecord], metrics: MetricsResponse) -> str:
    if flagged is None:
        return "No single record was strongly flagged in this snapshot. Try moving the Equity Dial to surface a clearer bias case."

    api_key = os.getenv("GEMINI_API_KEY") or ""
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    if not api_key or genai is None:
        return (
            f"This application was flagged because the decision was near the threshold "
            f"(score {flagged.score:.2f} vs threshold {flagged.threshold_used:.2f}), "
            f"and group {flagged.group} has a lower approval rate in the current policy. "
            f"The Equity Dial reduces this gap by adjusting thresholds to bring approval "
            f"rates closer together (DIR {metrics.disparate_impact_ratio_B_over_A:.2f})."
        )

    prompt = f"""
You are an AI fairness auditor. Write EXACTLY 2 complete sentences.
Explain why this loan record was flagged for potential bias and how remediation affects it.
Ground your explanation in the numbers provided. Do not use bullet points.
Make sure each sentence is complete and ends with a period.

Flagged record:
{flagged.model_dump_json()}

Current fairness snapshot:
{metrics.model_dump_json()}

Output exactly 2 sentences only.
""".strip()

    try:
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
        txt = (resp.text or "").strip()

        # ── Fix: split on sentence boundaries not every "." so decimals are preserved ──
        sentences = re.split(r'(?<=[.!?])\s+', txt)
        sentences = [s.strip() for s in sentences if s.strip()]
        if len(sentences) >= 2:
            txt = sentences[0] + " " + sentences[1]
        elif len(sentences) == 1:
            txt = sentences[0]

        return txt or "Gemini returned an empty explanation. Please try again."
    except Exception as e:
        return (
            f"Gemini explanation failed: {e}. "
            "This record was near the threshold and the current policy produces unequal approval rates across groups."
        )


# ── API endpoints ──

@app.get("/api/healthz")
def healthz() -> Dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def _startup() -> None:
    global _dataset
    if not _dataset:
        _dataset = _simulate_loan_dataset(DATASET_SIZE)

    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    static_dir = os.path.abspath(static_dir)
    if os.path.isdir(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


@app.get("/api/metrics", response_model=MetricsResponse)
def metrics() -> MetricsResponse:
    return _metrics()


@app.post("/api/remediate", response_model=RemediateResponse)
def remediate(req: RemediateRequest) -> RemediateResponse:
    global _fairness_strength, _threshold_A, _threshold_B

    if not _dataset:
        raise HTTPException(status_code=500, detail="Dataset not initialized.")

    s = float(req.fairness_strength)
    _fairness_strength = s

    _threshold_A = DEFAULT_THRESHOLD_A
    ra_baseline, _ = _approval_rates(_threshold_A, DEFAULT_THRESHOLD_B)

    tb_equalize = _solve_threshold_for_rate("B", ra_baseline, fixed_threshold_other=_threshold_A)
    _threshold_B = float(DEFAULT_THRESHOLD_B * (1.0 - s) + tb_equalize * s)

    m = _metrics()
    flagged = _pick_flagged_record()
    explanation = gemini_two_sentence_explanation(flagged, m)

    return RemediateResponse(metrics=m, flagged_record=flagged, gemini_explanation=explanation)


@app.post("/api/reset")
def reset() -> Dict[str, Any]:
    global _fairness_strength, _threshold_A, _threshold_B, _dataset
    _fairness_strength = 0.0
    _threshold_A = DEFAULT_THRESHOLD_A
    _threshold_B = DEFAULT_THRESHOLD_B
    _dataset = _simulate_loan_dataset(DATASET_SIZE)
    return {
        "ok": True,
        "metrics": _metrics().model_dump(),
        "example_record": asdict(_dataset[0]) if _dataset else None,
    }