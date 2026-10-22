import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SlotId, Template } from '../data'
import { SLOT_LABELS, useDeleteTemplate, useSaveTemplate, useTemplates } from '../data'
import { ApplyPanel } from './ApplyPanel'
import { CellDialog } from './CellDialog'
import { renamed, WEEKDAY_NAMES, WEEKDAYS } from './cells'

const SLOTS = Object.keys(SLOT_LABELS) as SlotId[]

// Nome nuovo o rinominato: un campo e un pulsante.
function NameForm({
  initial,
  label,
  onSubmit,
  onCancel,
  pending,
}: {
  initial: string
  label: string
  onSubmit: (name: string) => void
  onCancel: () => void
  pending: boolean
}) {
  const [name, setName] = useState(initial)
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSubmit(name.trim())
      }}
    >
      <Input
        aria-label="Nome del template"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-56"
        autoFocus
      />
      <Button type="submit" size="sm" disabled={!name.trim() || pending}>
        {label}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Annulla
      </Button>
    </form>
  )
}

function Grid({ template }: { template: Template }) {
  return (
    <WidgetCard title="Settimana" meta={`${template.cells.length} pasti`}>
      <table className="w-full table-fixed border-separate border-spacing-1.5">
        <thead>
          <tr>
            <th className="w-24" />
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className="text-left eyebrow font-normal">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot) => (
            <tr key={slot}>
              <th scope="row" className="text-left text-[13px] font-normal text-ink-muted">
                {SLOT_LABELS[slot]}
              </th>
              {WEEKDAYS.map((_, i) => {
                const weekday = i + 1
                const cell = template.cells.find((c) => c.weekday === weekday && c.slot === slot)
                return (
                  <td key={weekday}>
                    <CellDialog template={template} weekday={weekday} slot={slot} cell={cell}>
                      <button
                        type="button"
                        aria-label={`${WEEKDAY_NAMES[i]} ${SLOT_LABELS[slot]}: ${cell ? cell.name : 'vuoto'}`}
                        className={cn(
                          'flex min-h-16 w-full cursor-pointer flex-col items-start justify-between gap-1 rounded-[12px] px-2.5 py-2 text-left text-xs hover:bg-glass-hover',
                          cell ? 'glass-chip' : 'border border-dashed border-glass-border text-ink-muted',
                        )}
                      >
                        <span className="line-clamp-2">{cell ? cell.name : '+'}</span>
                        {cell ? (
                          <span className="font-mono text-[11px] text-ink-muted">
                            {cell.grams ? `${num(cell.grams)} g · ` : ''}
                            {num(cell.kcal)}
                          </span>
                        ) : null}
                      </button>
                    </CellDialog>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="text-left text-[13px] font-normal text-ink-muted">
              Totale
            </th>
            {template.dayKcal.map((k, i) => (
              <td
                key={i}
                aria-label={`Totale ${WEEKDAY_NAMES[i]}: ${num(k)} kcal`}
                className="px-2.5 font-mono text-[13px]"
              >
                {num(k)} kcal
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </WidgetCard>
  )
}

// Pagina /pasti/template (NUT-010): i template settimanali sul server, uguali
// da web e da iOS.
export function TemplatesPage() {
  const [params, setParams] = useSearchParams()
  const { data, error } = useTemplates()
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null)
  const [confirm, setConfirm] = useState(false)
  const save = useSaveTemplate()
  const remove = useDeleteTemplate()
  const templates = data?.templates ?? []
  const selected = templates.find((t) => t.id === params.get('template')) ?? templates[0]
  const failed = save.error ?? remove.error
  const message = failed instanceof ApiError ? failed.message : failed ? 'Backend non raggiungibile' : null
  const select = (id: string) => setParams({ template: id }, { replace: true })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="eyebrow">Pasti · Template</div>
        <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">
          {selected?.name ?? 'Template'}
        </h1>
      </div>

      {!data && error ? (
        <AlertRow
          title="Template non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      ) : !data ? (
        <WidgetSkeleton title="Settimana" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Template" className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-current={t.id === selected?.id ? 'true' : undefined}
                  onClick={() => select(t.id)}
                  className={cn(
                    'min-h-9 cursor-pointer rounded-full px-3.5 text-[13px] glass-chip',
                    t.id === selected?.id
                      ? 'border-brand-line text-brand-text'
                      : 'text-ink-muted hover:bg-glass-hover',
                  )}
                >
                  {t.name}
                </button>
              ))}
            </nav>
            {naming ? (
              <NameForm
                initial={naming === 'rename' ? (selected?.name ?? '') : ''}
                label={naming === 'rename' ? 'Rinomina' : 'Crea'}
                pending={save.isPending}
                onCancel={() => setNaming(null)}
                onSubmit={(name) =>
                  naming === 'rename' && selected
                    ? save.mutate(
                        { id: selected.id, input: renamed(selected, name) },
                        { onSuccess: () => setNaming(null) },
                      )
                    : save.mutate(
                        { input: { name, cells: [] } },
                        {
                          onSuccess: (t) => {
                            setNaming(null)
                            select((t as Template).id)
                          },
                        },
                      )
                }
              />
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setNaming('new')}>
                  Nuovo
                </Button>
                {selected ? (
                  <Button variant="ghost" size="sm" onClick={() => setNaming('rename')}>
                    Rinomina
                  </Button>
                ) : null}
                {selected && confirm ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                      Tieni
                    </Button>
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={() =>
                        remove.mutate(selected.id, {
                          onSuccess: () => {
                            setConfirm(false)
                            setParams({}, { replace: true })
                          },
                        })
                      }
                    >
                      Elimina davvero
                    </Button>
                  </>
                ) : selected ? (
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
                    Elimina
                  </Button>
                ) : null}
              </>
            )}
          </div>
          {message ? <AlertRow title="Template non salvato." body={message} /> : null}

          {selected ? (
            <div className="flex flex-col gap-5">
              <Grid template={selected} />
              <div className="max-w-[720px]">
                <ApplyPanel key={selected.id} template={selected} />
              </div>
            </div>
          ) : (
            <span className="text-[13px] text-ink-muted">Nessun template. Creane uno con Nuovo.</span>
          )}
        </>
      )}
    </>
  )
}
