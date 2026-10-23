import { describe, expect, it } from 'vitest'

import type { DocumentType } from './data'
import { baseName, emptyForm, modeOf, toInput } from './form'

const passport: DocumentType = {
  id: 'pass',
  key: 'passport',
  name: 'Passaporto',
  icon: 'passport',
  preset: true,
  fields: [],
  documents: 0,
}

describe('form del documento (DOC-005)', () => {
  it('titolo precompilato: nome del tipo o nome del file senza estensione', () => {
    expect(emptyForm('document', passport).title).toBe('Passaporto')
    expect(emptyForm('free', null, 'Contratto affitto.pdf').title).toBe('Contratto affitto')
    expect(emptyForm('info', null).extra).toEqual([{ label: '', value: '' }])
    expect(baseName('.env')).toBe('.env')
  })

  it('toInput: tag divisi, righe vuote tolte, niente campi del tipo fuori da Documento', () => {
    const form = {
      ...emptyForm('document', passport),
      fields: { number: 'YA1' },
      extra: [
        { label: 'PIN', value: '1' },
        { label: ' ', value: '' },
      ],
      tags: 'viaggi, , identità ',
      expiresOn: '2031-03-12',
      holder: ' ',
    }
    expect(toInput(form, 'document')).toMatchObject({
      typeId: 'pass',
      holder: 'Io',
      fields: { number: 'YA1' },
      extra: [{ label: 'PIN', value: '1' }],
      tags: ['viaggi', 'identità'],
      expiresOn: '2031-03-12',
    })
    expect(toInput(form, 'info')).toMatchObject({ typeId: null, fields: {}, expiresOn: null })
    expect(toInput(form, 'free').extra).toEqual([])
  })

  it('modo di un documento esistente', () => {
    expect(modeOf({ typeId: 'x', extra: [] })).toBe('document')
    expect(modeOf({ typeId: null, extra: [{ label: 'a', value: 'b' }] })).toBe('info')
    expect(modeOf({ typeId: null, extra: [] })).toBe('free')
  })
})
