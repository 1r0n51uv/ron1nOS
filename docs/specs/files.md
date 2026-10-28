# File

Prefisso ID: `FILE` · Label: `mod:files`

Il modulo è un file hosting personale sull'home server: si caricano file
di qualsiasi tipo e dimensione, si tengono in cartelle, si scaricano, si
eliminano e si condividono con un link. Come gli altri moduli la logica
sta nel backend di ron1nOS (`/api/v1/files`), che serve allo stesso modo
la dashboard web e l'app iOS.

È diverso dai Documenti: lì ci sono pochi file piccoli e preziosi, con
campi da copiare e cifrati in Postgres; qui ci sono file qualsiasi, anche
grandi (video, archivi, foto), che restano file veri su disco.

Non fa, per ora: sincronizzazione con le cartelle del Mac o dell'iPhone,
versioni dei file, modifica dei file nel browser, condivisione in
scrittura (qualcuno che carica da un link), backup (regola del progetto:
nessun backup).

**Stato del documento: proposto il 2026-10-28.** Le scelte aperte sono
nelle schede del thread; il testo segue le opzioni consigliate, in
"Decisioni", e si aggiorna con le risposte.

## Requisiti

### Dashboard

#### FILE-001 · Widget File

Stato: proposto

Il widget in dashboard mostra lo spazio e gli ultimi file.

Accettazione:

- [ ] Spazio usato dai file e spazio libero sul disco (FILE-014), con una
      barra; sotto il 10% libero la barra usa il rosso `brand`.
- [ ] Gli ultimi 5 file caricati, con icona del tipo, nome, dimensione e
      data; un clic apre l'anteprima (FILE-008).
- [ ] Il numero dei link di condivisione attivi (FILE-011).
- [ ] `Carica` apre la scelta dei file (FILE-003); il link `Dettagli`
      apre la pagina File (FILE-002).
- [ ] Stato vuoto con `Carica il primo file`.

#### FILE-002 · Pagina File

Stato: proposto

Una pagina `/file` per sfogliare le cartelle.

Accettazione:

- [ ] Percorso della cartella in alto (`File › Foto › 2026`), ogni pezzo
      cliccabile.
- [ ] Prima le cartelle, poi i file, con nome, dimensione, data di
      modifica e un'icona di condivisione se hanno un link attivo.
- [ ] Vista a elenco e vista a griglia con miniature (FILE-008); la scelta
      resta nelle preferenze.
- [ ] Ordinamento per nome, data o dimensione.
- [ ] Ricerca per nome su tutte le cartelle, con il percorso di ogni
      risultato.
- [ ] Selezione multipla per spostare, scaricare ed eliminare insieme.
- [ ] Il percorso sta nell'URL (`/file?c=Foto/2026`): indietro e
      ricarica tengono la cartella.

### Gestione

#### FILE-003 · Caricare file

Stato: proposto

Accettazione:

- [ ] Trascinando file o cartelle sulla pagina, o con `Carica`; più file
      insieme, in coda.
- [ ] Nessun limite di dimensione oltre allo spazio libero: l'upload va a
      pezzi da 50 MB, sotto il limite di 100 MB per richiesta di
      Cloudflare Free.
- [ ] Avanzamento per file e totale, con velocità; ogni file si può
      annullare.
- [ ] Se la rete cade, il file riprende dall'ultimo pezzo arrivato; i
      pezzi abbandonati da più di 24 ore si cancellano da soli.
- [ ] Il file compare solo quando tutti i pezzi sono arrivati e la
      dimensione torna.
- [ ] Un nome già presente nella cartella diventa `nome (2).ext`, senza
      sovrascrivere.
- [ ] Se lo spazio libero non basta l'upload non parte e lo dice.

#### FILE-004 · Cartelle

Stato: proposto

Accettazione:

- [ ] Crea, rinomina, sposta ed elimina una cartella.
- [ ] Le cartelle si annidano senza limite di profondità.
- [ ] Eliminare una cartella non vuota chiede conferma con il numero di
      file e la manda nel cestino (FILE-006).

#### FILE-005 · Rinominare e spostare

Stato: proposto

Accettazione:

