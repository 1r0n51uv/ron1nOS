// free-exercise-db finto per gli e2e, sulla porta 18085: lo stesso finto
// dei test unit (server/testing/fake-exercises.ts).
import { serve } from '@hono/node-server'

import { createFakeExercises } from '../server/testing/fake-exercises.ts'

const port = Number(process.env.FAKE_EXERCISES_PORT ?? 18085)
const { app } = createFakeExercises()
serve({ fetch: app.fetch, port })
