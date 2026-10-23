import type { NavItem } from '@/components/ron1n'
import type { ModuleId } from '../../server/dashboard/catalog.ts'

export const railItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/pasti', label: 'Pasti', icon: 'meals' },
  { to: '/allenamenti', label: 'Allenamenti', icon: 'gym' },
  { to: '/documenti', label: 'Documenti', icon: 'documents' },
  { to: '/note', label: 'Note', icon: 'notes' },
  { to: '/casa', label: 'Casa', icon: 'home' },
  { to: '/server', label: 'Server e container', icon: 'server' },
  { to: '/impostazioni', label: 'Impostazioni', icon: 'settings' },
]

// La voce della barra di ogni modulo che ha una pagina: spento il modulo
// (SET-005), la voce sparisce.
export const NAV_MODULES: Record<string, ModuleId> = {
  '/pasti': 'nutrition',
  '/allenamenti': 'workout',
  '/documenti': 'documents',
  '/note': 'notes',
  '/casa': 'home',
  '/server': 'server',
}

export function visibleRailItems(disabled: readonly ModuleId[]) {
  return railItems.filter((item) => {
    const module = NAV_MODULES[item.to]
    return !module || !disabled.includes(module)
  })
}