- [ ] Rinomina in linea; i nomi con `/`, `\`, `..` o caratteri di
      controllo sono rifiutati.
- [ ] Sposta in un'altra cartella con un selettore o trascinando sulla
      cartella.
- [ ] I link di condivisione seguono il file quando si sposta o rinomina.

#### FILE-006 · Eliminare e cestino

Stato: proposto

Senza backup, un cestino evita la perdita per un clic sbagliato.

Accettazione:

- [ ] Eliminare manda nel cestino, senza chiedere conferma per un file
      solo; un avviso permette di annullare.
- [ ] Il cestino mostra cosa c'è, da dove viene e quando sparirà;
      `Ripristina` lo rimette al suo posto (o in `File` se la cartella non
      c'è più).
- [ ] Dopo 30 giorni il cestino si svuota da solo; `Svuota cestino` e
      `Elimina per sempre` chiedono conferma.
- [ ] Un file nel cestino perde i suoi link di condivisione.
- [ ] Lo spazio del cestino si vede nel widget e nella pagina.

#### FILE-007 · Scaricare

Stato: proposto

Accettazione:

- [ ] Ogni file si scarica con il suo nome.
- [ ] Il download supporta le richieste `Range`: si riprende e i video si
      possono scorrere.
- [ ] Una cartella o una selezione si scarica come ZIP creato al volo,
      senza file temporanei.

#### FILE-008 · Anteprima

Stato: proposto

Accettazione:

- [ ] Anteprima nel browser per immagini, PDF, video, audio e testo
      (fino a 1 MB); gli altri tipi mostrano icona, dimensione e
      `Scarica`.
- [ ] Frecce per passare al file precedente e successivo della cartella.
- [ ] Miniature per le immagini, create alla prima richiesta e tenute in
      una cache rigenerabile.

### Condivisione

#### FILE-009 · Creare un link

Stato: proposto

Accettazione:

- [ ] Da un file o una cartella, `Condividi` crea un link
      `https://share.DOMINIO/s/<codice>`, con un codice casuale di almeno
      128 bit.
- [ ] Scadenza fra 1 giorno, 7 giorni (default), 30 giorni o mai.
- [ ] Password facoltativa, salvata come hash scrypt come quella del
      login.
- [ ] Numero massimo di download facoltativo.
- [ ] `Copia link` copia l'indirizzo; un file può avere più link.

#### FILE-010 · Pagina pubblica del link

Stato: proposto

Chi riceve il link non ha l'account Cloudflare né il login di ron1nOS.

Accettazione:

- [ ] `share.DOMINIO/s/<codice>` mostra nome, dimensione, anteprima
      (FILE-008) e `Scarica`; per una cartella l'elenco dei file e
      `Scarica tutto` come ZIP.
- [ ] Con la password, prima un campo per inserirla; i tentativi sbagliati
      sono limitati come quelli del login.
- [ ] Un link scaduto, revocato, esaurito o inesistente dà la stessa
      pagina `Link non disponibile`, senza dire quale dei quattro.
- [ ] Da questo host si raggiungono solo la pagina del link e i suoi
      file: niente dashboard, niente altre rotte di `/api/v1`, niente
      elenco delle cartelle sopra quella condivisa.
- [ ] Stile ron1nOS, in italiano, senza dati del proprietario.

#### FILE-011 · Gestire i link

Stato: proposto

Accettazione:

- [ ] Nella pagina File una vista `Condivisi` con tutti i link: file,
      scadenza, password sì o no, download fatti.
- [ ] Ogni link si copia, si modifica (scadenza, password, limite) o si
      revoca.
- [ ] I link scaduti restano in elenco come scaduti per 30 giorni, poi
      spariscono.

### Server

#### FILE-012 · Base del modulo

Stato: proposto

Accettazione:

- [ ] I file stanno in chiaro nella cartella `FILES_DIR` (sul server
      `/srv/ron1n-files`, montata nel container): l'albero delle cartelle
      sul disco è quello che si vede nella pagina, leggibile anche via
      SSH.
- [ ] Il disco è la fonte di verità: elenco, dimensioni e date si leggono
      dal disco. Postgres tiene solo link, cestino e upload in corso
      (migrazione nuova in `server/migrations/`).
- [ ] Ogni percorso dal client è risolto dentro `FILES_DIR`: `..`, link
      simbolici che escono e percorsi assoluti sono rifiutati con 400.
- [ ] Cestino, pezzi degli upload e cache delle miniature in cartelle
      nascoste dentro `FILES_DIR` (`.cestino`, `.upload`, `.miniature`),
      mai mostrate nell'elenco.
- [ ] Senza `FILES_DIR` il modulo risponde 503 e la pagina lo spiega, come
      i Documenti senza chiave.
- [ ] Rotte in `api/openapi.yaml`, tutte dietro il login (AUTH) tranne
      quelle pubbliche dei link (FILE-010).

#### FILE-013 · Host pubblico e infra

Stato: proposto

Il lavoro sta nel repo ron1n (stack `infra/ron1nos`, Caddy, Cloudflare),
con la sua issue.

Accettazione:

- [ ] Volume `/srv/ron1n-files:/data/files` nello stack ron1nos e
      `FILES_DIR=/data/files` nel `.env.example`; il bootstrap crea la
      cartella con i permessi giusti, il cleanup chiede se toglierla.
- [ ] Caddy pubblica `share.DOMINIO` verso ron1nos solo su `/s/*` e
      `/api/v1/share/*`; tutto il resto risponde 404.
- [ ] `scripts/cloudflare.sh` crea l'applicazione Access
      "ron1n · condivisione" su `share.DOMINIO` con la policy "ron1n ·
      pubblico" (Bypass) di SETUP-011, più il nome DNS nel tunnel.
      Rilanciato non crea doppioni.
- [ ] Tutto sul piano gratuito di Cloudflare.

#### FILE-014 · Spazio su disco

Stato: proposto

Accettazione:

