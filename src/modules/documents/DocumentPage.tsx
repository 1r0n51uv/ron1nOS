import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { AlertRow, Icon, StatusPill } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Attachments } from './Attachments'
import type { Document } from './data'
import { useDeleteDocument, useDocument, useDocumentTypes, useUpdateDocument } from './data'
import { DocumentForm } from './DocumentForm'
import type { FormState } from './form'
import { formOf, toInput } from './form'
import { copyAllText, expiryText, itDate } from './format'
import { message } from './upload'

// Conferma breve dopo una copia (DOC-009): `Copiato · Numero`.
function useToast() {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!text) return
    const id = setTimeout(() => setText(null), 2000)
    return () => clearTimeout(id)
  }, [text])
  return [text, setText] as const
}

function CopyRow({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string
  value: string
  mono?: boolean
  onCopy?: () => void
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-t border-glass-border text-sm first:border-t-0">
      <span className="w-[180px] shrink-0 text-ink-muted">{label}</span>
      <span className={cn('min-w-0 flex-1 break-words', mono && 'font-mono')}>{value}</span>
      {onCopy ? (
        <Button variant="ghost" size="sm" aria-label={`Copia ${label}`} onClick={onCopy}>
          <Icon name="copy" size={16} />
          Copia
        </Button>
      ) : null}
    </div>
  )
}

// Campi del tipo e campi liberi, ognuno con Copia; Copia tutto in testa.
function Fields({ doc, onCopied }: { doc: Document; onCopied: (what: string) => void }) {
  const copy = (label: string, value: string) =>
    navigator.clipboard.writeText(value).then(
      () => onCopied(label),
      () => onCopied('non riuscito'),
    )
  const typeFields = doc.type?.fields ?? []
  const all = copyAllText(doc)
  return (
    <section aria-label="Campi" className="flex min-w-0 flex-col gap-4 rounded-[24px] p-6 glass-panel">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Campi</div>
        {all ? (
          <Button variant="glass" size="sm" onClick={() => void copy('tutto', all)}>
            Copia tutto
          </Button>
        ) : null}
      </div>
      {typeFields.length ? (
        <div className="flex flex-col">
          {typeFields.map((f) => {
            const raw = doc.fields[f.key]
            if (!raw) return <CopyRow key={f.key} label={f.label} value="Non compilato" />
            const value = f.kind === 'date' ? itDate(raw) : raw
            return (
              <CopyRow
                key={f.key}
                label={f.label}
                value={value}
                mono={f.kind !== 'text'}
                onCopy={f.copyable ? () => void copy(f.label, value) : undefined}
              />
            )
          })}
        </div>
      ) : null}
      {doc.extra.length ? (
        <>
          {typeFields.length ? <div className="eyebrow">Campi liberi</div> : null}
          <div className="flex flex-col">
            {doc.extra.map((e, i) => (
              <CopyRow
                key={i}
                label={e.label}
                value={e.value}
                mono
                onCopy={() => void copy(e.label, e.value)}
              />
            ))}
          </div>
        </>
      ) : null}
      {!typeFields.length && !doc.extra.length ? (
        <p className="m-0 text-sm text-ink-muted">Nessun campo.</p>
      ) : null}
      {doc.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {doc.tags.map((t) => (
            <span key={t} className="rounded-full px-3 py-1 text-xs glass-chip">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {doc.notes ? <p className="m-0 text-sm whitespace-pre-wrap text-ink-muted">{doc.notes}</p> : null}
    </section>
  )
}

function EditDialog({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const types = useDocumentTypes().data ?? []
  const [form, setForm] = useState<FormState>(() => formOf(doc))
  const save = useUpdateDocument(doc.id)
  const type = types.find((t) => t.id === form.typeId) ?? null
  const mode = form.typeId ? 'document' : 'info'
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="font-display text-[28px] leading-[34px] font-semibold">
            Modifica
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-muted">
            Cambiando tipo, i valori che il nuovo tipo non ha diventano campi liberi.
          </DialogDescription>
        </DialogHeader>
        <DocumentForm
          form={form}
          onChange={setForm}
          mode={mode}
          type={type}
          types={types}
          error={save.error ? message(save.error) : null}
          onSubmit={() => save.mutate(toInput(form, mode), { onSuccess: onClose })}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="glass" onClick={onClose}>
                Annulla
              </Button>
              <Button type="submit" disabled={!form.title.trim() || save.isPending}>
                Salva
              </Button>
            </div>
          }
        />
      </DialogContent>
    </Dialog>
  )
}

// Pagina /documenti/:id (DOC-004): allegati in alto a sinistra, campi a
// destra; azioni evidenza, modifica, elimina.
export function DocumentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: doc, error } = useDocument(id)
  const pin = useUpdateDocument(id ?? '')
  const remove = useDeleteDocument()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [toast, setToast] = useToast()

  if (!doc) {
    return error ? (
      <>
        <Link to="/documenti" className="text-sm">
          Documenti
        </Link>
        <AlertRow
          title={
            error instanceof ApiError && error.status === 404
              ? 'Documento non trovato.'
              : 'Documento non disponibile.'
          }
          body={message(error)}
        />
      </>
    ) : (
      <WidgetSkeleton title="Documento" />
    )
  }

  const expiry = expiryText(doc.expiresOn, doc.expiry)
  const actionError = pin.error ?? remove.error

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link to="/documenti" className="text-sm">
            Documenti
          </Link>
          <h1 className="m-0 truncate font-display text-[40px] leading-[44px] font-bold">{doc.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span>
              {doc.type?.name ?? 'File'} · {doc.holder}
            </span>
            {doc.expiresOn ? (
              <>
                <span>·</span>
                <span>
                  Scade il <span className="font-mono">{itDate(doc.expiresOn)}</span>
                </span>
                {doc.expiry && doc.expiry.status !== 'ok' ? (
                  <StatusPill tone="alert" size="small">
                    {expiry === 'Scaduto' ? 'Scaduto' : expiry}
                  </StatusPill>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="glass"
            aria-pressed={doc.pinnedAt !== null}
            disabled={pin.isPending}
            onClick={() => pin.mutate({ pinned: doc.pinnedAt === null })}
          >
            <Icon name="star" size={16} />
            {doc.pinnedAt ? 'In evidenza' : 'Metti in evidenza'}
          </Button>
          <Button variant="glass" onClick={() => setEditing(true)}>
            Modifica
          </Button>
          {confirm ? (
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Tieni
              </Button>
              <Button
                variant="glass"
                disabled={remove.isPending}
                onClick={() => remove.mutate(doc.id, { onSuccess: () => void navigate('/documenti') })}
              >
                Elimina davvero
              </Button>
            </>
          ) : (
            <Button variant="glass" onClick={() => setConfirm(true)}>
              Elimina
            </Button>
          )}
        </div>
      </div>
      {confirm ? (
        <p className="m-0 text-sm text-ink-muted">
          Il documento e i suoi file vengono cancellati in modo definitivo.
        </p>
      ) : null}
      {actionError ? <AlertRow title="Azione non riuscita." body={message(actionError)} /> : null}

      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start gap-5">
        <Attachments doc={doc} onCopied={(what) => setToast(`Copiato · ${what}`)} />
        <Fields
          doc={doc}
          onCopied={(what) => setToast(what === 'non riuscito' ? 'Copia non riuscita' : `Copiato · ${what}`)}
        />
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm glass-chip"
        >
          {toast}
        </div>
      ) : null}
      {editing ? <EditDialog doc={doc} onClose={() => setEditing(false)} /> : null}
    </>
  )
}
