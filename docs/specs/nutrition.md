# Nutrizione

Prefisso ID: `NUT` · Label: `mod:nutrition`

Il modulo tiene il diario alimentare: cosa si mangia nei 5 pasti del
giorno, calorie e macro rispetto all'obiettivo, piano settimanale, ricette,
lista della spesa, acqua, caffeina e integratori. Si sincronizza con YAZIO
in lettura e scrittura, e YAZIO ha la priorità.

Riprende quasi tutto il modulo `1r0-diet` di
[1r0-pkm](https://github.com/1r0n51uv/1r0-pkm) (ADR-0017…0037), che è
deprecata e resta solo come riferimento, con una
differenza di fondo: in pkm la logica sta nell'app iOS (SwiftData, outbox,
calcoli lato client) e il backend è un archivio. Qui la logica sta nel
backend di ron1nOS (`/api/v1`), che serve allo stesso modo la dashboard web
e la futura app iOS: i due client sono intercambiabili.

Non fa, per ora: riconoscimento del piatto da foto, notifiche dal server,
più utenti, collegamento con altre app oltre a YAZIO. Apple Salute e i
promemoria arrivano con l'app iOS (NUT-018, NUT-019).

**Stato del documento: confermato il 2026-10-21.** Le scelte sono in
fondo, in "Decisioni". Ogni requisito porta l'origine: **pkm** (già
pensato o fatto in 1r0-pkm), **pkm, cambia** (ripreso con modifiche) o
**nuovo**. Ogni requisito confermato ha la sua issue; NUT-018 e
NUT-019 sono rimandati all'app iOS, NUT-025 è `rimosso`. L'integrazione
YAZIO è fattibile: lo conferma la prova del 2026-10-21 (vedi "Esito della
prova").

## Requisiti

### Diario del giorno

#### NUT-001 · Widget Nutrizione

Stato: fatto (#46) · Origine: pkm, cambia

Il widget in dashboard mostra la giornata di oggi.

Accettazione:

- [ ] Anello con le kcal mangiate sulla quota del giorno (NUT-016), in
      `font-mono`.
- [ ] Tre barre per proteine, carboidrati e grassi: `mangiati / obiettivo g`.
- [ ] Il prossimo pasto non ancora segnato: nome dello slot, cosa è
      pianificato, kcal.
- [ ] Il link `Dettagli` apre la pagina Nutrizione (NUT-002).
- [ ] Durante il primo caricamento mostra lo skeleton.

#### NUT-002 · Pagina Nutrizione

Stato: fatto (#47) · Origine: pkm, cambia

Una pagina `/pasti` con tutto il giorno, come la schermata Dieta unificata
di pkm (ADR-0036): striscia dei giorni (10 indietro, 13 avanti, oggi
selezionato), i 5 pasti, i tracker e i link a ricette, template e spesa.

Accettazione:

- [ ] Gli slot sono `Colazione`, `Spuntino`, `Pranzo`, `Merenda`, `Cena`
      (`breakfast`, `morning_snack`, `lunch`, `afternoon_snack`, `dinner`).
- [ ] Ogni slot ha uno di tre stati: vuoto (pulsante `+`), pianificato
      (alimenti previsti e interruttore), mangiato (alimenti con kcal).
- [ ] Scegliere un altro giorno nella striscia mostra i pasti e i totali di
      quel giorno, non di oggi (in pkm l'anello restava su oggi).

#### NUT-003 · Registrare un pasto

Stato: fatto (#48) · Origine: pkm

Si aggiunge un alimento a uno slot di un giorno qualsiasi.

Accettazione:

- [ ] Ricerca per nome con almeno 2 caratteri, risultati da NUT-004.
- [ ] Quantità in grammi, con le kcal e i macro calcolati mentre si scrive.
- [ ] Più alimenti nello stesso pasto, ognuno con la sua quantità.
- [ ] Le kcal e i macro di ogni riga si salvano al momento (snapshot): se
      l'alimento viene corretto dopo, lo storico non cambia.
- [ ] Lo slot proposto è quello dell'ora corrente.

#### NUT-004 · Ricerca alimenti

Stato: fatto (#49) · Origine: pkm, cambia

Il backend cerca in più fonti e unisce i risultati, senza duplicati per
nome.

Accettazione:

- [ ] Fonti: alimenti già usati (catalogo locale), OpenFoodFacts, USDA
      FoodData Central, e catalogo YAZIO se collegato (NUT-021).
- [ ] Filtro `Solo Italia` attivo di default (ADR-0036): la ricerca
      OpenFoodFacts passa da `search.openfoodfacts.org` con
      `countries_tags:"en:italy"` nella query, perché `cgi/search.pl`
      risponde 503 a intermittenza (2026-10-23).
- [ ] Un risultato esterno entra nel catalogo solo quando lo si usa.
- [ ] Ogni risultato mostra la fonte (`OFF`, `USDA`, `YAZIO`, `mio`).

#### NUT-005 · Codice a barre

Stato: fatto (#50) · Origine: pkm, cambia

Accettazione:

- [ ] Da web si inserisce il codice a mano; da iOS con la fotocamera.
- [ ] Il backend cerca prima nel catalogo locale, poi su OpenFoodFacts.
- [ ] Codice sconosciuto: si propone di creare l'alimento (NUT-006) con
      il codice già compilato.

#### NUT-006 · Alimenti personali

Stato: fatto (#51) · Origine: pkm

Accettazione:

- [ ] Nome, kcal, proteine, carboidrati, grassi per 100 g; marca, porzione
      e codice a barre facoltativi.
- [ ] Si modificano e si eliminano; i pasti già registrati non cambiano.

#### NUT-007 · Correggere un pasto

Stato: fatto (#52) · Origine: pkm

Accettazione:

- [ ] Si toglie un singolo alimento da un pasto mangiato; se era l'ultimo,
      il pasto sparisce e l'eventuale piano torna `saltato` (ADR-0037).
- [ ] Si aggiunge un alimento extra a un pasto già mangiato, anche di un
      giorno passato.
- [ ] Si cambia la quantità di una riga.

### Piano e ricette

#### NUT-008 · Ricette

Stato: fatto (#53) · Origine: pkm

Accettazione:

- [ ] Una ricetta ha nome, note facoltative e alimenti con grammi.
- [ ] Mostra kcal e macro totali.
- [ ] Si usa per registrare (NUT-003) o pianificare (NUT-009) un pasto in
      un colpo.

#### NUT-009 · Pianificare un pasto

Stato: fatto (#54) · Origine: pkm

Accettazione:

- [ ] Si pianifica una ricetta o una lista di alimenti su giorno e slot,
      nel passato o nel futuro.
- [ ] Un interruttore segna il pasto `mangiato` (crea le righe del diario)
      o `saltato`. Spegnerlo da `mangiato` cancella le righe collegate
      (ADR-0032).
- [ ] Un pasto pianificato si modifica finché non è `mangiato`.

#### NUT-010 · Template settimanale

Stato: fatto (#55) · Origine: pkm, cambia

Una dieta settimanale con nome (es. "massa", "definizione"): per ogni
giorno e slot una ricetta o un alimento singolo (ADR-0029, ADR-0032).

Accettazione:

- [ ] Griglia 7 giorni × 5 slot, ogni cella con ricetta o alimento, mai
      entrambi.
- [ ] `Applica a una settimana` (corrente, prossima o data libera, sempre
      da lunedì) crea i pasti pianificati e sostituisce solo quelli ancora
      `pianificati`.
- [ ] I template stanno sul server: si vedono uguali da web e da iOS (in
      pkm erano solo sul telefono).

#### NUT-011 · Lista della spesa

Stato: fatto (#56) · Origine: pkm

Accettazione:

- [ ] Si genera dai pasti pianificati di un intervallo di giorni,
      sommando i grammi dello stesso alimento.
- [ ] Voci manuali libere; tutte si spuntano e si eliminano.
- [ ] `Togli le spuntate` le elimina in blocco.
- [ ] Rigenerare aggiunge solo ciò che manca, non sovrascrive.

### Tracker

#### NUT-012 · Acqua

Stato: fatto (#57) · Origine: pkm

Accettazione:

- [ ] Contatore del giorno in ml con `-` e `+` (250 ml); `-` annulla
      l'ultima voce di oggi (ADR-0037).
- [ ] Obiettivo in ml dall'obiettivo nutrizionale (NUT-015), con barra.

#### NUT-013 · Caffeina

Stato: fatto (#58) · Origine: pkm

Accettazione:

- [ ] Contatore del giorno in mg con `-` e `+` (espresso, 80 mg).
- [ ] Alimenti con caffeina nel catalogo (`caffeine_mg_per_100g`) si sommano
      al totale quando si registrano.

#### NUT-014 · Integratori

Stato: fatto (#59) · Origine: pkm

Accettazione:

- [ ] Elenco degli integratori attivi (nome, dose, quando).
- [ ] Checklist del giorno: spuntato o no per ognuno.
- [ ] Si aggiungono, si disattivano, si eliminano.

### Obiettivi e andamento

#### NUT-015 · Obiettivo nutrizionale

Stato: fatto (#60) · Origine: pkm, cambia

Accettazione:

- [ ] Obiettivo in kcal e grammi di proteine, carboidrati, grassi, più
      acqua in ml.
- [ ] Con YAZIO collegato l'obiettivo si legge da YAZIO
      (`GET /user/goals`) a ogni sincronizzazione (NUT-024) e in ron1nOS
      non si modifica.
- [ ] Senza YAZIO, o con la sincronizzazione spenta, si imposta a mano.
      Niente modalità `TDEE`.
- [ ] Lo storico non si perde: ogni cambio, da YAZIO o a mano, aggiunge
      una riga con data di inizio (ADR-0019). Il report usa l'obiettivo
      valido in quel giorno.
- [ ] La modalità `fase della scheda` di pkm non c'è più: le schede di
      allenamento sono state tolte da pkm (ADR-0027).

#### NUT-016 · Quota del giorno

Stato: fatto (#66) · Origine: pkm, cambia

Accettazione:

- [ ] Quota = obiettivo di base + energia attiva del giorno, con un tetto
      di +1200 kcal (ADR-0019 emendata).
- [ ] L'energia attiva viene da YAZIO: con `consume_activity_calories`
      attivo, il riepilogo del giorno (`GET /user/widgets/daily-summary`)
      dà `activity_energy` e un obiettivo che la comprende già. Si usa
      quel valore applicando solo il tetto, senza sommare di nuovo gli
      esercizi. Senza YAZIO la quota è l'obiettivo di base.
- [ ] Il calcolo sta nel backend: web e iOS mostrano lo stesso numero.

#### NUT-017 · Andamento

Stato: fatto (#67) · Origine: pkm, cambia

Accettazione:

- [ ] Kcal e macro al giorno su 30 e 90 giorni, con media e tendenza.
- [ ] Aderenza: percentuale di giorni entro ±150 kcal dall'obiettivo del
      giorno.
- [ ] Peso sullo stesso asse temporale delle kcal. Arriva da YAZIO: al
      collegamento si importa lo storico
      (`GET /user/bodyvalues/weight?start=&end=`, vedi "Esito della
      prova"), poi a ogni sincronizzazione si aggiungono le pesate nuove.
- [ ] Calcolato nel backend (in pkm era nel client).

### Apple Salute e promemoria (solo iOS)

#### NUT-018 · Apple Salute

Stato: proposto, rimandato all'app iOS · Origine: pkm

Accettazione:

- [ ] L'app iOS scrive in Salute kcal e macro di ogni pasto.
- [ ] Legge peso, acqua ed energia attiva e li invia al backend, che li
      rende disponibili anche al web.
- [ ] Un interruttore nell'app attiva o spegne il collegamento (ADR-0029).

#### NUT-019 · Promemoria pasti e acqua

Stato: proposto, rimandato all'app iOS · Origine: pkm

Accettazione:

- [ ] Notifica locale `Colazione?` vicino all'orario dello slot se non c'è
      un pasto né un "sì" per quello slot (ADR-0027); `Sì` e `Rimanda`
      funzionano dalla notifica.
- [ ] Notifica acqua a orari fissi se si è sotto la quota proporzionata
      all'ora.
- [ ] Orari degli slot modificabili e salvati sul server.

#### NUT-026 · Dati da Apple Salute

Stato: pianificato (#209) · Origine: nuovo · Serve a NUT-018 (IOS-040 dell'app iOS)

Le rotte con cui l'app iOS manda al backend ciò che legge da Salute.

Accettazione:

- [ ] `POST /nutrition/health/samples` riceve un elenco di campioni:
      tipo (`weight` in kg, `water` in ml, `active_energy` in kcal),
      istante, valore e l'id del campione di Salute.
- [ ] I campioni già ricevuti (stesso id) non si duplicano; un invio
      ripetuto non cambia nulla.
- [ ] Il peso di Salute diventa il peso di riferimento al posto di quello
      di YAZIO (NUT-024) e compare nell'andamento (NUT-017) del web e
      dell'app.
- [ ] L'acqua di Salute entra nel contatore del giorno (NUT-012) con
      fonte `Salute`, senza contare due volte quella già inviata a Salute
      da ron1nOS.
- [ ] L'energia attiva di Salute vale per la quota (NUT-016) solo se
      YAZIO non la dà.
- [ ] `GET /nutrition/health/status` dice se e quando sono arrivati dati
      da Salute; la pagina Integrazioni del web lo mostra.
- [ ] Rotte in `api/openapi.yaml`, validate con zod, con test.

#### NUT-027 · Orari dei promemoria

Stato: fatto (#PR) · Origine: nuovo · Serve a NUT-019 (IOS-041 dell'app iOS)

Accettazione:

- [x] Le preferenze (SET-002) hanno una sezione `reminders`: orario
      `HH:MM` per ognuno dei 5 slot e un elenco di orari per l'acqua.
- [x] Predefiniti: colazione 07:30, spuntino 10:30, pranzo 13:00,
      merenda 16:30, cena 20:00; acqua 10:00, 13:00, 16:00, 19:00.
- [x] `PATCH /preferences` valida gli orari; `api/openapi.yaml`
      aggiornato, con test.
- [x] Le notifiche le programma solo l'app: il backend salva gli orari e
      basta.
- [x] Gli orari viaggiano nel backup della configurazione (SET-011); un
      backup di prima non li ha e riporta i predefiniti.

### YAZIO

#### NUT-020 · Collegamento all'account YAZIO

Stato: fatto (#61) · Origine: nuovo

Accettazione:

- [ ] In Impostazioni lo stato del collegamento: `collegato`,
      `non collegato`, `errore` con il motivo, ora dell'ultima
      sincronizzazione.
- [ ] Le credenziali YAZIO stanno solo sul server (vedi "Analisi
      integrazione YAZIO", Credenziali), mai nei client.
- [ ] Prerequisito: l'account oggi entra con Apple o Google, quindi va
      impostata una password nell'app YAZIO prima del collegamento.
- [ ] `Sincronizza ora` forza un giro di NUT-022 e NUT-023.
- [ ] Un interruttore spegne la sincronizzazione senza perdere dati.

#### NUT-021 · Catalogo YAZIO nella ricerca

Stato: fatto (#63) · Origine: nuovo

Accettazione:

- [ ] Con YAZIO collegato, la ricerca (NUT-004) include i prodotti YAZIO
      nel paese `IT`, lingua `it_IT`.
- [ ] Un alimento preso da YAZIO conserva il suo `product_id` YAZIO, così
      l'invio (NUT-023) lo registra come prodotto vero.

#### NUT-022 · Lettura dal diario YAZIO

Stato: fatto (#64) · Origine: nuovo

Ciò che si registra direttamente nell'app YAZIO compare in ron1nOS.

Accettazione:

- [ ] Ogni 15 minuti, e a richiesta, il backend legge il diario YAZIO
      degli ultimi 3 giorni.
- [ ] Le voci nuove entrano nel diario con fonte `YAZIO`; quelle cancellate
      in YAZIO spariscono anche qui.
- [ ] Le voci inviate da ron1nOS (NUT-023) non tornano indietro doppie.
- [ ] Conflitti: se una voce è cambiata sia in YAZIO sia in ron1nOS fra
      due letture, vince sempre YAZIO e la riga di ron1nOS si aggiorna;
      l'eventuale modifica di ron1nOS ancora in coda si scarta.
- [ ] Lo slot `snack` di YAZIO diventa `Spuntino` prima delle 15:00,
      `Merenda` dopo.
- [ ] Acqua: vale il totale del giorno di YAZIO.

#### NUT-023 · Scrittura sul diario YAZIO

Stato: fatto (#65) · Origine: nuovo

Ciò che si registra in ron1nOS (web o iOS) finisce anche in YAZIO.

Accettazione:

- [ ] Ogni riga di pasto registrata, modificata o cancellata in ron1nOS si
      riflette in YAZIO entro un minuto.
- [ ] `Spuntino` e `Merenda` diventano `snack` (YAZIO ha 4 slot).
- [ ] Un alimento con `product_id` YAZIO va come prodotto.
- [ ] Un alimento di OpenFoodFacts o USDA va come il prodotto YAZIO
      equivalente: per codice a barre se c'è, altrimenti per nome e marca.
      L'abbinamento si salva sull'alimento e si riusa.
- [ ] Se non c'è un equivalente, la riga resta solo in ron1nOS con stato
      `senza equivalente` e si può abbinare a mano (proposta).
- [ ] L'acqua va come totale cumulativo del giorno.
- [ ] Se YAZIO non risponde, la voce resta in coda e riprova; il diario di
      ron1nOS non si blocca mai e vale finché YAZIO non torna.
- [ ] Ogni riga mostra lo stato di sincronizzazione (inviata, in coda,
      errore).

#### NUT-024 · Obiettivi, esercizi e peso da YAZIO

Stato: fatto (#62) · Origine: nuovo

Accettazione:

- [ ] A ogni sincronizzazione si leggono obiettivo kcal e macro (NUT-015),
      attività del giorno (NUT-016) e le pesate nuove (NUT-017).
- [ ] Un obiettivo cambiato in YAZIO apre una nuova riga di storico con la
      data del giorno.
- [ ] Il peso di YAZIO è il peso di riferimento finché non arriva Apple
      Salute (NUT-018).

### Migrazione

#### NUT-025 · Import dei dati di 1r0-pkm

Stato: rimosso · Origine: nuovo

pkm conteneva solo dati di prova: si parte puliti e i dati veri arrivano
da YAZIO.

## Note

### Architettura

Il modulo usa il backend di ron1nOS (issue #4, BFF con `/api/v1` e
OpenAPI in `api/openapi.yaml`), come Download e Server. È però il primo
modulo con dati propri, quindi porta due cose nuove:

- **Postgres.** Un database `ron1nos`, con il suo utente, nel Postgres
  condiviso del server che serve tutte le app ron1n (stack in `infra/` di
  ron1n, immagine con tag esplicito, senza dump automatici). Lo schema riparte dalle migrazioni di
  pkm (`0004`, `0006`…`0008`, `0010`) unite in una sola, senza `snack` e
  `phase_linked`, più le tabelle dei template e le colonne YAZIO.
  Migrazioni SQL semplici in `api/migrations/`, applicate all'avvio.
- **Lavori in background.** Un ciclo nel processo del BFF per la
  sincronizzazione YAZIO (lettura ogni 15 minuti, coda di scrittura).
  Niente servizi separati finché basta.

Tutta la logica sta nel backend: calcolo di macro e quota, applicazione
dei template, generazione della spesa, aderenza, mappatura YAZIO e
abbinamento dei prodotti. I client
mostrano e inviano. In pkm l'app iOS era offline-first con una coda locale
(ADR-0006): la futura app iOS ron1nOS può tenere una coda per le scritture
fatte senza rete, ma le regole restano sul server.

### Endpoint proposti

Tutti sotto `/api/v1/nutrition`. Le date sono giorni locali
`Europe/Rome` (`YYYY-MM-DD`).

| Metodo e rotta                                    | Uso                               | Requisiti     |
| ------------------------------------------------- | --------------------------------- | ------------- |
| `GET /day?date=`                                  | giorno completo: slot, totali     | 001, 002, 016 |
| `GET /foods/search?q=&country=`                   | ricerca su tutte le fonti         | 004, 021      |
| `GET /foods/barcode/{code}`                       | ricerca per codice                | 005           |
| `POST /foods`, `PATCH`/`DELETE /foods/{id}`       | alimenti personali                | 006           |
| `POST /meals`, `PATCH`/`DELETE /meal-items/{id}`  | registrare e correggere           | 003, 007      |
| `GET`/`POST`/`DELETE /recipes`                    | ricette                           | 008           |
| `POST /planned-meals`, `PATCH …/{id}`             | piano, interruttore mangiato      | 009           |
| `GET`/`POST /templates`, `POST …/{id}/apply`      | template settimanali              | 010           |
| `GET`/`POST /shopping`, `POST /shopping/generate` | lista della spesa                 | 011           |
| `POST`/`DELETE /water`, `/caffeine`               | tracker                           | 012, 013      |
| `GET`/`POST /supplements`, `POST …/{id}/taken`    | integratori                       | 014           |
| `GET`/`POST /goals`                               | obiettivi (POST solo senza YAZIO) | 015           |
| `POST /health-samples`                            | dati di Salute, con l'app iOS     | 018           |
| `GET /report?days=30\|90`                         | andamento                         | 017           |
| `GET /yazio`, `POST /yazio/sync`, `PATCH /yazio`  | stato e controllo YAZIO           | 020, 024      |
| `PUT /foods/{id}/yazio-product`                   | abbinamento a mano                | 023           |

Le rotte di pkm (`/v1/meal-entries`, `/v1/planned-meals`…) restano un
riferimento per la logica, non si copiano uguali: pkm faceva upsert di
interi oggetti decisi dal client, qui il client manda l'intenzione
(`aggiungi alimento`, `segna mangiato`) e il server applica la regola.

### Analisi integrazione YAZIO

#### Cosa c'è

YAZIO non ha un'API pubblica. Le due repo indicate, più la libreria su cui
si basa la seconda, descrivono l'API privata usata dall'app:

| Repo                                                                    | Cos'è                                                      | Stato                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| [saganos/yazio_public_api](https://github.com/saganos/yazio_public_api) | `swagger.json` ricavato dal traffico dell'app, esempi Node | documenta `v15`, ultimo aggiornamento giugno 2026, MIT |
| [fliptheweb/yazio-mcp](https://github.com/fliptheweb/yazio-mcp)         | server MCP (Claude, Cursor) con 12 strumenti               | v0.0.14, giugno 2026, MIT                              |
| [juriadams/yazio](https://github.com/juriadams/yazio)                   | client TypeScript senza dipendenze, usato da yazio-mcp     | v1.1.3, punta già a `v20`, licenza non dichiarata      |

L'MCP non serve al backend: è un adattatore per un assistente AI. Si può
usare a parte (Claude Desktop sul Mac) per interrogare YAZIO a voce, ma la
sincronizzazione di ron1nOS parla direttamente con l'API.

#### Cosa permette

| Area         | Lettura                                                                        | Scrittura                                    |
| ------------ | ------------------------------------------------------------------------------ | -------------------------------------------- |
| Diario       | `GET /user/consumed-items?date=`: prodotti, porzioni di ricetta, voci semplici | `POST /user/consumed-items`, `DELETE` per id |
| Riepilogo    | `GET /user/widgets/daily-summary?date=`                                        | no                                           |
| Acqua        | `GET /user/water-intake?date=`                                                 | `POST`, valore **cumulativo** del giorno     |
| Prodotti     | `GET /products/search` (anche per EAN), `GET /products/{id}`                   | no (creare prodotti non è documentato)       |
| Ricette      | `GET /user/recipes`, `GET /recipes/{id}`                                       | solo `DELETE`                                |
| Obiettivi    | `GET /user/goals`                                                              | no                                           |
| Peso         | `GET /user/bodyvalues/weight/last?date=`, storico `?start=&end=`               | no                                           |
| Esercizi     | `GET /user/exercises?date=`                                                    | no                                           |
| Suggerimenti | `GET /user/products/suggested`                                                 | no                                           |

Punti che condizionano il disegno:

- **4 slot contro 5.** YAZIO ha `breakfast`, `lunch`, `dinner`, `snack`.
  In uscita Spuntino e Merenda diventano `snack`; in entrata `snack` si
  divide con l'ora (NUT-022). Un pasto spostato da Spuntino a Merenda in
  ron1nOS per YAZIO non cambia.
- **Prodotti.** Una voce "prodotto" richiede un `product_id` del catalogo
  YAZIO. Per gli alimenti presi da OpenFoodFacts o USDA si cerca
  l'equivalente nel catalogo YAZIO (decisione 3); `simple_products` resta
  fuori. Non c'è una ricerca per codice a barre: l'EAN passato a
  `/products/search` trova il prodotto (vedi "Esito della prova").
- **Id lato client.** Le voci del diario hanno un `id` UUID scelto da chi
  scrive: ron1nOS può usare lo stesso UUID della sua riga, e questo rende
  facile non duplicare in lettura.
- **Acqua cumulativa.** Si scrive il totale del giorno, non l'aggiunta;
  chi scrive per ultimo vince.
- **Niente notifiche di modifica.** Si legge solo a intervalli; una voce
  cambiata in YAZIO arriva al giro successivo e, in caso di conflitto,
  sovrascrive quella di ron1nOS.

#### Autenticazione

OAuth2 `password grant` su `POST /oauth/token`, con `client_id` e
`client_secret` dell'app YAZIO (pubblicati nei repo) più email e password
dell'account. Il token vale 48 ore (`expires_in: 172800`) e si rinnova con
`refresh_token`.

Conseguenze:

- serve un account YAZIO con email e password: con accesso solo via Apple
  o Google non funziona, bisogna prima impostare una password in YAZIO
  (è il caso dell'account attuale);
- se YAZIO cambia `client_id`/`client_secret` (basta un aggiornamento
  dell'app) il login smette di funzionare finché non si aggiornano.

#### Credenziali

Proposta, dalla più sicura che resta pratica:

- email e password in `.env` dello stack ron1nOS (`YAZIO_USERNAME`,
  `YAZIO_PASSWORD`), non versionato; nel repo solo `.env.example`;
- il backend usa la password solo per il primo login o quando il refresh
  fallisce; tiene `access_token` e `refresh_token` in Postgres, cifrati con
  una chiave in `.env` (`YAZIO_TOKEN_KEY`), così un dump del database da
  solo non basta;
- nessuna credenziale passa ai client né compare nei log; l'endpoint
  `GET /yazio` restituisce solo lo stato;
- password YAZIO usata solo per YAZIO, diversa da tutte le altre.

Alternativa scartata: inserire email e password da una pagina della
dashboard. Comodo, ma mette la password in transito nel browser e richiede
di salvarla in database.

#### Rischi

| Rischio                 | Probabilità | Effetto                                                                                                                     | Mitigazione                                                                                                                                            |
| ----------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Termini di servizio     | da valutare | l'uso di un'API non pubblica con le chiavi dell'app è quasi certamente fuori dai termini; nel caso peggiore account sospeso | uso personale, poche chiamate, nessuna redistribuzione; leggere i termini prima di attivare (dal server cloud il sito yazio.com non era raggiungibile) |
| L'API cambia            | alta        | la sync smette di funzionare (già successo: swagger `v15`, libreria `v20`)                                                  | adattatore unico (`yazio/`) con validazione delle risposte, errore visibile in NUT-020, il diario di ron1nOS continua da solo                          |
| Chiavi dell'app ruotate | media       | login impossibile                                                                                                           | `client_id`/`client_secret` in `.env`, non nel codice                                                                                                  |
| Limiti di frequenza     | sconosciuta | errori 429, blocco temporaneo                                                                                               | lettura ogni 15 minuti su 3 giorni, scritture in coda con attesa crescente                                                                             |
| Dati incoerenti         | media       | doppioni o voci perse fra i due diari                                                                                       | UUID condivisi, YAZIO vince sempre nei conflitti, ron1nOS tiene la copia completa per quando YAZIO non risponde                                        |
| Equivalenti sbagliati   | media       | in YAZIO finisce un prodotto con valori diversi da quelli registrati                                                        | abbinamento per codice a barre prima del nome, abbinamento salvato e correggibile a mano                                                               |
| Furto delle credenziali | bassa       | accesso al diario YAZIO                                                                                                     | `.env` sul server, token cifrati, accesso solo da Tailscale                                                                                            |

Il punto chiave: YAZIO ha la priorità ma è un'integrazione **fragile**.
Quando funziona comanda lui; quando è spento o rotto il modulo continua
per intero con la copia di ron1nOS, che si riallinea al ritorno di YAZIO.

#### Libreria

Proposta: un adattatore nostro (`api/src/yazio/`) di poche centinaia di
righe, con le chiamate che servono e schemi zod sulle risposte, scritto
leggendo lo swagger e `juriadams/yazio`. Non come dipendenza perché la
libreria non dichiara una licenza e così il punto che si rompe è uno solo
e lo controlliamo noi.

#### Esito della prova

Fatta il 2026-10-21 con l'account vero e
[`scripts/yazio-probe`](../../scripts/yazio-probe/README.md), anche con
`--write`. Esito: **integrazione fattibile**, il disegno resta com'è salvo
NUT-016.

| Prova                 | Esito                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Login                 | `v15` e `v20` accettano email e password; token di 48 ore, il refresh funziona                                         |
| Obiettivo ed esercizi | il riepilogo somma già l'energia attiva: base 2021 kcal, obiettivo del giorno 2098 senza esercizi registrati (NUT-016) |
| Diario                | lettura di 3 giorni ok; scrittura di una voce con UUID nostro, rilettura con lo stesso id e cancellazione: tutto ok    |
| Ricerca per nome (IT) | 50 risultati per richiesta; in testa anche voci tedesche ("Banane" per "pane"): il riordino spetta a noi (NUT-021)     |
| Codice a barre        | `/products/barcode/{ean}` e `/products/ean/{ean}` danno 404; l'EAN in `/products/search` trova i 2 prodotti provati    |
| Acqua                 | lettura e scrittura ok: si scrive `[{ date, water_intake }]` e il totale del giorno si aggiorna (0 → 250 ml)           |
| Peso                  | `weight/last` vuole `date`; lo storico `?start=&end=` (non documentato) dà `{ date, value }`                           |

Il 2026-10-23 YAZIO ha bloccato la `v20` per i dati utente: login e ricerca
rispondono, ogni `/user/*` dà `403 version_blocked`. ron1nOS usa la `v15`
(default di `YAZIO_URL`) e mostra una versione bloccata come errore in
NUT-020.

Resta aperto, senza bloccare:

- la forma delle voci vere (porzioni, ricette, voci semplici): il diario
  provato era vuoto, si rilancia lo script dopo qualche pasto registrato;
- limiti di frequenza: 31 chiamate senza errori, il tetto resta ignoto;
- termini di servizio, come in "Rischi".

### Piano di lavoro

pkm è deprecata (decisione 5): da lì si prendono documentazione, regole e
pezzi di codice, ma nessun dato. Ordine proposto:

1. **Specifica** (questa PR), confermata.
2. **Prova YAZIO** con l'account vero, fatta il 2026-10-21: fattibile,
   NUT-023 resta com'è e NUT-016 prende la quota dal riepilogo di YAZIO
   (vedi "Esito della prova").
3. **Base dati**: database `ron1nos` nel Postgres condiviso, schema unito
   da pkm, migrazioni all'avvio. Dipende dal BFF (#4).
4. **API**: rotte di NUT-001…017 con OpenAPI. La logica di pkm da portare
   nel backend:
   - `foodsearch.js` (OpenFoodFacts, USDA, filtro Italia): quasi uguale;
   - `NutritionMath` (macro, quota, acqua) e `DietReport` (serie,
     aderenza, tendenza) da Swift a TypeScript, con gli stessi test di
     `NutritionMathTests`, senza la parte TDEE;
   - `DietSync.applyTemplate`, `generateShoppingList`, `deleteMealItem`,
     `setPlannedMealEaten`: da Swift a regole lato server.
5. **Web**: widget e pagina `/pasti`, compresi template e spesa, un pezzo
   per issue.
6. **YAZIO**: NUT-020…024.
7. **iOS**: quando arriva l'app ron1nOS iOS, NUT-018 e NUT-019, riusando
   da pkm viste SwiftUI, HealthKit, promemoria e scanner.

Mockup approvati il 2026-10-21:
[canvas Modulo Nutrizione](https://claude.ai/artifact/DaU9UXLfJAmKfES2zz5rdZ)
(widget in tre stati, pagina `/pasti`, registrazione di un pasto, template,
ricette e spesa, andamento, impostazioni YAZIO).

### Rapporto con gli altri moduli

- **Peso** (`src/modules/weight`): per ora il peso arriva da YAZIO
  (NUT-024), più avanti da Salute via iOS (NUT-018), e serve all'andamento
  (NUT-017). Il modulo Peso avrà la sua specifica e può leggere lo stesso
  storico.
- **Allenamento**: nessun legame (la modalità legata alla scheda è tolta).

### Decisioni

Prese il 2026-10-21.

1. **Requisiti.** Confermati NUT-001…014, NUT-017, NUT-020…024 (con le
   modifiche che seguono). NUT-015 e NUT-016 cambiati, NUT-018 e NUT-019
   rimandati all'app iOS, NUT-025 rimosso.
2. **Fonte di verità.** Ibrida con priorità a YAZIO: nei conflitti vince
   sempre YAZIO e ron1nOS si aggiorna; se YAZIO non risponde vale la copia
   di ron1nOS, che ha già importato tutto.
3. **Voci OFF/USDA verso YAZIO.** Si invia il prodotto YAZIO equivalente.
4. **Account YAZIO.** Oggi accesso con Apple/Google: va impostata una
   password in YAZIO prima del collegamento.
5. **pkm.** Deprecata, usata solo per prova: nessun import, si parte
   puliti.
6. **Postgres.** Condiviso dal server per tutte le app.
7. **Template e spesa.** Dal primo giro, insieme al diario.
8. **Obiettivo.** Da YAZIO; manuale solo senza YAZIO; niente TDEE.
9. **Quota.** Energia attiva da YAZIO, non da Salute: quella che il
   riepilogo del giorno somma già all'obiettivo (aggiornata dopo la prova).
10. **Peso.** Da YAZIO, con lo storico importato al collegamento e
    aggiornato a ogni sincronizzazione (corretto dopo la prova: lo storico
    c'è).
