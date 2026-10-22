import { useId, useState } from 'react'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { num, shortDay } from '@/lib/format'
import type { Goal, GoalInput } from '../data'
import { useGoals, useSaveGoal } from '../data'
import { goalLine } from '../format'

const FIELDS = [
  { key: 'kcal', label: 'Calorie', unit: 'kcal' },
  { key: 'protein', label: 'Proteine', unit: 'g' },
  { key: 'carbs', label: 'Carboidrati', unit: 'g' },
  { key: 'fat', label: 'Grassi', unit: 'g' },
  { key: 'waterMl', label: 'Acqua', unit: 'ml' },
] as const

type Draft = Record<(typeof FIELDS)[number]['key'], string>

function toDraft(goal: Goal | null): Draft {
  const v = (n: number | null | undefined) => (n == null ? '' : String(n))
  return {
    kcal: v(goal?.kcal),
    protein: v(goal?.protein),
    carbs: v(goal?.carbs),
    fat: v(goal?.fat),
    waterMl: v(goal?.waterMl),
  }
}

function toInput(d: Draft): GoalInput | null {
  const n = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')))
  const input = { kcal: n(d.kcal), protein: n(d.protein), carbs: n(d.carbs), fat: n(d.fat) }
  if (Object.values(input).some((x) => !Number.isFinite(x) || x < 0)) return null
  const water = n(d.waterMl)
  return { ...input, waterMl: Number.isFinite(water) ? water : null }
}

// Obiettivo nutrizionale in Impostazioni (NUT-015): a mano senza YAZIO,
// in sola lettura quando arriva da YAZIO.
export function GoalsPanel() {
  const { data, error } = useGoals()
  if (!data && error) {
    return (
      <WidgetCard title="Obiettivo nutrizionale">
        <AlertRow
          title="Obiettivo non disponibile."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Obiettivo nutrizionale" />
  return (
    <GoalsForm
      key={data.current?.id ?? 'nuovo'}
      current={data.current}
      history={data.history}
      editable={data.editable}
    />
  )
}

function GoalsForm({
  current,
  history,
  editable,
}: {
  current: Goal | null
  history: Goal[]
  editable: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState(() => toDraft(current))
  const save = useSaveGoal()
  const input = toInput(draft)
  const changed = JSON.stringify(draft) !== JSON.stringify(toDraft(current))
  const error =
    save.error instanceof ApiError ? save.error.message : save.error ? 'Salvataggio non riuscito' : null

  return (
    <WidgetCard title="Obiettivo nutrizionale" meta={current?.source === 'yazio' ? 'da YAZIO' : 'manuale'}>
      <div className="flex flex-col gap-4">
        {editable ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (input) save.mutate(input)
            }}
          >
            <div className="grid grid-cols-5 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
                  <label htmlFor={`${id}-${f.key}`}>{f.label}</label>
                  <span className="relative">
                    <Input
                      id={`${id}-${f.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={draft[f.key]}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                      className="pr-12"
                      required={f.key !== 'waterMl'}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-xs">
                      {f.unit}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-ink-muted">
                Vale da oggi. I giorni passati tengono l'obiettivo che avevano.
              </span>
              <Button type="submit" size="sm" disabled={!input || !changed || save.isPending}>
                {save.isPending ? 'Salvo…' : 'Salva'}
              </Button>
            </div>
            {error ? <AlertRow title="Obiettivo non salvato." body={error} /> : null}
          </form>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex min-h-8 items-center justify-between gap-4 text-sm">
              <span className="text-ink-muted">Obiettivo</span>
              <span className="font-mono text-[13px]">{current ? goalLine(current) : '—'}</span>
            </div>
            <div className="flex min-h-8 items-center justify-between gap-4 text-sm">
              <span className="text-ink-muted">Acqua</span>
              <span className="font-mono text-[13px]">
                {current?.waterMl != null ? `${num(current.waterMl)} ml` : '—'}
              </span>
            </div>
            <span className="text-xs text-ink-muted">Si modifica nell'app YAZIO.</span>
          </div>
        )}

        {history.length > 1 ? (
          <div className="flex flex-col gap-1 border-t border-glass-border pt-3">
            <div className="eyebrow">Storico</div>
            <ul className="m-0 flex list-none flex-col p-0">
              {history.slice(0, 6).map((g) => (
                <li key={g.id} className="flex min-h-8 items-center justify-between gap-4 text-[13px]">
                  <span className="text-ink-muted">
                    dal {shortDay(g.effectiveFrom)}
                    {g.source === 'yazio' ? ' · YAZIO' : ''}
                  </span>
                  <span className="font-mono">{goalLine(g)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </WidgetCard>
  )
}
