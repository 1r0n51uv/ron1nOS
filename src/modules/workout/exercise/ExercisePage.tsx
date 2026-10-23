import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import { todayRome } from '@/modules/nutrition/dates'
import type { ExerciseDetail, ExerciseRange } from '../data'
import { useExercise } from '../data'
import { clock, groupLabel, setLabel, workoutDay } from '../format'
import { ExercisePhoto } from '../images/ExercisePhoto'
import { GroupDialog } from './GroupDialog'
import { LineChart } from './LineChart'
import { RadioChips } from './RadioChips'

type Metric = 'best' | 'total'

const RANGES = [
  { value: '3m', label: '3 mesi' },
  { value: '6m', label: '6 mesi' },
  { value: '1y', label: '1 anno' },
  { value: 'all', label: 'Tutto' },
] as const

const kg = (v: number) => `${num(Math.round(v))} kg`
// Un peso sollevato resta com'è: 92,5 kg.
const lifted = (v: number) => `${num(v, v % 1 ? 1 : 0)} kg`

// Per gli esercizi a tempo le stesse due viste diventano durate.
function metrics(timed: boolean) {
  return timed
    ? {
        best: { label: 'Durata migliore', value: (p: Point) => p.bestDurationSeconds, format: clock },
        total: { label: 'Durata totale', value: (p: Point) => p.totalDurationSeconds, format: clock },
      }
    : {
        best: { label: '1RM stimato', value: (p: Point) => p.best1RMKg, format: kg },
        total: { label: 'Volume', value: (p: Point) => p.volumeKg, format: kg },
      }
}

type Point = ExerciseDetail['points'][number]

function Header({ exercise }: { exercise: ExerciseDetail }) {
  const numbers = exercise.timed
    ? [
        {
          label: 'durata migliore',
          value: exercise.bestDurationSeconds ? clock(exercise.bestDurationSeconds) : '–',
        },
        { label: 'sessioni', value: num(exercise.sessions) },
      ]
    : [
        { label: '1RM stimato', value: exercise.best1RMKg ? kg(exercise.best1RMKg) : '–' },
        { label: 'peso più alto', value: exercise.heaviestKg ? lifted(exercise.heaviestKg) : '–' },
        { label: 'sessioni', value: num(exercise.sessions) },
      ]
  return (
    <div className="flex items-stretch gap-6">
      <ExercisePhoto name={exercise.name} image={exercise.image} className="h-[180px] w-[320px] shrink-0">
        <div className="eyebrow text-white/75">{groupLabel(exercise.group)}</div>
        <h1 className="m-0 font-display text-[28px] leading-[32px] font-bold text-white">{exercise.name}</h1>
      </ExercisePhoto>
      <div className="flex flex-col justify-between gap-4">
        <GroupDialog name={exercise.name} current={exercise.group}>
          <Button variant="glass" size="sm" className="self-start">
            {exercise.group ? `Gruppo · ${groupLabel(exercise.group)}` : 'Assegna il gruppo'}
          </Button>
        </GroupDialog>
        <dl className="m-0 flex items-end gap-8">
          {numbers.map((n) => (
            <div key={n.label} className="flex flex-col-reverse">
              <dt className="text-xs text-ink-muted">{n.label}</dt>
              <dd className="m-0 font-mono text-[26px] leading-[30px] font-semibold">{n.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function Recent({ exercise }: { exercise: ExerciseDetail }) {
  const today = todayRome()
  return (
    <section aria-label="Ultime volte">
      <WidgetCard title="Ultime volte">
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {exercise.recent.map((r) => (
            <li key={r.sessionId}>
              <Link
                to={`/allenamenti/sessioni/${r.sessionId}`}
                className="grid min-h-11 grid-cols-[200px_1fr_90px] items-center gap-4 rounded-[12px] px-2 text-sm text-ink no-underline hover:bg-glass-hover"
              >
                <span className="text-ink-muted">{workoutDay(r.day, today)}</span>
                <span className="truncate font-mono text-[13px]">
                  {r.sets
                    .filter((s) => !s.warmup)
                    .map(setLabel)
                    .join(' · ')}
                </span>
                <span className="text-right font-mono">{r.best1RMKg ? kg(r.best1RMKg) : ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      </WidgetCard>
    </section>
  )
}

// Pagina /allenamenti/esercizi/:name (GYM-008): foto grande con tre
// numeri e il gruppo (GYM-011), un grafico per volta nel periodo scelto e
// le ultime 3 volte.
export function ExercisePage() {
  const { name = '' } = useParams()
  const [range, setRange] = useState<ExerciseRange>('6m')
  const [metric, setMetric] = useState<Metric>('best')
  const { data, error } = useExercise(name, range)

  return (
    <>
      <Link to="/allenamenti" className="self-start text-[13px] text-brand-text no-underline hover:underline">
        Allenamenti
      </Link>
      {!data && error ? (
        <AlertRow
          title="Esercizio non disponibile."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      ) : !data ? (
        <WidgetSkeleton title="Esercizio" />
      ) : (
        <>
          <Header exercise={data} />
          <section aria-label="Andamento">
            <WidgetCard title="Andamento">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <RadioChips
                  label="Grafico"
                  options={[
                    { value: 'best', label: metrics(data.timed).best.label },
                    { value: 'total', label: metrics(data.timed).total.label },
                  ]}
                  value={metric}
                  onChange={setMetric}
                />
                <RadioChips label="Periodo" options={RANGES} value={range} onChange={setRange} />
              </div>
              <LineChart
                label={metrics(data.timed)[metric].label}
                format={metrics(data.timed)[metric].format}
                points={data.points.map((p) => ({
                  sessionId: p.sessionId,
                  day: p.day,
                  value: metrics(data.timed)[metric].value(p),
                }))}
              />
            </WidgetCard>
          </section>
          <Recent exercise={data} />
        </>
      )}
    </>
  )
}
