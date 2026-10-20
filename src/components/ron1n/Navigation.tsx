import { NavLink } from 'react-router'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { HankoMark } from './HankoMark'
import { Icon, type IconName } from './Icon'

export type NavItem = { to: string; label: string; icon: IconName }

// Barra laterale desktop: logo e una voce per sezione, etichetta in tooltip.
export function NavRail({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Sezioni"
      className="glass-panel sticky top-5 flex w-[76px] flex-col items-center gap-2 self-start rounded-rail p-3"
    >
      <NavLink to="/" className="mb-2" aria-label="ron1nOS, dashboard">
        <HankoMark size={52} decorative />
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
                  'flex size-[52px] items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-glass-strong hover:text-ink',
                  isActive && 'bg-glass-hover text-ink',
                )
              }
            >
              <Icon name={it.icon} />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{it.label}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  )
}
