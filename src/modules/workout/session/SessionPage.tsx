import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useFormats } from '@/preferences/data'
import { todayRome } from '@/modules/nutrition/dates'
import type { SessionDetail } from '../data'
import { useDeleteSession, useSession } from '../data'
import { duration, massTotal, setLabel, startTime, workoutDay } from '../format'
import { ExercisePhoto } from '../images/ExercisePhoto'

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : err ? 'Backend non raggiungibile' : null

// Volume per esercizio in barre orizzontali, il più pesante in rosso.
function VolumeBars({ exercises }: { exercises: SessionDetail['exercises'] }) {
  const fmt = useFormats()
  const lifted = exercises.filter((e) => e.volumeKg > 0)
  const top = Math.max(1, ...lifted.map((e) => e.volumeKg))
  if (!lifted.length) return null
  return (
    <section aria-label="Volume per esercizio">
      <WidgetCard title="Volume per esercizio">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {lifted.map((e) => (
            <li key={e.key} className="grid grid-cols-[200px_1fr_90px] items-center gap-3 text-sm">
              <span className="truncate text-ink-muted">{e.name}</span>
              <span className="h-2 rounded-full bg-track">
                <span
                  className={cn('block h-full rounded-full', e.volumeKg === top ? 'bg-brand' : 'bg-ink/45')}
                  style={{ width: `${(e.volumeKg / top) * 100}%` }}
                />
              </span>
              <span className="text-right font-mono">{massTotal(e.volumeKg, fmt)}</span>
            </li>
          ))}
        </ul>
      </WidgetCard>
    </section>
  )
}

function ExerciseCard({ exercise: e }: { exercise: SessionDetail['exercises'][number] }) {
  const fmt = useFormats()
  return (
    <li aria-label={e.name} className="flex flex-col gap-2.5 rounded-[18px] p-2.5 glass-panel">
      <ExercisePhoto name={e.name} image={e.image} className="h-[110px]">
        <div className="flex items-end justify-between gap-2">
          <span className="text-sm leading-5 font-semibold text-white">{e.name}</span>
          {e.record ? (
            <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
              Record
            </span>
          ) : null}
        </div>
      </ExercisePhoto>
      <ul aria-label={`Serie di ${e.name}`} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {e.sets.map((s) => (
          <li
            key={s.index}
            title={s.warmup ? 'Riscaldamento' : undefined}
            className={cn(
              'rounded-[8px] border px-2 py-0.5 font-mono text-xs',
              s.warmup ? 'border-dashed border-ink/30 text-ink-muted' : 'border-glass-border',
            )}
          >
            {setLabel(s, fmt)}
          </li>
        ))}
      </ul>
    </li>
  )
}

function DeleteSession({ session }: { session: SessionDetail }) {
  const [open, setOpen] = useState(false)
  const remove = useDeleteSession()
  const navigate = useNavigate()
  const error = message(remove.error)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">Elimina sessione</Button>
      </DialogTrigger>
      {open ? (
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Eliminare la sessione?</DialogTitle>
            <DialogDescription className="text-[13px]">
              {session.routine || 'Allenamento'} · {workoutDay(session.day, todayRome())}. Sparisce da
              storico, grafici e record, e un nuovo import del CSV non la riporta.
            </DialogDescription>
          </DialogHeader>
          {error ? <AlertRow title="Sessione non eliminata." body={error} /> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="glass">Annulla</Button>
            </DialogClose>
            <Button
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(session.id, { onSuccess: () => navigate('/allenamenti', { replace: true }) })
              }
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

// Pagina /allenamenti/sessioni/:id (GYM-005): testata, volume per
// esercizio e una card per esercizio con le serie. In sola lettura, tranne
// Elimina sessione (GYM-006).
export function SessionPage() {
  const { id = '' } = useParams()
  const { data, error } = useSession(id)
  const fmt = useFormats()

  return (
    <>
      <Link
        to="/allenamenti"
        className="self-start text-[13px] text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
      >
        Allenamenti
      </Link>
      {!data && error ? (
        <AlertRow title="Sessione non disponibile." body={message(error) ?? undefined} />
      ) : !data ? (
        <WidgetSkeleton title="Sessione" />
      ) : (
        <>
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="eyebrow">Sessione</div>
              <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">
                {data.routine || 'Allenamento'}
              </h1>
              <div className="font-mono text-sm text-ink-muted">
                {[
                  `${workoutDay(data.day, todayRome())} · ${startTime(data.startedAt, fmt.timeZone)}`,
                  data.durationSeconds ? duration(data.durationSeconds) : null,
                  massTotal(data.volumeKg, fmt),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <DeleteSession session={data} />
          </div>
          <VolumeBars exercises={data.exercises} />
          <ul aria-label="Esercizi" className="m-0 grid list-none grid-cols-4 gap-4 p-0 xl:grid-cols-5">
            {data.exercises.map((e) => (
              <ExerciseCard key={e.key} exercise={e} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}
