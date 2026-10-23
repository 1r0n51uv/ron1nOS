import type { NavItem } from '@/components/ron1n'
import type { ModuleId } from '../../server/dashboard/catalog.ts'
import { NAV_ITEMS } from '../../server/preferences/schema.ts'

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

export type NavItemId = (typeof NAV_ITEMS)[number]

// L'indirizzo di ogni voce spostabile (SET-006): l'id è il percorso senza `/`.
export const navPath = (id: NavItemId) => `/${id}`

// Le voci nell'ordine scelto: Dashboard sempre prima, Impostazioni sempre
// ultima, in mezzo le altre come in `order`.
export function orderedRailItems(order: readonly NavItemId[] = NAV_ITEMS) {
  const first = railItems[0]
  const last = railItems.at(-1)!
  const middle = order.flatMap((id) => railItems.find((item) => item.to === navPath(id)) ?? [])
  return [first, ...middle, last]
}

export function visibleRailItems(disabled: readonly ModuleId[], order?: readonly NavItemId[]) {
  return orderedRailItems(order).filter((item) => {
    const module = NAV_MODULES[item.to]
    return !module || !disabled.includes(module)
  })
}

// Sposta la voce `from` al posto di `to`; le altre scorrono.
export function moveItem<T>(list: readonly T[], from: number, to: number) {
  if (from === to || to < 0 || to >= list.length) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
