import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { WidgetCard } from '@/components/ron1n'
import type { ModuleId } from '../../server/dashboard/catalog.ts'
import { useDisabledModules } from './data'

// La pagina di un modulo spento: al posto del contenuto, il link per riaccenderlo.
export function ModuleGate({
  module,
  title,
  children,
}: {
  module: ModuleId
  title: string
  children: ReactNode
}) {
  const off = useDisabledModules().includes(module)
  if (!off) return children
  return (
    <>
      <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">{title}</h1>
      <WidgetCard title="Modulo spento" className="max-w-xl">
        <p className="m-0 text-sm leading-[1.6] text-ink-muted">
          I dati restano. Si riaccende da{' '}
          <Link
            to="/impostazioni/moduli"
            className="hit-area text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
          >
            Impostazioni › Moduli
          </Link>
          .
        </p>
      </WidgetCard>
    </>
  )
}
