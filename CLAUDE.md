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
- Testi: brevi, calmi, niente punti esclamativi né emoji. Separatore `·`.
- Prima di consegnare: `npm run build` e `npm run lint` puliti.
