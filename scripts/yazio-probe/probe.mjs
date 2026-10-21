#!/usr/bin/env node
// Prova dell'API non ufficiale di YAZIO per la specifica Nutrizione
// (docs/specs/nutrition.md, "Piano di lavoro", passo 2).
//
// Non fa parte dell'immagine: si lancia a mano da un computer qualsiasi con
// Node 18 o più recente, senza dipendenze. Di default legge e basta; con
// --write aggiunge una voce di 1 g al diario di oggi e la cancella subito.
//
// Il rapporto (yazio-probe-report.json e il riassunto a schermo) non contiene
// token, email, nomi né il contenuto del diario: solo forme delle risposte,
// conteggi ed esiti.

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
loadEnv(join(here, '.env'))

const env = process.env
const WRITE = process.argv.includes('--write')
const VERSIONS = (env.YAZIO_VERSIONS ?? 'v15,v20').split(',').map((v) => v.trim())
const HOST = env.YAZIO_HOST ?? 'https://yzapi.yazio.com'
const EANS = (env.YAZIO_PROBE_EANS ?? '8076800195057,8000500310427').split(',')
const QUERIES = ['pane', 'petto di pollo', 'yogurt greco', 'mela']
const PRIVATE_KEYS = /(token|email|mail|name|first|last|password|image|photo|avatar|uuid|user_?id)/i

for (const k of ['YAZIO_USERNAME', 'YAZIO_PASSWORD', 'YAZIO_CLIENT_ID', 'YAZIO_CLIENT_SECRET']) {
  if (!env[k]) fail(`Manca ${k}: copia .env.example in .env e compilalo.`)
}

const report = { startedAt: new Date().toISOString(), write: WRITE, steps: [] }
let base = ''
let token = null
let calls = 0

main()
  .catch((e) => step('errore inatteso', false, { message: String(e?.message ?? e) }))
  .finally(() => {
    report.calls = calls
    const out = join(here, 'yazio-probe-report.json')
    writeFileSync(out, JSON.stringify(report, null, 2))
    console.warn(`\nRapporto in ${out}`)
  })

