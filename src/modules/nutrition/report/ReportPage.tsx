import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { AlertRow, Metric, Sparkline, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api'
import { num, shortDay, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Report, ReportDays } from '../data'
import { useReport } from '../data'

const PERIODS: ReportDays[] = [30, 90]
const TOLERANCE = 150

const MACROS = [
  { key: 'protein', label: 'Proteine' },
  { key: 'carbs', label: 'Carboidrati' },
  { key: 'fat', label: 'Grassi' },
] as const

// Andamento (NUT-017): ultimi 30 o 90 giorni. I numeri arrivano già
// calcolati dal backend; qui solo il disegno.
export function ReportPage() {
  const [params, setParams] = useSearchParams()
  const days: ReportDays = params.get('giorni') === '90' ? 90 : 30
  const { data, error } = useReport(days)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Link to="/pasti" className="eyebrow no-underline hover:underline">
            Pasti · Andamento
          </Link>
          <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">Ultimi {days} giorni</h1>
        </div>
        <div role="group" aria-label="Periodo" className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={days === p}
              onClick={() => setParams(p === 30 ? {} : { giorni: String(p) })}
              className={cn(
                'h-10 cursor-pointer rounded-full border px-4 font-sans text-sm',
                days === p
                  ? 'border-brand-line bg-glass-strong text-ink'
                  : 'border-glass-border bg-transparent text-ink-muted hover:bg-glass-hover',
              )}
            >
              {p} giorni
            </button>
          ))}
        </div>
      </div>
      {!data && error ? (
        <WidgetCard title="Andamento">
          <AlertRow
            title="Andamento non disponibile."
            body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
          />
        </WidgetCard>
      ) : data?.days === days ? (
        <ReportBody report={data} />
      ) : (
        <WidgetSkeleton title="Andamento" />
      )}
    </>
  )
}

function ReportBody({ report: r }: { report: Report }) {
  const { adherence, weight } = r
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-3.5">
        <Stat label="Media">
          <Metric size="md" value={r.averageKcal === null ? '—' : num(r.averageKcal)} unit="kcal" />
        </Stat>
        <Stat label="Tendenza">
          <Metric
            size="md"
            value={r.trendKcalPerWeek === null ? '—' : signed(r.trendKcalPerWeek, 0)}
            unit="kcal/sett."
          />
        </Stat>
        <Stat label={`Aderenza ±${TOLERANCE}`}>
          <Metric
            size="md"
            value={adherence.pct === null ? '—' : num(adherence.pct)}
            unit="%"
            delta={adherence.total ? `${adherence.inTarget} giorni su ${adherence.total}` : undefined}
          />
        </Stat>
        <Stat label="Peso">
          <Metric
            size="md"
            value={weight.last === null ? '—' : num(weight.last, 1)}
            unit="kg"
            delta={weight.delta === null ? undefined : `${signed(weight.delta, 1)} kg`}
          />
        </Stat>
      </div>
      <KcalChart report={r} />
      <div className="grid grid-cols-2 gap-3.5">
        <WidgetCard title="Macro, media al giorno">
          {r.macros ? (
            <div className="flex flex-col gap-3">
              {MACROS.map((m) => {
                const value = r.macros![m.key]
                const max = r.goal?.[m.key] ?? 0
                const text = max ? `${num(value)} / ${num(max)} g` : `${num(value)} g`
                return (
                  <div key={m.key} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span>{m.label}</span>
                      <span className="font-mono">{text}</span>
                    </div>
                    <Progress
                      value={max ? Math.min(100, Math.round((value / max) * 100)) : 0}
                      aria-label={`${m.label} ${text}`}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <span className="text-[13px] text-ink-muted">Niente registrato nel periodo.</span>
          )}
        </WidgetCard>
        <WidgetCard
          title="Peso"
          meta={
            weight.first !== null && weight.last !== null && weight.points.length >= 2
              ? `da YAZIO · ${num(weight.first, 1)} → ${num(weight.last, 1)} kg`
              : undefined
          }
        >
          {weight.points.length >= 2 ? (
            <Sparkline
              points={weight.points.map((p) => p.kg)}
              height={120}
              ariaLabel={`Peso da ${num(weight.first!, 1)} a ${num(weight.last!, 1)} kg in ${r.days} giorni`}
            />
          ) : (
            <span className="text-[13px] text-ink-muted">
              {weight.points.length ? 'Una sola pesata nel periodo.' : 'Nessuna pesata nel periodo.'}
            </span>
          )}
        </WidgetCard>
      </div>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="gap-2 px-5 py-[18px]">
      <span className="eyebrow">{label}</span>
      {children}
    </Card>
  )
}

// Kcal al giorno con l'obiettivo di quel giorno; più chiari i giorni fuori
// tolleranza.
function KcalChart({ report: r }: { report: Report }) {
  const top = Math.max(1, ...r.series.map((d) => Math.max(d.kcal, d.goalKcal ?? 0))) * 1.1
  const h = (v: number) => `${(v / top) * 100}%`
  const labels = [0, 1, 2, 3].map((i) => r.series[Math.round((i * (r.series.length - 1)) / 3)].date)
  const goals = r.series.map((d) => d.goalKcal).filter((g) => g !== null)
  const goalText = goals.length ? `, obiettivo intorno a ${num(goals.at(-1)!)} kcal` : ''

  return (
    <section aria-label="Kcal al giorno">
      <WidgetCard title="Kcal al giorno">
        <div className="flex flex-col gap-3.5">
          <div className="flex gap-4 self-end text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-3.5 bg-brand" />
              obiettivo del giorno
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-ink/20" />
              fuori tolleranza
            </span>
          </div>
          <div
            role="img"
            aria-label={`Kcal al giorno dal ${shortDay(r.from)} al ${shortDay(r.to)}${goalText}`}
            className={cn(
              'flex h-[200px] items-end border-b border-glass-border',
              r.days > 30 ? 'gap-px' : 'gap-1',
            )}
          >
            {r.series.map((d) => {
              const out = d.goalKcal !== null && d.logged && Math.abs(d.kcal - d.goalKcal) > TOLERANCE
              return (
                <div key={d.date} className="relative h-full flex-1" data-day={d.date}>
                  {d.logged ? (
                    <div
                      className={cn(
                        'absolute inset-x-0 bottom-0 rounded-t-[3px]',
                        out ? 'bg-ink/20' : 'bg-ink/55',
                      )}
                      style={{ height: h(d.kcal) }}
                    />
                  ) : null}
                  {d.goalKcal !== null ? (
                    <div
                      aria-hidden="true"
                      className="absolute -inset-x-px h-0.5 bg-brand"
                      style={{ bottom: h(d.goalKcal) }}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
          <div className="flex justify-between font-mono text-xs text-ink-muted">
            {labels.map((d) => (
              <span key={d}>{shortDay(d)}</span>
            ))}
          </div>
        </div>
      </WidgetCard>
    </section>
  )
}
