import { describe, expect, it } from 'vitest'

import type { DocumentSummary } from './data'
import {
  copyAllText,
  expiryText,
  fileKind,
  groupDocuments,
  itDate,
  monthYear,
  widgetExpiry,
  widgetView,
} from './format'

const summary = (over: Partial<DocumentSummary>): DocumentSummary => ({
  id: 'd',
  typeId: null,
  typeName: null,
  typeIcon: null,
  title: 'x',
  holder: 'Io',
  expiresOn: null,
  expiry: null,
  tags: [],
  pinnedAt: null,
  files: 0,
  thumbFileId: null,
  firstFile: null,
  updatedAt: '2026-10-22T10:00:00Z',
  ...over,
})

describe('formati dei documenti', () => {
  it('date italiane', () => {
    expect(itDate('2027-04-12')).toBe('12/04/2027')
    expect(monthYear('2031-03-12')).toBe('03/2031')
  })

  it('scadenza (DOC-010)', () => {
    expect(expiryText(null, null)).toBeNull()
    expect(expiryText('2026-10-21', { status: 'expired', daysLeft: -1 })).toBe('Scaduto')
    expect(expiryText('2026-11-20', { status: 'expiring', daysLeft: 29 })).toBe('tra 29 giorni')
    expect(expiryText('2026-10-23', { status: 'expiring', daysLeft: 1 })).toBe('tra 1 giorno')
    expect(expiryText('2026-10-22', { status: 'expiring', daysLeft: 0 })).toBe('scade oggi')
    expect(expiryText('2031-03-12', { status: 'ok', daysLeft: 1600 })).toBe('03/2031')
  })

  it('tipo del file', () => {
    expect(fileKind('application/pdf')).toBe('PDF')
    expect(fileKind('image/jpeg')).toBe('JPG')
    expect(fileKind('application/octet-stream')).toBe('FILE')
  })

  it('gruppi: fissati, poi per tipo nell’ordine dei tipi, File in fondo (DOC-002)', () => {
    const groups = groupDocuments(
      [
        summary({ id: '1', title: 'Contratto' }),
        summary({ id: '2', typeId: 'pass', typeName: 'Passaporto' }),
        summary({ id: '3', typeId: 'cie', typeName: "Carta d'identità", pinnedAt: '2026-10-01T00:00:00Z' }),
        summary({ id: '4', typeId: 'cie', typeName: "Carta d'identità" }),
      ],
      ['cie', 'pass'],
    )
    expect(groups.map((g) => [g.label, g.documents.map((d) => d.id)])).toEqual([
      ['In evidenza', ['3']],
      ["Carta d'identità", ['4']],
      ['Passaporto', ['2']],
      ['File', ['1']],
    ])
  })

  it('Copia tutto: una riga per campo compilato, date in italiano (DOC-009)', () => {
    expect(
      copyAllText({
        type: {
          id: 't',
          name: 'Passaporto',
          icon: 'passport',
          fields: [
            { key: 'number', label: 'Numero', kind: 'code', copyable: true },
            { key: 'name', label: 'Nome', kind: 'text', copyable: true },
            { key: 'birth_date', label: 'Data di nascita', kind: 'date', copyable: true },
          ],
        },
        fields: { number: 'YA1', birth_date: '1990-04-12' },
        extra: [{ label: 'PIN', value: '1234' }],
      }),
    ).toBe('Numero: YA1\nData di nascita: 12/04/1990\nPIN: 1234')
  })
})

describe('widget (DOC-001)', () => {
  it('testi della scadenza', () => {
    expect(widgetExpiry({ status: 'expired', daysLeft: -2 })).toBe('Scaduto')
    expect(widgetExpiry({ status: 'expiring', daysLeft: 0 })).toBe('Scade oggi')
    expect(widgetExpiry({ status: 'expiring', daysLeft: 1 })).toBe('Scade domani')
    expect(widgetExpiry({ status: 'ok', daysLeft: 84 })).toBe('Scade tra 84 giorni')
  })

  it('entro 90 giorni in lista, oltre solo come prossima scadenza', () => {
    const view = widgetView([
      summary({ id: 'far', expiresOn: '2027-06-01', expiry: { status: 'ok', daysLeft: 200 } }),
      summary({ id: 'near', expiresOn: '2026-12-01', expiry: { status: 'ok', daysLeft: 90 } }),
      summary({ id: 'none' }),
    ])
    expect(view.expiring.map((d) => d.id)).toEqual(['near'])
    expect(view.nextDays).toBe(200)
  })
})
