# Nutrizione

Prefisso ID: `NUT` · Label: `mod:nutrition`

Il modulo tiene il diario alimentare: cosa si mangia nei 5 pasti del
giorno, calorie e macro rispetto all'obiettivo, piano settimanale, ricette,
lista della spesa, acqua, caffeina e integratori. Si sincronizza con YAZIO
in lettura e scrittura.

Riprende quasi tutto il modulo `1r0-diet` di
[1r0-pkm](https://github.com/1r0n51uv/1r0-pkm) (ADR-0017…0037), con una
differenza di fondo: in pkm la logica sta nell'app iOS (SwiftData, outbox,
calcoli lato client) e il backend è un archivio. Qui la logica sta nel
backend di ron1nOS (`/api/v1`), che serve allo stesso modo la dashboard web
e la futura app iOS: i due client sono intercambiabili.

Non fa, per ora: riconoscimento del piatto da foto, notifiche dal server,
più utenti, collegamento con altre app oltre a YAZIO e Apple Salute.

**Stato del documento: bozza da confermare.** Ogni requisito è `proposto`
e porta l'origine: **pkm** (già pensato o fatto in 1r0-pkm), **pkm,
cambia** (ripreso con modifiche) o **nuovo**. Le domande aperte sono in
fondo, in "Da decidere". Le issue si creano solo dopo la conferma.

## Requisiti

### Diario del giorno

#### NUT-001 · Widget Nutrizione

Stato: proposto · Origine: pkm, cambia

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

Stato: proposto · Origine: pkm, cambia

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

Stato: proposto · Origine: pkm

Si aggiunge un alimento a uno slot di un giorno qualsiasi.

Accettazione:

- [ ] Ricerca per nome con almeno 2 caratteri, risultati da NUT-004.
- [ ] Quantità in grammi, con le kcal e i macro calcolati mentre si scrive.
- [ ] Più alimenti nello stesso pasto, ognuno con la sua quantità.
- [ ] Le kcal e i macro di ogni riga si salvano al momento (snapshot): se
      l'alimento viene corretto dopo, lo storico non cambia.
- [ ] Lo slot proposto è quello dell'ora corrente.

#### NUT-004 · Ricerca alimenti

Stato: proposto · Origine: pkm, cambia

Il backend cerca in più fonti e unisce i risultati, senza duplicati per
nome.

Accettazione:

- [ ] Fonti: alimenti già usati (catalogo locale), OpenFoodFacts, USDA
      FoodData Central, e catalogo YAZIO se collegato (NUT-021).
- [ ] Filtro `Solo Italia` attivo di default (OpenFoodFacts su
      `it.openfoodfacts.org`, ADR-0036).
- [ ] Un risultato esterno entra nel catalogo solo quando lo si usa.
- [ ] Ogni risultato mostra la fonte (`OFF`, `USDA`, `YAZIO`, `mio`).

#### NUT-005 · Codice a barre

Stato: proposto · Origine: pkm, cambia

Accettazione:

- [ ] Da web si inserisce il codice a mano; da iOS con la fotocamera.
- [ ] Il backend cerca prima nel catalogo locale, poi su OpenFoodFacts.
- [ ] Codice sconosciuto: si propone di creare l'alimento (NUT-006) con
      il codice già compilato.

#### NUT-006 · Alimenti personali

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Nome, kcal, proteine, carboidrati, grassi per 100 g; marca, porzione
      e codice a barre facoltativi.
- [ ] Si modificano e si eliminano; i pasti già registrati non cambiano.

#### NUT-007 · Correggere un pasto

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Si toglie un singolo alimento da un pasto mangiato; se era l'ultimo,
      il pasto sparisce e l'eventuale piano torna `saltato` (ADR-0037).
- [ ] Si aggiunge un alimento extra a un pasto già mangiato, anche di un
      giorno passato.
- [ ] Si cambia la quantità di una riga.

### Piano e ricette

