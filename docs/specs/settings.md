# Impostazioni

Prefisso ID: `SET` · Label: `mod:settings`

Oggi la pagina `/impostazioni` contiene solo i pannelli del modulo
Nutrizione, uno sotto l'altro. Diventa la pagina di tutte le impostazioni
di ron1nOS: aspetto, dashboard, moduli, account, integrazioni e
informazioni, divise in sezioni con un menu laterale.

Le preferenze si salvano sul backend (`/api/v1`), come il layout della
dashboard ([dashboard.md](dashboard.md)), così l'app iOS le legge dalle
stesse rotte. I segreti restano nel `.env` del server: la pagina li
mostra come stato, non li modifica.

Non fa, per ora: tema chiaro, colore di accento diverso dal rosso, lingue
diverse dall'italiano, più utenti.

**Stato del documento: approvato il 2026-10-22, requisiti pianificati.** Le scelte sono in fondo,
in "Decisioni".

## Requisiti

### Struttura

#### SET-001 · Pagina a sezioni

Stato: fatto (#176)

Accettazione:

- [x] A sinistra il menu delle sezioni, a destra una sezione alla volta.
      Ogni sezione ha il suo indirizzo `/impostazioni/<sezione>`;
      `/impostazioni` apre `Aspetto`.
- [x] Sezioni, in ordine: Aspetto, Dashboard, Moduli, Navigazione,
      Account, App iOS, Integrazioni, Formati, Backup configurazione,
      Informazioni.
- [x] Le impostazioni dei singoli moduli (oggi Nutrizione: YAZIO, alimenti
      non abbinati, obiettivi, alimenti, integratori) stanno sotto
      `Moduli`, una pagina per modulo: `/impostazioni/moduli/nutrizione`.
- [x] Ogni modifica si salva da sola, senza pulsante `Salva`; un errore si
      mostra accanto al campo.

#### SET-002 · Preferenze sul server

Stato: fatto (#174)

Accettazione:

- [x] Tabella `preferences` (migrazione nuova) con un documento unico:
      aspetto, moduli spenti, ordine della navigazione, formati.
- [x] `GET /api/v1/preferences` e `PATCH /api/v1/preferences`, validate
      con zod nel backend, in `api/openapi.yaml`.
- [x] Il frontend le carica all'avvio con React Query; finché non
      arrivano usa i valori predefiniti, senza sfarfallio di tema.
- [x] Senza database valgono i predefiniti e la pagina avvisa che le
      modifiche non si salvano.

### Sezioni

#### SET-003 · Aspetto

Stato: fatto (#179)

Resta il tema scuro con il solo rosso del marchio; si personalizzano
sfondo, vetro e densità.

Accettazione:

- [x] Sfondo: una delle sfumature già pronte (la predefinita è quella di
      oggi) o un'immagine caricata. L'immagine si salva sul backend
      (`PUT /api/v1/preferences/background`, massimo 5 MB, JPEG/PNG/WebP)
      e viene scurita quanto basta per tenere leggibile il testo.
- [x] Vetro: `leggero`, `medio` (oggi), `intenso`; cambia sfocatura e
      trasparenza delle utility `glass-panel`, `glass-chip`, `glass-bar`
      tramite variabili CSS, senza toccare i componenti.
- [x] Densità: `comoda` (oggi) o `compatta`, che riduce spaziature e
      padding di card e griglia.
- [x] Ogni scelta si vede subito in un'anteprima nella sezione e poi in
      tutta l'interfaccia.

#### SET-004 · Dashboard

Stato: fatto (#181)

Accettazione:

- [x] Forma della testata: completa, una riga, nascosta (DASH-006).
- [x] Elenco dei widget presenti, con `Rimuovi` e `Opzioni` (le stesse
      del menu sul widget, DASH-005).
- [x] `Ripristina layout predefinito` con conferma (DASH-008).

#### SET-005 · Moduli

Stato: fatto (#184)

Accettazione:

- [x] Elenco dei moduli con interruttore acceso/spento e, se ne ha, il
      link alle sue impostazioni.
- [x] Un modulo spento sparisce dalla barra di navigazione, dalla
      dashboard e dal catalogo dei widget; la sua pagina mostra `Modulo
spento` con il link per riaccenderlo.
- [x] Le rotte API del modulo spento rispondono `404` con codice
      `module_disabled`; i suoi job in background (es. sincronizzazione
      YAZIO) si fermano. I dati restano.
- [x] Dashboard e Impostazioni non si possono spegnere.

#### SET-006 · Navigazione

Stato: fatto (#190)

Accettazione:

- [x] Elenco delle voci della barra laterale, riordinabile trascinando o
      con le frecce.
- [x] Dashboard resta sempre prima e Impostazioni sempre ultima.
- [x] `Ripristina ordine` torna a quello predefinito.

#### SET-007 · Account

Stato: fatto (#188)

Raccoglie i comandi del login ([auth.md](auth.md)).

Accettazione:

- [x] Sessioni attive con dispositivo, ultimo uso e `Chiudi`; `Chiudi le
altre sessioni` (AUTH-002).
- [x] `Esci` (AUTH-001).
- [x] Cambio password: la password sta come hash nel `.env`
      (AUTH-002), quindi la sezione spiega come generarne una nuova con
      `npm run auth:hash` invece di offrire un campo.

#### SET-008 · App iOS

Stato: pianificato (#156)

È la sezione dei token di AUTH-005: creazione con nome, token mostrato una
volta, elenco con ultimo uso e revoca. Si realizza con AUTH-005, quando
arriva l'app; fino ad allora la sezione non compare.

#### SET-009 · Integrazioni

Stato: fatto (#186)

Accettazione:

- [x] Una riga per servizio esterno: Postgres, YAZIO, qBittorrent,
      Glances, Home Assistant. Per ognuno: `collegato`, `errore` (con il
      messaggio) o `non configurato`, e l'ora dell'ultimo controllo.
- [x] Dati da `GET /api/v1/integrations`, che non restituisce mai
      password né token.
- [x] `Verifica` rifà il controllo di un servizio.
- [x] Per un servizio non configurato, le variabili del `.env` da
      impostare.

#### SET-010 · Formati

Stato: fatto (#192)

Accettazione:

- [x] Fuso orario (predefinito `Europe/Rome`), usato dove oggi è scritto
      fisso, a partire dalle date della Nutrizione.
- [x] Unità del peso (`kg`, `lb`) e dell'energia (`kcal`, `kJ`):
      cambiano solo la visualizzazione, i dati restano in kg e kcal.
- [x] Lingua: solo italiano, mostrata ma non modificabile.

Il fuso vale per le ore mostrate (ultima sincronizzazione YAZIO, inizio
di una sessione). I giorni del diario e degli allenamenti restano
sull'ora di Roma, come nel backend che li calcola. I campi da compilare
(obiettivi, ricette, serie) restano in kcal e kg.

#### SET-011 · Backup della configurazione

Stato: in corso (#154)

Accettazione:

- [x] `Esporta` scarica un JSON con preferenze e layout di tutti i
      dispositivi, con una versione di formato. Niente dati dei moduli,
      niente segreti, niente immagine di sfondo.
- [x] `Importa` legge il file, lo valida sul backend
      (`POST /api/v1/preferences/import`), mostra cosa cambierà e chiede
      conferma.

#### SET-012 · Informazioni

Stato: pianificato (#155)

Accettazione:

- [ ] Versione dell'immagine (commit e data della build, passati come
      argomenti al `Dockerfile` dalla pipeline di rilascio).
- [ ] Stato del backend e del database (da `GET /api/v1/health`) e da
      quanto tempo è acceso.
- [ ] Link al repository e alla specifica.

## Decisioni

Prese il 2026-10-22 dal proprietario, con le schede di scelta.

1. **Aspetto generale.** Sfondo, intensità del vetro e densità. Resta il
   tema scuro con il solo rosso del marchio.
2. **Moduli.** Si possono spegnere interi moduli: spariscono da widget,
   navigazione e API.
3. **Contenuto.** Pagina completa: aspetto, dashboard, moduli, account,
   integrazioni, informazioni, più token iOS, ordine della navigazione,
   formati ed esporta/importa.
4. **Struttura.** Menu laterale di sezioni, una alla volta.

Scelte fatte nella stesura, da confermare:

- Preferenze uniche per tutti i dispositivi; solo il layout della
  dashboard è per dispositivo.
- La password non si cambia dalla UI finché vive nel `.env` (AUTH-002).
- Le impostazioni della Nutrizione si spostano sotto `Moduli`, senza
  cambiare.
