// Configurazione del backend, tutta da variabili d'ambiente (.env dello
// stack sul server). Le credenziali di qBittorrent restano qui e non
// arrivano mai ai client.
export type Config = {
  port: number
  staticDir: string
  qbt: { url: string; username: string; password: string }
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
  }
}
