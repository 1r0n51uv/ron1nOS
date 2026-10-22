import { Link, useSearchParams } from 'react-router'

import { AlertRow, Icon } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNow } from '@/hooks/useNow'
import { ApiError } from '@/lib/api'
import { useDay } from '../data'
import { eyebrowDay, isDay, todayRome } from '../dates'
import { AddMealDialog } from '../log/AddMealDialog'
import { CaffeineCard } from './CaffeineCard'
import { DayStrip } from './DayStrip'
import { DaySummary } from './DaySummary'
import { SlotCard } from './SlotCard'
import { SupplementsCard } from './SupplementsCard'
import { WaterCard } from './WaterCard'

// Pagina /pasti (NUT-002): il giorno scelto con i 5 pasti e il riepilogo.
export function MealsPage() {
  const now = useNow()
  const today = todayRome(now)
  const [params] = useSearchParams()
  const requested = params.get('giorno')
  const date = isDay(requested) ? requested : today
  const { data, error } = useDay(date)
  const shown = data?.date === date ? data : undefined

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="eyebrow">{eyebrowDay(date)}</div>
          <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">Pasti</h1>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Nutrizione" className="flex gap-2">
            <Button asChild variant="glass" size="sm">
              <Link to="/pasti/andamento">Andamento</Link>
            </Button>
            <Button asChild variant="glass" size="sm">
              <Link to="/pasti/template">Template</Link>
            </Button>
            <Button asChild variant="glass" size="sm">
              <Link to="/pasti/ricette">Ricette e spesa</Link>
            </Button>
          </nav>
          <AddMealDialog date={date} slot={shown?.suggestedSlot ?? 'breakfast'}>
            <Button disabled={!shown}>
              <Icon name="plus" size={18} />
              Registra
            </Button>
          </AddMealDialog>
        </div>
      </div>

      <DayStrip today={today} selected={date} />

      {error && !shown ? (
        <AlertRow
          title="Diario non disponibile."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <section aria-label="Pasti del giorno" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
            {shown
              ? shown.slots.map((s) => <SlotCard key={s.slot} date={date} slot={s} />)
              : Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} aria-busy="true" className="h-20 rounded-panel" />
                ))}
          </section>
          <aside
            aria-label="Riepilogo del giorno"
            className="flex max-w-[440px] flex-[1_1_360px] flex-col gap-3.5"
          >
            {shown ? (
              <>
                <DaySummary day={shown} title={date === today ? 'Oggi' : 'Giorno'} />
                <WaterCard day={shown} />
                <CaffeineCard day={shown} />
                <SupplementsCard day={shown} />
              </>
            ) : (
              <Skeleton aria-busy="true" className="h-72 rounded-panel" />
            )}
          </aside>
        </div>
      )}
    </>
  )
}
