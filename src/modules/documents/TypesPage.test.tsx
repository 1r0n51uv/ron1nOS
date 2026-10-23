import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import { useDeleteType, useDocumentTypes, useSaveType } from './data'
import { types } from './fixtures'
import { TypesPage } from './TypesPage'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useDocumentTypes: vi.fn(),
  useSaveType: vi.fn(),
  useDeleteType: vi.fn(),
}))

const save = vi.fn()
const remove = vi.fn()
const custom = { ...types[1], id: 'pol', key: null, name: 'Polizza', preset: false, documents: 0 }

beforeEach(() => {
  save.mockReset()
  remove.mockReset()
  vi.mocked(useDocumentTypes).mockReturnValue({ data: [...types, custom], error: null } as never)
  vi.mocked(useSaveType).mockReturnValue({ mutate: save, isPending: false, error: null } as never)
  vi.mocked(useDeleteType).mockReturnValue({ mutate: remove, isPending: false, error: null } as never)
})

describe('TypesPage (DOC-016)', () => {
  it('elenca già pronti e creati, con quanti documenti li usano', () => {
    renderWithProviders(<TypesPage />, { route: '/documenti/tipi' })
    const nav = screen.getByRole('navigation', { name: 'Tipi' })
    expect(within(nav).getByText('Già pronti')).toBeInTheDocument()
    expect(within(nav).getByText('Creati da te')).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: /Polizza/ })).toHaveTextContent('Polizza0 doc')
  })

  it('un tipo usato non si elimina e lo dice', () => {
    renderWithProviders(<TypesPage />, { route: '/documenti/tipi?tipo=cie' })
    expect(screen.getByRole('button', { name: 'Elimina tipo' })).toBeDisabled()
    expect(screen.getByText(/Usato da 1 documento\./)).toBeInTheDocument()
  })

  it('modifica i campi: rinomina, sposta, togli, aggiungi; le chiavi esistenti restano', () => {
    renderWithProviders(<TypesPage />, { route: '/documenti/tipi?tipo=cie' })
    fireEvent.change(screen.getByLabelText('Etichetta del campo 1'), {
      target: { value: 'Numero documento' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sposta su Data di nascita' }))
    fireEvent.click(screen.getByRole('button', { name: 'Togli Codice fiscale' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi campo' }))
    fireEvent.change(screen.getByLabelText('Etichetta del campo 3'), { target: { value: 'PIN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(save).toHaveBeenCalledWith(
      {
        id: 'cie',
        name: "Carta d'identità",
        icon: 'id-card',
        fields: [
          { key: 'birth_date', label: 'Data di nascita', kind: 'date', copyable: true },
          { key: 'number', label: 'Numero documento', kind: 'code', copyable: true },
          { label: 'PIN', kind: 'text', copyable: true },
        ],
      },
      expect.anything(),
    )
  })

  it('nuovo tipo ed eliminazione con conferma', () => {
    renderWithProviders(<TypesPage />, { route: '/documenti/tipi?tipo=pol' })
    fireEvent.click(screen.getByRole('button', { name: 'Elimina tipo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Elimina davvero' }))
    expect(remove).toHaveBeenCalledWith('pol')

    fireEvent.click(screen.getByRole('button', { name: 'Nuovo tipo' }))
    expect(screen.getByRole('region', { name: 'Nuovo tipo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Busta paga' } })
    fireEvent.change(screen.getByLabelText('Etichetta del campo 1'), { target: { value: 'Mese' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(save).toHaveBeenCalledWith(
      { name: 'Busta paga', icon: 'file', fields: [{ label: 'Mese', kind: 'text', copyable: true }] },
      expect.anything(),
    )
  })
})
