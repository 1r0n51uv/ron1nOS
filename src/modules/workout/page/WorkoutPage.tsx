import { useState } from 'react'
import { Link } from 'react-router'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import type { ImportSummary } from '../data'
import { useWorkoutSummary } from '../data'
import { period, streak, workouts } from '../format'
import { ImportDialog } from '../import/ImportDialog'
import { WeekBars } from '../WeekBars'
import { ExerciseDashboard } from './ExerciseDashboard'
import { RecentRecords } from './RecentRecords'
import { SessionHistory } from './SessionHistory'

// Pagina /allenamenti (GYM-002): costanza (GYM-013), esercizi più
// allenati (GYM-007), nuovi record (GYM-010), storico (GYM-004) e import
// del CSV (GYM-003). Il volume per gruppo arriva con GYM-012.
export function WorkoutPage() {
  const [last, setLast] = useState<ImportSummary | null>(null)
  const { data, error } = useWorkoutSummary()

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="eyebrow">Palestra</div>
          <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">Allenamenti</h1>
          {data?.last ? (
            <div className="font-mono text-sm text-ink-muted">
              {workouts(data.thisWeek)} questa settimana · {streak(data.streakDays)}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {data?.last ? (
            <Button variant="glass" asChild>
              <Link to="/allenamenti/esercizi" className="no-underline">
                Tutti gli esercizi
              </Link>
            </Button>
          ) : null}
          <ImportDialog onImported={setLast}>
            <Button>Importa CSV</Button>
          </ImportDialog>
        </div>
      </div>

      {last ? (
        <div role="status" className="text-sm text-ink-muted">
          Import completato · {workouts(last.newSessions)} nuovi, {num(last.updatedSessions)} aggiornati ·{' '}
          {period(last.from, last.to)}
        </div>
      ) : null}

      {!data && error ? (
        <AlertRow
          title="Allenamenti non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      ) : !data ? (
        <WidgetSkeleton title="Allenamenti per settimana" />
      ) : data.last ? (
        <>
          <ExerciseDashboard />
          <div className="grid grid-cols-2 gap-4">
            <RecentRecords today={data.today} />
          </div>
          <section aria-label="Allenamenti per settimana">
            <WidgetCard title="Allenamenti per settimana" meta="ultime 26 settimane">
              <WeekBars weeks={data.weeks} average height={160} />
            </WidgetCard>
          </section>
          <SessionHistory today={data.today} />
        </>
      ) : (
        <div className="rounded-[20px] p-5 text-sm text-ink-muted glass-panel">
          Importa il CSV esportato da Liftin’ per vedere qui i tuoi allenamenti.
        </div>
      )}
    </>
  )
}
