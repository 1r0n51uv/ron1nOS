import { useState } from 'react'

import { Icon } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MODULE_LABELS } from './registry'
import type { ModuleId, WidgetDef } from './types'

// Catalogo di `Aggiungi widget` (DASH-004): i widget dei moduli accesi,
// divisi per modulo, con un'anteprima dal vivo. Quelli già in dashboard
// restano visibili ma non si aggiungono di nuovo.
export function AddWidgetDialog({
  widgets,
  present,
  onAdd,
}: {
  widgets: WidgetDef[]
  present: ReadonlySet<string>
  onAdd: (widget: WidgetDef) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="glass">
          <Icon name="plus" size={16} />
          Aggiungi widget
        </Button>
      </DialogTrigger>
      {open ? (
        <Catalog
          widgets={widgets}
          present={present}
          onAdd={(widget) => {
            onAdd(widget)
            setOpen(false)
          }}
        />
      ) : null}
    </Dialog>
  )
}

function Catalog({
  widgets,
  present,
  onAdd,
}: {
  widgets: WidgetDef[]
  present: ReadonlySet<string>
  onAdd: (widget: WidgetDef) => void
}) {
  const [query, setQuery] = useState('')
  const [module, setModule] = useState<ModuleId | null>(null)
  const modules = [...new Set(widgets.map((w) => w.module))]
  const needle = query.trim().toLowerCase()
  const matching = widgets.filter(
    (w) => !needle || `${w.title} ${w.description}`.toLowerCase().includes(needle),
  )
  const groups = modules
    .filter((m) => module === null || m === module)
    .map((m) => ({ module: m, widgets: matching.filter((w) => w.module === m) }))
    .filter((g) => g.widgets.length)

  return (
    <DialogContent className="max-h-[calc(100vh-64px)] max-w-[960px] grid-rows-[auto_minmax(0,1fr)]">
      <DialogHeader className="flex-row items-center gap-4">
        <DialogTitle className="text-[26px]">Aggiungi widget</DialogTitle>
        <DialogDescription className="sr-only">
          Scegli un widget: entra nel primo spazio libero in alto.
        </DialogDescription>
        <Input
          type="search"
          aria-label="Cerca widget"
          placeholder="Cerca widget"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ml-auto max-w-[280px]"
        />
      </DialogHeader>
      <div className="flex min-h-0 gap-6">
        <nav aria-label="Moduli" className="flex w-[180px] shrink-0 flex-col gap-0.5">
          <ModuleButton
            label="Tutti"
            count={matching.length}
            on={module === null}
            onClick={() => setModule(null)}
          />
          {modules.map((m) => (
            <ModuleButton
              key={m}
              label={MODULE_LABELS[m]}
              count={matching.filter((w) => w.module === m).length}
              on={module === m}
              onClick={() => setModule(m)}
            />
          ))}
        </nav>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1">
          {groups.length === 0 ? <p className="m-0 text-sm text-ink-muted">Nessun widget trovato.</p> : null}
          {groups.map((g) => (
            <section key={g.module} aria-label={MODULE_LABELS[g.module]} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h3 className="m-0 font-display text-xl font-semibold">{MODULE_LABELS[g.module]}</h3>
                <span className="text-[13px] text-ink-muted">
                  {g.widgets.length} widget · {g.widgets.filter((w) => present.has(w.id)).length} già in
                  dashboard
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {g.widgets.map((w) => (
                  <WidgetCard key={w.id} widget={w} added={present.has(w.id)} onAdd={() => onAdd(w)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </DialogContent>
  )
}

function ModuleButton({
  label,
  count,
  on,
  onClick,
}: {
  label: string
  count: number
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'flex h-10 cursor-pointer items-center justify-between rounded-[14px] border-0 bg-transparent px-3 text-left text-sm text-ink-muted hover:bg-glass hover:text-ink',
        on && 'bg-glass-strong font-semibold text-ink',
      )}
    >
      <span>{label}</span>
      <span className="font-mono text-xs">{count}</span>
    </button>
  )
}

// L'anteprima è il widget vero, a metà scala e non interattivo.
function WidgetCard({ widget, added, onAdd }: { widget: WidgetDef; added: boolean; onAdd: () => void }) {
  const Preview = widget.component
  return (
    <article
      aria-label={widget.title}
      className="flex flex-col gap-3 rounded-tile border border-glass-border bg-glass p-3"
    >
      <div aria-hidden="true" inert className="pointer-events-none h-[140px] overflow-hidden rounded-[14px]">
        <div className="flex h-[280px] w-[200%] origin-top-left scale-50">
          <Preview className="min-h-0 flex-1 overflow-hidden" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{widget.title}</span>
        <span className="text-[13px] text-ink-muted">{widget.description}</span>
      </div>
      {added ? (
        <span className="text-[13px] text-ink-muted">In dashboard</span>
      ) : (
        <Button variant="glass" size="sm" className="self-start" onClick={onAdd}>
          <Icon name="plus" size={16} />
          Aggiungi
        </Button>
      )}
    </article>
  )
}
