import { useRef, useState } from 'react'

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
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import type { ImportPlan } from './data'
import { EXPORT_URL, useImportBackup } from './data'

const message = (err: unknown) => (err instanceof ApiError ? err.message : 'Backend non raggiungibile')

// Il testo del file: se non è JSON lo manda com'è, il backend dice perché
// non va (le regole stanno lì).
function parse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// Impostazioni › Backup configurazione (SET-011): esporta preferenze e
// layout in un file; importarlo mostra cosa cambia e chiede conferma.
export function BackupSection() {
  const file = useRef<HTMLInputElement>(null)
  const check = useImportBackup()
  const apply = useImportBackup()
  const [pending, setPending] = useState<{ backup: unknown; plan: ImportPlan } | null>(null)
  const [done, setDone] = useState<ImportPlan | null>(null)

  async function read(picked: File) {
    setDone(null)
    apply.reset()
    const backup = parse(await picked.text())
    check.mutate(
      { backup, confirm: false },
      { onSuccess: (plan) => (plan.changes.length ? setPending({ backup, plan }) : setDone(plan)) },
    )
  }

  return (
    <>
      <WidgetCard title="Esporta">
        <p className="m-0 text-sm text-ink-muted">
          Un file JSON con preferenze e layout della dashboard di tutti i dispositivi. Niente dati dei moduli,
          niente password, niente immagine di sfondo.
        </p>
        <Button asChild variant="glass" size="sm" className="self-start">
          <a href={EXPORT_URL} download>
            Esporta configurazione
          </a>
        </Button>
      </WidgetCard>

      <WidgetCard title="Importa">
        <p className="m-0 text-sm text-ink-muted">
          Prima di cambiare qualcosa mostra cosa cambierà e chiede conferma.
        </p>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          aria-label="File di backup"
          className="sr-only"
          onChange={(e) => {
            const picked = e.target.files?.[0]
            if (picked) void read(picked)
            e.target.value = ''
          }}
        />
        <Button
          variant="glass"
          size="sm"
          className="self-start"
          disabled={check.isPending}
          onClick={() => file.current?.click()}
        >
          {check.isPending ? 'Controllo…' : 'Importa da file'}
        </Button>
        {check.isError ? (
          <p role="alert" className="m-0 text-sm text-brand-text">
            {message(check.error)}
          </p>
        ) : null}
        {done ? (
          <p role="status" className="m-0 text-sm text-ink-muted">
            {done.applied ? 'Configurazione importata.' : 'Niente da cambiare: è già tutto come nel file.'}
            {done.notes.map((n) => ` ${n}`).join('')}
          </p>
        ) : null}
      </WidgetCard>

      <Dialog open={pending !== null} onOpenChange={(open) => (open ? null : setPending(null))}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Importare la configurazione?</DialogTitle>
            <DialogDescription className="text-sm">
              Queste parti prendono i valori del file.
            </DialogDescription>
          </DialogHeader>
          <ul aria-label="Cosa cambia" className="m-0 flex flex-col gap-1.5 pl-5 text-sm">
            {pending?.plan.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {pending?.plan.notes.map((n) => (
            <p key={n} className="m-0 text-[13px] text-ink-muted">
              {n}
            </p>
          ))}
          {apply.isError ? (
            <p role="alert" className="m-0 text-sm text-brand-text">
              Import non riuscito · {message(apply.error)}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="glass">Annulla</Button>
            </DialogClose>
            <Button
              disabled={apply.isPending}
              onClick={() =>
                pending &&
                apply.mutate(
                  { backup: pending.backup, confirm: true },
                  {
                    onSuccess: (plan) => {
                      setPending(null)
                      setDone(plan)
                    },
                  },
                )
              }
            >
              Importa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
