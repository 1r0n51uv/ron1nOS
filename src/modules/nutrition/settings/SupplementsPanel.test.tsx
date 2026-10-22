import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Supplement } from '../data'
import { useCreateSupplement, useDeleteSupplement, useSupplements, useUpdateSupplement } from '../data'
import { SupplementsPanel } from './SupplementsPanel'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useSupplements: vi.fn(),
  useCreateSupplement: vi.fn(),
  useUpdateSupplement: vi.fn(),
  useDeleteSupplement: vi.fn(),
}))

const list: Supplement[] = [
  { id: 's1', name: 'Creatina', dose: '5 g', schedule: 'mattina', active: true },
  { id: 's2', name: 'Vitamina D', dose: null, schedule: 'sera', active: false },
]

const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const mutation = (mutate: unknown) => ({ mutate, isPending: false, error: null }) as never

beforeEach(() => {
  for (const m of [create, update, remove]) m.mockReset()
  vi.mocked(useCreateSupplement).mockReturnValue(mutation(create))
  vi.mocked(useUpdateSupplement).mockReturnValue(mutation(update))
  vi.mocked(useDeleteSupplement).mockReturnValue(mutation(remove))
  vi.mocked(useSupplements).mockReturnValue({ data: { supplements: list }, error: null } as never)
})

describe('SupplementsPanel (NUT-014)', () => {
  it('elenca gli integratori con dose e quando, conta gli attivi', () => {
    renderWithProviders(<SupplementsPanel />)
    expect(screen.getByText('1 attivo')).toBeInTheDocument()
    const creatina = screen.getByRole('listitem', { name: 'Creatina' })
    expect(creatina).toHaveTextContent('Creatina · 5 g · mattina')
    expect(screen.getByRole('listitem', { name: 'Vitamina D' })).toHaveTextContent('disattivato')
  })

  it('si disattiva, si riattiva e si elimina con conferma', () => {
    renderWithProviders(<SupplementsPanel />)
    const creatina = within(screen.getByRole('listitem', { name: 'Creatina' }))
    fireEvent.click(creatina.getByRole('button', { name: 'Disattiva' }))
    expect(update).toHaveBeenCalledWith({ id: 's1', patch: { active: false } })
    const d = within(screen.getByRole('listitem', { name: 'Vitamina D' }))
    fireEvent.click(d.getByRole('button', { name: 'Riattiva' }))
    expect(update).toHaveBeenLastCalledWith({ id: 's2', patch: { active: true } })
    fireEvent.click(creatina.getByRole('button', { name: 'Elimina' }))
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(creatina.getByRole('button', { name: 'Elimina davvero' }))
    expect(remove).toHaveBeenCalledWith('s1')
  })

  it('un nuovo integratore: il nome serve, dose e quando no', () => {
    renderWithProviders(<SupplementsPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo integratore' }))
    const form = within(screen.getByRole('form', { name: 'Nuovo integratore' }))
    expect(form.getByRole('button', { name: 'Aggiungi' })).toBeDisabled()
    fireEvent.change(form.getByLabelText(/^Nome/), { target: { value: ' Omega 3 ' } })
    fireEvent.change(form.getByLabelText(/^Quando/), { target: { value: 'pranzo' } })
    fireEvent.click(form.getByRole('button', { name: 'Aggiungi' }))
    expect(create).toHaveBeenCalledWith(
      { name: 'Omega 3', dose: null, schedule: 'pranzo' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })
})
