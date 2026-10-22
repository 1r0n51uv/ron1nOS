import { useEffect, useState } from 'react'

import { AlertRow } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import type { Food } from '../data'
import { useBarcode } from '../data'

const VALID = /^\d{6,14}$/

// Codice a barre scritto a mano (NUT-005): da iOS arriva dalla fotocamera.
export function BarcodeTab({
  onPick,
  onCreate,
}: {
  onPick: (food: Food) => void
  onCreate: (code: string) => void
}) {
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState<string | null>(null)
  const lookup = useBarcode(submitted)
  const clean = code.replace(/\s/g, '')
  const found = lookup.data?.food

  // Trovato: diventa l'alimento scelto, con la sua quantità.
  useEffect(() => {
    if (found) onPick(found)
  }, [found, onPick])

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (VALID.test(clean)) setSubmitted(clean)
        }}
      >
        <Input
          aria-label="Codice a barre"
          placeholder="Codice a barre, da 6 a 14 cifre"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono"
          autoFocus
        />
        <Button type="submit" size="sm" variant="glass" disabled={!VALID.test(clean) || lookup.isFetching}>
          {lookup.isFetching ? 'Cerco…' : 'Cerca'}
        </Button>
      </form>
      {lookup.data && !found && submitted ? (
        lookup.data.unavailable.length ? (
          <AlertRow title="OpenFoodFacts non risponde." body="Riprova tra poco o crea l'alimento a mano." />
        ) : (
          <div className="flex items-center justify-between gap-3 px-3 text-[13px] text-ink-muted">
            <span>
              Codice sconosciuto · <span className="font-mono">{submitted}</span>
            </span>
            <Button size="sm" variant="glass" onClick={() => onCreate(submitted)}>
              Crea l'alimento
            </Button>
          </div>
        )
      ) : null}
      {lookup.error ? (
        <AlertRow
          title="Ricerca non disponibile."
          body={lookup.error instanceof ApiError ? lookup.error.message : 'Backend non raggiungibile'}
        />
      ) : null}
    </div>
  )
}
