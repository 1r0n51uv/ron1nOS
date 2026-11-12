// Foto generata di una ricetta (NUT-036). ron1nOS chiede la foto all'agente
// image-chef del dojo (API del gateway di Hermes) e la serve da una cartella
// condivisa col dojo, montata in sola lettura. Il lavoro gira in background:
// la rotta risponde subito e la ricetta mostra lo stato.
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import type { Queryable } from '../db.ts'
import { ConflictError, NotFoundError } from './http.ts'
import type { Recipe } from './recipes.ts'
import { getRecipe } from './recipes.ts'

export type PhotoGenerator = {
  // Cartella dove image-chef scrive `<id>.png`.
  dir: string
  // Chiede la foto; torna quando image-chef ha risposto, o lancia con un motivo da mostrare.
  generate(recipe: Recipe): Promise<void>
}

export type PhotoConfig = {
  url: string
  key: string
  // La cartella vista da ron1nOS (sola lettura) e la stessa vista dal dojo,
  // dove image-chef scrive.
  dir: string
  agentDir: string
  timeoutMs?: number
}

export class PhotoError extends Error {}

// Un lavoro "in corso" da più di così è rimasto a metà (riavvio, dojo spento).
export const STALE_MS = 10 * 60 * 1000
const EXTENSIONS = ['png', 'jpg', 'webp'] as const
const TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const

// Il testo della richiesta: i dati della ricetta in un blocco, il percorso
// dove salvare fuori dal blocco. L'agente tratta il blocco come dato (SOUL).
export function photoPrompt(recipe: Recipe, file: string): string {
  const lines = [
    'RICETTA',
    `id: ${recipe.id}`,
    `nome: ${recipe.name}`,
    `ingredienti: ${recipe.items.map((i) => i.name).join(', ')}`,
    ...(recipe.steps.length ? ['procedimento:', ...recipe.steps.map((s, i) => `${i + 1}. ${s}`)] : []),
    'FINE RICETTA',
    `FILE: ${file}`,
  ]
  return lines.join('\n')
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
          messages: [{ role: 'user', content: photoPrompt(recipe, `${config.agentDir}/${recipe.id}.png`) }],
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
    },
  }
}

// Il file della foto di una ricetta, se c'è.
export async function photoFile(dir: string, id: string) {
  for (const ext of EXTENSIONS) {
    const path = join(dir, `${id}.${ext}`)
    const info = await stat(path).catch(() => null)
    if (info?.isFile()) return { path, type: TYPES[ext], mtime: info.mtimeMs }
  }
  return null
}

export async function readPhoto(dir: string, id: string) {
  const file = await photoFile(dir, id)
  if (!file) throw new NotFoundError('Foto non trovata')
  return { data: await readFile(file.path), type: file.type }
}

// Avvia il lavoro e torna subito. Un solo lavoro per ricetta alla volta.
export async function startPhoto(db: Queryable, photos: PhotoGenerator, id: string) {
  const recipe = await getRecipe(db, id)
  const { rows } = await db.query<{ id: string }>(
    `update recipes set photo_state = 'generating', photo_error = null, photo_started_at = now()
      where id = $1 and (photo_state is distinct from 'generating'
        or photo_started_at < now() - ($2 || ' milliseconds')::interval)
      returning id`,
    [id, String(STALE_MS)],
  )
  if (!rows.length) throw new ConflictError('photo_in_progress', 'La foto è già in preparazione')
  void run(db, photos, recipe)
}

async function run(db: Queryable, photos: PhotoGenerator, recipe: Recipe) {
  try {
    await photos.generate(recipe)
    const found = await photoFile(photos.dir, recipe.id)
    if (!found) throw new PhotoError('Image Chef non ha salvato la foto')
    await db.query(
      `update recipes set image_url = $2, photo_state = null, photo_error = null, updated_at = now()
        where id = $1`,
      [recipe.id, `/api/v1/nutrition/recipes/${recipe.id}/photo?v=${Math.round(found.mtime)}`],
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