- [ ] L'API dice spazio totale e libero del disco di `FILES_DIR` e lo
      spazio usato dai file e dal cestino.
- [ ] Il numero si calcola in background e si tiene in memoria, non a
      ogni richiesta.

## Note

### Architettura

Rotte sotto `/api/v1/files` nel backend Hono. I file non passano mai da
Postgres: il backend legge e scrive in `FILES_DIR` con stream, così anche
un file di molti GB non occupa memoria. Lo ZIP delle cartelle si scrive in
streaming mentre si scarica.

Tabelle proposte:

- `files_shares`: codice, percorso, tipo (file o cartella), scadenza, hash
  della password, limite e numero di download, creato, revocato.
- `files_trash`: id, percorso originale, nome nel cestino, eliminato il.
- `files_uploads`: id, cartella, nome, dimensione attesa, byte arrivati,
  ultimo pezzo, iniziato il.

I link seguono gli spostamenti (FILE-005) perché ogni rinomina o
spostamento fatto da ron1nOS aggiorna anche `files_shares`. Uno
spostamento fatto via SSH rompe il link, che risulta `Link non
disponibile`.

### Endpoint proposti

Sotto `/api/v1/files`, dietro il login:

| Metodo e rotta                        | Uso                                 | Requisiti |
| ------------------------------------- | ----------------------------------- | --------- |
| `GET /summary`                        | spazio, ultimi file, link attivi    | 001, 014  |
| `GET /list?path=&sort=`               | contenuto di una cartella           | 002       |
| `GET /search?q=`                      | ricerca per nome                    | 002       |
| `POST /folders`                       | nuova cartella                      | 004       |
| `POST /move`                          | rinomina o sposta file e cartelle   | 004, 005  |
| `POST /uploads`                       | inizia un upload, dà id e pezzo     | 003       |
| `PUT /uploads/{id}?offset=`           | un pezzo da 50 MB al massimo        | 003       |
| `GET /uploads/{id}`, `DELETE …/{id}`  | stato per la ripresa, annullamento  | 003       |
| `GET /download?path=`                 | file con `Range`, o cartella in ZIP | 007       |
| `POST /zip`                           | ZIP di una selezione                | 007       |
| `GET /thumbnail?path=`                | miniatura di un'immagine            | 008       |
| `POST /trash`, `GET /trash`           | elimina, contenuto del cestino      | 006       |
| `POST /trash/{id}/restore`            | ripristino                          | 006       |
| `DELETE /trash/{id}`, `DELETE /trash` | elimina per sempre, svuota          | 006       |
| `GET /shares`, `POST /shares`         | elenco e nuovo link                 | 009, 011  |
| `PATCH /shares/{id}`, `DELETE …/{id}` | modifica e revoca                   | 011       |

Pubbliche, sotto `/api/v1/share`, raggiungibili da `share.DOMINIO`:

| Metodo e rotta                 | Uso                             | Requisiti |
| ------------------------------ | ------------------------------- | --------- |
| `GET /{codice}`                | nome, dimensione, elenco        | 010       |
| `POST /{codice}/unlock`        | password, dà un cookie del link | 010       |
| `GET /{codice}/download?path=` | file con `Range`, o ZIP         | 010       |

La pagina `/s/<codice>` è una pagina leggera a parte nella stessa SPA,
senza il resto della dashboard.

### Piano di lavoro

1. **Infra** (ron1n, FILE-013): cartella, volume, host `share`, Access.
2. **Base** (FILE-012, FILE-014): config, percorsi sicuri, migrazione,
   elenco e spazio.
3. **Upload a pezzi** (FILE-003).
4. **Pagina** (FILE-002, FILE-004, FILE-005), poi **download e anteprima**
   (FILE-007, FILE-008).
5. **Cestino** (FILE-006), poi **widget** (FILE-001).
6. **Link** (FILE-009, FILE-011), poi **pagina pubblica** (FILE-010).
7. **App iOS**: requisiti `IOS-1xx` in ron1nos-ios, con caricamento dal
   foglio di condivisione di iOS e dalla libreria foto.

### Limiti dei servizi gratuiti

- Cloudflare Free accetta richieste fino a 100 MB: per questo l'upload va
  a pezzi da 50 MB. I download non hanno questo limite.
- I termini di Cloudflare scoraggiano di servire molto video attraverso la
  CDN: per vedere un film va bene, per farne un servizio di streaming no.

### Decisioni

Proposte il 2026-10-28, in attesa delle risposte nelle schede del thread.

1. **Dove.** Cartella `/srv/ron1n-files` in chiaro, metadati in Postgres
   (consigliata; in alternativa cifrata o in Postgres come i Documenti).
2. **Link.** Pubblici con scadenza su `share.DOMINIO`, unico host aperto
   da Access (in alternativa solo email autorizzate, o niente link).
3. **Dimensione.** Senza limite, upload a pezzi da 50 MB (in alternativa
   massimo 100 MB).
4. **Organizzazione.** Cartelle annidate (in alternativa lista con tag).
5. **Cestino.** 30 giorni, perché non ci sono backup.
