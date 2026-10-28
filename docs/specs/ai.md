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

Assistente e agenti non hanno logica propria sui dati: usano le stesse
operazioni di `/api/v1` che usano la dashboard e l'app iOS, scelte e
descritte in `api/openapi.yaml`. La logica sta nel backend, come per gli
altri moduli; il browser mostra la chat e le conferme.

Tutto è gratuito (regola del progetto): il motore predefinito è un modello
locale con Ollama sul mini PC; un'API esterna con piano gratuito è
facoltativa e non riceve mai i dati sensibili.

Non fa, per ora: voce, ricerca sul web, lettura del contenuto dei
documenti, agenti avviati da eventi dei moduli, server MCP, parità iOS
(seconda fase, requisiti `IOS-1xx` in ron1nos-ios).

**Stato del documento: proposto il 2026-10-28.** Le scelte sono in fondo,
in "Decisioni": oggi riportano le opzioni consigliate, in attesa di
conferma.

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
      Allenamento, metadati dei Documenti).
- [ ] Una conversazione o un agente sul motore esterno non riceve gli
      strumenti sensibili; se la domanda li richiede, la chat propone di
      continuare in locale.
- [ ] Il contenuto dei documenti (campi cifrati e allegati) non è mai uno
      strumento: l'AI vede solo nome, tipo, tag e scadenze.

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
      la stessa validazione zod e la stessa sessione dell'utente: nessuna
      scorciatoia sul database.
- [ ] Le operazioni distruttive (eliminazioni) non sono strumenti.

#### AI-005 · Strumenti iniziali

Stato: proposto

Accettazione:

- [ ] Elenco del primo rilascio, nella tabella "Strumenti iniziali" in
      fondo. Ogni modulo nuovo (Casa, File) aggiunge i suoi con
      `x-ai-tool` nella propria PR.

#### AI-006 · Conferma delle scritture

Stato: proposto

Accettazione:

- [ ] Una chiamata `write` non parte: crea un'azione in attesa con
      strumento, argomenti leggibili e chi l'ha chiesta.
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

- [ ] Un agente ha nome, istruzioni, strumenti consentiti (sottoinsieme
      del registro), motore, pianificazione facoltativa e stato attivo.
- [ ] Si crea, modifica e spegne da `/ai/agenti`.

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
    90 giorni, solo metadati.
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
                             └─ actions.ts    registro e azioni in attesa
```

Ciclo di un turno: messaggio dell'utente → modello con gli strumenti
consentiti → per ogni chiamata, `read` si esegue subito, `write` diventa
un'azione in attesa → esiti al modello → risposta finale.

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

In attesa di conferma; per ora valgono le opzioni consigliate.

1. **Motore.** Ibrido: Ollama locale predefinito, API esterna gratuita
   facoltativa.
2. **Strumenti.** Registro generato da `/api/v1` con `x-ai-tool`; server
   MCP in una fase successiva.
3. **Autonomia.** Letture libere, scritture con conferma, distruttive
   escluse, tutto nel registro.
4. **Trigger.** Manuali e pianificati; gli eventi dopo.
5. **Privacy.** Dei documenti solo i metadati; i dati sanitari solo al
   modello locale.
