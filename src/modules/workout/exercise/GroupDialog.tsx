import type { ReactNode } from 'react'
import { useState } from 'react'

import { AlertRow } from '@/components/ron1n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useSetExerciseGroup } from '../data'
import { MUSCLE_GROUPS } from '../format'

// Scelta del gruppo muscolare (GYM-011): un clic salva e chiude. Vale per
// tutte le sessioni con lo stesso nome e resta dopo un nuovo import.
export function GroupDialog({
  name,
  current,
  children,
}: {
  name: string
  current: string | null
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const save = useSetExerciseGroup()
  const choose = (group: string | null) => save.mutate({ name, group }, { onSuccess: () => setOpen(false) })
  const option = (value: string | null, label: string) => (
    <button
      key={label}
      type="button"
      role="radio"
      aria-checked={current === value}
      disabled={save.isPending}
      onClick={() => choose(value)}
      className={cn(
        'min-h-9 cursor-pointer rounded-full px-3.5 text-[13px] glass-chip',
        current === value ? 'border-brand-line text-brand-text' : 'text-ink-muted hover:bg-glass-hover',
      )}
    >
      {label}
    </button>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) save.reset()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open ? (
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Gruppo muscolare</DialogTitle>
            <DialogDescription className="text-[13px]">
              {name} · vale per tutto lo storico con questo nome.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Gruppo" className="flex flex-wrap gap-2">
            {Object.entries(MUSCLE_GROUPS).map(([value, label]) => option(value, label))}
            {option(null, 'Non assegnato')}
          </div>
          {save.error ? (
            <AlertRow
              title="Gruppo non salvato."
              body={save.error instanceof ApiError ? save.error.message : 'Backend non raggiungibile'}
            />
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
