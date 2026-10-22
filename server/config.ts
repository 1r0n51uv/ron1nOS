// Configurazione del backend, tutta da variabili d'ambiente (.env dello
// stack sul server). Le credenziali di qBittorrent restano qui e non
// arrivano mai ai client.
export type Config = {
  port: number
  staticDir: string
  qbt: { url: string; username: string; password: string }
  // Attesa dei metadati di un magnet prima di proporre Riprova (DL-005).
  metadataWaitMs: number
  glances: { url: string }
  // Postgres del modulo Nutrizione; senza, il modulo risponde 503.
  databaseUrl?: string
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
  }
}
