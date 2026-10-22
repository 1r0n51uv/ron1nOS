import { expect, test } from '@playwright/test'

// Base del modulo Documenti (DOC-015, DOC-003): con il login e la chiave il
// modulo risponde e offre i quattro tipi già pronti.
test('GET /api/v1/documents/types: i tipi già pronti, con i campi', async ({ request }) => {
  const res = await request.get('/api/v1/documents/types')
  expect(res.ok()).toBe(true)
  const types = (await res.json()) as { key: string; name: string; fields: { label: string }[] }[]
  expect(types.map((t) => t.name)).toEqual(["Carta d'identità", 'Passaporto', 'Patente', 'Tessera sanitaria'])
  expect(types[3].fields.map((f) => f.label)).toEqual(['Codice fiscale', 'Numero tessera', 'Cognome', 'Nome'])
})