#### NUT-008 · Ricette

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Una ricetta ha nome, note facoltative e alimenti con grammi.
- [ ] Mostra kcal e macro totali.
- [ ] Si usa per registrare (NUT-003) o pianificare (NUT-009) un pasto in
      un colpo.

#### NUT-009 · Pianificare un pasto

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Si pianifica una ricetta o una lista di alimenti su giorno e slot,
      nel passato o nel futuro.
- [ ] Un interruttore segna il pasto `mangiato` (crea le righe del diario)
      o `saltato`. Spegnerlo da `mangiato` cancella le righe collegate
      (ADR-0032).
- [ ] Un pasto pianificato si modifica finché non è `mangiato`.

#### NUT-010 · Template settimanale

Stato: proposto · Origine: pkm, cambia

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

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Si genera dai pasti pianificati di un intervallo di giorni,
      sommando i grammi dello stesso alimento.
- [ ] Voci manuali libere; tutte si spuntano e si eliminano.
- [ ] `Togli le spuntate` le elimina in blocco.
- [ ] Rigenerare aggiunge solo ciò che manca, non sovrascrive.

### Tracker

#### NUT-012 · Acqua

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Contatore del giorno in ml con `-` e `+` (250 ml); `-` annulla
      l'ultima voce di oggi (ADR-0037).
- [ ] Obiettivo in ml dall'obiettivo nutrizionale (NUT-015), con barra.

#### NUT-013 · Caffeina

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Contatore del giorno in mg con `-` e `+` (espresso, 80 mg).
- [ ] Alimenti con caffeina nel catalogo (`caffeine_mg_per_100g`) si sommano
      al totale quando si registrano.

#### NUT-014 · Integratori

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Elenco degli integratori attivi (nome, dose, quando).
- [ ] Checklist del giorno: spuntato o no per ognuno.
- [ ] Si aggiungono, si disattivano, si eliminano.

### Obiettivi e andamento

#### NUT-015 · Obiettivo nutrizionale

Stato: proposto · Origine: pkm, cambia

Accettazione:

- [ ] Obiettivo in kcal e grammi di proteine, carboidrati, grassi, più
      acqua in ml.
- [ ] Due modalità: `manuale` e `TDEE` (da peso e livello di attività:
      sedentario, moderato, attivo).
- [ ] Lo storico non si perde: ogni cambio aggiunge una riga con data di
      inizio (ADR-0019). Il report usa l'obiettivo valido in quel giorno.
- [ ] La modalità `fase della scheda` di pkm non c'è più: le schede di
      allenamento sono state tolte da pkm (ADR-0027).

#### NUT-016 · Quota del giorno

Stato: proposto · Origine: pkm, cambia

Accettazione:

- [ ] Quota = obiettivo di base + energia attiva del giorno, con un tetto
      di +1200 kcal (ADR-0019 emendata).
- [ ] L'energia attiva arriva da Apple Salute tramite l'app iOS (NUT-018);
      senza dato la quota è l'obiettivo di base.
- [ ] Il calcolo sta nel backend: web e iOS mostrano lo stesso numero.

#### NUT-017 · Andamento

Stato: proposto · Origine: pkm, cambia

Accettazione:

- [ ] Kcal e macro al giorno su 30 e 90 giorni, con media e tendenza.
- [ ] Aderenza: percentuale di giorni entro ±150 kcal dall'obiettivo del
      giorno.
- [ ] Peso sullo stesso asse temporale delle kcal (dal modulo Peso).
- [ ] Calcolato nel backend (in pkm era nel client).

### Apple Salute e promemoria (solo iOS)

#### NUT-018 · Apple Salute

Stato: proposto · Origine: pkm

Accettazione:

- [ ] L'app iOS scrive in Salute kcal e macro di ogni pasto.
- [ ] Legge peso, acqua ed energia attiva e li invia al backend, che li
      rende disponibili anche al web.
- [ ] Un interruttore nell'app attiva o spegne il collegamento (ADR-0029).

#### NUT-019 · Promemoria pasti e acqua

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Notifica locale `Colazione?` vicino all'orario dello slot se non c'è
      un pasto né un "sì" per quello slot (ADR-0027); `Sì` e `Rimanda`
      funzionano dalla notifica.
