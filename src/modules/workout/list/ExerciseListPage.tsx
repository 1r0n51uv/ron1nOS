import { useState } from 'react'
import { Link } from 'react-router'

import { AlertRow } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { todayRome } from '@/modules/nutrition/dates'
import type { ExerciseRow } from '../data'
import { exercisePath, useExercises } from '../data'
import { GroupDialog } from '../exercise/GroupDialog'
import { RadioChips } from '../exercise/RadioChips'
import { groupLabel, workoutDay } from '../format'
import { ChooseImageDialog } from '../images/ChooseImageDialog'
import { ExercisePhoto } from '../images/ExercisePhoto'

type Filter = 'all' | 'incomplete'

const FILTERS = [
  { value: 'all', label: 'Tutti' },
  { value: 'incomplete', label: 'Da completare' },
] as const

// Le etichette di ciò che manca aprono la scelta, fuori dal link della card.
function Missing({ exercise }: { exercise: ExerciseRow }) {
  if (exercise.group && exercise.image) return null
  const tag =
    'min-h-7 cursor-pointer rounded-full border border-brand-line px-2.5 text-[11px] text-brand-text'
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {exercise.group ? null : (
        <GroupDialog name={exercise.name} current={null}>
          <button type="button" className={tag} aria-label={`Assegna il gruppo a ${exercise.name}`}>
            Senza gruppo
          </button>
        </GroupDialog>
      )}
      {exercise.image ? null : (
        <ChooseImageDialog name={exercise.name} current={null}>
          <button type="button" className={tag} aria-label={`Scegli immagine per ${exercise.name}`}>
            Senza immagine
          </button>
        </ChooseImageDialog>
      )}
    </div>
  )
}

function Card({ exercise, today }: { exercise: ExerciseRow; today: string }) {
  return (
    <li aria-label={exercise.name} className="flex min-w-0 flex-col gap-2 rounded-[16px] p-2 glass-chip">
      <Link to={exercisePath(exercise.key)} className="flex flex-col gap-2 text-ink no-underline">
        <ExercisePhoto name={exercise.name} image={exercise.image} className="h-20 rounded-[12px]" compact />
        <div className="flex flex-col gap-0.5 px-1">
          <span className="truncate text-[13px] font-medium">{exercise.name}</span>
          <span className="truncate text-[11px] text-ink-muted">
            {groupLabel(exercise.group)} · {workoutDay(exercise.lastDay, today)}
          </span>
        </div>
      </Link>
      <Missing exercise={exercise} />
    </li>
  )
}

// Pagina /allenamenti/esercizi (GYM-009): tutti gli esercizi in card
// compatte, 6 per riga, dall'ultima volta più recente. Ricerca per nome e
// filtro `Da completare` per quelli senza gruppo o senza immagine.
export function ExerciseListPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const { data, error } = useExercises({ q: query.trim() || undefined, incomplete: filter === 'incomplete' })
  const today = todayRome()

  return (
    <>
      <Link
        to="/allenamenti"
        className="hit-area self-start text-[13px] text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
      >
        Allenamenti
      </Link>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="eyebrow">Palestra</div>
          <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">Esercizi</h1>
        </div>
        <div className="flex items-center gap-3">
          <RadioChips label="Filtro" options={FILTERS} value={filter} onChange={setFilter} />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome"
            aria-label="Cerca esercizi"
            className="w-[260px]"
          />
        </div>
      </div>
      {!data && error ? (
        <AlertRow
          title="Esercizi non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      ) : !data ? (
        <WidgetSkeleton title="Esercizi" />
      ) : !data.length ? (
        <div className="rounded-[20px] p-5 text-sm text-ink-muted glass-panel">
          {filter === 'incomplete' && !query.trim()
            ? 'Tutti gli esercizi hanno gruppo e immagine.'
            : query.trim()
              ? 'Nessun esercizio con questo nome.'
              : 'Importa il CSV esportato da Liftin’ per vedere qui i tuoi esercizi.'}
        </div>
      ) : (
        <ul aria-label="Esercizi" className="m-0 grid list-none grid-cols-6 gap-3 p-0">
          {data.map((e) => (
            <Card key={e.key} exercise={e} today={today} />
          ))}
        </ul>
      )}
    </>
  )
}
