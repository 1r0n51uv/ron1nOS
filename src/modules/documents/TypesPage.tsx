import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { AlertRow, Icon } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { cn } from '@/lib/utils'
import type { DocumentType, FieldKind, TypeInput } from './data'
import { TYPE_ICONS, useDeleteType, useDocumentTypes, useSaveType } from './data'
import { message } from './upload'

const KINDS: { kind: FieldKind; label: string }[] = [
  { kind: 'text', label: 'Testo' },
  { kind: 'code', label: 'Codice' },
  { kind: 'date', label: 'Data' },
]

const ICON_LABELS: Record<(typeof TYPE_ICONS)[number], string> = {
  'id-card': 'Documento d’identità',
  passport: 'Passaporto',
  car: 'Auto',
  health: 'Salute',
  file: 'File',
  card: 'Tessera',
  person: 'Persona',
}

type Draft = TypeInput & { id?: string }

const draftOf = (t: DocumentType): Draft => ({
  id: t.id,
  name: t.name,
  icon: t.icon,
  fields: t.fields.map((f) => ({ ...f })),
})

const NEW: Draft = { name: '', icon: 'file', fields: [{ label: '', kind: 'text', copyable: true }] }

function Editor({ type, onSaved }: { type: DocumentType | null; onSaved: (t: DocumentType) => void }) {
  const [draft, setDraft] = useState<Draft>(() => (type ? draftOf(type) : NEW))
  const [confirm, setConfirm] = useState(false)
  const save = useSaveType()
  const remove = useDeleteType()
  const used = type?.documents ?? 0
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setField = (i: number, patch: Partial<Draft['fields'][number]>) =>
    set({ fields: draft.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const move = (i: number) => {
    const fields = [...draft.fields]
    ;[fields[i - 1], fields[i]] = [fields[i], fields[i - 1]]
    set({ fields })
  }
  const error = save.error ?? remove.error

  function submit() {
    const fields = draft.fields.filter((f) => f.label.trim())
    save.mutate({ ...draft, name: draft.name.trim(), fields }, { onSuccess: onSaved })
  }

  return (
    <section
      aria-label={type ? type.name : 'Nuovo tipo'}
      className="flex min-w-0 flex-1 flex-col gap-4 rounded-[24px] p-6 glass-panel"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <label htmlFor="type-name" className="text-[13px] text-ink-muted">
            Nome
          </label>
          <Input
            id="type-name"
            value={draft.name}
            maxLength={60}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="type-icon" className="text-[13px] text-ink-muted">
            Icona
          </label>
          <select
            id="type-icon"
            value={draft.icon}
            onChange={(e) => set({ icon: e.target.value })}
            className="min-h-11 rounded-[14px] border border-glass-border bg-glass-strong px-3 text-[15px] text-ink"
          >
            {TYPE_ICONS.map((i) => (
              <option key={i} value={i}>
                {ICON_LABELS[i]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div role="table" aria-label="Campi" className="flex flex-col">
        <div
          role="row"
          className="grid grid-cols-[minmax(0,1fr)_140px_110px_88px] gap-2.5 pb-2 font-mono text-[11px] tracking-[0.15em] text-ink-muted"
        >
          <span role="columnheader">CAMPO</span>
          <span role="columnheader">TIPO</span>
          <span role="columnheader">COPIABILE</span>
          <span role="columnheader" className="sr-only">
            Azioni
          </span>
        </div>
        {draft.fields.map((f, i) => (
          <div
            key={f.key ?? `new-${i}`}
            role="row"
            className="grid min-h-13 grid-cols-[minmax(0,1fr)_140px_110px_88px] items-center gap-2.5 border-t border-glass-border py-1.5"
          >
            <Input
              aria-label={`Etichetta del campo ${i + 1}`}
              value={f.label}
              maxLength={60}
              onChange={(e) => setField(i, { label: e.target.value })}
            />
            <select
              aria-label={`Tipo del campo ${f.label || i + 1}`}
              value={f.kind}
              onChange={(e) => setField(i, { kind: e.target.value as FieldKind })}
              className="min-h-11 rounded-[14px] border border-glass-border bg-glass-strong px-3 text-sm text-ink"
            >
              {KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={f.copyable}
                onChange={(e) => setField(i, { copyable: e.target.checked })}
                className="size-4 accent-brand"
              />
              {f.copyable ? 'Sì' : 'No'}
            </label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Sposta su ${f.label || 'campo'}`}
                disabled={i === 0}
                onClick={() => move(i)}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Togli ${f.label || 'campo'}`}
                onClick={() => set({ fields: draft.fields.filter((_, j) => j !== i) })}
              >
                <Icon name="close" size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div>
        <Button
          type="button"
          variant="glass"
          size="sm"
          disabled={draft.fields.length >= 40}
          onClick={() => set({ fields: [...draft.fields, { label: '', kind: 'text', copyable: true }] })}
        >
          <Icon name="plus" size={16} />
          Aggiungi campo
        </Button>
      </div>

      {error ? <AlertRow title="Tipo non salvato." body={message(error)} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-glass-border pt-3">
        <span className="text-[13px] text-ink-muted">
          {type
            ? `${used === 1 ? 'Usato da 1 documento' : `Usato da ${used} documenti`}. Un campo tolto non cancella i valori: diventano campi liberi.`
            : 'Un campo nuovo non obbliga a compilare i documenti esistenti.'}
        </span>
        <div className="flex gap-2">
          {type ? (
            confirm ? (
              <>
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  Tieni
                </Button>
                <Button variant="glass" disabled={remove.isPending} onClick={() => remove.mutate(type.id)}>
                  Elimina davvero
                </Button>
              </>
            ) : (
              <Button variant="glass" disabled={used > 0} onClick={() => setConfirm(true)}>
                Elimina tipo
              </Button>
            )
          ) : null}
          <Button onClick={submit} disabled={!draft.name.trim() || save.isPending}>
            Salva
          </Button>
        </div>
      </div>
    </section>
  )
}

// Pagina /documenti/tipi (DOC-016): elenco dei tipi e il tipo scelto.
export function TypesPage() {
  const [params, setParams] = useSearchParams()
  const { data, error } = useDocumentTypes()
  const creating = params.get('nuovo') === '1'
  const types = data ?? []
  const selected = creating ? null : (types.find((t) => t.id === params.get('tipo')) ?? types[0] ?? null)
  const go = (next: Record<string, string>) => setParams(next, { replace: true })

  const group = (label: string, list: DocumentType[]) =>
    list.length ? (
      <>
        <div className="px-3 pt-2 pb-1 eyebrow">{label}</div>
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={t.id === selected?.id ? 'true' : undefined}
            onClick={() => go({ tipo: t.id })}
            className={cn(
              'flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[12px] border px-3 text-left text-sm text-ink',
              t.id === selected?.id
                ? 'border-brand-line bg-glass-strong'
                : 'border-transparent bg-transparent hover:bg-glass-hover',
            )}
          >
            <span className="min-w-0 truncate">{t.name}</span>
            <span className="font-mono text-xs text-ink-muted">{t.documents} doc</span>
          </button>
        ))}
      </>
    ) : null

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Link to="/documenti" className="text-sm">
            Documenti
          </Link>
          <h1 className="m-0 font-display text-[40px] leading-[44px] font-bold">Tipi di documento</h1>
        </div>
        <Button onClick={() => go({ nuovo: '1' })}>
          <Icon name="plus" size={16} />
          Nuovo tipo
        </Button>
      </div>
      {!data && error ? (
        <AlertRow title="Tipi non disponibili." body={message(error)} />
      ) : !data ? (
        <WidgetSkeleton title="Tipi" />
      ) : (
        <div className="flex items-start gap-6">
          <nav
            aria-label="Tipi"
            className="flex w-[300px] shrink-0 flex-col gap-1 rounded-[24px] p-4 glass-panel"
          >
            {group(
              'Già pronti',
              types.filter((t) => t.preset),
            )}
            {group(
              'Creati da te',
              types.filter((t) => !t.preset),
            )}
          </nav>
          <Editor key={selected?.id ?? 'new'} type={selected} onSaved={(t) => go({ tipo: t.id })} />
        </div>
      )}
    </>
  )
}
