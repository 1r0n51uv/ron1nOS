import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { CatalogExercise, ExerciseImage } from '../data'
import { ChooseImageDialog } from './ChooseImageDialog'
import { ExercisePhoto } from './ExercisePhoto'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { get: vi.fn(), put: vi.fn() },
}))

const entry = (id: string, name: string): CatalogExercise => ({
  id,
  name,
  primaryMuscles: ['chest'],
  equipment: 'dumbbell',
  images: 2,
  url: `/api/v1/workout/catalog/images/${id}/0.jpg`,
})

const MANUAL: ExerciseImage = {
  catalogId: 'Dumbbell_Flyes',
  source: 'manual',
  url: '/api/v1/workout/catalog/images/Dumbbell_Flyes/0.jpg',
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.put).mockReset()
})

function open(current: ExerciseImage | null = null) {
  renderWithProviders(
    <ChooseImageDialog name="croci ai cavi alti" current={current}>
      <button type="button">Scegli immagine</button>
    </ChooseImageDialog>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Scegli immagine' }))
}

describe('ChooseImageDialog', () => {
  it('cerca nel catalogo e salva la foto scelta', async () => {
    vi.mocked(api.get).mockResolvedValue({
      exercises: [entry('Dumbbell_Flyes', 'Dumbbell Flyes'), entry('Cable_Crossover', 'Cable Crossover')],
    })
    vi.mocked(api.put).mockResolvedValue({ name: 'croci ai cavi alti', image: MANUAL })
    open()
    fireEvent.change(screen.getByLabelText('Cerca nel catalogo'), { target: { value: 'cable' } })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workout/catalog?q=cable'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cable Crossover' }))
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/workout/exercises/croci%20ai%20cavi%20alti/image', {
        catalogId: 'Cable_Crossover',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('con una scelta a mano permette di tornare all abbinamento automatico', async () => {
    vi.mocked(api.get).mockResolvedValue({ exercises: [entry('Dumbbell_Flyes', 'Dumbbell Flyes')] })
    vi.mocked(api.put).mockResolvedValue({ name: 'croci ai cavi alti', image: null })
    open(MANUAL)
    expect(await screen.findByRole('button', { name: 'Dumbbell Flyes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abbinamento automatico' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(expect.any(String), { catalogId: null }))
  })

  it('senza risultati suggerisce il nome inglese', async () => {
    vi.mocked(api.get).mockResolvedValue({ exercises: [] })
    open()
    expect(
      await screen.findByText('Nessun esercizio trovato · prova con il nome inglese.'),
    ).toBeInTheDocument()
  })
})

describe('ExercisePhoto', () => {
  it('mostra la foto in bianco e nero, scurita', () => {
    renderWithProviders(<ExercisePhoto name="Croci" image={MANUAL} />)
    const img = screen.getByRole('img', { name: 'Croci' })
    expect(img).toHaveAttribute('src', MANUAL.url)
    expect(img.className).toContain('grayscale')
  })

  it('senza immagine mostra il riquadro neutro', () => {
    renderWithProviders(<ExercisePhoto name="Croci" image={null} />)
    expect(screen.getByText('Scegli immagine')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
