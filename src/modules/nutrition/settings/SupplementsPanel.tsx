import { useId, useState } from 'react'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import type { Supplement, SupplementInput } from '../data'
import { useCreateSupplement, useDeleteSupplement, useSupplements, useUpdateSupplement } from '../data'

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : error ? 'Backend non raggiungibile' : null

// Integratori in Impostazioni (NUT-014): si aggiungono, si disattivano e si
// eliminano. La checklist del giorno è nella pagina Pasti.
export function SupplementsPanel() {
  const { data, error } = useSupplements()
  const [adding, setAdding] = useState(false)
  const create = useCreateSupplement()

  if (!data && error) {
    return (
      <WidgetCard title="Integratori">
        <AlertRow title="Integratori non disponibili." body={errorText(error)!} />
      </WidgetCard>
    )
  }
  if (!data) return <WidgetSkeleton title="Integratori" />

  const active = data.supplements.filter((s) => s.active).length
  return (
    <WidgetCard title="Integratori" meta={`${active} ${active === 1 ? 'attivo' : 'attivi'}`}>
      <div className="flex flex-col gap-3">
        {data.supplements.length ? (
          <ul aria-label="Integratori" className="m-0 flex list-none flex-col p-0">
            {data.supplements.map((s) => (
              <SupplementRow key={s.id} supplement={s} />
            ))}
          </ul>
        ) : (
          <span className="text-[13px] text-ink-muted">Nessun integratore.</span>
        )}
        {adding ? (
          <div className="border-t border-glass-border pt-3">
            <SupplementForm
              pending={create.isPending}
              error={create.error}
              onCancel={() => setAdding(false)}
              onSubmit={(input) => create.mutate(input, { onSuccess: () => setAdding(false) })}
            />
          </div>
        ) : (
          <Button variant="glass" size="sm" className="self-start" onClick={() => setAdding(true)}>
            Nuovo integratore
          </Button>
        )}
      </div>
    </WidgetCard>
  )
}

function SupplementRow({ supplement: s }: { supplement: Supplement }) {
  const [confirm, setConfirm] = useState(false)
  const update = useUpdateSupplement()
  const remove = useDeleteSupplement()
  const message = errorText(update.error ?? remove.error)

  return (
    <li aria-label={s.name} className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center gap-3 text-sm">
        <span className={s.active ? 'min-w-0 flex-1 truncate' : 'min-w-0 flex-1 truncate text-ink-muted'}>
          {s.name}
          {[s.dose, s.schedule].filter(Boolean).map((t) => (
            <span key={t} className="text-ink-muted">
              {' '}
              · {t}
            </span>
          ))}
          {s.active ? null : <span className="text-ink-muted"> · disattivato</span>}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: s.id, patch: { active: !s.active } })}
        >
          {s.active ? 'Disattiva' : 'Riattiva'}
        </Button>
        {confirm ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Tieni
            </Button>
            <Button size="sm" disabled={remove.isPending} onClick={() => remove.mutate(s.id)}>
              Elimina davvero
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
            Elimina
          </Button>
        )}
      </div>
      {confirm ? (
        <span className="text-xs text-ink-muted">Si cancellano anche le spunte dei giorni passati.</span>
      ) : null}
      {message ? <AlertRow title="Integratore non salvato." body={message} /> : null}
    </li>
  )
}

const FIELDS = [
  { key: 'name', label: 'Nome', placeholder: 'Creatina' },
  { key: 'dose', label: 'Dose', placeholder: '5 g' },
  { key: 'schedule', label: 'Quando', placeholder: 'mattina' },
] as const

function SupplementForm({
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  pending: boolean
  error: unknown
  onSubmit: (input: SupplementInput) => void
  onCancel: () => void
}) {
  const id = useId()
  const [draft, setDraft] = useState({ name: '', dose: '', schedule: '' })
  const message = errorText(error)
  const name = draft.name.trim()

  return (
    <form
      aria-label="Nuovo integratore"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (name) onSubmit({ name, dose: draft.dose.trim() || null, schedule: draft.schedule.trim() || null })
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
            <label htmlFor={`${id}-${f.key}`}>
              {f.label}
              {f.key === 'name' ? null : <span className="text-ink-muted/60"> · facoltativo</span>}
            </label>
            <Input
              id={`${id}-${f.key}`}
              value={draft[f.key]}
              placeholder={f.placeholder}
              maxLength={80}
              required={f.key === 'name'}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="glass" size="sm" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" size="sm" disabled={!name || pending}>
          {pending ? 'Salvo…' : 'Aggiungi'}
        </Button>
      </div>
      {message ? <AlertRow title="Integratore non salvato." body={message} /> : null}
    </form>
  )
}
