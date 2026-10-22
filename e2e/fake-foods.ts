// OpenFoodFacts e USDA finti per gli e2e, sulla porta 18083: lo stesso
// finto dei test unit (server/testing/fake-foods.ts).
import { serve } from '@hono/node-server'

import { createFakeFoods } from '../server/testing/fake-foods.ts'

const port = Number(process.env.FAKE_FOODS_PORT ?? 18083)
const { app } = createFakeFoods()
serve({ fetch: app.fetch, port })
