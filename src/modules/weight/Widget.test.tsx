import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { WeightWidget } from './Widget'

describe('WeightWidget', () => {
  it('dettagliata: valore e andamento', async () => {
    renderWithProviders(<WeightWidget variant="detailed" />)
    expect(await screen.findByText('80,1')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Peso da 82,4 a 80,1 kg/ })).toBeInTheDocument()
  })

  it('compatta: solo il valore (DASH-005)', async () => {
    renderWithProviders(<WeightWidget variant="compact" />)
    expect(await screen.findByText('80,1')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Peso da/ })).toBeNull()
  })
})
