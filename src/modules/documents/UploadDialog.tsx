import type { DragEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { AlertRow, Icon } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { fileSize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Chip } from './Chip'
import type { FileLabel } from './data'
import { FILE_LABELS, useCreateDocument, useDocumentTypes, useRefreshDocuments } from './data'
import { DocumentForm } from './DocumentForm'
import type { FormState, Mode } from './form'
import { emptyForm, MODES, toInput } from './form'
import type { Pending, Upload } from './upload'
import { MAX_FILE_BYTES, message, pending, uploadAll } from './upload'

// Elenco dei file scelti con etichetta e zona per aggiungerne altri.
export function FilePicker({
  files,
  onAdd,
  onLabel,
  onRemove,
  uploads,
}: {
  files: Pending[]
  onAdd: (files: File[]) => void
  onLabel?: (key: string, label: FileLabel) => void
  onRemove?: (key: string) => void
  uploads?: Record<string, Upload>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    onAdd([...e.dataTransfer.files])
  }
  return (
    <div className="flex flex-col gap-2">
      {files.length ? (
        <ul aria-label="File scelti" className="m-0 flex list-none flex-col gap-2 p-0">
          {files.map((p) => {
            const up = uploads?.[p.key]
            const tooBig = p.file.size > MAX_FILE_BYTES
            return (
              <li key={p.key} className="flex flex-col gap-1.5 rounded-[14px] px-3 py-2 glass-chip">
                <div className="flex min-h-9 items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
                  <span className="font-mono text-[13px] text-ink-muted">{fileSize(p.file.size)}</span>
                  {onLabel ? (
                    <select
                      aria-label={`Etichetta di ${p.file.name}`}
                      value={p.label}
                      onChange={(e) => onLabel(p.key, e.target.value as FileLabel)}
                      className="h-8 rounded-[10px] border border-glass-border bg-glass-strong px-2 font-mono text-[13px] text-ink"
                    >
                      {FILE_LABELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono text-[13px] text-ink-muted">{p.label}</span>
                  )}
                  {onRemove ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Togli ${p.file.name}`}
                      onClick={() => onRemove(p.key)}
                    >
                      <Icon name="close" size={16} />
                    </Button>
                  ) : null}
                </div>
                {tooBig ? (
                  <span className="text-xs text-brand-text">Oltre i 20 MB: non verrà caricato.</span>
                ) : null}
                {up && !tooBig ? (
                  up.error ? (
                    <span className="text-xs text-brand-text">{up.error}</span>
                  ) : (
                    <Progress
                      aria-label={`Caricamento di ${p.file.name}`}
                      value={Math.round((up.done ? 1 : up.progress) * 100)}
                    />
                  )
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cn(
          'min-h-14 cursor-pointer rounded-[14px] border border-dashed px-4 text-[13px] text-ink-muted',
          over ? 'border-brand-line bg-glass-strong' : 'border-glass-border hover:bg-glass-hover',
        )}
      >
        {files.length ? 'Trascina altri file' : 'Trascina i file'} o scegli dal computer · max 20 MB l’uno
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-label="Scegli i file"
        onChange={(e) => {
          onAdd([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
    </div>
  )
}

// Montato solo a modale aperto: chiudendo si riparte da capo.
function Wizard({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const types = useDocumentTypes().data ?? []
  const [step, setStep] = useState<1 | 2>(1)
  const [mode, setMode] = useState<Mode>('document')
  const [typeId, setTypeId] = useState<string | null>(null)
  const [files, setFiles] = useState<Pending[]>([])
  const [form, setForm] = useState<FormState | null>(null)
  const [uploads, setUploads] = useState<Record<string, Upload>>({})
  const [created, setCreated] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const create = useCreateDocument()
  const refresh = useRefreshDocuments()
  const type = types.find((t) => t.id === (typeId ?? types[0]?.id)) ?? null

  function next() {
    setForm(emptyForm(mode, type, files[0]?.file.name))
    setStep(2)
  }

  async function save() {
    if (!form) return
    const doc = created ? { id: created } : await create.mutateAsync(toInput(form, mode)).catch(() => null)
    if (!doc) return
    setCreated(doc.id)
    setUploading(true)
    const failed = await uploadAll(
      doc.id,
      files.filter((f) => !uploads[f.key]?.done),
      (key, up) => setUploads((u) => ({ ...u, [key]: up })),
    )
    setUploading(false)
    await refresh()
    if (!failed) {
      onDone()
      void navigate(`/documenti/${doc.id}`)
    }
  }

  const error = create.error ? message(create.error) : null
  const failed = Object.values(uploads).some((u) => u.error)

  return step === 1 ? (
    <>
      <DialogHeader>
        <div className="eyebrow">Carica · 1 di 2</div>
        <DialogTitle className="font-display text-[28px] leading-[34px] font-semibold">
          Cosa stai caricando
        </DialogTitle>
        <DialogDescription className="sr-only">Scegli i file e cosa sono.</DialogDescription>
      </DialogHeader>
      <FilePicker
        files={files}
        onAdd={(added) => setFiles((f) => [...f, ...pending(added, mode, f.length)])}
        onLabel={(key, label) => setFiles((f) => f.map((p) => (p.key === key ? { ...p, label } : p)))}
        onRemove={(key) => setFiles((f) => f.filter((p) => p.key !== key))}
      />
      <div role="group" aria-label="Cos’è" className="grid grid-cols-3 gap-3">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            aria-pressed={mode === m.mode}
            onClick={() => setMode(m.mode)}
            className={cn(
              'flex cursor-pointer flex-col gap-1 rounded-[16px] border p-3.5 text-left',
              mode === m.mode
                ? 'border-brand-line bg-glass-strong'
                : 'border-glass-border bg-transparent hover:bg-glass-hover',
            )}
          >
            <span className="text-[15px] font-medium text-ink">{m.title}</span>
            <span className="text-xs text-ink-muted">{m.description}</span>
          </button>
        ))}
      </div>
      {mode === 'document' ? (
        <div className="flex flex-col gap-2">
          <div className="eyebrow">Tipo</div>
          <div role="group" aria-label="Tipo" className="flex flex-wrap gap-2">
            {types.map((t) => (
              <Chip key={t.id} pressed={t.id === type?.id} onClick={() => setTypeId(t.id)}>
                {t.name}
              </Chip>
            ))}
          </div>
          <span className="text-xs text-ink-muted">Il tipo si può cambiare anche dopo.</span>
        </div>
      ) : null}
      <div className="flex justify-between gap-2">
        <span className="self-center text-xs text-ink-muted">
          {files.length ? '' : 'Puoi anche creare il documento ora e aggiungere i file dopo.'}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="glass" onClick={onDone}>
            Annulla
          </Button>
          <Button type="button" onClick={next} disabled={mode === 'document' && !type}>
            Continua
          </Button>
        </div>
      </div>
    </>
  ) : (
    <>
      <DialogHeader>
        <div className="eyebrow">Carica · 2 di 2{files.length ? ` · ${files.length} file` : ''}</div>
        <DialogTitle className="font-display text-[28px] leading-[34px] font-semibold">
          {mode === 'document'
            ? (type?.name ?? 'Documento')
            : mode === 'info'
              ? 'File con info'
              : 'File libero'}
        </DialogTitle>
        <DialogDescription className="sr-only">Compila i campi e salva.</DialogDescription>
      </DialogHeader>
      {form ? (
        <DocumentForm
          form={form}
          onChange={setForm}
          mode={mode}
          type={type}
          error={error}
          onSubmit={() => void save()}
          footer={
            <>
              {Object.keys(uploads).length ? (
                <FilePicker files={files} onAdd={() => {}} uploads={uploads} />
              ) : null}
              {created && failed && !uploading ? (
                <AlertRow
                  title="Alcuni file non sono stati caricati."
                  body="Il documento è salvato. Riprova o aprilo e aggiungili dopo."
                />
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-ink-muted">Solo il titolo è obbligatorio.</span>
                <div className="flex gap-2">
                  {created ? (
                    <Button
                      type="button"
                      variant="glass"
                      onClick={() => {
                        onDone()
                        void navigate(`/documenti/${created}`)
                      }}
                    >
                      Apri documento
                    </Button>
                  ) : (
                    <Button type="button" variant="glass" onClick={() => setStep(1)}>
                      Indietro
                    </Button>
                  )}
                  <Button type="submit" disabled={!form.title.trim() || create.isPending || uploading}>
                    {uploading ? 'Carico…' : created ? 'Riprova' : 'Salva'}
                  </Button>
                </div>
              </div>
            </>
          }
        />
      ) : null}
    </>
  )
}

// Carica file (DOC-005, DOC-011): prima i file e cosa sono, poi il form.
export function UploadDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[760px]">
        {open ? <Wizard onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}
