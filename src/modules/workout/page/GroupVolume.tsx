import { useState } from 'react'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { ApiError } from '@/lib/api'
import { num, shortDay } from '@/lib/format'
import { useFormats } from '@/preferences/data'
import { useGroupVolume } from '../data'
import { RadioChips } from '../exercise/RadioChips'
import { groupLabel, massTotal } from '../format'

type Measure = 'volume' | 'sets'

// Toni di grigio per i gruppi, dal più chiaro: il rosso resta l'unico
// accento della pagina. Non assegnato è tratteggiato.
const SHADES = [92, 78, 66, 56, 47, 39, 32, 26, 21]

function swatch(index: number, unassigned: boolean) {
  return unassigned
    ? {
        backgroundImage:
          'repeating-linear-gradient(135deg, color-mix(in srgb, var(--ink) 35%, transparent) 0 3px, transparent 3px 6px)',
      }
    : { backgroundColor: `color-mix(in srgb, var(--ink) ${SHADES[index % SHADES.length]}%, transparent)` }
}

// Volume per gruppo muscolare (GYM-012): barre impilate settimana per
// settimana sulle ultime 12, sotto solo la legenda.
export function GroupVolume() {
  const [measure, setMeasure] = useState<Measure>('volume')
  const { data, error } = useGroupVolume()
  const fmt = useFormats()

  if (!data && error) {
    return (
      <WidgetCard title="Gruppi muscolari">
        <AlertRow
          title="Gruppi non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Gruppi muscolari" />

  const value = (g: { volumeKg: number; sets: number }) => (measure === 'volume' ? g.volumeKg : g.sets)
  const totals = data.weeks.map((w) => w.groups.reduce((sum, g) => sum + value(g), 0))
  const top = Math.max(1, ...totals)
  const unit = (v: number) => (measure === 'volume' ? massTotal(v, fmt) : `${num(v)} serie`)
  const index = new Map(data.groups.map((g, i) => [g, i]))
  const first = data.weeks[0]
  const label = `${measure === 'volume' ? 'Volume' : 'Serie'} per gruppo muscolare dal ${
    first ? shortDay(first.monday) : ''
  }: questa settimana ${unit(totals.at(-1) ?? 0)}`

  return (
    <section aria-label="Gruppi muscolari">
      <WidgetCard title="Gruppi muscolari" meta="ultime 12 settimane">
        <RadioChips
          label="Misura"
          options={[
            { value: 'volume', label: 'Volume' },
            { value: 'sets', label: 'Serie' },
          ]}
          value={measure}
          onChange={setMeasure}
        />
        {data.groups.length ? (
          <>
            <div
              role="img"
              aria-label={label}
              className="flex h-[140px] items-end gap-1 border-b border-glass-border"
            >
              {data.weeks.map((w, i) => (
                <div
                  key={w.monday}
                  data-week={w.monday}
                  title={`${shortDay(w.monday)} · ${unit(totals[i]!)}`}
                  className="flex flex-1 flex-col-reverse overflow-hidden rounded-t-[3px]"
                  style={{ height: `${(totals[i]! / top) * 100}%` }}
                >
                  {w.groups.map((g) => (
                    <div
                      key={g.group ?? ''}
                      style={{
                        height: `${(value(g) / (totals[i] || 1)) * 100}%`,
                        ...swatch(index.get(g.group) ?? 0, g.group === null),
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <ul aria-label="Legenda" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0">
              {data.groups.map((g, i) => (
                <li key={g ?? ''} className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={swatch(i, g === null)} />
                  {groupLabel(g)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="text-sm text-ink-muted">Nessuna serie nelle ultime 12 settimane.</div>
        )}
      </WidgetCard>
    </section>
  )
}
