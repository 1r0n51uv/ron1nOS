// free-exercise-db finto, per i test del catalogo delle immagini (GYM-014):
// serve /dist/exercises.json e le foto come raw.githubusercontent.com.
import { Hono } from 'hono'

// Un JPEG grigio di 4×3 pixel.
export const FAKE_JPEG = Buffer.from(
  '/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAADAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJgA/9k=',
  'base64',
)

const exercise = (id: string, name: string, primaryMuscles: string[], equipment: string | null) => ({
  id,
  name,
  primaryMuscles,
  equipment,
  images: [`${id}/0.jpg`, `${id}/1.jpg`],
})

export const FAKE_EXERCISES = [
  exercise('Barbell_Bench_Press_-_Medium_Grip', 'Barbell Bench Press - Medium Grip', ['chest'], 'barbell'),
  exercise('Barbell_Squat', 'Barbell Squat', ['quadriceps'], 'barbell'),
  exercise('Dumbbell_Flyes', 'Dumbbell Flyes', ['chest'], 'dumbbell'),
  exercise('Incline_Dumbbell_Press', 'Incline Dumbbell Press', ['chest'], 'dumbbell'),
  exercise('Face_Pull', 'Face Pull', ['shoulders'], 'cable'),
  exercise('Plank', 'Plank', ['abdominals'], 'body only'),
]

export function createFakeExercises() {
  const app = new Hono()
  const requests: string[] = []
  let down = false
  app.get('/__fake/health', (c) => c.text('ok'))
  app.use('*', async (c, next) => {
    requests.push(new URL(c.req.url).pathname)
    if (down) return c.text('down', 503)
    await next()
  })
  app.get('*/dist/exercises.json', (c) => c.json(FAKE_EXERCISES))
  app.get('*/exercises/:id/:file', (c) => {
    const known = FAKE_EXERCISES.some((e) => e.id === c.req.param('id'))
    if (!known || !/^[01]\.jpg$/.test(c.req.param('file'))) return c.text('not found', 404)
    return c.body(new Uint8Array(FAKE_JPEG), 200, { 'Content-Type': 'image/jpeg' })
  })
  return {
    app,
    requests,
    setDown(value: boolean) {
      down = value
    },
    fetch: ((input: string | URL | Request, init?: RequestInit) =>
      app.request(String(input), init)) as typeof fetch,
  }
}
