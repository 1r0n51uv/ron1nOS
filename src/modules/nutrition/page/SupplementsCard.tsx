import { Link } from 'react-router'

import { ToggleTile, WidgetCard } from '@/components/ron1n'
import type { Day, DaySupplement } from '../data'
import { useSetTaken } from '../data'

const meta = (s: DaySupplement) => [s.dose, s.schedule].filter(Boolean).join(' · ') || undefined

// La checklist degli integratori del giorno (NUT-014). L'elenco si
// gestisce in Impostazioni.
export function SupplementsCard({ day }: { day: Day }) {
  const taken = useSetTaken()
  const done = day.supplements.filter((s) => s.taken).length

  return (
    <section aria-label="Integratori">
      <WidgetCard
        title="Integratori"
        meta={day.supplements.length ? `${done} di ${day.supplements.length}` : undefined}
      >
        {day.supplements.length ? (
          <div className="flex flex-col gap-2.5">
            {day.supplements.map((s) => (
              <ToggleTile
                key={s.id}
                name={s.name}
                meta={meta(s)}
                on={s.taken}
                onChange={(next) => taken.mutate({ id: s.id, date: day.date, taken: next })}
              />
            ))}
            {taken.error ? (
              <p role="alert" className="m-0 text-[13px] text-brand-text">
                Spunta non salvata. Riprova.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="m-0 text-[13px] text-ink-muted">
            Nessun integratore.{' '}
            <Link to="/impostazioni/moduli/nutrizione" className="text-brand-text">
              Aggiungili in Impostazioni
            </Link>
          </p>
        )}
      </WidgetCard>
    </section>
  )
}