async function main() {
  // 1. Login: quale versione dell'API accetta le credenziali.
  for (const v of VERSIONS) {
    const res = await login(`${HOST}/${v}`)
    step(`login ${v}`, res.ok, res.info)
    if (res.ok && !token) {
      base = `${HOST}/${v}`
      token = res.token
    }
  }
  if (!token) return

  // 2. Rinnovo del token.
  const r = await post(
    '/oauth/token',
    form({ grant_type: 'refresh_token', refresh_token: token.refresh_token }),
    false,
  )
  step('refresh token', r.ok, { status: r.status, expiresIn: r.json?.expires_in })
  if (r.ok) token = r.json

  const today = day(0)
  const days = [day(0), day(-1), day(-2)]

  // 3. Profilo e impostazioni: serve consume_activity_calories (NUT-016).
  const user = await get('/user')
  step('profilo', user.ok, { status: user.status, shape: shape(user.json) })
  const settings = await get('/user/settings')
  step('impostazioni', settings.ok, {
    status: settings.status,
    consume_activity_calories: settings.json?.consume_activity_calories,
    shape: shape(settings.json),
  })

  // 4. Obiettivi: base contro quelli del giorno con gli esercizi (NUT-015, NUT-016).
  const goals = await get(`/user/goals/unmodified?date=${today}`)
  step('obiettivi (unmodified)', goals.ok, { status: goals.status, values: goals.json })
  const goalsDay = await get(`/user/goals?date=${today}`)
  step('obiettivi (del giorno)', goalsDay.ok, { status: goalsDay.status, values: goalsDay.json })
  const summary = await get(`/user/widgets/daily-summary?date=${today}`)
  step('riepilogo del giorno', summary.ok, {
    status: summary.status,
    goals: summary.json?.goals,
    shape: shape(summary.json),
  })

  // 5. Esercizi degli ultimi 7 giorni.
  const ex = []
  for (let i = 0; i > -7; i--) {
    const e = await get(`/user/exercises?date=${day(i)}`)
    const all = [...(e.json?.training ?? []), ...(e.json?.custom_training ?? [])]
    ex.push({ date: day(i), status: e.status, count: all.length, kcal: sum(all.map((x) => x.energy)) })
    if (i === 0) step('forma esercizi', e.ok, { shape: shape(e.json) })
  }
  step(
    'esercizi 7 giorni',
    ex.every((x) => x.status === 200),
    { days: ex },
  )

  // 6. Diario degli ultimi 3 giorni: tipi di voce e slot.
  let sampleProductId = null
  for (const d of days) {
    const c = await get(`/user/consumed-items?date=${d}`)
    const j = c.json ?? {}
    const products = j.products ?? (Array.isArray(j) ? j : [])
    sampleProductId ??= products[0]?.product_id ?? null
    step(`diario ${d}`, c.ok, {
      status: c.status,
      products: products.length,
      recipe_portions: j.recipe_portions?.length ?? null,
      simple_products: j.simple_products?.length ?? null,
      daytimes: count(
        [...products, ...(j.recipe_portions ?? []), ...(j.simple_products ?? [])].map((x) => x.daytime),
      ),
      withServing: products.filter((x) => x.serving).length,
      shape: shape(j),
    })
  }

  // 7. Dettaglio prodotto: nutrienti, porzioni, codice a barre.
  if (sampleProductId) {
    const p = await get(`/products/${sampleProductId}`)
    step('dettaglio prodotto del diario', p.ok, {
      status: p.status,
      nutrientKeys: Object.keys(p.json?.nutrients ?? {}).length,
      hasBarcodeField: hasKey(p.json, /ean|barcode|gtin/i),
      shape: shape(p.json),
    })
  } else
    step('dettaglio prodotto del diario', false, { note: 'nessun prodotto nel diario degli ultimi 3 giorni' })

  // 8. Ricerca per nome, catalogo italiano.
  let writable = null
  for (const q of QUERIES) {
    const s = await get(
      `/products/search?${new URLSearchParams({ query: q, sex: 'male', countries: 'IT', locales: 'it_IT' })}`,
    )
    const list = Array.isArray(s.json) ? s.json : []
    // La ricerca mette davanti anche l'anguria: si prende la mela per nome.
    if (q === 'mela') writable = list.find((x) => x.name?.trim().toLowerCase() === 'mela') ?? null
    step(`ricerca "${q}"`, s.ok && list.length > 0, {
      status: s.status,
      results: list.length,
      verified: list.filter((x) => x.is_verified).length,
      top: list
        .slice(0, 3)
        .map((x) => `${x.name}${x.producer ? ` (${x.producer})` : ''} · ${x.nutrients?.['energy.energy']}`),
    })
  }

  // 9. Codice a barre: nessun endpoint documentato, si provano le varianti note.
  for (const ean of EANS) {
    const tries = {}
    for (const path of [
      `/products/barcode/${ean}`,
      `/products/ean/${ean}`,
      `/products/search?${new URLSearchParams({ query: ean, countries: 'IT', locales: 'it_IT', sex: 'male' })}`,
    ]) {
      const b = await get(path)
      const list = Array.isArray(b.json) ? b.json : b.json ? [b.json] : []
      tries[path.split('?')[0].replace(ean, '{ean}')] = {
        status: b.status,
        results: list.length,
        first: list[0]?.name ?? null,
      }
    }
    step(
      `codice a barre ${ean}`,
      Object.values(tries).some((t) => t.status === 200 && t.results > 0),
      tries,
    )
  }

  // 10. Acqua e peso.
  const water = await get(`/user/water-intake?date=${today}`)
  step('acqua oggi', water.ok, { status: water.status, shape: shape(water.json) })
  const weight = await get(`/user/bodyvalues/weight/last?date=${today}`)
  step('ultimo peso', weight.ok, { status: weight.status, shape: shape(weight.json) })
  const history = await get(`/user/bodyvalues/weight?start=${day(-90)}&end=${today}`)
  step('storico peso (non documentato)', history.ok, { status: history.status, shape: shape(history.json) })

  if (!WRITE) {
    step('scrittura', true, { note: 'saltata: rilancia con --write per provarla' })
    return
  }

  // 11. Scrittura: 1 g di un prodotto con id scelto da noi, poi cancellazione.
  if (!writable) return step('scrittura', false, { note: 'nessun prodotto da usare' })
  const id = randomUUID()
  const add = await post(
    '/user/consumed-items',
    JSON.stringify({
      products: [
        {
          id,
          product_id: writable.product_id,
          date: `${today} 12:00:00`,
          daytime: 'snack',
          amount: 1,
          serving: null,
          serving_quantity: null,
        },
      ],
      recipe_portions: [],
      simple_products: [],
    }),
  )
  step('scrittura voce', add.ok, { status: add.status, body: add.ok ? undefined : add.text?.slice(0, 300) })
  const back = await get(`/user/consumed-items?date=${today}`)
  const found = (back.json?.products ?? []).find((x) => x.id === id)
  step('rilettura con il nostro id', Boolean(found), { sameId: Boolean(found), shape: shape(found) })
  const del = await request('DELETE', '/user/consumed-items', JSON.stringify([id]))
  const after = await get(`/user/consumed-items?date=${today}`)
  const gone = !(after.json?.products ?? []).some((x) => x.id === id)
  step('cancellazione', del.ok && gone, { status: del.status, gone })

  // 12. Acqua: si riscrive lo stesso totale, quindi il diario non cambia.
  const ml = water.json?.water_intake
  if (typeof ml === 'number') {
    const w = await post(
      '/user/water-intake',
      JSON.stringify([{ date: `${today} 12:00:00`, water_intake: ml }]),
    )
    const w2 = await get(`/user/water-intake?date=${today}`)
    step('scrittura acqua (stesso totale)', w.ok && w2.json?.water_intake === ml, { status: w.status })
  }
}