- [ ] Notifica acqua a orari fissi se si è sotto la quota proporzionata
      all'ora.
- [ ] Orari degli slot modificabili e salvati sul server.

### YAZIO

#### NUT-020 · Collegamento all'account YAZIO

Stato: proposto · Origine: nuovo

Accettazione:

- [ ] In Impostazioni lo stato del collegamento: `collegato`,
      `non collegato`, `errore` con il motivo, ora dell'ultima
      sincronizzazione.
- [ ] Le credenziali YAZIO stanno solo sul server (vedi "Analisi
      integrazione YAZIO", Credenziali), mai nei client.
- [ ] `Sincronizza ora` forza un giro di NUT-022 e NUT-023.
- [ ] Un interruttore spegne la sincronizzazione senza perdere dati.

#### NUT-021 · Catalogo YAZIO nella ricerca

Stato: proposto · Origine: nuovo

Accettazione:

- [ ] Con YAZIO collegato, la ricerca (NUT-004) include i prodotti YAZIO
      nel paese `IT`, lingua `it_IT`.
- [ ] Un alimento preso da YAZIO conserva il suo `product_id` YAZIO, così
      l'invio (NUT-023) lo registra come prodotto vero.

#### NUT-022 · Lettura dal diario YAZIO

Stato: proposto · Origine: nuovo

Ciò che si registra direttamente nell'app YAZIO compare in ron1nOS.

Accettazione:

- [ ] Ogni 15 minuti, e a richiesta, il backend legge il diario YAZIO
      degli ultimi 3 giorni.
- [ ] Le voci nuove entrano nel diario con fonte `YAZIO`; quelle cancellate
      in YAZIO spariscono anche qui.
- [ ] Le voci inviate da ron1nOS (NUT-023) non tornano indietro doppie.
- [ ] Lo slot `snack` di YAZIO diventa `Spuntino` prima delle 15:00,
      `Merenda` dopo.
- [ ] Acqua: si importa il totale del giorno se è maggiore di quello di
      ron1nOS.

#### NUT-023 · Scrittura sul diario YAZIO

Stato: proposto · Origine: nuovo

Ciò che si registra in ron1nOS (web o iOS) finisce anche in YAZIO.

Accettazione:

- [ ] Ogni riga di pasto registrata, modificata o cancellata in ron1nOS si
      riflette in YAZIO entro un minuto.
- [ ] `Spuntino` e `Merenda` diventano `snack` (YAZIO ha 4 slot).
- [ ] Un alimento con `product_id` YAZIO va come prodotto; gli altri vanno
      come voce semplice con nome e nutrienti (da verificare, vedi Analisi).
- [ ] L'acqua va come totale cumulativo del giorno.
- [ ] Se YAZIO non risponde, la voce resta in coda e riprova; il diario di
      ron1nOS non si blocca mai.
- [ ] Ogni riga mostra lo stato di sincronizzazione (inviata, in coda,
      errore).

#### NUT-024 · Obiettivi e peso da YAZIO

Stato: proposto · Origine: nuovo

Accettazione:

- [ ] `Importa da YAZIO` copia l'obiettivo kcal e macro di YAZIO in un
      nuovo obiettivo manuale (NUT-015), su richiesta, mai da solo.
- [ ] Il peso più recente di YAZIO si mostra in Impostazioni come
      confronto; il peso di riferimento resta quello di Salute.

### Migrazione

#### NUT-025 · Import dei dati di 1r0-pkm

Stato: proposto · Origine: nuovo

Accettazione:

- [ ] Uno script importa dal database `onepkm_prod` di pkm alimenti,
      ricette, pasti, piani, spesa, acqua, caffeina, integratori e
      obiettivi, mantenendo gli UUID.
- [ ] Le righe con slot `snack` (prima di ADR-0024) vanno in `Spuntino`
      prima delle 15:00, `Merenda` dopo.
- [ ] Rieseguirlo non duplica nulla.
- [ ] A fine import stampa i conteggi per tabella, confrontabili con pkm.

## Note

### Architettura

Il modulo usa il backend di ron1nOS (issue #4, BFF con `/api/v1` e
OpenAPI in `api/openapi.yaml`), come Download e Server. È però il primo
modulo con dati propri, quindi porta due cose nuove:

- **Postgres.** Un database nello stack di ron1nOS (`infra/ron1nos` in
  ron1n), immagine con tag esplicito, volume in `/srv/ron1nos/pg`, dump
  notturno con il backup del server. Lo schema riparte dalle migrazioni di
  pkm (`0004`, `0006`…`0008`, `0010`) unite in una sola, senza `snack` e
  `phase_linked`, più le tabelle dei template e le colonne YAZIO.
  Migrazioni SQL semplici in `api/migrations/`, applicate all'avvio.
- **Lavori in background.** Un ciclo nel processo del BFF per la
  sincronizzazione YAZIO (lettura ogni 15 minuti, coda di scrittura).
  Niente servizi separati finché basta.

Tutta la logica sta nel backend: calcolo di macro e quota, applicazione
dei template, generazione della spesa, aderenza, mappatura YAZIO. I client
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
| `GET`/`POST /goals`                               | obiettivi                         | 015           |
| `POST /health-samples`                            | energia attiva, peso, acqua (iOS) | 016, 018      |
| `GET /report?days=30\|90`                         | andamento                         | 017           |
| `GET /yazio`, `POST /yazio/sync`, `PATCH /yazio`  | stato e controllo YAZIO           | 020, 024      |

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
| Prodotti     | `GET /products/search`, `GET /products/{id}`                                   | no (creare prodotti non è documentato)       |
| Ricette      | `GET /user/recipes`, `GET /recipes/{id}`                                       | solo `DELETE`                                |
| Obiettivi    | `GET /user/goals`                                                              | no                                           |
| Peso         | `GET /user/bodyvalues/weight/last` (solo l'ultimo)                             | no                                           |
| Esercizi     | `GET /user/exercises?date=`                                                    | no                                           |
| Suggerimenti | `GET /user/products/suggested`                                                 | no                                           |

Punti che condizionano il disegno:

- **4 slot contro 5.** YAZIO ha `breakfast`, `lunch`, `dinner`, `snack`.
  In uscita Spuntino e Merenda diventano `snack`; in entrata `snack` si
  divide con l'ora (NUT-022). Un pasto spostato da Spuntino a Merenda in
  ron1nOS per YAZIO non cambia.
- **Prodotti.** Una voce "prodotto" richiede un `product_id` del catalogo
  YAZIO. Per gli alimenti presi da OpenFoodFacts o USDA ci sono due strade:
  inviarli come `simple_products` (nome e nutrienti, come l'aggiunta rapida
  dell'app) oppure cercarne l'equivalente YAZIO. La forma di
  `simple_products` in scrittura è nello schema della libreria ma non
  provata da nessuno dei repo: va verificata con un account vero prima di
  pianificare NUT-023.
- **Id lato client.** Le voci del diario hanno un `id` UUID scelto da chi
  scrive: ron1nOS può usare lo stesso UUID della sua riga, e questo rende
  facile non duplicare in lettura.
- **Acqua cumulativa.** Si scrive il totale del giorno, non l'aggiunta;
  chi scrive per ultimo vince.
- **Niente notifiche di modifica.** Si legge solo a intervalli; una voce
  cambiata in YAZIO arriva al giro successivo.

#### Autenticazione

OAuth2 `password grant` su `POST /oauth/token`, con `client_id` e
`client_secret` dell'app YAZIO (pubblicati nei repo) più email e password
dell'account. Il token vale 48 ore (`expires_in: 172800`) e si rinnova con
`refresh_token`.

Conseguenze:

- serve un account YAZIO con email e password: con accesso solo via Apple
  o Google non funziona, bisogna prima impostare una password in YAZIO;
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
| Dati incoerenti         | media       | doppioni o voci perse fra i due diari                                                                                       | UUID condivisi, ron1nOS fonte di verità, YAZIO specchio con import delle voci nate lì                                                                  |
| Furto delle credenziali | bassa       | accesso al diario YAZIO                                                                                                     | `.env` sul server, token cifrati, accesso solo da Tailscale                                                                                            |

Il punto chiave: YAZIO è un'integrazione **facoltativa e fragile**. Il
modulo deve funzionare per intero anche con YAZIO spento o rotto, per
questo ron1nOS resta la fonte di verità e YAZIO si aggiunge sopra.

#### Libreria

Proposta: un adattatore nostro (`api/src/yazio/`) di poche centinaia di
righe, con le chiamate che servono e schemi zod sulle risposte, scritto
leggendo lo swagger e `juriadams/yazio`. Non come dipendenza perché la
libreria non dichiara una licenza e così il punto che si rompe è uno solo
e lo controlliamo noi.

### Piano di migrazione da pkm

pkm resta una beta (decisione del 2026-10-20): da lì si prendono
documentazione, regole e pezzi di codice. Ordine proposto:

1. **Specifica** (questa PR) e conferma delle funzionalità.
2. **Base dati**: Postgres nello stack ron1nOS, schema unito da pkm,
   migrazioni all'avvio. Dipende dal BFF (#4).
3. **API**: rotte di NUT-001…017 con OpenAPI. La logica di pkm da portare
   nel backend:
   - `foodsearch.js` (OpenFoodFacts, USDA, filtro Italia): quasi uguale;
   - `NutritionMath` (TDEE, macro, quota, acqua) e `DietReport` (serie,
     aderenza, tendenza) da Swift a TypeScript, con gli stessi test di
     `NutritionMathTests`;
   - `DietSync.applyTemplate`, `generateShoppingList`, `deleteMealItem`,
     `setPlannedMealEaten`: da Swift a regole lato server.
4. **Web**: widget e pagina `/pasti`, un pezzo per issue.
5. **Import da pkm** (NUT-025): `pg_dump` di `onepkm_prod` dall'EC2 e
   script di import. I template di pkm stanno solo nel telefono (SwiftData)
   e non sono nel database: vanno ricreati a mano (sono pochi).
6. **YAZIO**: prima una prova con un account vero (login, lettura, scrittura
   di una voce semplice), poi NUT-020…024.
7. **iOS**: quando arriva l'app ron1nOS iOS, riusa da pkm viste SwiftUI,
   HealthKit, promemoria e scanner, ma parla con `/api/v1`.

Fino al passo 7 l'app pkm resta com'è sull'EC2. Il giorno del passaggio
si fa l'ultimo import e pkm smette di scrivere: niente doppia scrittura
fra i due backend.

### Rapporto con gli altri moduli

- **Peso** (`src/modules/weight`): il peso arriva da Salute via iOS
  (NUT-018) e serve a TDEE (NUT-015) e all'andamento (NUT-017). Il modulo
  Peso avrà la sua specifica; qui si legge e basta.
- **Allenamento**: nessun legame (la modalità legata alla scheda è tolta).

### Da decidere

Domande per il proprietario, con la proposta segnata. Le risposte vanno in
una sezione "Decisioni".

1. Funzionalità: per ognuna di NUT-001…025, confermare, modificare o
   togliere.
2. Fonte di verità: ron1nOS con YAZIO specchio e import delle voci nate in
   YAZIO (proposta), oppure YAZIO come diario principale e ron1nOS che
   legge.
3. Account YAZIO: ha email e password, o accede con Apple/Google?
4. Voci OFF/USDA verso YAZIO: voce semplice con nutrienti (proposta, da
   verificare), cercare l'equivalente nel catalogo YAZIO, o non inviarle.
5. Postgres: nello stack ron1nOS (proposta) o un Postgres condiviso del
   server per tutte le app.
6. pkm: continua a usarla ogni giorno fino all'app iOS ron1nOS (import
   finale al passaggio, proposta) o import subito e pkm si ferma.
7. Template e spesa via web: necessari dal primo giro o dopo il diario.
