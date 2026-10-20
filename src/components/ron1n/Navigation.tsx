import { NavLink } from 'react-router'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { HankoMark } from './HankoMark'
import { Icon, type IconName } from './Icon'

export type NavItem = { to: string; label: string; icon: IconName }

// Barra laterale desktop: logo e una voce per sezione, etichetta in tooltip.
// Le voci occupano tutta la larghezza interna, così restano centrate.
export function NavRail({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Sezioni"
      className="glass-panel sticky top-5 flex w-20 flex-col items-stretch gap-1.5 self-start rounded-rail p-2.5"
    >
      <NavLink to="/" className="mb-2 block" aria-label="ron1nOS, dashboard">
        <HankoMark size={58} decorative />
      </NavLink>
      {items.map((it) => (
        <Tooltip key={it.to}>
          <TooltipTrigger asChild>
            <NavLink
              to={it.to}
              end
              aria-label={it.label}
              className={({ isActive }) =>
                cn(
                  'flex aspect-square w-full items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-glass-strong hover:text-ink',
                  isActive && 'bg-glass-hover text-ink',
                )
              }
            >
              <Icon name={it.icon} size={28} />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{it.label}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  )
}
