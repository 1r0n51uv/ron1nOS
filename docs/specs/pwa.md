# App installabile

Prefisso ID: `PWA` · Label: `mod:pwa`

La dashboard si installa sulla schermata Home di un tablet (o di un
telefono) e si apre a tutto schermo, senza la barra del browser. Serve
HTTPS, che c'è già dietro Caddy.

Non fa, per ora: lavoro offline, notifiche push, aggiornamenti in
background. Il layout del resto della dashboard resta desktop (larghezza
minima 1024px): su un tablet in orizzontale va bene, in verticale è solo
la pagina di login ad adattarsi.

## Requisiti

#### PWA-001 · Installabile

Stato: fatto

Accettazione:

- [x] `manifest.webmanifest` con nome, `display: standalone`, colori del
      tema e icone 192, 512 e maskable 512; `apple-touch-icon` per iPad.
- [x] Il link al manifest manda i cookie (`crossorigin="use-credentials"`):
      dietro Cloudflare Access, senza, il browser riceve la pagina di login
      al posto del manifest e non offre l'installazione.
- [x] Un service worker (`sw.js`) registrato in produzione: rete per
      prima, e senza rete mostra la pagina di avvio. Non mette in cache le
      API né i dati.
