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
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'
import type { ExerciseImage } from '../data'
import { useCatalog, useSetExerciseImage } from '../data'

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : err ? 'Backend non raggiungibile' : null

// Montato solo a modale aperto: chiudendo si riparte da capo.
function ChooseImage({
  name,
  current,
  onDone,
}: {
  name: string
  current: ExerciseImage | null
  onDone: () => void
}) {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim())
  const catalog = useCatalog(q)
  const save = useSetExerciseImage()
  const error = message(catalog.error) ?? message(save.error)
  const choose = (catalogId: string | null) => save.mutate({ name, catalogId }, { onSuccess: onDone })

  return (
    <DialogContent className="max-w-[720px]">
      <DialogHeader>
        <div className="font-mono text-xs tracking-[0.2em] text-ink-muted">IMMAGINE</div>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription className="text-[13px]">
          Cerca nel catalogo, nomi in inglese. La foto vale per tutte le sessioni con questo nome.
        </DialogDescription>
      </DialogHeader>

      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="bench press, squat, curl…"
        aria-label="Cerca nel catalogo"
        autoFocus
      />

      {error ? <AlertRow title="Catalogo non disponibile." body={error} /> : null}
      {catalog.data ? (
        catalog.data.exercises.length ? (
          <ul
            aria-label="Immagini del catalogo"
            className="m-0 grid max-h-[420px] list-none grid-cols-4 gap-3 overflow-y-auto p-0"
          >
            {catalog.data.exercises.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  aria-pressed={current?.catalogId === e.id}
                  disabled={save.isPending}
                  onClick={() => choose(e.id)}
                  className={cn(
                    'relative flex aspect-square w-full cursor-pointer flex-col justify-end overflow-hidden rounded-[14px] border border-glass-border text-left',
                    current?.catalogId === e.id && 'border-brand-line',
                  )}
                >
                  <img
                    src={e.url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover brightness-[0.55] grayscale"
                  />
                  <span className="relative bg-linear-to-t from-black/80 to-transparent p-2 text-xs leading-4">
                    {e.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[13px] text-ink-muted">
            Nessun esercizio trovato · prova con il nome inglese.
          </div>
        )
      ) : catalog.isPending ? (
        <div className="text-[13px] text-ink-muted">Ricerca…</div>
      ) : null}

      <DialogFooter>
        {current?.source === 'manual' ? (
          <Button variant="ghost" disabled={save.isPending} onClick={() => choose(null)}>
            Abbinamento automatico
          </Button>
        ) : null}
        <DialogClose asChild>
          <Button variant="glass">Chiudi</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  )
}

// Scegli immagine (GYM-014), aperto dal pulsante passato come figlio.
export function ChooseImageDialog({
  name,
  current,
  children,
}: {
  name: string
  current: ExerciseImage | null
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open ? <ChooseImage name={name} current={current} onDone={() => setOpen(false)} /> : null}
    </Dialog>
  )
}
