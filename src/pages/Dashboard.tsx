import { StatusPill } from '@/components/ron1n'
import { useNow } from '@/hooks/useNow'
import { eyebrowDate, greeting, time } from '@/lib/format'
import { summarize, useContainers } from '@/modules/containers/data'
import type { SlotId } from '@/modules/nutrition/data'
import { useDay } from '@/modules/nutrition/data'
import { todayRome } from '@/modules/nutrition/dates'
import { useEffect, useState } from 'react'

import { AddWidgetDialog } from '@/widgets/AddWidgetDialog'
import { DashboardGrid } from '@/widgets/DashboardGrid'
import { addWidget } from '@/widgets/grid'
import type { LayoutItem } from '@/widgets/layout'
import { useDashboardLayout } from '@/widgets/layout'
import { availableWidgets, findWidget } from '@/widgets/registry'

const MEAL_ARTICLE: Record<SlotId, string> = {
  breakfast: 'la colazione',
  morning_snack: 'lo spuntino',
  lunch: 'il pranzo',
  afternoon_snack: 'la merenda',
  dinner: 'la cena',
}

// Frase di stato sotto il saluto: cosa non funziona, cosa resta da fare.
function useSummary(now: Date) {
  const containers = useContainers().data
  const nutrition = useDay(todayRome(now)).data

  const parts: string[] = []
  if (containers) {
    const n = summarize(containers).down.length
    parts.push(
      n === 0
        ? 'Tutto operativo.'
        : n === 1
          ? 'Tutto operativo, tranne un container.'
          : `Tutto operativo, tranne ${n} container.`,
    )
  }

  const todo: string[] = []
  if (nutrition?.nextSlot) todo.push(MEAL_ARTICLE[nutrition.nextSlot])
  if (todo.length) parts.push(`Ti manca ${todo.join(' e ')}.`)

  return parts.join(' ')
}

export const UNDO_MS = 8000

// Il layout salvato (o quello predefinito) con i widget disponibili: quelli
// dei moduli spenti restano nel layout ma non si vedono. Ogni modifica si
// salva da sola (DASH-004); dopo `Rimuovi` resta `Annulla` per 8 secondi.
function useWidgets() {
  const { layout, setLayout, stored, saveFailed, retry } = useDashboardLayout()
  const items = layout?.items ?? []
  const [removed, setRemoved] = useState<{ title: string; items: LayoutItem[] } | null>(null)

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [removed])

  const setItems = (next: LayoutItem[]) => {
    if (layout) setLayout({ header: layout.header, items: next })
  }
  return {
    items,
    widgets: availableWidgets(),
    stored,
    saveFailed,
    retry,
    setItems,
    remove: (id: string) => {
      setRemoved({ title: findWidget(id)?.title ?? 'Widget', items })
      setItems(items.filter((i) => i.id !== id))
    },
    removed: removed?.title ?? null,
    undo: () => {
      if (removed) setItems(removed.items)
      setRemoved(null)
    },
  }
}

export function Dashboard() {
  const { items, widgets, stored, saveFailed, retry, setItems, remove, removed, undo } = useWidgets()
  const now = useNow()
  const summary = useSummary(now)
  const containers = useContainers().data
  const status = containers && summarize(containers)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs tracking-[0.2em] text-ink-muted">
            {eyebrowDate(now)} · {time(now)}
          </div>
          <h1 className="mt-1.5 mb-0 font-display text-[44px] leading-[48px] font-bold">{greeting(now)}</h1>
          <p className="mt-1.5 mb-0 min-h-6 text-base leading-6 text-ink-muted">{summary}</p>
        </div>
        <div className="flex items-center gap-3">
          {status ? (
            <StatusPill tone={status.down.length ? 'alert' : 'ok'}>
              homelab · {status.running}/{status.total} attivi
            </StatusPill>
          ) : null}
          <AddWidgetDialog
            widgets={widgets}
            present={new Set(items.map((i) => i.id))}
            onAdd={(widget) => setItems(addWidget(items, widget))}
          />
        </div>
      </div>

      {!stored ? (
        <p role="status" className="m-0 text-sm text-ink-muted">
          Layout predefinito · senza database le modifiche non si salvano
        </p>
      ) : null}
      {saveFailed ? (
        <p role="alert" className="m-0 flex items-center gap-3 text-sm text-brand-text">
          Layout non salvato ·
          <button
            type="button"
            onClick={retry}
            className="cursor-pointer border-0 bg-transparent p-0 text-brand-text underline"
          >
            Riprova
          </button>
        </p>
      ) : null}
      <DashboardGrid items={items} widgets={widgets} onChange={setItems} onRemove={remove} />
      {removed ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div
            role="status"
            className="pointer-events-auto flex h-12 items-center gap-3.5 rounded-full pr-2.5 pl-5 text-sm glass-bar"
          >
            Widget {removed} rimosso
            <button
              type="button"
              onClick={undo}
              className="h-9 cursor-pointer rounded-full border-0 bg-glass-strong px-3.5 text-sm text-brand-text"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
