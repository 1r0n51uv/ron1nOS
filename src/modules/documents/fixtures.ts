import type { Document, DocumentSummary, DocumentType } from './data'

// Dati finti per i test dei componenti del modulo.
export const types: DocumentType[] = [
  {
    id: 'cie',
    key: 'identity_card',
    name: "Carta d'identità",
    icon: 'id-card',
    preset: true,
    fields: [
      { key: 'number', label: 'Numero', kind: 'code', copyable: true },
      { key: 'birth_date', label: 'Data di nascita', kind: 'date', copyable: true },
      { key: 'tax_code', label: 'Codice fiscale', kind: 'code', copyable: true },
    ],
    documents: 1,
  },
  {
    id: 'pass',
    key: 'passport',
    name: 'Passaporto',
    icon: 'passport',
    preset: true,
    fields: [{ key: 'number', label: 'Numero', kind: 'code', copyable: true }],
    documents: 0,
  },
]

export const summary = (over: Partial<DocumentSummary> = {}): DocumentSummary => ({
  id: 'd1',
  typeId: 'cie',
  typeName: "Carta d'identità",
  typeIcon: 'id-card',
  title: "Carta d'identità",
  holder: 'Io',
  expiresOn: '2027-01-12',
  expiry: { status: 'expiring', daysLeft: 81 },
  tags: [],
  pinnedAt: null,
  files: 0,
  thumbFileId: null,
  firstFile: null,
  updatedAt: '2026-10-22T10:00:00Z',
  ...over,
})

export const doc = (over: Partial<Document> = {}): Document => ({
  id: 'd1',
  typeId: 'cie',
  type: { id: 'cie', name: "Carta d'identità", icon: 'id-card', fields: types[0].fields },
  title: "Carta d'identità",
  holder: 'Io',
  expiresOn: '2027-01-12',
  expiry: { status: 'expiring', daysLeft: 81 },
  warnings: [90, 30, 7],
  tags: ['viaggi'],
  pinnedAt: null,
  fields: { number: 'CA00000AA', birth_date: '1990-04-12' },
  extra: [{ label: 'PIN', value: '1234' }],
  notes: 'Nel cassetto',
  files: [
    {
      id: 'f1',
      name: 'fronte.jpg',
      mime: 'image/jpeg',
      size: 2_400_000,
      label: 'fronte',
      position: 0,
      hasThumb: true,
      createdAt: '2026-10-22T10:00:00Z',
    },
  ],
  createdAt: '2026-10-22T10:00:00Z',
  updatedAt: '2026-10-22T10:00:00Z',
  ...over,
})
