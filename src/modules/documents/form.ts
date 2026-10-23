import type { Document, DocumentInput, DocumentType, ExtraField } from './data'

// Cosa si sta caricando (DOC-005): un documento con il suo tipo, un file
// con info (titolo e campi liberi) o un file libero (solo titolo).
export type Mode = 'document' | 'info' | 'free'

export const MODES: { mode: Mode; title: string; description: string }[] = [
  {
    mode: 'document',
    title: 'Documento',
    description: "Ha un tipo, compili il suo form. Carta d'identità, passaporto…",
  },
  {
    mode: 'info',
    title: 'File con info',
    description: 'Un titolo e i campi che vuoi copiare al volo. Un PDF, un contratto.',
  },
  { mode: 'free', title: 'File libero', description: 'Solo un titolo. Lo tieni per quando ti serve.' },
]

export const WARNINGS = [90, 30, 7]

export type FormState = {
  typeId: string | null
  title: string
  holder: string
  fields: Record<string, string>
  extra: ExtraField[]
  expiresOn: string
  warnings: number[]
  tags: string
  pinned: boolean
  notes: string
}

export const modeOf = (doc: Pick<Document, 'typeId' | 'extra'>): Mode =>
  doc.typeId ? 'document' : doc.extra.length ? 'info' : 'free'

// Nome del file senza estensione, come titolo di un file libero.
export const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name

export function emptyForm(mode: Mode, type: DocumentType | null, fileName?: string): FormState {
  return {
    typeId: mode === 'document' ? (type?.id ?? null) : null,
    title: mode === 'document' ? (type?.name ?? '') : fileName ? baseName(fileName) : '',
    holder: 'Io',
    fields: {},
    extra: mode === 'info' ? [{ label: '', value: '' }] : [],
    expiresOn: '',
    warnings: [...WARNINGS],
    tags: '',
    pinned: false,
    notes: '',
  }
}

export function formOf(doc: Document): FormState {
  return {
    typeId: doc.typeId,
    title: doc.title,
    holder: doc.holder,
    fields: { ...doc.fields },
    extra: doc.extra.map((e) => ({ ...e })),
    expiresOn: doc.expiresOn ?? '',
    warnings: [...doc.warnings],
    tags: doc.tags.join(', '),
    pinned: doc.pinnedAt !== null,
    notes: doc.notes,
  }
}

// Il corpo per il backend: righe dei campi liberi vuote tolte, tag divisi
// per virgola. Il resto lo valida il server.
export function toInput(form: FormState, mode: Mode): DocumentInput {
  const document = mode === 'document'
  return {
    typeId: document ? form.typeId : null,
    title: form.title.trim(),
    holder: form.holder.trim() || 'Io',
    fields: document ? form.fields : {},
    extra: mode === 'free' ? [] : form.extra.filter((e) => e.label.trim() || e.value.trim()),
    expiresOn: document && form.expiresOn ? form.expiresOn : null,
    warnings: form.warnings,
    tags: form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    pinned: form.pinned,
    notes: form.notes,
  }
}
