import type { ClipboardEvent, ReactNode } from 'react'
import { useState } from 'react'

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
import { useCreateDraft, useDraft, useRetryDraft } from '../data'
import { fileSize } from '@/lib/format'
import { ContentsStep } from './ContentsStep'
import { FilesStep } from './FilesStep'
import { SourceStep } from './SourceStep'
import type { SourceState } from './source'
import { EMPTY_SOURCE, isReady, parseLink } from './source'
import { STEPS } from './steps'
import { Stepper } from './Stepper'

const TITLES = ['Da dove arriva il torrent', 'Lettura dei contenuti', 'Cosa scaricare', 'Riepilogo']

// Montato solo a modale aperto: chiudendo si riparte da capo.
function Wizard() {
  const [step, setStep] = useState(0)
  const [source, setSource] = useState<SourceState>(EMPTY_SOURCE)
  const draft = useCreateDraft()
  const current = useDraft(draft.data)
  const retry = useRetryDraft()
  const ready = current.data?.status === 'ready' ? current.data : undefined
  // Scelte del passo 3, legate alla bozza: tornando indietro restano.
  const [selection, setSelection] = useState<{ id: string; files: Set<number> } | null>(null)
  const selected =
    ready && selection?.id === ready.id ? selection.files : new Set(ready?.files.map((f) => f.index))

  function next() {
    if (step === 0) {
      draft.mutate(
        source.tab === 'file' && source.file
          ? { kind: 'file', file: source.file }
          : { kind: 'link', link: source.link.trim() },
      )
    }
    setStep((s) => s + 1)
  }

  function back() {
    if (step === 1) {
      draft.reset()
      retry.reset()
    }
    setStep((s) => Math.max(0, s - 1))
  }

  // Un link incollato fuori dal campo apre la scheda Link (DL-004).
  function onPaste(e: ClipboardEvent) {
    if (step !== 0 || e.target instanceof HTMLInputElement) return
    const text = e.clipboardData.getData('text')
    if (!parseLink(text)) return
    e.preventDefault()
    setSource((s) => ({ ...s, tab: 'link', link: text.trim() }))
  }

  const canGoOn =
    (step === 0 && isReady(source)) || (step === 1 && !!ready) || (step === 2 && selected.size > 0)

  return (
    <DialogContent onPaste={onPaste}>
      <DialogHeader>
        <div className="font-mono text-xs tracking-[0.2em] text-ink-muted">
          AGGIUNGI TORRENT · {step + 1} DI {STEPS.length}
        </div>
        <DialogTitle>{TITLES[step]}</DialogTitle>
        {step >= 2 && ready ? (
          <span className="truncate text-[13px] text-ink-muted">
            {ready.name} · {ready.files.length} file · {fileSize(ready.size)}
          </span>
        ) : null}
        <DialogDescription className="sr-only">
          Aggiungi un torrent da file, link magnet o URL.
        </DialogDescription>
      </DialogHeader>
      <Stepper current={step} />
      {step === 0 ? <SourceStep value={source} onChange={setSource} /> : null}
      {step === 1 ? (
        <ContentsStep
          draft={current.data}
          error={draft.error ?? current.error ?? retry.error}
          onBack={back}
          onRetry={() => current.data && retry.mutate(current.data.id)}
        />
      ) : null}
      {step === 2 && ready ? (
        <FilesStep
          draft={ready}
          selected={selected}
          onChange={(files) => setSelection({ id: ready.id, files })}
        />
      ) : null}
      <DialogFooter>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="glass">Annulla</Button>
          </DialogClose>
          {step > 0 ? (
            <Button variant="glass" onClick={back}>
              Indietro
            </Button>
          ) : null}
        </div>
        <Button disabled={!canGoOn} onClick={next}>
          Avanti
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

// Il trigger è il pulsante del widget: alla chiusura il focus torna lì.
export function AddTorrentDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open ? <Wizard /> : null}
    </Dialog>
  )
}
