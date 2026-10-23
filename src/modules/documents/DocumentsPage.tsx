import { useSearchParams } from 'react-router'

import { AlertRow, Icon } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { ApiError } from '@/lib/api'
import { useDebounced } from '@/lib/useDebounced'
import { Chip } from './Chip'
import { DocumentCard } from './DocumentCard'
import { useDocuments, useDocumentTypes, useHolders } from './data'
import { groupDocuments } from './format'
import { UploadDialog } from './UploadDialog'

// Pagina /documenti (DOC-002): griglia di card, in alto i fissati, poi un
// gruppo per tipo. Ricerca per titolo e tag, filtri per tipo e titolare.
export function DocumentsPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type = params.get('tipo') ?? ''
  const holder = params.get('titolare') ?? ''
  const search = useDebounced(q, 250)
  const { data, error } = useDocuments({ q: search, type, holder })
  const types = useDocumentTypes().data ?? []
  const holders = useHolders().data ?? []

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const filtered = !!(q || type || holder)
  const groups = groupDocuments(
    data ?? [],
    types.map((t) => t.id),
  )
  const usedTypes = types.filter((t) => t.documents > 0)

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="eyebrow">
            Archivio
            {data && !filtered ? ` · ${data.length} ${data.length === 1 ? 'documento' : 'documenti'}` : ''}
          </div>
          <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">Documenti</h1>
        </div>
        <UploadDialog>
          <Button>
            <Icon name="plus" size={16} />
            Carica file
          </Button>
        </UploadDialog>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Cerca per titolo o tag"
          placeholder="Cerca per titolo o tag"
          className="max-w-[320px]"
          value={q}
          onChange={(e) => set('q', e.target.value)}
        />
        <div role="group" aria-label="Tipo" className="flex flex-wrap gap-2">
          <Chip pressed={!type} onClick={() => set('tipo', '')}>
            Tutti
          </Chip>
          {usedTypes.map((t) => (
            <Chip key={t.id} pressed={type === t.id} onClick={() => set('tipo', t.id)}>
              {t.name}
            </Chip>
          ))}
          <Chip pressed={type === 'none'} onClick={() => set('tipo', 'none')}>
            File
          </Chip>
        </div>
        {holders.length > 1 ? (
          <div role="group" aria-label="Titolare" className="flex flex-wrap gap-2">
            <Chip pressed={!holder} onClick={() => set('titolare', '')}>
              Tutti i titolari
            </Chip>
            {holders.map((h) => (
              <Chip key={h} pressed={holder === h} onClick={() => set('titolare', h)}>
                {h}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      {!data && error ? (
        <AlertRow
          title="Documenti non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      ) : !data ? (
        <WidgetSkeleton title="Documenti" />
      ) : groups.length ? (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label} className="flex w-full flex-col gap-3">
            <div className="eyebrow">{g.label}</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {g.documents.map((d) => (
                <DocumentCard key={d.id} doc={d} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="m-0 text-sm text-ink-muted">
          {filtered
            ? 'Nessun documento con questi filtri.'
            : 'Nessun documento. Carica un file per iniziare: un documento, un PDF con le sue info o un file da tenere.'}
        </p>
      )}
    </>
  )
}
