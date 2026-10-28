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

Il motore degli agenti è [Mastra](https://mastra.ai), framework
TypeScript open source (nucleo Apache-2.0) che gira dentro il backend
Hono. Le stesse funzionalità si offrono anche ad altri client AI con un
server MCP nostro.

Sicurezza zero trust: assistente e agenti non ereditano mai i permessi
dell'utente. Ognuno è un'identità a sé con i suoi permessi, concessi uno
per uno; tutto ciò che non è concesso è negato, e ogni chiamata si verifica
di nuovo nel backend, non nel modello (sezione "Identità e permessi").

Assistente e agenti non hanno logica propria sui dati: usano le stesse
operazioni di `/api/v1` che usano la dashboard e l'app iOS, scelte e
descritte in `api/openapi.yaml`. La logica sta nel backend, come per gli
altri moduli; il browser mostra la chat e le conferme.

Tutto è gratuito (regola del progetto): un router sul server salta da un
servizio online gratuito all'altro finché hanno quota e chiude sul modello
locale con Ollama sul mini PC. I dati sensibili vanno solo al modello
locale.

Non fa, per ora: voce, ricerca sul web, lettura degli allegati (immagini e
PDF, serve l'OCR, rimandato anche in Documenti), webhook da servizi
esterni, parità iOS
(seconda fase, requisiti `IOS-1xx` in ron1nos-ios).

**Stato del documento: in revisione dal 2026-10-28 (zero trust), mockup da
fare.**
Le scelte sono in fondo, in "Decisioni".

## Requisiti

### Motore

#### AI-001 · Motori attraverso un router

Stato: proposto

Accettazione:

- [ ] Il backend parla con un solo indirizzo compatibile OpenAI (chat
      completions con `tools` e streaming): il router LiteLLM (AI-002),
      open source e ospitato sul server, senza parti a pagamento.
- [ ] Il router espone due modelli logici:
  - `ron1n-locale`: solo Ollama;
  - `ron1n-gratis`: la catena dei servizi online gratuiti (AI-018), che
    chiude su Ollama.
- [ ] Chiavi dei servizi online solo nel `.env` del router; un servizio
      senza chiave è saltato.
- [ ] `Impostazioni › Moduli › AI` mostra lo stato di ogni motore
      (raggiungibile, modello, quota del giorno, ultimo errore) e il
      modello logico predefinito della chat.
- [ ] Senza alcun motore raggiungibile il modulo si mostra spento, con il
      motivo.

#### AI-002 · Ollama e router sul server

Stato: proposto · Repo: ron1n

Accettazione:

- [ ] Stack `infra/ollama/compose.yaml` nell'hub, immagine con tag
      esplicito, modelli in un volume su `/srv`, limite di memoria (6 GB)
      e di CPU perché non soffochi gli altri servizi.
- [ ] Stack `infra/ai-router/compose.yaml` con LiteLLM (tag esplicito) e
      la sua configurazione versionata: catena, limiti per servizio,
      tempi di attesa dopo un 429.
- [ ] Nessuno dei due è pubblicato da Caddy né dal tunnel: solo sulla rete
      Docker condivisa con `ron1nos`; il router chiede una chiave interna
      generata da `make_envs`.
- [ ] `infra.sh` li avvia prima di `ron1nos`; il bootstrap chiede le
      chiavi facoltative e scarica il modello predefinito, il cleanup
      toglie stack e dati.

#### AI-028 · Mastra nel backend

Stato: proposto

Accettazione:

- [ ] `@mastra/core` (e i pacchetti che servono: `@mastra/pg`,
      `@mastra/mcp`) con versione fissata, montato nel backend Hono sotto
      `/api/v1/ai`. Solo parti Apache-2.0: niente codice delle cartelle
      `ee/`, che hanno una licenza a parte.
- [ ] Ogni agente di ron1nOS è un `Agent` di Mastra creato al volo dalla
      sua definizione in database (AI-013), con i soli strumenti concessi
      (AI-021).
- [ ] Modelli tramite il provider compatibile OpenAI dell'AI SDK, puntato
      sul router (AI-001).
- [ ] Memoria e storia delle conversazioni nello storage Postgres di
      Mastra, nel Postgres condiviso, schema `ai`.
- [ ] Le esecuzioni a più passi degli agenti (trigger, conferme in attesa,
      ripresa dopo la conferma) usano i workflow di Mastra con
      sospensione e ripresa.

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

- [ ] Conversazioni e messaggi nella memoria di Mastra (AI-028), legati
      all'agente `Assistente`.
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
- [ ] Una sola esecuzione locale alla volta (coda): il mini PC non ha
      GPU. Le esecuzioni sulla catena online possono andare in parallelo.
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

#### AI-018 · Catena gratuita

Stato: proposto

Accettazione:

- [ ] `ron1n-gratis` prova i servizi in un ordine configurabile (per
      partire: Groq, Cerebras, Gemini, Mistral, modelli `:free` di
      OpenRouter) e alla fine Ollama.
- [ ] Su 429 o quota finita il router passa al successivo e lascia a
      riposo quel servizio fino al reset; su rifiuto per contenuto non
      ritenta altrove.
- [ ] Ogni servizio ha limiti per minuto e per giorno impostati sotto la
      quota vera, per non farsi bloccare.
- [ ] La chat mostra quale servizio ha risposto; Impostazioni mostra le
      richieste del giorno per servizio.
- [ ] Nessun piano a pagamento né credito prepagato: un servizio che
      chiede una carta per la quota gratuita non entra nella catena.

#### AI-026 · Trigger da eventi

Stato: proposto

Accettazione:

- [ ] Un agente può partire anche da un evento di un modulo, scelto da un
      elenco: download finito, disco oltre soglia, container fermo,
      documento che entra in preavviso, pasto registrato, seduta
      importata, sincronizzazione YAZIO fallita. Casa aggiunge i suoi
      quando esisterà.
- [ ] Ascoltare un evento è un permesso dell'agente come gli strumenti
      (AI-021): senza concessione l'evento non lo avvia.
- [ ] I dati dell'evento arrivano al modello come dati non fidati
      (AI-023).
- [ ] Antirimbalzo per agente: al massimo un avvio per evento ogni N
      minuti, configurabile; gli eventi in eccesso si contano e si
      riassumono nell'avvio successivo.
- [ ] Gli eventi passano dalla stessa coda delle esecuzioni (AI-015).

#### AI-027 · Prova dei modelli locali

Stato: proposto

Accettazione:

- [ ] Script `scripts/ai-bench` che, sul server, prova i modelli candidati
      (per esempio `qwen3:4b`, `qwen3:8b`, `llama3.2:3b`, `gemma3:4b`,
      `hermes3:8b`) con
      domande fisse in italiano che richiedono strumenti dei moduli.
- [ ] Misura per ogni modello: tempo alla prima parola, token al secondo,
      RAM usata, chiamate a strumenti corrette, risposte accettabili.
- [ ] Risultati in `docs/ai-bench.md`; il modello predefinito di
      `ron1n-locale` si sceglie da lì, prima di costruire la chat.

### Server MCP

#### AI-029 · Server MCP di ron1n

Stato: proposto

Accettazione:

- [ ] `MCPServer` di `@mastra/mcp` su `/api/v1/mcp` (HTTP in streaming),
      con gli stessi strumenti del registro (AI-004): un client AI esterno
      (Claude Code, un'app desktop) usa le funzionalità di ron1n come
      l'assistente.
- [ ] Zero trust anche qui: ogni client MCP è un'identità con i suoi
      permessi (AI-019, AI-021) e un token proprio `r1m_`, creato e
      revocato da `/ai/agenti`. Senza concessioni il client non vede
      nessuno strumento.
- [ ] Le scritture con conferma di un client MCP finiscono nella casella
      (AI-016); i dati sensibili non si concedono a client MCP, che usano
      modelli fuori dal server.
- [ ] Raggiungibile solo dietro Cloudflare Access: dall'esterno serve
      anche un service token di Access, come per l'app iOS.
- [ ] Ogni chiamata nel registro per agente (AI-024).

### AI personale

#### AI-030 · Hermes Agent come AI personale

Stato: proposto

[Hermes Agent](https://github.com/NousResearch/hermes-agent) di Nous
Research è un agente personale open source (MIT, gratuito da ospitare):
memoria tra le sessioni, abilità che impara da solo, attività pianificate
e un gateway verso app di messaggi come Telegram. Si inserisce come
client del server MCP di ron1n, non al posto di Mastra: Mastra resta il
motore degli agenti della dashboard, con un'identità e permessi per
agente; Hermes è un'identità sola con i suoi permessi.

Accettazione:

- [ ] Stack `infra/hermes/compose.yaml` nell'hub (immagine
      `nousresearch/hermes-agent` con tag esplicito, dati in un volume su
      `/srv`), non pubblicato da Caddy né dal tunnel.
- [ ] Strumenti solo dal server MCP di ron1n (AI-029), con un token `r1m_`
      e permessi concessi da `/ai/agenti` come per ogni client. Terminale,
      browser, esecuzione di codice e MCP esterni spenti: Hermes non tocca
      il server se non attraverso `/api/v1`.
- [ ] Modelli dal router (AI-001), modello logico `ron1n-gratis`. Hermes
      chiede almeno 64k token di contesto: sul Ryzen 5300U senza GPU un
      modello locale con quel contesto è troppo lento, quindi di fatto usa
      la catena online e non riceve permessi su dati sensibili.
- [ ] Le sue scritture con conferma vanno nella casella (AI-016); le sue
      attività pianificate compaiono nel registro (AI-024) con la sua
      identità.
- [ ] Gateway Telegram facoltativo per parlargli dal telefono: gratuito,
      ma i messaggi passano dai server di Telegram, quindi vale la stessa
      regola dei dati sensibili.
- [ ] Scrittura in memoria con approvazione (`memory.write_approval`).

## Esempi di utilizzo

Casi pensati per i moduli che esistono oggi. Tra parentesi i permessi che
servono; dove non è detto, basta la lettura.

### Assistente

- **"Cosa mangio stasera per chiudere le proteine?"** Legge totali del
  giorno e obiettivi, propone due o tre pasti con alimenti già usati e, se
  ne scegli uno, lo aggiunge al pasto (scrittura con conferma, Nutrizione).
  La sincronizzazione con YAZIO fa il resto.
- **"Ho mangiato 150 g di pollo e 80 g di riso a pranzo."** Cerca gli
  alimenti e prepara le voci; tu confermi (scrittura con conferma).
- **"Come va la panca rispetto a un mese fa?"** 1RM stimato, volume e
  sedute a confronto, in due righe.
- **"Il peso scende come dovrebbe?"** Tendenza del peso confrontata con la
  media delle calorie delle ultime settimane.
- **"Quando scade la patente? Dammi il numero della carta d'identità."**
  Legge i documenti, campi decifrati compresi (solo modello locale).
- **"Perché il server è lento?"** CPU, RAM, temperatura, container e
  download attivi; propone di mettere in pausa i download (scrittura con
  conferma, Download).
- **"Scarica questo magnet."** Lo aggiunge a qBittorrent dopo la conferma.
- **Dal terminale, con Claude Code e il server MCP:** "com'è il disco del
  server?" oppure "segna la colazione", con i permessi dati a quel client.

### Agenti

| Agente                | Quando                                     | Cosa fa                                                                          | Permessi                                               |
| --------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Briefing del mattino  | ogni giorno alle 7:30                      | obiettivi del giorno, allenamento della settimana, scadenze vicine, stato server | lettura su più moduli, solo locale                     |
| Coach serale          | ogni giorno alle 21                        | riepilogo di calorie e macro, un consiglio per domani                            | lettura Nutrizione                                     |
| Guardiano del server  | eventi disco oltre soglia, container fermo | diagnosi in una riga e azione proposta                                           | lettura Server e Download, pausa download con conferma |
| Download finito       | evento download finito                     | nome, dimensione, spazio rimasto; se il disco è stretto propone cosa togliere    | lettura Download e Server                              |
| Scadenze documenti    | evento documento in preavviso              | cosa scade, quando, cosa serve per rinnovare                                     | lettura Documenti, solo locale                         |
| Settimana in palestra | domenica alle 20                           | sedute, volume per gruppo muscolare, gruppi trascurati                           | lettura Allenamento                                    |
| Controllo YAZIO       | evento sincronizzazione fallita            | legge l'errore e dice cosa fare (per esempio versione dell'API bloccata)         | lettura Nutrizione e stato integrazioni                |
| Spesa della settimana | a mano                                     | dalla settimana tipo prepara la lista della spesa                                | lettura Nutrizione, scrittura lista con conferma       |

Ogni agente vede solo i suoi strumenti: il Coach serale, per esempio, non
può leggere i documenti né toccare i download, anche se il modello ci
provasse.

## Note

### Architettura

```text
Web / iOS ── /api/v1/ai ──┐
Client MCP ── /api/v1/mcp ┤
                          ▼
                    server/ai (Mastra dentro Hono)
                     ├─ agents.ts    Agent Mastra dalle definizioni in db
                     ├─ tools.ts     createTool da x-ai-tool, esecuzione
                     │               via app.request con token r1a_/r1m_
                     ├─ policy.ts    concessioni, vincoli, limiti, token
                     ├─ workflows.ts trigger, conferme, ripresa
                     ├─ mcp.ts       MCPServer con gli stessi strumenti
                     └─ actions.ts   registro e azioni in attesa
                          │
                          ▼
             router LiteLLM ── catena gratuita online ──► Ollama locale
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

Indicativi, verificati il 2026-10-28: cambiano spesso e i numeri veri sono
nella console di ogni servizio. Nei piani gratuiti i dati possono essere
usati per l'addestramento, per questo i dati sensibili restano in locale.

| Servizio   | Limiti indicativi                                   | Note                                |
| ---------- | --------------------------------------------------- | ----------------------------------- |
| Groq       | ~1000 richieste/giorno sui modelli grandi           | molto veloce, tool calling          |
| Cerebras   | quota giornaliera in token                          | molto veloce                        |
| Gemini     | ~20-250 richieste/giorno sui modelli Flash          | quote ridotte più volte nel 2025-26 |
| Mistral    | piano gratuito di prova, limiti bassi               | da verificare                       |
| OpenRouter | modelli `:free`, ~50 richieste/giorno senza credito | il credito è a pagamento: escluso   |

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
4. **Base**: Ollama e router nell'hub (AI-002), Mastra, motori e registro
   (AI-028, 001, 003, 004, 018), identità e permessi (AI-019…025).
5. **Prova dei modelli locali** sul server (AI-027), insieme, prima di
   scegliere il modello predefinito.
6. **Assistente**: chat, conferme, registro, widget.
7. **Server MCP** (AI-029) sugli stessi strumenti e permessi.
8. **Agenti**: definizioni, permessi, esecuzioni, pianificazione,
   eventi, casella, agenti pronti.
9. **iOS**: parità nella seconda fase.

## Decisioni

Prese il 2026-10-28.

1. **Motore.** Ibrido: catena di servizi online gratuiti fino a
   esaurimento quota, poi Ollama locale, attraverso il router LiteLLM sul
   server; i modelli locali si provano sul server prima della scelta
   (precisato il 2026-10-28).
2. **Strumenti.** Registro generato da `/api/v1` con `x-ai-tool`, usato
   dagli agenti Mastra e da un server MCP nostro (precisato il
   2026-10-28: Mastra come framework, MCP nel modulo).
3. **Autonomia.** Letture libere, scritture con conferma, distruttive
   escluse, tutto nel registro.
4. **Trigger.** Manuali, pianificati ed eventi dei moduli (precisato il
   2026-10-28).
5. **Privacy.** Tutto leggibile, ma solo dal modello locale: dati
   sanitari e documenti, compresi i campi decifrati, non vanno mai al
   motore esterno. Gli allegati restano fuori in ogni caso.
6. **Zero trust.** Ogni agente, compreso l'assistente, è un'identità con
   permessi propri concessi uno per uno, token per esecuzione e verifica
   a ogni chiamata (richiesto il 2026-10-28). Precisa la decisione 3: la
   scrittura senza conferma esiste solo come concessione per agente e per
   strumento.
7. **AI personale.** Hermes Agent di Nous Research come client del server
   MCP, con permessi suoi; Mastra resta il motore degli agenti della
   dashboard (scelto il 2026-10-28).