async function login(b) {
  const res = await fetchRaw(`${b}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ grant_type: 'password', username: env.YAZIO_USERNAME, password: env.YAZIO_PASSWORD }),
  })
  return {
    ok: res.ok,
    token: res.json,
    info: {
      status: res.status,
      expiresIn: res.json?.expires_in,
      error: res.ok ? undefined : res.text?.slice(0, 200),
    },
  }
}

function form(extra) {
  return new URLSearchParams({
    client_id: env.YAZIO_CLIENT_ID,
    client_secret: env.YAZIO_CLIENT_SECRET,
    ...extra,
  }).toString()
}

const get = (path) => request('GET', path)
const post = (path, body, json = true) => request('POST', path, body, json)

function request(method, path, body, json = true) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token.access_token}`
  if (body) headers['Content-Type'] = json ? 'application/json' : 'application/x-www-form-urlencoded'
  return fetchRaw(`${base}${path}`, { method, headers, body })
}

async function fetchRaw(url, init) {
  calls++
  const t = Date.now()
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    if (res.status === 429) console.warn(`429 su ${new URL(url).pathname}`)
    return { ok: res.ok, status: res.status, json, text, ms: Date.now() - t }
  } catch (e) {
    return { ok: false, status: 0, json: null, text: String(e?.message ?? e), ms: Date.now() - t }
  }
}

function step(name, ok, info = {}) {
  report.steps.push({ name, ok, ...info })
  console.warn(`${ok ? 'ok  ' : 'NO  '} ${name}`)
}

// Forma di una risposta: chiavi e tipi, senza valori personali.
function shape(v, depth = 0) {
  if (v == null) return null
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1)] : []
  if (typeof v !== 'object') return typeof v
  if (depth > 3) return 'object'
  return Object.fromEntries(
    Object.entries(v).map(([k, x]) => [k, PRIVATE_KEYS.test(k) ? typeof x : shape(x, depth + 1)]),
  )
}

function hasKey(v, re) {
  if (!v || typeof v !== 'object') return false
  return Object.entries(v).some(([k, x]) => re.test(k) || hasKey(x, re))
}

function day(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
}

function sum(xs) {
  return xs.reduce((a, b) => a + (Number(b) || 0), 0)
}

function count(xs) {
  return xs.reduce((a, x) => ({ ...a, [x]: (a[x] ?? 0) + 1 }), {})
}

function loadEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

function fail(msg) {
  console.error(msg)
  process.exit(1)
}
