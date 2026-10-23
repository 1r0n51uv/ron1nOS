import type { FormEvent, ReactNode } from 'react'
import { useId } from 'react'

import { AlertRow, Icon } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Chip } from './Chip'
import type { DocumentType } from './data'
import { useHolders } from './data'
import type { FormState, Mode } from './form'
import { WARNINGS } from './form'

const MAX_EXTRA = 30

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

// Form di un documento (DOC-005, DOC-006, DOC-007, DOC-010): cosa mostra
// dipende da cosa si sta salvando. Con `types` si sceglie anche il tipo
// (modifica): togliendolo, i valori diventano campi liberi sul server.
export function DocumentForm({
  form,
  onChange,
  mode,
  type,
  types,
  error,
  footer,
  onSubmit,
}: {
  form: FormState
  onChange: (next: FormState) => void
  mode: Mode
  type: DocumentType | null
  types?: DocumentType[]
  error: string | null
  footer: ReactNode
  onSubmit: () => void
}) {
  const id = useId()
  const holders = useHolders().data ?? []
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => onChange({ ...form, [key]: value })
  const setExtra = (i: number, patch: Partial<FormState['extra'][number]>) =>
    set(
      'extra',
      form.extra.map((e, j) => (j === i ? { ...e, ...patch } : e)),
    )
  const toggleWarning = (w: number) =>
    set('warnings', form.warnings.includes(w) ? form.warnings.filter((x) => x !== w) : [...form.warnings, w])
  // L'errore del backend nomina il campo con la sua etichetta.
  const invalid = (label: string) => !!error && error.startsWith(`${label}:`)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
      {types ? (
        <Field id={`${id}-type`} label="Tipo">
          <select
            id={`${id}-type`}
            value={form.typeId ?? ''}
            onChange={(e) => set('typeId', e.target.value || null)}
            className="min-h-11 rounded-[14px] border border-glass-border bg-glass-strong px-3 text-[15px] text-ink"
          >
            <option value="">Nessun tipo · solo campi liberi</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <Field id={`${id}-title`} label="Titolo">
          <Input
            id={`${id}-title`}
            value={form.title}
            maxLength={120}
            aria-invalid={invalid('Titolo') || (error?.includes('title') ?? false)}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        {mode !== 'free' ? (
          <Field id={`${id}-holder`} label="Titolare">
            <Input
              id={`${id}-holder`}
              value={form.holder}
              maxLength={60}
              list={`${id}-holders`}
              onChange={(e) => set('holder', e.target.value)}
            />
            <datalist id={`${id}-holders`}>
              {holders.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>
          </Field>
        ) : null}
      </div>

      {mode === 'document' && type && type.fields.length ? (
        <section aria-label="Campi del tipo" className="flex flex-col gap-3">
          <div className="eyebrow">Campi del tipo</div>
          <div className="grid grid-cols-2 gap-4">
            {type.fields.map((f) => (
              <Field key={f.key} id={`${id}-f-${f.key}`} label={f.label}>
                <Input
                  id={`${id}-f-${f.key}`}
                  type={f.kind === 'date' ? 'date' : 'text'}
                  className={cn(f.kind !== 'text' && 'font-mono')}
                  value={form.fields[f.key] ?? ''}
                  aria-invalid={invalid(f.label)}
                  onChange={(e) => set('fields', { ...form.fields, [f.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </section>
      ) : null}

      {mode !== 'free' ? (
        <section aria-label="Campi liberi" className="flex flex-col gap-3">
          <div className="eyebrow">Campi liberi</div>
          {form.extra.map((e, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-end gap-3">
              <Field id={`${id}-l${i}`} label="Etichetta">
                <Input
                  id={`${id}-l${i}`}
                  value={e.label}
                  maxLength={60}
                  onChange={(ev) => setExtra(i, { label: ev.target.value })}
                />
              </Field>
              <Field id={`${id}-v${i}`} label="Valore">
                <Input
                  id={`${id}-v${i}`}
                  className="font-mono"
                  value={e.value}
                  maxLength={2000}
                  onChange={(ev) => setExtra(i, { value: ev.target.value })}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Togli ${e.label || 'campo'}`}
                onClick={() =>
                  set(
                    'extra',
                    form.extra.filter((_, j) => j !== i),
                  )
                }
              >
                <Icon name="close" size={16} />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="glass"
              size="sm"
              disabled={form.extra.length >= MAX_EXTRA}
              onClick={() => set('extra', [...form.extra, { label: '', value: '' }])}
            >
              <Icon name="plus" size={16} />
              Aggiungi campo
            </Button>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        {mode === 'document' ? (
          <>
            <Field id={`${id}-exp`} label="Scadenza">
              <Input
                id={`${id}-exp`}
                type="date"
                className="font-mono"
                value={form.expiresOn}
                onChange={(e) => set('expiresOn', e.target.value)}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-ink-muted">Preavvisi</span>
              <div role="group" aria-label="Preavvisi" className="flex min-h-11 items-center gap-2">
                {WARNINGS.map((w) => (
                  <Chip key={w} small pressed={form.warnings.includes(w)} onClick={() => toggleWarning(w)}>
                    {w} gg
                  </Chip>
                ))}
              </div>
            </div>
          </>
        ) : null}
        <Field id={`${id}-tags`} label="Tag">
          <Input
            id={`${id}-tags`}
            value={form.tags}
            placeholder="separati da virgola"
            onChange={(e) => set('tags', e.target.value)}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(e) => set('pinned', e.target.checked)}
            className="size-4 accent-brand"
          />
          In evidenza
        </label>
      </div>

      <Field id={`${id}-notes`} label="Note">
        <textarea
          id={`${id}-notes`}
          value={form.notes}
          maxLength={5000}
          rows={3}
          onChange={(e) => set('notes', e.target.value)}
          className="rounded-[14px] border border-glass-border bg-glass-strong px-3.5 py-2.5 text-[15px] text-ink outline-none focus-visible:border-brand-line"
        />
      </Field>

      <div className="sticky bottom-0 flex flex-col gap-3 bg-[rgba(22,22,24,0.94)] pt-3">
        {error ? <AlertRow title="Documento non salvato." body={error} /> : null}
        {footer}
      </div>
    </form>
  )
}
