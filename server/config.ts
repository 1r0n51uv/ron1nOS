// Configurazione del backend, tutta da variabili d'ambiente (.env dello
// stack sul server). Le credenziali di qBittorrent restano qui e non
// arrivano mai ai client.
import type { ExternalConfig } from './nutrition/foodsearch.ts'
import { DEFAULT_CATALOG_URL } from './workout/catalog.ts'
import type { YazioConfig } from './yazio/client.ts'

export type Config = {
  port: number
  staticDir: string
  qbt: { url: string; username: string; password: string }
  // Attesa dei metadati di un magnet prima di proporre Riprova (DL-005).
  metadataWaitMs: number
  glances: { url: string }
  // Postgres del modulo Nutrizione; senza, il modulo risponde 503.
  databaseUrl?: string
  // Account YAZIO (modulo Nutrizione): attivo solo con tutte le variabili.
  yazio?: YazioConfig & { tokenKey: string }
  // OpenFoodFacts e USDA per la ricerca alimenti (NUT-004, NUT-005).
  foods: ExternalConfig
  // Login della dashboard (AUTH-002): hash scrypt della password.
  auth: { passwordHash?: string; cookieSecure: boolean }
  // Modulo Documenti (DOC-015): chiave AES-256 in base64.
  documentsKey?: string
  // Modulo Allenamento (GYM-014): copia del catalogo delle immagini.
  workoutCatalog: { dir: string; url: string }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8080),
    staticDir: env.STATIC_DIR ?? 'dist',
    qbt: {
      url: (env.QBT_URL ?? 'http://qbittorrent:8080').replace(/\/+$/, ''),
      username: env.QBT_USERNAME ?? '',
      password: env.QBT_PASSWORD ?? '',
    },
    metadataWaitMs: Number(env.METADATA_WAIT_SECONDS ?? 60) * 1000,
    // Glances gira in rete host (infra/glances): dal container si raggiunge
    // con host.docker.internal.
    glances: {
      url: (env.GLANCES_URL ?? 'http://host.docker.internal:61208').replace(/\/+$/, ''),
    },
    databaseUrl: env.DATABASE_URL || undefined,
    yazio: yazioConfig(env),
    foods: {
      offUrl: (env.OFF_URL ?? 'https://world.openfoodfacts.org').replace(/\/+$/, ''),
      offItalyUrl: (env.OFF_ITALY_URL ?? 'https://it.openfoodfacts.org').replace(/\/+$/, ''),
      usdaUrl: (env.USDA_URL ?? 'https://api.nal.usda.gov/fdc/v1').replace(/\/+$/, ''),
      // DEMO_KEY basta per poche ricerche al giorno; una chiave gratuita su api.data.gov.
      usdaKey: env.USDA_API_KEY || 'DEMO_KEY',
    },
    auth: {
      passwordHash: env.AUTH_PASSWORD_HASH || undefined,
      // Il cookie viaggia solo su HTTPS (Caddy); false solo negli e2e su localhost.
      cookieSecure: env.AUTH_COOKIE_SECURE !== 'false',
    },
    documentsKey: env.DOCUMENTS_KEY || undefined,
    workoutCatalog: {
      dir: env.WORKOUT_CATALOG_DIR || 'data/workout-catalog',
      url: (env.WORKOUT_CATALOG_URL || DEFAULT_CATALOG_URL).replace(/\/+$/, ''),
    },
  }
}

function yazioConfig(env: NodeJS.ProcessEnv): Config['yazio'] {
  const { YAZIO_USERNAME, YAZIO_PASSWORD, YAZIO_CLIENT_ID, YAZIO_CLIENT_SECRET, YAZIO_TOKEN_KEY } = env
  if (!YAZIO_USERNAME || !YAZIO_PASSWORD || !YAZIO_CLIENT_ID || !YAZIO_CLIENT_SECRET || !YAZIO_TOKEN_KEY) {
    return undefined
  }
  return {
    url: (env.YAZIO_URL ?? 'https://yzapi.yazio.com/v20').replace(/\/+$/, ''),
    clientId: YAZIO_CLIENT_ID,
    clientSecret: YAZIO_CLIENT_SECRET,
    username: YAZIO_USERNAME,
    password: YAZIO_PASSWORD,
    tokenKey: YAZIO_TOKEN_KEY,
  }
}
