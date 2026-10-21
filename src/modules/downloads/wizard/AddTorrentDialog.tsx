import type { ReactNode } from 'react'

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
import { Stepper } from './Stepper'
import { STEPS } from './steps'

const TITLES = ['Da dove arriva il torrent', 'Contenuti', 'Cosa scaricare', 'Riepilogo']

// Guscio del wizard (DL-003). I passi arrivano con DL-004…DL-007.
// Il trigger è il pulsante del widget: alla chiusura il focus torna lì.
export function AddTorrentDialog({ children }: { children: ReactNode }) {
  const step = 0
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
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
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass">Annulla</Button>
          </DialogClose>
          <Button disabled>Avanti</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
