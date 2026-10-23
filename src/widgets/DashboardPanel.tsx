import { useState } from 'react'

import { WidgetCard } from '@/components/ron1n'
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
import { useDashboardLayout } from './layout'

// Dashboard in Impostazioni: per ora il ripristino del layout (DASH-008).
// Con SET-004 si aggiungono testata ed elenco dei widget.
export function DashboardPanel() {
  const { stored, reset, resetting, resetFailed } = useDashboardLayout()
  const [open, setOpen] = useState(false)

  return (
    <section aria-label="Dashboard">
      <WidgetCard title="Dashboard">
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm text-ink-muted">
            Il layout predefinito rimette tutti i widget in fila, alla dimensione di partenza, senza opzioni.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="glass" size="sm" className="self-start" disabled={!stored}>
                Ripristina layout predefinito
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Ripristinare il layout predefinito?</DialogTitle>
                <DialogDescription className="text-sm">
                  Posizioni, dimensioni, varianti e opzioni dei widget tornano come all’inizio. La testata
                  torna completa.
                </DialogDescription>
              </DialogHeader>
              {resetFailed ? (
                <p role="alert" className="m-0 text-sm text-brand-text">
                  Ripristino non riuscito · riprova
                </p>
              ) : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="glass">Annulla</Button>
                </DialogClose>
                <Button
                  disabled={resetting}
                  onClick={() =>
                    reset().then(
                      () => setOpen(false),
                      () => undefined,
                    )
                  }
                >
                  Ripristina
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {!stored ? (
            <p role="status" className="m-0 text-[13px] text-ink-muted">
              Senza database il layout è già quello predefinito.
            </p>
          ) : null}
        </div>
      </WidgetCard>
    </section>
  )
}
