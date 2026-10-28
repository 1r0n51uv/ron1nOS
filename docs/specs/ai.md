# AI

Prefisso ID: `AI` · Label: `mod:ai`

Il modulo porta in ron1nOS due cose:

- **un assistente**: una chat che risponde e agisce usando i moduli
  (Nutrizione, Allenamento, Peso, Documenti, Download, Server, e Casa
  quando esisterà). "Quante proteine mi mancano oggi?", "metti in pausa i
  download", "come sta il disco?";
- **degli agenti**: compiti ripetibili con un obiettivo e un elenco di
  strumenti consentiti, avviati a mano o a orario. "Alle 21 riepiloga la
  giornata alimentare", "avvisami se il disco supera il 90%".

Sicurezza zero trust: assistente e agenti non ereditano mai i permessi
dell'utente. Ognuno è un'identità a sé con i suoi permessi, concessi uno
per uno; tutto ciò che non è concesso è negato, e ogni chiamata si verifica
di nuovo nel backend, non nel modello (sezione "Identità e permessi").

Assistente e agenti non hanno logica propria sui dati: usano le stesse
operazioni di `/api/v1` che usano la dashboard e l'app iOS, scelte e
descritte in `api/openapi.yaml`. La logica sta nel backend, come per gli
altri moduli; il browser mostra la chat e le conferme.

Tutto è gratuito (regola del progetto): il motore predefinito è un modello
locale con Ollama sul mini PC; un'API esterna con piano gratuito è
facoltativa e non riceve mai i dati sensibili.

