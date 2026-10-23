import { useRef, useState } from 'react'

import { AlertRow, Icon } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { fileSize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Document, DocumentFile, FileLabel } from './data'
import { FILE_LABELS, fileUrl, useDeleteFile, useRefreshDocuments, useUpdateFile } from './data'
import { fileKind, previewable } from './format'
import type { Pending, Upload } from './upload'
import { FilePicker } from './UploadDialog'
import { pending, uploadAll } from './upload'

const canCopyImage = () =>
  typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined'

// Un'immagine negli appunti come PNG (DOC-009): il browser accetta solo
// PNG, quindi le altre passano da un canvas.
async function copyImage(url: string) {
  const blob = await (await fetch(url)).blob()
  let png = blob
  if (blob.type !== 'image/png') {
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'),
    )
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

function Preview({ doc, file, onZoom }: { doc: Document; file: DocumentFile; onZoom: () => void }) {
  const url = fileUrl(doc.id, file.id)
  if (file.mime === 'application/pdf') {
    return (
      <iframe
        title={file.name}
        src={url}
        className="h-[420px] w-full rounded-[14px] border border-glass-border"
      />
    )
  }
  if (previewable(file.mime)) {
    return (
      <button
        type="button"
        onClick={onZoom}
        aria-label={`Apri ${file.name} a schermo intero`}
        className="flex h-[420px] cursor-zoom-in items-center justify-center overflow-hidden rounded-[14px] border border-glass-border bg-glass-strong p-0"
      >
        <img src={url} alt={file.name} className="max-h-full max-w-full object-contain" />
      </button>
    )
  }
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-[14px] border border-glass-border bg-glass-strong">
      <span className="font-mono text-[13px] tracking-[0.1em] text-ink-muted">{fileKind(file.mime)}</span>
      <span className="text-sm">{file.name}</span>
      <span className="text-xs text-ink-muted">Anteprima non disponibile · si può scaricare</span>
    </div>
  )
}

// Allegati del dettaglio (DOC-004, DOC-011, DOC-012, DOC-014): anteprima,
// schermo intero, copia immagine, download, etichetta, ordine, elimina,
// aggiunta di altri file.
export function Attachments({ doc, onCopied }: { doc: Document; onCopied: (what: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [adding, setAdding] = useState<Pending[]>([])
  const [uploads, setUploads] = useState<Record<string, Upload>>({})
  const [copyError, setCopyError] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const update = useUpdateFile(doc.id)
  const remove = useDeleteFile(doc.id)
  const refresh = useRefreshDocuments()
  const files = doc.files
  const selected = files.find((f) => f.id === selectedId) ?? files[0]
  const error = update.error ?? remove.error

  async function add(chosen: File[]) {
    const list = pending(chosen, 'info', files.length)
    setAdding(list)
    setUploads({})
    const failed = await uploadAll(doc.id, list, (key, up) => setUploads((u) => ({ ...u, [key]: up })))
    await refresh()
    if (!failed) setAdding([])
  }

  return (
    <section aria-label="Allegati" className="flex min-w-0 flex-col gap-4 rounded-[24px] p-6 glass-panel">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Allegati · {files.length}</div>
        <Button variant="glass" size="sm" onClick={() => input.current?.click()}>
          <Icon name="plus" size={16} />
          Aggiungi
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          aria-label="Aggiungi file"
          onChange={(e) => {
            void add([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>

      {selected ? (
        <>
          <Preview doc={doc} file={selected} onZoom={() => setZoom(true)} />
          <div className="flex flex-wrap items-center gap-2">
            {previewable(selected.mime) && selected.mime.startsWith('image/') && canCopyImage() ? (
              <Button
                variant="glass"
                size="sm"
                onClick={() =>
                  copyImage(fileUrl(doc.id, selected.id)).then(
                    () => onCopied(selected.name),
                    () => setCopyError(true),
                  )
                }
              >
                <Icon name="copy" size={16} />
                Copia immagine
              </Button>
            ) : null}
            <Button variant="glass" size="sm" asChild>
              <a href={fileUrl(doc.id, selected.id, { download: true })} download={selected.name}>
                <Icon name="download" size={16} />
                Scarica
              </a>
            </Button>
          </div>
        </>
      ) : (
        <p className="m-0 text-sm text-ink-muted">Nessun allegato.</p>
      )}

      {files.length ? (
        <ul aria-label="File" className="m-0 flex list-none flex-col p-0">
          {files.map((f, i) => (
            <li
              key={f.id}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-[12px] px-2 text-sm',
                f.id === selected?.id && 'bg-glass-strong',
              )}
            >
              <button
                type="button"
                aria-current={f.id === selected?.id ? 'true' : undefined}
                onClick={() => setSelectedId(f.id)}
                className="min-w-0 flex-1 cursor-pointer truncate bg-transparent p-0 text-left text-ink"
              >
                {f.name}
              </button>
              <select
                aria-label={`Etichetta di ${f.name}`}
                value={f.label}
                onChange={(e) => update.mutate({ fileId: f.id, label: e.target.value as FileLabel })}
                className="h-8 rounded-[10px] border border-glass-border bg-glass-strong px-2 font-mono text-[13px] text-ink"
              >
                {FILE_LABELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <span className="w-[64px] text-right font-mono text-[13px] text-ink-muted">
                {fileSize(f.size)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Sposta su ${f.name}`}
                disabled={i === 0}
                onClick={() => update.mutate({ fileId: f.id, position: i - 1 })}
              >
                ↑
              </Button>
              {confirm === f.id ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                    Tieni
                  </Button>
                  <Button
                    variant="glass"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(f.id, { onSuccess: () => setConfirm(null) })}
                  >
                    Elimina davvero
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Elimina ${f.name}`}
                  onClick={() => setConfirm(f.id)}
                >
                  <Icon name="trash" size={16} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {adding.length ? <FilePicker files={adding} onAdd={() => {}} uploads={uploads} /> : null}
      {error ? (
        <AlertRow
          title="Allegato non aggiornato."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      ) : null}
      {copyError ? <AlertRow title="Immagine non copiata." body="Il browser non lo permette." /> : null}

      {selected && zoom ? (
        <Dialog open onOpenChange={setZoom}>
          <DialogContent className="max-w-[min(1200px,92vw)] p-4">
            <DialogTitle className="sr-only">{selected.name}</DialogTitle>
            <DialogDescription className="sr-only">Immagine a schermo intero</DialogDescription>
            <img
              src={fileUrl(doc.id, selected.id)}
              alt={selected.name}
              className="max-h-[85vh] w-full object-contain"
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  )
}
