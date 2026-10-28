import type { ReactNode } from 'react'
import { useState } from 'react'

import { AlertRow } from '@/components/ron1n'
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
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ImportSummary } from '../data'
import { csvFileError, useImportPreview, useImportWorkouts } from '../data'
import { period } from '../format'

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : err ? 'Backend non raggiungibile' : null

// Montato solo a modale aperto: chiudendo si riparte da capo.
function ImportCsv({ onDone }: { onDone: (summary: ImportSummary) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const preview = useImportPreview()
  const apply = useImportWorkouts()
  const summary = preview.data
  const error = fileError ?? message(preview.error) ?? message(apply.error)

  function pick(next: File | undefined) {
    if (!next) return
    setFile(next)
    apply.reset()
    const invalid = csvFileError(next)
    setFileError(invalid)
    if (invalid) preview.reset()
    else preview.mutate(next)
  }

  return (
    <DialogContent className="max-w-[560px]">
      <DialogHeader>
        <div className="font-mono text-xs tracking-[0.2em] text-ink-muted">ALLENAMENTI</div>
        <DialogTitle>Importa CSV di Liftin’</DialogTitle>
        <DialogDescription className="text-[13px]">
          Il file completo esportato da Liftin’: le sessioni già presenti si aggiornano, nessuna si duplica.
        </DialogDescription>
      </DialogHeader>

      <label
        className={cn(
          'flex h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-white/20 bg-glass text-center transition-colors',
          over && 'border-brand-line bg-brand-tint-faint',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          pick(e.dataTransfer.files[0])
        }}
      >
        {file ? (
          <span className="max-w-[80%] truncate font-mono text-sm">{file.name}</span>
        ) : (
          <span className="text-base font-medium">Trascina qui il file .csv</span>
        )}
        <span className="text-[13px] text-ink-muted">
          {file ? null : 'oppure '}
          <span className="text-ink underline decoration-ink/40 underline-offset-4">
            {file ? 'scegli un altro file' : 'scegli dal disco'}
          </span>
          {' · fino a 5 MB'}
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="File CSV di Liftin’"
          className="sr-only"
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>

      {error ? <AlertRow title="File non importabile." body={error} /> : null}
      {preview.isPending ? <div className="text-[13px] text-ink-muted">Lettura del file…</div> : null}
      {summary && !error ? (
        <div className="flex flex-col gap-2" aria-label="Anteprima dell'import">
          <dl className="m-0 flex flex-col gap-1.5 rounded-[16px] p-4 glass-panel">
            <Line label="Allenamenti nuovi" value={summary.newSessions} />
            <Line label="Allenamenti aggiornati" value={summary.updatedSessions} />
            <Line label="Righe scartate" value={summary.skippedRows} />
          </dl>
          <div className="text-[13px] text-ink-muted">
            {period(summary.from, summary.to)}
            {summary.deletedSessions
              ? ` · ${num(summary.deletedSessions)} eliminati in ron1nOS restano fuori`
              : null}
          </div>
        </div>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="glass">Annulla</Button>
        </DialogClose>
        <Button
          disabled={!file || !summary || !!error || apply.isPending}
          onClick={() => file && apply.mutate(file, { onSuccess: onDone })}
        >
          Importa
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="m-0 font-mono">{num(value)}</dd>
    </div>
  )
}

// Il dialog di import (GYM-003), aperto dal pulsante passato come figlio.
export function ImportDialog({
  children,
  onImported,
}: {
  children: ReactNode
  onImported?: (summary: ImportSummary) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open ? (
        <ImportCsv
          onDone={(summary) => {
            setOpen(false)
            onImported?.(summary)
          }}
        />
      ) : null}
    </Dialog>
  )
}
