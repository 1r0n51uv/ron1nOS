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
import { ContentsStep } from './ContentsStep'
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

  function next() {
    if (step === 0) {
      draft.mutate(
        source.tab === 'file' && source.file
          ? { kind: 'file', file: source.file }
          : { kind: 'link', link: source.link.trim() },
      )
      setStep(1)
    }
  }

  function back() {
    draft.reset()
    retry.reset()
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

  const canGoOn = step === 0 && isReady(source)

  return (
    <DialogContent onPaste={onPaste}>
      <DialogHeader>
        <div className="font-mono text-xs tracking-[0.2em] text-ink-muted">
          AGGIUNGI TORRENT · {step + 1} DI {STEPS.length}
        </div>
        <DialogTitle>{TITLES[step]}</DialogTitle>
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
