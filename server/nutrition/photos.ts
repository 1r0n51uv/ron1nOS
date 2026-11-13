// Foto generata di una ricetta (NUT-036). ron1nOS chiede la foto all'agente
// image-chef del dojo (API del gateway di Hermes) e la serve da una cartella
// condivisa col dojo, montata in sola lettura. Il lavoro gira in background:
// la rotta risponde subito e la ricetta mostra lo stato.
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import type { Queryable } from '../db.ts'
import { ConflictError, NotFoundError } from './http.ts'
import type { Recipe } from './recipes.ts'
import { getRecipe } from './recipes.ts'

export type PhotoGenerator = {
  // Cartella dove image-chef salva le immagini (sola lettura per ron1nOS).
  dir: string
  // Chiede la foto; torna il nome del file creato, se l'agente l'ha detto, o
  // lancia con un motivo da mostrare.
  generate(recipe: Recipe): Promise<string | null>
}

export type PhotoConfig = { url: string; key: string; dir: string; timeoutMs?: number }

export class PhotoError extends Error {}

// Un lavoro "in corso" da più di così è rimasto a metà (riavvio, dojo spento).
export const STALE_MS = 10 * 60 * 1000
const NAME = /^[\w.-]+\.(png|jpe?g|webp)$/i
const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

// Il testo della richiesta: i dati della ricetta in un blocco. L'agente lo
// tratta come dato (SOUL).
export function photoPrompt(recipe: Recipe): string {
  const lines = [
    'RICETTA',
    `id: ${recipe.id}`,
    `nome: ${recipe.name}`,
    `ingredienti: ${recipe.items.map((i) => i.name).join(', ')}`,
    ...(recipe.steps.length ? ['procedimento:', ...recipe.steps.map((s, i) => `${i + 1}. ${s}`)] : []),
    'FINE RICETTA',
  ]
  return lines.join('\n')
}

// Il nome del file dalla risposta `FATTO /percorso/foto.png`.
export function fileNameFrom(answer: string): string | null {
  const last = answer.match(/[^\s`'"()]+\.(?:png|jpe?g|webp)/gi)?.at(-1)
  const name = last?.split('/').at(-1)
  return name && NAME.test(name) ? name : null
}

export function createPhotoGenerator(config: PhotoConfig): PhotoGenerator {
  const base = config.url.replace(/\/+$/, '')
  return {
    dir: config.dir,
    async generate(recipe) {
      const res = await fetch(`${base}/p/image-chef/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
        body: JSON.stringify({
          model: 'image-chef',
          stream: false,
          messages: [{ role: 'user', content: photoPrompt(recipe) }],
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 5 * 60 * 1000),
      }).catch((err: unknown) => {
        throw new PhotoError(
          err instanceof Error && err.name === 'TimeoutError'
            ? 'Image Chef non ha risposto in tempo'
            : 'Il dojo non risponde',
        )
      })
      if (!res.ok) throw new PhotoError(`Il dojo ha risposto ${res.status}`)
      const body = (await res.json().catch(() => null)) as {
        choices?: { message?: { content?: string } }[]
      } | null
      const answer = body?.choices?.[0]?.message?.content?.trim() ?? ''
      if (/^ERRORE/i.test(answer)) throw new PhotoError(answer.replace(/^ERRORE[:\s-]*/i, '').slice(0, 300))
      return fileNameFrom(answer)
    },
  }
}

// Il file di una foto nella cartella condivisa, se il nome è valido e c'è.
export async function photoFile(dir: string, name: string | null) {
  if (!name || !NAME.test(name)) return null
  const path = join(dir, name)
  const info = await stat(path).catch(() => null)
  if (!info?.isFile()) return null
  return { path, name, type: TYPES[name.split('.').at(-1)!.toLowerCase()], mtime: info.mtimeMs }
}

// Se l'agente non ha detto il nome: l'immagine più recente creata dopo `since`.
async function newestSince(dir: string, since: number) {
  const names = await readdir(dir).catch(() => [])
  const found = (await Promise.all(names.map((n) => photoFile(dir, n)))).filter(
    (f): f is NonNullable<typeof f> => f !== null && f.mtime >= since,
  )
  return found.sort((a, b) => b.mtime - a.mtime)[0] ?? null
}

export async function readPhoto(db: Queryable, dir: string, id: string) {
  const { rows } = await db.query<{ photoFile: string | null }>(
    'select photo_file as "photoFile" from recipes where id = $1',
    [id],
  )
  const file = await photoFile(dir, rows[0]?.photoFile ?? null)
  if (!file) throw new NotFoundError('Foto non trovata')
  return { data: await readFile(file.path), type: file.type }
}

// Avvia il lavoro e torna subito. Un solo lavoro per ricetta alla volta.
export async function startPhoto(db: Queryable, photos: PhotoGenerator, id: string) {
  const recipe = await getRecipe(db, id)
  const since = Date.now() - 1000
  const { rows } = await db.query<{ id: string }>(
    `update recipes set photo_state = 'generating', photo_error = null, photo_started_at = now()
      where id = $1 and (photo_state is distinct from 'generating'
        or photo_started_at < now() - ($2 || ' milliseconds')::interval)
      returning id`,
    [id, String(STALE_MS)],
  )
  if (!rows.length) throw new ConflictError('photo_in_progress', 'La foto è già in preparazione')
  void run(db, photos, recipe, since)
}

async function run(db: Queryable, photos: PhotoGenerator, recipe: Recipe, since: number) {
  try {
    const name = await photos.generate(recipe)
    const found = (await photoFile(photos.dir, name)) ?? (await newestSince(photos.dir, since))
    if (!found) throw new PhotoError('Image Chef non ha salvato la foto')
    await db.query(
      `update recipes set image_url = $2, photo_file = $3, photo_state = null, photo_error = null,
              updated_at = now() where id = $1`,
      [recipe.id, `/api/v1/nutrition/recipes/${recipe.id}/photo?v=${Math.round(found.mtime)}`, found.name],
    )
  } catch (err) {
    const message = err instanceof PhotoError ? err.message : 'Non è riuscita'
    await db
      .query(`update recipes set photo_state = 'failed', photo_error = $2 where id = $1`, [
        recipe.id,
        message,
      ])
      .catch(() => undefined)
  }
}
