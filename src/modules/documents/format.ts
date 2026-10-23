import type { Document, DocumentSummary, Expiry } from './data'

// Un giorno `YYYY-MM-DD` come 12/04/2027.
export function itDate(day: string) {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

// Mese e anno, per le scadenze lontane: 03/2031.
export function monthYear(day: string) {
  const [y, m] = day.split('-')
  return `${m}/${y}`
}

// Testo breve della scadenza (DOC-010): `Scaduto`, `tra N giorni` dal
// primo preavviso, altrimenti mese e anno.
export function expiryText(expiresOn: string | null, expiry: Expiry) {
  if (!expiresOn || !expiry) return null
  if (expiry.status === 'expired') return 'Scaduto'
  if (expiry.status === 'expiring') {
    if (expiry.daysLeft === 0) return 'scade oggi'
    return expiry.daysLeft === 1 ? 'tra 1 giorno' : `tra ${expiry.daysLeft} giorni`
  }
  return monthYear(expiresOn)
}

// Etichetta corta di un tipo di file: PDF, JPG, ZIP… o FILE.
export function fileKind(mime: string) {
  const known: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/webp': 'WEBP',
    'image/heic': 'HEIC',
    'image/gif': 'GIF',
    'application/pdf': 'PDF',
    'application/zip': 'ZIP',
  }
  return known[mime] ?? 'FILE'
}

export const previewable = (mime: string) =>
  /^image\/(jpeg|png|webp|gif)$/.test(mime) || mime === 'application/pdf'

export type Group = { key: string; label: string; documents: DocumentSummary[] }

// Pagina Documenti (DOC-002): in alto i fissati, poi un gruppo per tipo
// nell'ordine dei tipi, in fondo `File` per quelli senza tipo.
export function groupDocuments(documents: DocumentSummary[], typeOrder: string[]): Group[] {
  const pinned = documents.filter((d) => d.pinnedAt)
  const rest = documents.filter((d) => !d.pinnedAt)
  const groups: Group[] = pinned.length ? [{ key: 'pinned', label: 'In evidenza', documents: pinned }] : []
  const byType = new Map<string, Group>()
  for (const d of rest) {
    const key = d.typeId ?? 'none'
    if (!byType.has(key)) byType.set(key, { key, label: d.typeName ?? 'File', documents: [] })
    byType.get(key)!.documents.push(d)
  }
  const rank = (key: string) =>
    key === 'none' ? Infinity : typeOrder.indexOf(key) + 1 || typeOrder.length + 1
  return [...groups, ...[...byType.values()].sort((a, b) => rank(a.key) - rank(b.key))]
}

// `Copia tutto` (DOC-009): una riga per campo, etichetta e valore.
export function copyAllText(doc: Pick<Document, 'type' | 'fields' | 'extra'>) {
  const lines = (doc.type?.fields ?? [])
    .filter((f) => doc.fields[f.key])
    .map((f) => `${f.label}: ${f.kind === 'date' ? itDate(doc.fields[f.key]) : doc.fields[f.key]}`)
  return [...lines, ...doc.extra.map((e) => `${e.label}: ${e.value}`)].join('\n')
}
