import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { num } from '@/lib/format'
import type { ImportSummary } from '../data'
import { period, workouts } from '../format'
import { ImportDialog } from '../import/ImportDialog'

// Pagina /allenamenti (GYM-002). Per ora l'import del CSV (GYM-003); le
// sezioni dello storico, degli esercizi e dei record arrivano con le loro
// issue.
export function WorkoutPage() {
  const [last, setLast] = useState<ImportSummary | null>(null)

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="eyebrow">Palestra</div>
          <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">Allenamenti</h1>
        </div>
        <ImportDialog onImported={setLast}>
          <Button>Importa CSV</Button>
        </ImportDialog>
      </div>

      <div role="status" className="rounded-[20px] p-5 text-sm glass-panel">
        {last ? (
          <>
            Import completato · {workouts(last.newSessions)} nuovi, {num(last.updatedSessions)} aggiornati ·{' '}
            {period(last.from, last.to)}
          </>
        ) : (
          <span className="text-ink-muted">
            Importa il CSV esportato da Liftin’ per vedere qui i tuoi allenamenti.
          </span>
        )}
      </div>
    </>
  )
}