Non fa, per ora: voce, ricerca sul web, lettura degli allegati (immagini e
PDF, serve l'OCR, rimandato anche in Documenti), agenti avviati da eventi dei moduli, server MCP, parità iOS
(seconda fase, requisiti `IOS-1xx` in ron1nos-ios).

**Stato del documento: in revisione dal 2026-10-28 (zero trust), mockup da
fare.**
Le scelte sono in fondo, in "Decisioni".

## Requisiti

### Motore

#### AI-001 · Motore configurabile

Stato: proposto

Accettazione:

- [ ] Il backend parla con il motore attraverso un'unica interfaccia
      compatibile OpenAI (chat completions con `tools` e streaming), così
      locale ed esterno si scambiano senza toccare il codice.
- [ ] Motore locale: Ollama, indirizzo e modello da `AI_LOCAL_URL` e
      `AI_LOCAL_MODEL` (predefinito un modello piccolo con tool calling,
      per esempio `qwen3:4b`).
- [ ] Motore esterno facoltativo con piano gratuito: Groq o Gemini, chiave
      in `AI_CLOUD_API_KEY`, fornitore e modello in `AI_CLOUD_PROVIDER` e
      `AI_CLOUD_MODEL`. Senza chiave l'opzione non compare.
- [ ] `Impostazioni › Moduli › AI` mostra lo stato di ogni motore
      (raggiungibile, modello, ultimo errore) e permette di scegliere il
      motore predefinito della chat. Le chiavi restano nel `.env`.
- [ ] Senza alcun motore raggiungibile il modulo si mostra spento, con il
      motivo.

#### AI-002 · Ollama sul server

Stato: proposto · Repo: ron1n

Accettazione:

- [ ] Stack `infra/ollama/compose.yaml` nell'hub, immagine con tag
      esplicito, modelli in un volume su `/srv`, limite di memoria (6 GB)
      e di CPU perché non soffochi gli altri servizi.
- [ ] Non pubblicato da Caddy né dal tunnel: solo sulla rete Docker
      condivisa con `ron1nos`.
- [ ] `infra.sh` lo avvia prima di `ron1nos`; il bootstrap scarica il
      modello predefinito, il cleanup lo toglie insieme ai dati.

#### AI-003 · Dati sensibili solo in locale

Stato: proposto

Accettazione:

- [ ] Ogni strumento dichiara se tocca dati sensibili (Nutrizione, Peso,
      Allenamento, Documenti).
- [ ] Una conversazione o un agente sul motore esterno non riceve gli
      strumenti sensibili; se la domanda li richiede, la chat propone di
      continuare in locale.
- [ ] Il modello locale legge anche il contenuto dei documenti: il backend
      decifra i campi (di tipo e liberi) come fa per la dashboard. Gli
      allegati restano fuori: nessun file passa al modello.
- [ ] Il motore esterno non vede nulla di Documenti, neanche i nomi.

### Strumenti

#### AI-004 · Registro dall'OpenAPI

Stato: proposto

Accettazione:

- [ ] Le operazioni offerte all'AI hanno in `api/openapi.yaml`
      un'estensione `x-ai-tool` con tipo (`read`, `write`), sensibilità e
      una descrizione breve per il modello.
- [ ] Il backend costruisce all'avvio le definizioni degli strumenti dai
      parametri e dai body dell'OpenAPI; un test verifica che ogni
      `x-ai-tool` punti a una rotta esistente con schema valido.
- [ ] Lo strumento si esegue chiamando la rotta dentro il processo, con
      la stessa validazione zod e con il token dell'esecuzione (AI-020),
      mai con la sessione dell'utente: nessuna scorciatoia sul database.
- [ ] Le operazioni distruttive (eliminazioni) e le rotte del modulo AI
      stesso (`/api/v1/ai/*`) non sono strumenti.

#### AI-005 · Strumenti iniziali

Stato: proposto

Accettazione:

- [ ] Elenco del primo rilascio, nella tabella "Strumenti iniziali" in
      fondo. Ogni modulo nuovo (Casa, File) aggiunge i suoi con
      `x-ai-tool` nella propria PR.

#### AI-006 · Conferma delle scritture

Stato: proposto

Accettazione:

- [ ] Una chiamata `write` concessa in modalità `con conferma` (AI-021)
      non parte: crea un'azione in attesa con strumento, argomenti
      leggibili e l'agente che l'ha chiesta.
- [ ] Nella chat compare una scheda con il riepilogo e i pulsanti
      `Conferma` e `Annulla`; dagli agenti l'azione va nella casella
      (AI-016).
- [ ] Dopo la conferma l'esito torna al modello, che prosegue.
- [ ] Un'azione non confermata scade dopo 24 ore.

#### AI-007 · Registro delle azioni

Stato: proposto

Accettazione:

- [ ] Tabella `ai_actions`: origine (chat o agente), strumento, argomenti,
      esito, stato (`eseguita`, `in attesa`, `annullata`, `scaduta`,
      `errore`), orario.
- [ ] Pagina `/ai/registro` con filtro per origine e stato. Le letture si
      registrano solo come conteggio per turno, le scritture una per una.

### Identità e permessi

Principi: nessuna fiducia implicita, permesso minimo, verifica a ogni
chiamata, tutto registrato, revoca immediata. Il modello è trattato come
non fidato: può chiedere qualsiasi cosa, decide il backend.

#### AI-019 · Un'identità per agente

Stato: proposto

Accettazione:

- [ ] Ogni agente, compreso `Assistente`, è un principale distinto
      dall'utente, con un id stabile.
- [ ] Un agente nuovo nasce senza permessi: senza concessioni non vede
      nessuno strumento.

#### AI-020 · Token per esecuzione

Stato: proposto

Accettazione:

- [ ] Ogni esecuzione (un turno di chat o un avvio di agente) riceve un
      token `r1a_` legato ad agente ed esecuzione, valido al massimo per la
      durata dell'esecuzione (5 minuti) e revocato alla fine.
- [ ] Il token porta solo i permessi concessi in quel momento; un permesso
      tolto durante l'esecuzione vale dalla chiamata successiva.
- [ ] Il middleware di autenticazione di `/api/v1` lo accetta solo sulle
      rotte concesse; il resto risponde 403, anche se il modello inventa
      una chiamata.

#### AI-021 · Permessi per strumento

Stato: proposto

Accettazione:

- [ ] Una concessione lega un agente a uno strumento con una modalità:
      `lettura`, `scrittura con conferma` o `scrittura senza conferma`.
- [ ] Una concessione può avere vincoli sui parametri: valori ammessi,
      massimi o risorse precise (per esempio solo un tipo di documento,
      solo certi container, quantità massima di un alimento).
- [ ] Una concessione può avere una scadenza.
- [ ] Le concessioni su dati sensibili valgono solo con il motore locale:
      un agente sul motore esterno non può riceverle.
- [ ] Limiti per agente: chiamate per esecuzione, esecuzioni al giorno,
      durata massima.

#### AI-022 · Solo l'utente concede

Stato: proposto

Accettazione:

- [ ] Permessi e agenti si cambiano solo da `/ai/agenti` con la sessione
      dell'utente, mai con un token `r1a_` o `r1n_`.
- [ ] Concedere un permesso di scrittura chiede di nuovo la password.
- [ ] Nessun agente crea agenti, cambia permessi, legge le esecuzioni di
      altri agenti o li avvia.

#### AI-023 · Isolamento

Stato: proposto

Accettazione:

- [ ] Ogni agente ha la sua storia e la sua memoria; un'esecuzione vede
      solo i propri messaggi e gli esiti dei propri strumenti.
- [ ] Gli esiti degli strumenti arrivano al modello come dati, marcati
      come non fidati: un testo letto (nome di un torrent, campo di un
      documento, nome di un alimento) non può cambiare i permessi né le
      istruzioni dell'agente.

#### AI-024 · Registro per agente

Stato: proposto

Accettazione:

- [ ] Ogni chiamata, consentita o negata, si registra con agente,
      esecuzione, token, concessione usata, argomenti ed esito.
- [ ] Le chiamate negate compaiono in evidenza nella pagina dell'agente.

#### AI-025 · Revoca e blocco

Stato: proposto

Accettazione:

- [ ] Spegnere un agente o togliergli un permesso revoca subito i token
      attivi e interrompe l'esecuzione in corso.
- [ ] Pulsante `Ferma tutto` che spegne tutti gli agenti e revoca tutti i
      token `r1a_`.
- [ ] Dopo 3 chiamate negate nella stessa esecuzione l'esecuzione si
      ferma e l'agente si segnala nella casella.

### Assistente

#### AI-008 · Pagina chat

Stato: proposto

Accettazione:

- [ ] Pagina `/ai`: a sinistra le conversazioni, al centro la chat, in
      alto il motore in uso (`locale` o il nome del servizio esterno).
- [ ] Risposta in streaming; ogni strumento usato compare come chip
      ("Nutrizione · pasti di oggi") espandibile con i dati letti.
- [ ] Indicatore di attesa onesto: con il modello locale una risposta può
      chiedere decine di secondi; si può interrompere.

#### AI-009 · Conversazioni salvate

Stato: proposto

Accettazione:

- [ ] Tabelle `ai_conversations` e `ai_messages` (migrazione nuova).
- [ ] Titolo generato dalla prima domanda, rinomina, eliminazione.
- [ ] Il contesto inviato al modello si tronca alle ultime battute che
      stanno nel limite del motore.

#### AI-010 · Chiedi da ovunque

Stato: proposto

Accettazione:

- [ ] Scorciatoia `⌘K` / `Ctrl K` apre un pannello con un campo di
      domanda; la risposta continua in una conversazione nuova in `/ai`.

#### AI-011 · Widget

Stato: proposto

Accettazione:

- [ ] Widget `AI` per la dashboard personalizzabile: campo di domanda,
      ultimi risultati degli agenti e numero di azioni in attesa.

#### AI-012 · API della chat

Stato: proposto

Accettazione:

- [ ] Rotte in "Endpoint proposti", tutte in `api/openapi.yaml`, usabili
      dalla dashboard e dall'app iOS con sessione o token `r1n_`.
- [ ] Lo streaming usa Server-Sent Events, che passano da Cloudflare
      Tunnel.

### Agenti

#### AI-013 · Definizione di un agente

Stato: proposto

Accettazione:

- [ ] Un agente ha nome, istruzioni, permessi (AI-021), motore,
      pianificazione facoltativa e stato attivo.
- [ ] Si crea, modifica e spegne da `/ai/agenti`; ogni agente ha la sua
      pagina con permessi, esecuzioni e registro.
- [ ] L'assistente della chat è anch'esso un agente, `Assistente`, con
      permessi propri modificabili come gli altri.

#### AI-014 · Avvio manuale

Stato: proposto

Accettazione:

- [ ] `Avvia` esegue l'agente e crea un'esecuzione con i passi (strumenti
      chiamati), il risultato finale e la durata.

#### AI-015 · Pianificazione

Stato: proposto

Accettazione:

- [ ] Espressione cron per agente, eseguita dallo scheduler del backend
      nel fuso `Europe/Rome`.
- [ ] Una sola esecuzione alla volta (coda): il mini PC non ha GPU.
- [ ] Limiti per esecuzione: al massimo 8 chiamate a strumenti e 5 minuti;
      oltre, l'esecuzione termina con errore leggibile.

#### AI-016 · Casella

Stato: proposto

Accettazione:

- [ ] `/ai/casella` raccoglie i risultati delle esecuzioni e le azioni in
      attesa di conferma; un contatore compare nella navigazione.
- [ ] I risultati non letti si segnano come letti all'apertura.

#### AI-017 · Agenti pronti

Stato: proposto

Accettazione:

- [ ] Quattro agenti già definiti e spenti di default:
  - Riepilogo alimentare (ogni giorno alle 21): calorie e macro rispetto
    agli obiettivi.
  - Controllo server (ogni ora): disco oltre il 90%, container fermi,
    temperatura alta; scrive nella casella solo se c'è qualcosa.
  - Scadenze documenti (ogni lunedì): documenti in scadenza nei prossimi
    90 giorni.
  - Settimana di allenamento (domenica sera): sedute, volume, confronto con
    la settimana prima.

#### AI-018 · Limiti del piano gratuito

Stato: proposto

Accettazione:

- [ ] Il backend conta le richieste al motore esterno del giorno e le
      mostra in Impostazioni.
- [ ] Su limite raggiunto (HTTP 429) la chat avvisa e propone il motore
      locale; gli agenti ripiegano sul locale da soli.

## Note

### Architettura

```text
Web / iOS ── /api/v1/ai ──► server/ai
                             ├─ engine.ts     interfaccia OpenAI-compatibile
                             │                 (Ollama locale, Groq/Gemini)
                             ├─ tools.ts      registro da x-ai-tool
                             │                 + esecuzione via app.request
                             ├─ chat.ts       turni, streaming SSE, conferme
                             ├─ agents.ts     definizioni, esecuzioni, cron
                             ├─ policy.ts     concessioni, vincoli, token r1a_
                             └─ actions.ts    registro e azioni in attesa
```

Ciclo di un'esecuzione: token `r1a_` con i permessi dell'agente → modello
con i soli strumenti concessi → per ogni chiamata il backend verifica
concessione, vincoli e limiti; `lettura` e `scrittura senza conferma` si
eseguono, `scrittura con conferma` diventa un'azione in attesa, il resto è
negato e registrato → esiti al modello come dati non fidati → risposta →
token revocato.

Risorse: con un modello da 4B quantizzato Ollama usa 3-5 GB di RAM e
risponde a 8-10 token al secondo sul Ryzen 5300U. Il modello resta in
memoria 5 minuti dopo l'ultimo uso (`OLLAMA_KEEP_ALIVE`), poi si libera.

### Piani gratuiti esterni

Verificati il 2026-10-28, cambiano spesso: i numeri veri sono nella
console di ogni servizio.

| Servizio | Limiti indicativi                                                   | Note                                                     |
| -------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| Groq     | ~1000 richieste/giorno sui modelli grandi, di più su quelli piccoli | molto veloce, tool calling                               |
| Gemini   | ~20-250 richieste/giorno sui modelli Flash                          | nel piano gratuito i dati possono essere usati da Google |

### Strumenti iniziali

| Modulo      | Strumento                       | Tipo  | Sensibile |
| ----------- | ------------------------------- | ----- | --------- |
| Nutrizione  | pasti e totali del giorno       | read  | sì        |
| Nutrizione  | obiettivi                       | read  | sì        |
| Nutrizione  | cerca alimento                  | read  | no        |
| Nutrizione  | aggiungi alimento a un pasto    | write | sì        |
| Peso        | ultime misure                   | read  | sì        |
| Allenamento | ultime sedute e statistiche     | read  | sì        |
| Documenti   | elenco con tipo, tag e scadenze | read  | sì        |
| Documenti   | dettaglio con i campi decifrati | read  | sì        |
| Download    | elenco torrent e velocità       | read  | no        |
| Download    | aggiungi magnet                 | write | no        |
| Download    | pausa e ripresa                 | write | no        |
| Server      | CPU, RAM, disco, temperatura    | read  | no        |
| Server      | elenco container e stato        | read  | no        |

### Endpoint proposti

| Metodo e rotta                                      | Uso                          | Requisiti |
| --------------------------------------------------- | ---------------------------- | --------- |
| `GET /status`                                       | motori, modello, contatori   | 001, 018  |
| `GET /tools`                                        | registro degli strumenti     | 004       |
| `GET`/`POST /conversations`                         | elenco, nuova                | 009       |
| `GET`/`PATCH`/`DELETE /conversations/{id}`          | dettaglio, rinomina, elimina | 009       |
| `POST /conversations/{id}/messages`                 | nuovo turno, risposta in SSE | 008, 012  |
| `GET /actions?status=`                              | registro e azioni in attesa  | 007, 016  |
| `POST /actions/{id}/confirm`, `/cancel`             | conferma o annulla           | 006       |
| `GET`/`POST /agents`, `PATCH`/`DELETE /agents/{id}` | definizioni                  | 013       |
| `GET`/`PUT /agents/{id}/grants`                     | permessi dell'agente         | 021, 022  |
| `POST /agents/stop-all`                             | ferma tutto                  | 025       |
| `POST /agents/{id}/run`                             | avvio manuale                | 014       |
| `GET /runs`, `GET /runs/{id}`, `PATCH /runs/{id}`   | esecuzioni, segna come letta | 014, 016  |

Tutte le rotte sono relative a `/api/v1/ai`.

### Piano di lavoro

1. **Specifica** e decisioni.
2. **Mockup** di chat, conferma, agenti e casella, rivisti con la skill
   `apple-design`.
3. **Issue** con label `mod:ai`, una per requisito.
4. **Base**: Ollama nell'hub (AI-002), motore e registro (AI-001, 003,
   004).
5. **Assistente**: chat, conferme, registro, widget.
6. **Agenti**: definizioni, esecuzioni, pianificazione, casella, agenti
   pronti.
7. **iOS**: parità nella seconda fase.

## Decisioni

Prese il 2026-10-28.

1. **Motore.** Ibrido: Ollama locale predefinito, API esterna gratuita
   facoltativa.
2. **Strumenti.** Registro generato da `/api/v1` con `x-ai-tool`; server
   MCP in una fase successiva.
3. **Autonomia.** Letture libere, scritture con conferma, distruttive
   escluse, tutto nel registro.
4. **Trigger.** Manuali e pianificati; gli eventi dopo.
5. **Privacy.** Tutto leggibile, ma solo dal modello locale: dati
   sanitari e documenti, compresi i campi decifrati, non vanno mai al
   motore esterno. Gli allegati restano fuori in ogni caso.
6. **Zero trust.** Ogni agente, compreso l'assistente, è un'identità con
   permessi propri concessi uno per uno, token per esecuzione e verifica
   a ogni chiamata (richiesto il 2026-10-28). La modalità `scrittura
senza conferma` precisa la decisione 3: si concede solo per agente e
   per strumento.
