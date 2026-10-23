// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../app.ts'
import { defaultLayout } from '../dashboard/layout.ts'
import { testDb } from '../testing/db.ts'
import { fakeQbt } from '../testing/fake-qbt.ts'
import { BACKUP_FORMAT } from './backup.ts'

let db: Awaited<ReturnType<typeof testDb>>
beforeAll(async () => {
  db = await testDb()
})
afterAll(() => db.drop())
beforeEach(() =>
  db.query('delete from preferences; delete from preference_background; delete from dashboard_layouts'),
)

function api() {
  const app = createApp({ qbt: fakeQbt(), database: { db, status: () => 'ok' } })
  const json = async (res: Response) => ({
    status: res.status,
    headers: res.headers,
    body: JSON.parse(await res.text()),
  })
  return {
    export: async () => json(await app.request('/api/v1/preferences/export')),
    import: async (body: unknown, confirm = false) =>
      json(
        await app.request(`/api/v1/preferences/import${confirm ? '?confirm=1' : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
      ),
    patch: (body: unknown) =>
      app.request('/api/v1/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    prefs: async () => JSON.parse(await (await app.request('/api/v1/preferences')).text()),
  }
}

describe('backup della configurazione (SET-011)', () => {
  it('esporta preferenze e layout di tutti i dispositivi, con la versione di formato', async () => {
    const a = api()
    await a.patch({ formats: { energyUnit: 'kJ' } })
    const res = await a.export()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toMatch(
      /attachment; filename="ron1nos-configurazione-.*\.json"/,
    )
    expect(res.body).toMatchObject({ app: 'ron1nOS', format: BACKUP_FORMAT })
    expect(res.body.preferences.formats.energyUnit).toBe('kJ')
    expect(Object.keys(res.body.layouts)).toEqual(['desktop', 'iphone'])
    expect(res.body.preferences).not.toHaveProperty('updatedAt')
    expect(JSON.stringify(res.body)).not.toMatch(/backgroundImage|password|token/i)
  })

  it('senza conferma dice cosa cambierà e non scrive nulla', async () => {
    const a = api()
    const backup = (await a.export()).body
    backup.preferences.navOrder = [
      'server',
      ...backup.preferences.navOrder.filter((i: string) => i !== 'server'),
    ]
    backup.layouts.desktop = { ...backup.layouts.desktop, header: 'hidden' }
    const res = await a.import(backup)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      changes: ['Ordine della barra', 'Dashboard · computer'],
      notes: [],
      applied: false,
    })
    expect((await a.prefs()).navOrder[0]).toBe('pasti')
  })

  it('con la conferma importa, e un secondo import non cambia più nulla', async () => {
    const a = api()
    const backup = (await a.export()).body
    backup.preferences.disabledModules = ['notes']
    backup.layouts.iphone = { header: 'line', items: defaultLayout('iphone').items.slice(0, 1) }
    const res = await a.import(backup, true)
    expect(res.body).toMatchObject({
      changes: ['Moduli accesi e spenti', 'Dashboard · iPhone'],
      applied: true,
    })
    expect((await a.prefs()).disabledModules).toEqual(['notes'])
    expect((await a.export()).body.layouts.iphone.header).toBe('line')
    expect((await a.import(backup, true)).body).toEqual({ changes: [], notes: [], applied: false })
  })

  it('uno sfondo a immagine senza immagine sul server torna il predefinito, con una nota', async () => {
    const a = api()
    const backup = (await a.export()).body
    backup.preferences.appearance.background = 'image'
    const res = await a.import(backup, true)
    expect(res.body.changes).toEqual([])
    expect(res.body.notes[0]).toMatch(/immagine/)
    expect((await a.prefs()).appearance.background).toBe('brace')
  })

  it('rifiuta file non validi con un messaggio chiaro', async () => {
    const a = api()
    expect((await a.import('non json')).body).toMatchObject({ message: 'Il file non è un JSON valido' })
    expect((await a.import({ app: 'altro' })).body).toMatchObject({
      message: 'Il file non è un backup di ron1nOS',
    })
    const backup = (await a.export()).body
    expect((await a.import({ ...backup, format: 99 })).body).toMatchObject({
      message: 'Versione del backup non supportata',
    })
    const bad = { ...backup, preferences: { ...backup.preferences, navOrder: ['pasti'] } }
    const res = await a.import(bad)
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/preferences\.navOrder/)
    const overlap = {
      ...backup,
      layouts: {
        desktop: {
          header: 'full',
          items: [backup.layouts.desktop.items[0], backup.layouts.desktop.items[0]],
        },
      },
    }
    expect((await a.import(overlap)).status).toBe(422)
  })
})
