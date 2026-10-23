// Caricamento degli allegati (DOC-011), comune al wizard e al dettaglio.
import { ApiError } from '@/lib/api'
import type { FileLabel } from './data'
import { documentsSource } from './data'
import type { Mode } from './form'

export const MAX_FILE_BYTES = 20 * 1024 * 1024

export type Pending = { key: string; file: File; label: FileLabel }
export type Upload = { progress: number; error: string | null; done: boolean }

export const message = (err: unknown) => (err instanceof ApiError ? err.message : 'Backend non raggiungibile')

// Etichetta proposta: per un documento fronte, retro e poi pagine.
const labelFor = (mode: Mode, index: number): FileLabel =>
  mode === 'document' ? ((['fronte', 'retro'][index] as FileLabel | undefined) ?? 'pagina') : 'altro'

// Carica i file in fila: un errore su uno non ferma gli altri (DOC-011).
export async function uploadAll(
  documentId: string,
  files: Pending[],
  onUpdate: (key: string, upload: Upload) => void,
) {
  let failed = 0
  for (const p of files) {
    // Già segnalato nell'elenco: non si carica e non blocca il resto.
    if (p.file.size > MAX_FILE_BYTES) continue
    onUpdate(p.key, { progress: 0, error: null, done: false })
    try {
      await documentsSource.upload(documentId, p.file, p.label, (progress) =>
        onUpdate(p.key, { progress, error: null, done: false }),
      )
      onUpdate(p.key, { progress: 1, error: null, done: true })
    } catch (err) {
      failed++
      onUpdate(p.key, { progress: 0, error: message(err), done: false })
    }
  }
  return failed
}

let counter = 0
export const pending = (files: File[], mode: Mode, offset: number): Pending[] =>
  files.map((file, i) => ({ key: `f${++counter}`, file, label: labelFor(mode, offset + i) }))
