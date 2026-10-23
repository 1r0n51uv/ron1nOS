// Moduli spenti (SET-005): le rotte API del modulo rispondono 404
// `module_disabled` e i suoi job in background si fermano. I dati restano.
import type { MiddlewareHandler } from 'hono'

import type { ModuleId } from '../dashboard/catalog.ts'
import type { Database, Queryable } from '../db.ts'
import { getPreferences } from './store.ts'

// Prefisso delle rotte → modulo. I moduli senza rotte proprie (peso, casa,
// note, container) si spengono solo nell'interfaccia.
export const MODULE_ROUTES: [string, ModuleId][] = [
  ['/api/v1/nutrition', 'nutrition'],
  ['/api/v1/workout', 'workout'],
  ['/api/v1/documents', 'documents'],
  ['/api/v1/downloads', 'downloads'],
  ['/api/v1/server', 'server'],
]

export function moduleOf(path: string): ModuleId | null {
  const match = MODULE_ROUTES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  return match ? match[1] : null
}

export async function isModuleDisabled(db: Queryable, module: ModuleId) {
  return (await getPreferences(db)).disabledModules.includes(module)
}

// 404 module_disabled.
export class ModuleDisabledError extends Error {}

// Senza database le preferenze sono quelle predefinite: tutto acceso.
export function moduleGuard(database: Database): MiddlewareHandler {
  return async (c, next) => {
    const module = moduleOf(c.req.path)
    if (
      module &&
      database.status() === 'ok' &&
      database.db &&
      (await isModuleDisabled(database.db, module))
    ) {
      throw new ModuleDisabledError('Modulo spento')
    }
    await next()
  }
}
