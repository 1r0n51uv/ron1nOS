# CLAUDE.md

Dashboard web ron1nOS. Documentazione, commenti e testi dell'interfaccia in
italiano.

- Per ora solo layout desktop (larghezza minima 1024px). Il mobile arriva
  dopo: non aggiungere varianti responsive finché non viene chiesto.
- Design system: token in `src/index.css`. Il rosso del marchio è `brand`
  (`bg-brand`, `text-brand-text`…), non `accent`, che in shadcn è lo
  sfondo di hover. Un solo accento rosso, usato come segnale.
- Superfici in vetro con le utility `glass-panel`, `glass-chip`,
  `glass-bar`. Numeri sempre in `font-mono`, titoli in `font-display`.
- Componenti shadcn in `src/components/ui`; si aggiungono con
  `npx shadcn@latest add <nome>` e poi si adattano ai token.
- Ogni modulo ha `data.ts` (tipi, sorgente, hook React Query) e
  `Widget.tsx`. Il widget legge solo dall'hook. Per collegare un modulo
  vero si cambia solo la sorgente in `data.ts`.
- Backend in `server/` (Hono): rotte JSON sotto `/api/v1`, pensate per
  tutti i client (web e app iOS). Logica e validazione stanno qui, non nel
  browser. Ogni rotta nuova va in `api/openapi.yaml`. Segreti solo da
  variabili d'ambiente.
- Testi: brevi, calmi, niente punti esclamativi né emoji. Separatore `·`.
- Ogni PR porta i suoi test: unit (Vitest, `*.test.ts(x)` accanto al file)
  e almeno uno scenario e2e (Playwright, `e2e/`) per ciò che l'utente vede.
  Non disattivare né saltare test per far passare la CI.
- Stile: lo decide Prettier (`npm run format`), non a mano. ESLint con zero
  warning.
- Prima di consegnare: `npm run check` pulito (formato, lint, typecheck,
  unit, build, e2e).
- Per rivedere un'interfaccia, una schermata o una PR con UI usa la skill
  `apple-design` in `.claude/skills/`. Dove non concorda con il design
  system (per esempio il tema solo scuro) vince il design system. Non si
  formatta né si linta; si aggiorna con `npx skills update -p`.
