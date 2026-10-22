// tsc compila solo il TypeScript: le migrazioni SQL vanno copiate accanto
// al backend compilato, dove server/db.ts le cerca (dist-server/migrations).
import { cpSync, rmSync } from 'node:fs'

rmSync('dist-server/migrations', { recursive: true, force: true })
cpSync('server/migrations', 'dist-server/migrations', { recursive: true })
