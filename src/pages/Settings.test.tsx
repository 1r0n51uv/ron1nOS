import { screen, within } from '@testing-library/react'
import { Navigate, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { source } from '@/preferences/data'
import { renderWithProviders } from '@/test/render'
import { DEFAULT_PREFERENCES } from '../../server/preferences/schema.ts'
import { NutritionSettings, Settings, SettingsSection } from './Settings'

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="impostazioni" element={<Settings />}>
        <Route index element={<Navigate to="aspetto" replace />} />
        <Route path="moduli/nutrizione" element={<p>pannelli nutrizione</p>} />
        <Route path=":section" element={<SettingsSection />} />
      </Route>
    </Routes>,
    { route },
  )
}

describe('impostazioni a sezioni (SET-001)', () => {
  beforeEach(() => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue({
      ...DEFAULT_PREFERENCES,
      updatedAt: null,
      backgroundImage: null,
      stored: true,
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('il menu elenca le sezioni in ordine', () => {
    renderAt('/impostazioni/aspetto')
    const menu = screen.getByRole('navigation', { name: 'Sezioni delle impostazioni' })
    expect(
      within(menu)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual([
      'Aspetto',
      'Dashboard',
      'Moduli',
      'Navigazione',
      'Account',
      'Integrazioni',
      'Formati',
      'Backup configurazione',
      'Informazioni',
    ])
  })

  it('/impostazioni apre Aspetto, segnato nel menu', () => {
    renderAt('/impostazioni')
    expect(screen.getByRole('heading', { level: 2, name: 'Aspetto' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Aspetto' })).toHaveAttribute('aria-current', 'page')
  })

  it('una sezione sconosciuta riporta ad Aspetto', () => {
    renderAt('/impostazioni/tema')
    expect(screen.getByRole('heading', { level: 2, name: 'Aspetto' })).toBeInTheDocument()
  })

  it('Moduli porta alle impostazioni di Nutrizione', () => {
    renderAt('/impostazioni/moduli')
    expect(screen.getByRole('link', { name: /Nutrizione/ })).toHaveAttribute(
      'href',
      '/impostazioni/moduli/nutrizione',
    )
  })

  it('la pagina di Nutrizione ha il ritorno a Moduli', () => {
    renderWithProviders(<NutritionSettings />)
    expect(screen.getByRole('heading', { level: 2, name: 'Nutrizione' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Moduli' })).toHaveAttribute('href', '/impostazioni/moduli')
  })
})
