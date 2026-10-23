// Informazioni sul backend per Impostazioni › Informazioni (SET-012): la
// versione dell'immagine, passata dalla pipeline di rilascio come argomenti
// del Dockerfile, e da quanto tempo è acceso.
export type About = {
  version: { commit: string | null; builtAt: string | null }
  startedAt: string
  uptimeSeconds: number
}

export type AboutDeps = {
  commit?: string | null
  builtAt?: string | null
  startedAt?: Date
  now?: () => Date
}

// Fuori da un'immagine (sviluppo, test) commit e data mancano: null.
export function buildFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null)
  return { commit: clean(env.RON1NOS_COMMIT), builtAt: clean(env.RON1NOS_BUILT_AT) }
}

const BOOT = new Date(Date.now() - process.uptime() * 1000)

export function createAbout({
  commit = buildFromEnv().commit,
  builtAt = buildFromEnv().builtAt,
  startedAt = BOOT,
  now = () => new Date(),
}: AboutDeps = {}) {
  return (): About => ({
    version: { commit, builtAt },
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.max(0, Math.floor((now().getTime() - startedAt.getTime()) / 1000)),
  })
}
