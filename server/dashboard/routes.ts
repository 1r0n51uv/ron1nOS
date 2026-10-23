// Rotte della dashboard sotto /api/v1/dashboard (docs/specs/dashboard.md).
import { Hono } from 'hono'
import { z } from 'zod'

import type { Database } from '../db.ts'
import { DatabaseUnavailableError } from '../db.ts'
import { check, readJson } from '../nutrition/http.ts'
import {
  defaultLayout,
  deleteLayout,
  DEVICES,
  getLayout,
  Layout,
  putLayout,
  validateLayout,
} from './layout.ts'

const Device = z.enum(DEVICES)

export function dashboardRoutes({ database }: { database: Database }) {
  const app = new Hono()

  // Senza database si legge il layout predefinito e non si salva nulla:
  // `stored: false` dice al client di avvisare.
  app.get('/layouts/:device', async (c) => {
    const device = check(Device, c.req.param('device'))
    if (database.status() !== 'ok' || !database.db) {
      return c.json({ device, ...defaultLayout(device), updatedAt: null, stored: false })
    }
    return c.json({ device, ...(await getLayout(database.db, device)), stored: true })
  })

  app.put('/layouts/:device', async (c) => {
    const device = check(Device, c.req.param('device'))
    const layout = validateLayout(await readJson(c, Layout))
    if (database.status() !== 'ok' || !database.db) throw new DatabaseUnavailableError('database non pronto')
    return c.json({ device, ...(await putLayout(database.db, device, layout)), stored: true })
  })

  app.delete('/layouts/:device', async (c) => {
    const device = check(Device, c.req.param('device'))
    if (database.status() !== 'ok' || !database.db) throw new DatabaseUnavailableError('database non pronto')
    return c.json({ device, ...(await deleteLayout(database.db, device)), stored: true })
  })

  return app
}
