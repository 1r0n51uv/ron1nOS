import { useState } from 'react'

import { WidgetCard } from '@/components/ron1n'
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
import { cn } from '@/lib/utils'
import type { DashboardLayout, LayoutItem } from './layout'
import { HEADER_FORMS, readingOrder, useDashboardLayout } from './layout'
import { findWidget, MODULE_LABELS } from './registry'
import { WidgetOptionsDialog } from './WidgetOptionsDialog'

// Impostazioni › Dashboard (SET-004): forma della testata, widget presenti
// con `Opzioni` e `Rimuovi`, ripristino del layout (DASH-008). Il layout è
// uno solo per tutta la sezione, così le modifiche si salvano insieme.
export function DashboardPanel() {
  const { layout, setLayout, stored, saveFailed, retry, reset, resetting, resetFailed } = useDashboardLayout()
  const [open, setOpen] = useState(false)

  return (
    <section aria-label="Dashboard" className="flex flex-col gap-5">
      {layout ? (
        <>
          <HeaderCard
            value={layout.header}
            onChange={(header) => setLayout({ header, items: layout.items })}
          />
          <WidgetsCard layout={layout} onChange={(items) => setLayout({ header: layout.header, items })} />
        </>
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
      <WidgetCard title="Layout">
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm text-ink-muted">
            Il layout predefinito rimette tutti i widget in fila, alla dimensione di partenza, senza opzioni.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="glass" size="sm" className="self-start" disabled={!stored}>
                Ripristina layout predefinito
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Ripristinare il layout predefinito?</DialogTitle>
                <DialogDescription className="text-sm">
                  Posizioni, dimensioni, varianti e opzioni dei widget tornano come all’inizio. La testata
                  torna completa.
                </DialogDescription>
              </DialogHeader>
              {resetFailed ? (
                <p role="alert" className="m-0 text-sm text-brand-text">
                  Ripristino non riuscito · riprova
                </p>
              ) : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="glass">Annulla</Button>
                </DialogClose>
                <Button
                  disabled={resetting}
                  onClick={() =>
                    reset().then(
                      () => setOpen(false),
                      () => undefined,
                    )
                  }
                >
                  Ripristina
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {!stored ? (
            <p role="status" className="m-0 text-[13px] text-ink-muted">
              Senza database il layout è già quello predefinito.
            </p>
          ) : null}
        </div>
      </WidgetCard>
    </section>
  )
}

function HeaderCard({
  value,
  onChange,
}: {
  value: DashboardLayout['header']
  onChange: (form: DashboardLayout['header']) => void
}) {
  return (
    <WidgetCard title="Testata">
      <div className="flex items-center justify-between gap-6">
        <p className="m-0 text-sm text-ink-muted">Saluto, data e stato in alto sulla dashboard.</p>
        <div
          role="radiogroup"
          aria-label="Forma della testata"
          className="inline-flex shrink-0 gap-1 rounded-full border border-glass-border bg-glass p-1"
        >
          {HEADER_FORMS.map(([form, label]) => (
            <button
              key={form}
              type="button"
              role="radio"
              aria-checked={value === form}
              onClick={() => onChange(form)}
              className={cn(
                'h-9 cursor-pointer rounded-full border-0 px-4 text-sm',
                value === form ? 'bg-glass-hover text-ink' : 'bg-transparent text-ink-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </WidgetCard>
  )
}

// I widget nel layout, nell'ordine in cui si leggono sulla dashboard.
function WidgetsCard({
  layout,
  onChange,
}: {
  layout: DashboardLayout
  onChange: (items: LayoutItem[]) => void
}) {
  const [optionsId, setOptionsId] = useState<string | null>(null)
  const rows = readingOrder(layout.items).flatMap((item) => {
    const widget = findWidget(item.id)
    return widget ? [{ item, widget }] : []
  })
  const options = rows.find((r) => r.item.id === optionsId)

  return (
    <WidgetCard title="Widget presenti" meta={`${rows.length}`}>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-ink-muted">Nessun widget · si aggiungono dalla dashboard.</p>
      ) : (
        <ul aria-label="Widget presenti" className="m-0 flex list-none flex-col p-0">
          {rows.map(({ item, widget }) => (
            <li
              key={item.id}
              className="flex items-center gap-4 border-t border-glass-border py-2.5 first:border-t-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm">{widget.title}</span>
                <span className="text-[13px] text-ink-muted">{MODULE_LABELS[widget.module]}</span>
              </div>
              <span className="font-mono text-[13px] text-ink-muted">
                {item.w} × {item.h}
              </span>
              <Button
                variant="glass"
                size="sm"
                aria-label={`Opzioni · ${widget.title}`}
                onClick={() => setOptionsId(item.id)}
              >
                Opzioni
              </Button>
              <Button
                variant="glass"
                size="sm"
                aria-label={`Rimuovi · ${widget.title}`}
                className="text-brand-text"
                onClick={() => onChange(layout.items.filter((i) => i.id !== item.id))}
              >
                Rimuovi
              </Button>
            </li>
          ))}
        </ul>
      )}
      {options ? (
        <WidgetOptionsDialog
          item={options.item}
          widget={options.widget}
          onChange={(next) => onChange(layout.items.map((i) => (i.id === next.id ? next : i)))}
          onClose={() => setOptionsId(null)}
        />
      ) : null}
    </WidgetCard>
  )
}
