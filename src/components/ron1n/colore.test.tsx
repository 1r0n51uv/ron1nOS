import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Progress } from '@/components/ui/progress'
import { ProgressRing } from './ProgressRing'
import { Sparkline } from './Charts'
import { ToggleTile } from './Status'

// DES-001: il rosso è solo un segnale. Progressi, andamento e stato acceso
// sono `ink`; il rosso arriva solo con un tono di allarme esplicito.
describe('il rosso come segnale', () => {
  it('la barra di avanzamento è ink e diventa rossa solo con tone alert', () => {
    const { rerender } = render(<Progress value={40} aria-label="Barra" />)
    expect(screen.getByRole('progressbar').firstElementChild).toHaveClass('bg-ink')
    rerender(<Progress value={90} tone="alert" aria-label="Barra" />)
    expect(screen.getByRole('progressbar').firstElementChild).toHaveClass('bg-brand')
  })

  it("l'anello è ink per default e rosso solo con tone brand", () => {
    const { container, rerender } = render(<ProgressRing value={30} />)
    expect(container.querySelectorAll('circle')[1]).toHaveClass('stroke-ink')
    rerender(<ProgressRing value={30} tone="brand" />)
    expect(container.querySelectorAll('circle')[1]).toHaveClass('stroke-brand')
  })

  it("la linea d'andamento è ink", () => {
    const { container } = render(<Sparkline points={[3, 2, 1]} ariaLabel="Andamento" />)
    expect(container.querySelector('polyline')).toHaveClass('stroke-ink')
  })

  it('il tassello acceso non è rosso e si legge da aria-pressed', () => {
    render(<ToggleTile name="Luci" on onChange={() => {}} />)
    const tile = screen.getByRole('button', { name: /Luci/ })
    expect(tile).toHaveAttribute('aria-pressed', 'true')
    expect(tile.className).not.toMatch(/brand/)
    expect(tile.firstElementChild).toHaveClass('bg-ink')
  })
})

// Il testo rosso su vetro è `brand-text` (8:1); il rosso pieno `brand`, a
// 4,4:1 con il vetro intenso, non si usa come colore del testo.
describe('colore del testo', () => {
  const root = join(import.meta.dirname, '../..')
  const sources: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(tsx|css)$/.test(name) && !name.endsWith('.test.tsx')) sources.push(path)
    }
  }
  walk(root)

  it('nessun componente usa text-brand, salvo il logotipo', () => {
    const offenders = sources
      .filter((file) => !file.endsWith('HankoMark.tsx'))
      .filter((file) => /\btext-brand(?![-\w])/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
