# Download

Prefisso ID: `DL` · Label: `mod:downloads`

Il modulo mostra i download torrent del server e permette di aggiungerne di
nuovi. Il client è qBittorrent, stack `torrent` in
[`ron1n/infra/torrent`](https://github.com/1r0n51uv/ron1n/tree/main/infra/torrent).

Fa: widget con i download in corso, wizard per aggiungere un torrent da file
`.torrent`, URL di un file `.torrent` o link magnet, scelta dei file da
scaricare, avvio.

Non fa, per ora: pausa, ripresa o eliminazione dei torrent, priorità per
file dopo l'avvio, limiti di velocità, categorie, RSS, ricerca, pagina
`Download` dedicata (arriverà con pausa, ripresa ed eliminazione),
notifiche a download finito, VPN per il traffico BitTorrent. Per tutto questo resta la Web UI di qBittorrent su
`torrent.ron1n.home`.

## Requisiti

### DL-001 · Widget dei download in corso

Stato: fatto (#29)

Nella dashboard il widget Download mostra cosa sta scaricando il server,
aggiornato da solo.

Accettazione:

- [ ] In testata la velocità totale di download in MB/s, in `font-mono`.
- [ ] Elenca fino a 3 torrent in download, i più vicini alla fine per
      primi: nome (troncato), percentuale, barra di avanzamento, tempo
      rimanente.
- [ ] Sotto, una riga riassuntiva con gli altri:
      `+N attivi · N in coda · N in seed`, omettendo le voci a zero.
- [ ] Senza download attivi mostra `Nessun download attivo.` e la riga
      riassuntiva, se c'è.
- [ ] I dati si aggiornano ogni 5 secondi senza ricaricare la pagina e
      senza far lampeggiare il widget.
- [ ] Durante il primo caricamento mostra lo skeleton, come gli altri widget.

### DL-002 · Stato di qBittorrent non raggiungibile

Stato: fatto (#30)

Se la dashboard non riesce a parlare con qBittorrent, il widget lo dice
invece di mostrare dati vecchi o vuoti.

Accettazione:

- [ ] Con qBittorrent spento il widget mostra
      `qBittorrent non raggiungibile` con lo stato `offline` (StatusPill), entro due
      aggiornamenti.
- [ ] Con credenziali errate mostra `Accesso a qBittorrent non riuscito`.
- [ ] Quando il servizio torna disponibile il widget riprende da solo.
- [ ] Il pulsante Aggiungi (DL-003) resta visibile ma disattivato.

### DL-003 · Pulsante Aggiungi

Stato: fatto (#7)

Dal widget si apre il wizard per aggiungere un torrent.

Accettazione:

- [ ] Il widget ha un pulsante `Aggiungi` (Button glass piccolo, icona
      `plus`) in fondo, sulla riga riassuntiva. La testata resta alla
      velocità: il WidgetCard ha la meta o un'azione, mai entrambe.
- [ ] Il pulsante apre il wizard in un modale (Dialog), con la dashboard
      visibile sotto il vetro.
- [ ] Il modale si chiude con `Esc`, con il pulsante di chiusura o con
      `Annulla`, con le regole di DL-008.

### DL-004 · Wizard, passo 1: sorgente

Stato: fatto (#8)

Il primo passo chiede da dove viene il torrent: un file `.torrent`, l'URL
di un file `.torrent` o un link magnet. Un torrent alla volta.

Accettazione:

- [ ] Due schede: `File` e `Link`.
- [ ] `File`: area di trascinamento e scelta da disco; accetta un solo file
      `.torrent` fino a 10 MB. Un file non valido mostra
      `File torrent non valido.` e non si prosegue.
- [ ] `Link`: campo di testo che accetta due forme: - link magnet che inizia con `magnet:?` e contiene `xt=urn:btih:`
      (v1) o `xt=urn:btmh:` (v2); - URL `http://` o `https://` di un file `.torrent`.
      Altro testo mostra `Link non valido.`
- [ ] Con un URL, il file viene scaricato dal server e trattato come un
      file `.torrent` caricato. Se il download non riesce (indirizzo non
      raggiungibile, oltre 10 MB, oltre 15 secondi, contenuto che non è un
      torrent) il wizard mostra `Impossibile scaricare il file torrent.`
- [ ] Incollare un link magnet o un URL in qualunque punto del passo lo
      mette nella scheda `Link`.
- [ ] `Avanti` è attivo solo con una sorgente valida.

### DL-005 · Wizard, passo 2: lettura dei contenuti

Stato: pianificato (#9)

Prima di scegliere cosa scaricare il wizard legge nome, dimensione e
elenco dei file del torrent.

Accettazione:

- [ ] Con un file `.torrent` o un URL i contenuti appaiono appena il file
      è letto, senza attendere i peer.
- [ ] Con un magnet il wizard mostra `Recupero dei metadati…` con un
      indicatore di attesa finché i peer non li forniscono.
- [ ] Dopo 60 secondi senza metadati mostra
      `Nessun peer ha fornito i metadati.` con due scelte: `Riprova` (altri 60 secondi) e `Annulla`.
- [ ] Se il torrent è già presente in qBittorrent il wizard si ferma con
      `Questo torrent è già nei download.` e non lo aggiunge di nuovo.

### DL-006 · Wizard, passo 3: scelta dei file

Stato: pianificato (#10)

Si sceglie quali file del torrent scaricare.

Accettazione:

- [ ] I file sono mostrati ad albero, con le cartelle del torrent, ognuno
      con casella di selezione e dimensione in `font-mono`.
- [ ] Selezionare una cartella seleziona tutto il suo contenuto; una
      cartella con selezione parziale mostra lo stato intermedio.
- [ ] Comandi `Tutti` e `Nessuno`.
- [ ] All'apertura sono selezionati tutti i file.
- [ ] In fondo il totale: `N file · X GB su Y GB`.
- [ ] Con un torrent di un solo file il passo mostra il file già
      selezionato e si può proseguire subito.
- [ ] `Avanti` è attivo solo con almeno un file selezionato.

### DL-007 · Wizard, passo 4: riepilogo e avvio

Stato: pianificato (#11)

L'ultimo passo riassume e avvia il download.

Accettazione:

- [ ] Riepilogo: nome del torrent, file selezionati, dimensione da
      scaricare, cartella di destinazione (quella predefinita di
      qBittorrent, `/downloads`), spazio libero nella cartella.
- [ ] Se la dimensione da scaricare supera lo spazio libero mostra un
      avviso e `Avvia` resta disattivato.
- [ ] `Avvia` aggiunge il torrent con solo i file scelti e lo avvia; il
      modale si chiude.
- [ ] Entro un aggiornamento (5 s) il torrent compare nel widget, in
      download o in coda.
- [ ] Se l'avvio fallisce il wizard resta aperto sul riepilogo con
      `Avvio non riuscito. Riprova.` e nulla di parziale resta in
      qBittorrent.

### DL-008 · Annullare il wizard

Stato: pianificato (#12)

Chiudere il wizard prima di `Avvia` non lascia tracce.

Accettazione:

- [ ] Annullando in qualunque passo, in qBittorrent non resta nessun
      torrent nuovo né file scaricati.
- [ ] Vale anche per un magnet annullato durante il recupero dei metadati.
- [ ] `Indietro` torna al passo precedente mantenendo le scelte fatte.

### DL-009 · Credenziali solo sul server

Stato: fatto (#27)

Il browser non vede mai le credenziali di qBittorrent e non parla
direttamente con la sua Web API.

Accettazione:

- [ ] Utente e password di qBittorrent stanno solo nel `.env` dello stack
      ron1nOS sul server; non compaiono nel bundle JavaScript, nelle
      risposte HTTP né nei log.
- [ ] I client (dashboard web e, in futuro, app iOS) parlano solo con gli
      endpoint `/api/v1/downloads/*` di ron1nOS; la Web API di
      qBittorrent non è raggiungibile da fuori del server se non tramite
      Caddy sulla tailnet.
- [ ] Gli endpoint espongono solo le operazioni di questo modulo
      (elenco, aggiunta, lettura file, scelta file, avvio, annullamento).

## Note

### Architettura dell'integrazione

Oggi ron1nOS è solo file statici serviti da Nginx. qBittorrent si
autentica con un cookie di sessione `SID`, ha la protezione CSRF sugli
header `Origin`/`Referer` e non permette chiamate cross-origin, quindi il
browser non può (e non deve) chiamarlo direttamente.

Proposta: un piccolo backend della dashboard (**BFF**, backend for
frontend) nello stesso repo e nella stessa immagine Docker. Un server Node
(Hono o Fastify) serve i file statici di `dist/` e le rotte `/api/*`, e
sostituisce Nginx. Motivi:

- tiene le credenziali sul server (DL-009) e rinnova da solo la sessione
  quando qBittorrent risponde `403`;
- espone solo le operazioni che servono, invece di tutta la Web API;
- servirà comunque agli altri moduli: il modulo container non può dare al
  browser il socket Docker, quello server deve leggere metriche locali;
- resta un'immagine sola, come chiede il flusso (una app = un'immagine
  GHCR), e un container solo nello stack `infra/ron1nos`.

Alternativa scartata: Nginx inoltra `/api/qbt/` a qBittorrent con la
whitelist di sottorete attiva (niente login). È meno codice, ma chiunque
raggiunga la dashboard ha tutta la Web API, e la whitelist vale per ogni
container sulla rete `proxy`.

### Un backend per più client

Le stesse funzioni arriveranno nell'app ron1nOS iOS (decisione del
2026-10-20). Per questo il BFF è un'API vera, non un dettaglio della
pagina web:

- tutte le rotte sotto `/api/v1/`, JSON in uscita, versionate: un cambio
  incompatibile passa a `/api/v2/` senza rompere l'app installata;
- contratto descritto in un file OpenAPI nel repo (`api/openapi.yaml`),
  da cui si generano i tipi per la dashboard e per l'app iOS;
- nessuna logica solo nel browser: validazione dei magnet e degli URL,
  controllo duplicati, spazio libero e pulizia delle bozze stanno nel
  BFF, così l'app iOS non deve rifarle;
- upload del `.torrent` in `multipart/form-data`, che entrambi i client
  sanno inviare;
- autenticazione: oggi basta la tailnet; quando arriva l'app iOS si
  aggiunge un token per dispositivo (header `Authorization: Bearer`),
  senza cambiare le rotte.

Nel frontend non cambia la regola dei moduli: `data.ts` passa dal mock a
`fetch('/api/v1/downloads/...')`, il widget legge solo dagli hook.

### Endpoint del BFF

| Metodo e rotta                            | Uso                                                  | Chiamate qBittorrent                                   |
| ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `GET /api/v1/downloads`                   | DL-001, DL-002                                       | `transfer/info`, `torrents/info`                       |
| `POST /api/v1/downloads/drafts`           | DL-004, DL-005: crea una bozza da file, URL o magnet | vedi sotto                                             |
| `GET /api/v1/downloads/drafts/:id`        | DL-005: stato metadati e albero file                 | `torrents/files` (solo magnet)                         |
| `POST /api/v1/downloads/drafts/:id/start` | DL-006, DL-007: file scelti e avvio                  | `torrents/add` o `filePrio` + `torrents/start`         |
| `DELETE /api/v1/downloads/drafts/:id`     | DL-008                                               | `torrents/delete` con `deleteFiles=true` (solo magnet) |
| `GET /api/v1/downloads/space`             | DL-007: spazio libero                                | `sync/maindata` (`free_space_on_disk`)                 |

Sequenza prevista (da verificare sulla Web API di qBittorrent 5.3 in fase
di implementazione):

- **File `.torrent`:** il BFF legge il file da sé (bencode), calcola
  l'infohash e restituisce l'albero dei file. qBittorrent non vede nulla
  finché non si preme `Avvia`, quindi annullare è gratis. All'avvio:
  `torrents/add` con `stopped=true`, poi `filePrio` a `0` per i file
  esclusi, poi `torrents/start`.
- **URL di un `.torrent`:** il BFF scarica il file da sé (non lo passa a
  qBittorrent come `urls`) e da lì procede come per un file caricato.
- **Magnet:** il BFF ricava l'infohash dal link, controlla i duplicati
  con `torrents/info?hashes=`, poi `torrents/add` con
  `stopCondition=MetadataReceived` e il tag `ron1nos-draft`; il torrent si
  ferma appena ha i metadati. Il wizard interroga la bozza finché
  `torrents/files` non restituisce i file. All'avvio: `filePrio`, rimozione
  del tag, `torrents/start`. Annullare elimina il torrent e i file.
- **Bozze orfane:** all'avvio del BFF e ogni ora, i torrent con il tag
  `ron1nos-draft` più vecchi di 30 minuti vengono eliminati.

### Sicurezza sul server

- qBittorrent: Web UI non pubblicata sull'host, solo sulla rete `proxy`;
  password cambiata al primo avvio; nessun bypass dell'autenticazione per
  localhost o sottoreti; CSRF e validazione Host attivi. Dettagli in
  `ron1n/infra/torrent/README.md`.
- ron1nOS e `torrent.ron1n.home` sono raggiungibili solo dalla tailnet via
  Caddy, mai da Cloudflare Tunnel. La dashboard non ha login proprio:
  l'accesso è chi è nella tailnet. Se un giorno la dashboard diventa
  pubblica, serve prima un'autenticazione davanti (Cloudflare Access o
  simile).
- Il BFF chiama `http://qbittorrent:8080` sulla rete Docker interna; il
  traffico non esce dal server.
- Limiti sul BFF: corpo massimo 10 MB su `drafts`, solo
  `application/x-bittorrent`, testo `magnet:` o un URL `http(s)`.
- Download degli URL `.torrent` dal BFF, per evitare che la dashboard
  diventi un modo per far chiamare al server indirizzi interni (SSRF):
  solo `http`/`https`; il nome viene risolto e si rifiutano indirizzi
  loopback, privati, link-local e della tailnet (`127.0.0.0/8`,
  `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`,
  `100.64.0.0/10`, `::1`, `fc00::/7`, `fe80::/10`), anche dopo ogni
  redirect (massimo 3); timeout 15 s; massimo 10 MB letti; il contenuto
  deve essere un torrent valido. qBittorrent non riceve mai l'URL.
- Variabili nel `.env` dello stack ron1nOS: `QBT_URL`, `QBT_USERNAME`,
  `QBT_PASSWORD`. Nel repo solo `.env.example`.

### Dipendenze e ordine

1. Stack `torrent` attivo sul server (ron1n, `infra/torrent`).
2. BFF nell'immagine ron1nOS (#4) e stack `infra/ron1nos` in ron1n
   (1r0n51uv/ron1n#4).
3. DL-001 e DL-002 (sola lettura), poi DL-003…DL-008 (wizard).

I mockup del widget e dei quattro passi del wizard si fanno dopo
l'approvazione di questa specifica, con i componenti del design system
(WidgetCard, ProgressBar, StatusPill, Tag) e il Dialog shadcn.

### Decisioni (2026-10-20)

- Backend: BFF Node nella stessa immagine di ron1nOS, al posto di Nginx.
- Nessuna VPN per ora; se ne riparla a parte (container gluetun).
- Download in `/srv/downloads`, cartella unica senza categorie; la
  porta 6881 TCP/UDP viene inoltrata sul router.
- Widget: fino a 3 torrent attivi con nome, percentuale, barra e tempo
  rimanente; seed solo contati; aggiornamento ogni 5 s; il click su un
  torrent non fa nulla.
- Wizard: file `.torrent`, URL di un `.torrent` e magnet; un torrent alla
  volta; 60 s di attesa per i metadati; tutti i file selezionati
  all'inizio; cartella sempre quella predefinita; nessuna opzione extra;
  con spazio insufficiente `Avvia` è disattivato; un duplicato ferma il
  wizard.
- Pausa, ripresa ed eliminazione arrivano dopo, con la pagina `Download`.
  Nessuna notifica a download finito in questa versione.
