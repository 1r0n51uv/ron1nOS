// YAZIO finto per gli e2e, sulla porta 18084: lo stesso finto dei test unit
// (server/testing/fake-yazio.ts).
import { serve } from '@hono/node-server'

import { createFakeYazio } from '../server/testing/fake-yazio.ts'

const port = Number(process.env.FAKE_YAZIO_PORT ?? 18084)
const { app } = createFakeYazio()
serve({ fetch: app.fetch, port })
