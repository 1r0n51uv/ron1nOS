import { defineConfig, devices } from '@playwright/test'

import { E2E_PASSWORD_HASH, STATE } from './e2e/auth.ts'
import { E2E_CATALOG_DIR, E2E_DATABASE_URL } from './e2e/db.ts'
import { FAKE_CLIENT, FAKE_USER } from './server/testing/fake-yazio.ts'

// E2E sulla build di produzione servita dal backend. In CI il browser
// arriva da `npx playwright install`; in locale si può indicare un Chromium
// già installato con PLAYWRIGHT_CHROMIUM_PATH.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  // Un solo worker: i test condividono lo stato dei servizi finti.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    // Login una volta sola (AUTH-001): il cookie finisce in STATE.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      // Solo desktop per ora: larghezza minima 1024px.
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { executablePath },
        storageState: STATE,
      },
    },
  ],
  // Il backend compilato (npm run build) serve la SPA e l'API, collegato a
  // un qBittorrent e a un Glances finti e a un Postgres vero: lo stesso
  // percorso della produzione.
  webServer: [
    {
      command: 'node e2e/fake-qbittorrent.ts',
      url: 'http://localhost:18080/__fake/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node e2e/fake-glances.ts',
      url: 'http://localhost:18081/__fake/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node e2e/fake-foods.ts',
      url: 'http://localhost:18083/__fake/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node e2e/fake-yazio.ts',
      url: 'http://localhost:18084/__fake/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node e2e/fake-exercises.ts',
      url: 'http://localhost:18085/__fake/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node dist-server/index.js',
      url: 'http://localhost:4173/api/v1/health',
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '4173',
        STATIC_DIR: 'dist',
        QBT_URL: 'http://localhost:18080',
        // Attesa dei metadati corta per provare Riprova senza aspettare un minuto.
        METADATA_WAIT_SECONDS: '3',
        QBT_USERNAME: 'admin',
        QBT_PASSWORD: 'admin',
        GLANCES_URL: 'http://localhost:18081',
        // Postgres vero: in CI il servizio del job, in locale lo stesso utente.
        DATABASE_URL: E2E_DATABASE_URL,
        OFF_URL: 'http://localhost:18083/off',
        OFF_ITALY_URL: 'http://localhost:18083/off-it',
        USDA_URL: 'http://localhost:18083/usda',
        YAZIO_URL: 'http://localhost:18084/v20',
        YAZIO_CLIENT_ID: FAKE_CLIENT.id,
        YAZIO_CLIENT_SECRET: FAKE_CLIENT.secret,
        YAZIO_USERNAME: FAKE_USER.username,
        YAZIO_PASSWORD: FAKE_USER.password,
        YAZIO_TOKEN_KEY: 'chiave-e2e',
        // Login acceso come in produzione; cookie senza Secure su http://localhost.
        AUTH_PASSWORD_HASH: E2E_PASSWORD_HASH,
        AUTH_COOKIE_SECURE: 'false',
        // Chiave di prova del modulo Documenti (DOC-015).
        // Catalogo delle immagini degli esercizi finto, copia in una cartella temporanea.
        WORKOUT_CATALOG_URL: 'http://localhost:18085/catalog',
        WORKOUT_CATALOG_DIR: E2E_CATALOG_DIR,
        DOCUMENTS_KEY: 'ABB9OVQtWCp76GiMotgkxs3SgJ6emQ/YjCrpY8CAnBc=',
      },
    },
  ],
})
