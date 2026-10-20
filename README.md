# ron1nOS

Dashboard dell'homelab [ron1n](https://github.com/1r0n51uv/ron1n): pasti,
allenamento, peso, casa, server, container, download e note in un'unica
schermata. Stile liquid glass su nero, un solo accento rosso.

![Dashboard](docs/dashboard.png)

## Stato

MVP desktop con dati mock. Ogni modulo verrà collegato alla sua sorgente
vera uno alla volta (vedi [`src/modules`](src/modules/README.md)). La
versione mobile arriva dopo.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, componenti shadcn/ui (Radix),
TanStack Query, React Router.

## Sviluppo

```sh
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
```

## Struttura

```
src/
  components/ui/      componenti shadcn, con lo stile ron1nOS
  components/ron1n/   componenti del design system (HankoMark, ProgressRing, NavRail…)
  modules/<modulo>/   data.ts (tipi, sorgente, hook) + Widget.tsx
  pages/              Dashboard e pagine delle sezioni
  layout/             AppShell e voci di navigazione
  index.css           token del design system e tema shadcn
```

## Deploy

L'immagine Docker (Nginx con i file statici) viene pubblicata su
`ghcr.io/1r0n51uv/ron1nos` a ogni push su `main`. Sul server gira come
stack in `ron1n/infra`, aggiornato da Watchtower.
