import { useEffect, useMemo, useRef, useState } from 'react'

type Metrics = {
  n_records: number
  approval_rate_A: number
  approval_rate_B: number
  disparate_impact_ratio_B_over_A: number
  threshold_A: number
  threshold_B: number
  fairness_strength: number
}

type RemediateResponse = {
  metrics: Metrics
  gemini_explanation: string
  flagged_record?: {
    id: string
    group: 'A' | 'B'
    credit_score: number
    income_k: number
    debt_to_income: number
    score: number
    decision: 0 | 1
    threshold_used: number
  } | null
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || `Request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`
}

function App() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialBusy, setDialBusy] = useState(false)
  const [gemini, setGemini] = useState(
    'Move the Equity Dial to remediate bias and watch the bars converge in real time.',
  )

  const dir = metrics?.disparate_impact_ratio_B_over_A ?? 0

  const dirTone = useMemo(() => {
    if (!Number.isFinite(dir) || metrics == null) return 'neutral'
    return dir < 0.8 ? 'danger' : 'good'
  }, [dir, metrics])

  const debounceRef = useRef<number | null>(null)

  async function loadMetrics() {
    setLoading(true)
    try {
      const m = await getJson<Metrics>('/api/metrics')
      setMetrics(m)
    } catch (e) {
      setGemini(
        'Could not reach the API. Start the backend at http://localhost:8080 and refresh.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function resetDemo() {
    setDialBusy(true)
    try {
      await getJson('/api/reset', { method: 'POST' })
      await loadMetrics()
      setGemini('Dataset reset. Move the dial to demonstrate remediation again.')
    } finally {
      setDialBusy(false)
    }
  }

  async function remediate(next: number) {
    setDialBusy(true)
    try {
      const data = await getJson<RemediateResponse>('/api/remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fairness_strength: next }),
      })
      setMetrics(data.metrics)
      setGemini((data.gemini_explanation || '').trim() || 'No Gemini explanation returned.')
    } catch {
      setGemini('Remediation request failed. Check backend logs and try again.')
    } finally {
      setDialBusy(false)
    }
  }

  function onDialChange(next: number) {
    // Optimistic UI update for “judge wow”
    setMetrics((m) => (m ? { ...m, fairness_strength: next } : m))
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      void remediate(next)
    }, 180)
  }

  useEffect(() => {
    void loadMetrics()
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-full">
      <div className="bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-6">
          <Header
            n={metrics?.n_records ?? 0}
            dir={dir}
            dirTone={dirTone}
            loading={loading}
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-10">
        {loading || !metrics ? (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
            <div className="h-5 w-44 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-4 w-80 animate-pulse rounded bg-slate-100" />
            <div className="mt-8 h-64 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <BiasCard metrics={metrics} />
              <div className="mt-4">
                <GeminiCard text={gemini} />
              </div>
            </div>
            <div className="lg:col-span-5">
              <DialCard
                metrics={metrics}
                dialBusy={dialBusy}
                onDialChange={onDialChange}
                onReset={resetDemo}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Header({
  n,
  dir,
  dirTone,
  loading,
}: {
  n: number
  dir: number
  dirTone: 'neutral' | 'good' | 'danger'
  loading: boolean
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-950 text-white">
          <span className="font-semibold">E</span>
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight text-slate-900">
            EquiLens AI
          </div>
          <div className="text-sm text-slate-600">
            Equity Dial MVP — Loan Approval bias detection + real-time remediation
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill label={loading ? 'Records: …' : `Records: ${n}`} tone="neutral" />
        <Pill
          label={loading ? 'DIR (B/A): …' : `DIR (B/A): ${Number.isFinite(dir) ? dir.toFixed(2) : '—'}`}
          tone={dirTone}
        />
      </div>
    </div>
  )
}

function Pill({
  label,
  tone,
}: {
  label: string
  tone: 'neutral' | 'good' | 'danger'
}) {
  const cls =
    tone === 'danger'
      ? 'bg-rose-50 text-rose-800 ring-rose-200'
      : tone === 'good'
        ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
        : 'bg-blue-50 text-blue-900 ring-blue-200'
  return (
    <div className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${cls}`}>
      {label}
    </div>
  )
}

function CardShell({
  title,
  subtitle,
  children,
  right,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
}

function BiasCard({ metrics }: { metrics: Metrics }) {
  const a = metrics.approval_rate_A
  const b = metrics.approval_rate_B
  const dir = metrics.disparate_impact_ratio_B_over_A
  const ok = dir >= 0.8

  return (
    <CardShell
      title="Current bias snapshot"
      subtitle={
        ok
          ? 'DIR ≥ 0.80 — approval rates are closer to parity.'
          : 'DIR < 0.80 — potential adverse impact on Group B.'
      }
      right={
        <div
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 ${
            ok
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
              : 'bg-rose-50 text-rose-800 ring-rose-200'
          }`}
        >
          {ok ? 'Within 80% rule' : 'Flagged'}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Bar label="Group A" value={a} color="bg-blue-600" />
        <Bar label="Group B" value={b} color="bg-violet-600" />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-600">Disparate Impact Ratio</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            {Number.isFinite(dir) ? dir.toFixed(2) : '—'}
          </div>
          <div className="mt-2 text-sm text-slate-600">DIR = approval(B) / approval(A)</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Approval rate A" value={pct(a)} />
        <Stat label="Approval rate B" value={pct(b)} />
        <Stat label="Thresholds (A / B)" value={`${metrics.threshold_A.toFixed(2)} / ${metrics.threshold_B.toFixed(2)}`} />
      </div>
    </CardShell>
  )
}

function Bar({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <div className="text-sm font-semibold text-slate-900">{pct(v)}</div>
      </div>
      <div className="mt-3 h-3 w-full rounded-full bg-slate-100">
        <div
          className={`h-3 rounded-full ${color}`}
          style={{ width: `${v * 100}%` }}
        />
      </div>
      <div className="mt-3 h-36 rounded-xl bg-slate-50 p-3">
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
          <div
            className={`absolute bottom-0 left-0 right-0 ${color}`}
            style={{ height: `${v * 100}%`, opacity: 0.9 }}
          />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-600">{label}</div>
      <div className="mt-2 text-lg font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  )
}

function DialCard({
  metrics,
  dialBusy,
  onDialChange,
  onReset,
}: {
  metrics: Metrics
  dialBusy: boolean
  onDialChange: (v: number) => void
  onReset: () => Promise<void>
}) {
  return (
    <CardShell
      title="The Equity Dial"
      subtitle="Turn toward fairness to balance approval rates in real time."
      right={
        dialBusy ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
            Updating
          </div>
        ) : null
      }
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Fairness strength</div>
          <div className="text-sm font-semibold tabular-nums text-slate-900">
            {metrics.fairness_strength.toFixed(2)}
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={metrics.fairness_strength}
          onChange={(e) => onDialChange(Number(e.target.value))}
          disabled={dialBusy}
          className="mt-3 w-full"
        />
        <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500">
          <span>Accuracy-leaning</span>
          <span>Fairness-leaning</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Threshold A" value={metrics.threshold_A.toFixed(2)} />
        <Stat label="Threshold B" value={metrics.threshold_B.toFixed(2)} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={dialBusy}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-slate-800 disabled:opacity-60"
        >
          Reset demo dataset
        </button>
        <div className="text-sm text-slate-600">
          At 0.0, decisions reflect the biased model as-is. As you move toward 1.0,
          the policy adjusts the decision threshold to reduce the approval-rate gap.
        </div>
      </div>
    </CardShell>
  )
}

function GeminiCard({ text }: { text: string }) {
  return (
    <CardShell
      title="Gemini explanation (2 sentences)"
      subtitle="Plain-language justification for the flagged bias case."
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {text}
        </div>
      </div>
      <div className="mt-3 text-sm text-slate-500">
        Tip: set <span className="font-mono">GEMINI_API_KEY</span> in your{' '}
        <span className="font-mono">.env</span> to enable live explanations.
      </div>
    </CardShell>
  )
}

export default App
