# Casa

Prefisso ID: `CASA` · Label: `mod:home`

Il modulo controlla i dispositivi smart di casa (prese, condizionatori,
luci, sensori) dalla dashboard. Sostituisce il mock `Casa` dell'MVP.

Non parla con le marche una per una: in mezzo c'è Home Assistant, gratuito
e open source, che gira in Docker sul server di casa (CASA-011) e controlla
i dispositivi in rete locale. I dispositivi si aggiungono dall'interfaccia
di Home Assistant, con l'integrazione della loro marca; ron1nOS legge tutto
quello che Home Assistant espone e mostra il controllo giusto per tipo.
Così il modulo non dipende dalle marche: un dispositivo nuovo compare da
solo.

Come gli altri moduli la logica sta nel backend di ron1nOS
(`/api/v1/home`), che serve allo stesso modo la dashboard web e l'app iOS.
Il token di Home Assistant resta nel backend e il browser non parla mai
con Home Assistant.

Non fa, per ora: creazione o modifica di automazioni (si fanno in Home
Assistant, qui si avviano soltanto, CASA-007), Zigbee e Thread (servono una
chiavetta radio sul server), telecamere, serrature e allarmi, comandi
vocali, Nabu Casa (a pagamento, non serve: l'accesso da fuori passa da
Cloudflare Access).

**Stato del documento: proposto il 2026-10-28.** Le scelte del thread sono
in "Decisioni"; manca solo la risposta sull'interfaccia di Home Assistant
(decisione 3), per ora con l'opzione consigliata.

## Requisiti

### Dashboard

#### CASA-001 · Widget Casa

Stato: proposto

Il widget in dashboard mostra i dispositivi preferiti (CASA-008) e li
accende o spegne con un tocco.

Accettazione:

- [ ] Fino a 6 tasselli `ToggleTile` in griglia da 2: nome, stato breve
      (`142 W`, `24 °C · freddo`, `60%`) e interruttore.
- [ ] Il tocco cambia subito il tassello e il server conferma; se il
      comando fallisce il tassello torna com'era e compare il messaggio.
- [ ] Un dispositivo non raggiungibile è in grigio con `non disponibile` e
      non si può toccare.
- [ ] Sotto i tasselli il numero di dispositivi accesi e la potenza totale
      (`3 accesi · 1.982 W in casa`); il link `Tutti` in testata apre la
      pagina Casa (CASA-002).
- [ ] Senza Home Assistant configurato mostra `Home Assistant non collegato`
      con il link alle Impostazioni › Integrazioni.
- [ ] Senza preferiti mostra i primi 6 dispositivi controllabili.
- [ ] Durante il primo caricamento mostra lo skeleton.

#### CASA-002 · Pagina Casa

Stato: proposto

Una pagina `/casa` (oggi `ComingSoon`) con tutti i dispositivi.

Accettazione:

- [ ] In alto una riga di riepilogo: dispositivi accesi, potenza totale
      delle prese che la misurano (CASA-003), temperatura e umidità di
      casa se c'è un sensore (CASA-006).
- [ ] I dispositivi sono raggruppati per stanza, con le aree di Home
      Assistant; quelli senza area vanno in `Altro`.
- [ ] Filtri per tipo: `Tutti`, `Prese`, `Clima`, `Luci`, `Sensori`.
- [ ] Ogni dispositivo è una card con il controllo del suo tipo
      (CASA-003…006); un clic sul nome apre il dettaglio (CASA-012).
- [ ] Le scene e gli script stanno in una fila in alto (CASA-007).
- [ ] Ricerca per nome.
- [ ] Ogni stanza ha il suo skeleton; un errore di Home Assistant mostra
      un messaggio unico in alto senza svuotare la pagina.

### Dispositivi

#### CASA-003 · Prese e interruttori

Stato: proposto

Entità `switch` di Home Assistant (prese smart, relè, interruttori).

Accettazione:

- [ ] Acceso o spento con un interruttore.
- [ ] Se la presa misura i consumi (un sensore di potenza dello stesso
      dispositivo), la card mostra i watt attuali e i kWh di oggi in
      `font-mono`.
- [ ] Nessuna conferma prima di spegnere, neanche per la presa del
      server (decisione 6).

#### CASA-004 · Condizionatori e clima

Stato: proposto

Entità `climate` (condizionatori, pompe di calore, termostati).

Accettazione:

- [ ] Acceso o spento; modalità tra quelle che il dispositivo supporta
      (`freddo`, `caldo`, `deumidifica`, `ventola`, `auto`).
- [ ] Temperatura impostata con `−` e `+` al passo del dispositivo (di
      solito 0,5 o 1 °C) e la temperatura attuale della stanza.
- [ ] Velocità della ventola e oscillazione, se il dispositivo le ha.
- [ ] I comandi ravvicinati si uniscono: premere `+` tre volte manda un
      solo comando dopo 800 ms.
- [ ] La card usa il rosso `brand` solo quando il clima è acceso, come
      segnale; il resto resta neutro.

#### CASA-005 · Luci

Stato: proposto

Entità `light`.

Accettazione:

- [ ] Accesa o spenta.
- [ ] Luminosità con un cursore, se la luce la supporta.
- [ ] Temperatura del bianco, se la luce la supporta. Il colore RGB resta
      in Home Assistant.

#### CASA-006 · Sensori

Stato: proposto

Entità `sensor` e `binary_sensor` di temperatura, umidità, potenza,
energia, porta o finestra aperta, movimento, batteria.

Accettazione:

- [ ] Solo lettura: valore con unità in `font-mono` e da quanto è
      aggiornato.
- [ ] I sensori di potenza ed energia di una presa si mostrano dentro la
      card della presa, non da soli.
- [ ] Batteria sotto il 15%: il valore è in rosso `brand`.
- [ ] Gli altri tipi di sensore non compaiono, per non riempire la pagina
      con i sensori diagnostici delle integrazioni.

#### CASA-007 · Scene e script

Stato: proposto

Entità `scene` e `script` create in Home Assistant (per esempio `Esco di
casa`: spegne luci e clima).

Accettazione:

- [ ] Una fila di pulsanti con il nome; un clic avvia la scena o lo
      script.
- [ ] Il pulsante mostra l'attesa e poi `fatto` o l'errore.
- [ ] Le scene si creano e si modificano solo in Home Assistant.

#### CASA-008 · Preferiti e dispositivi nascosti

Stato: proposto

Accettazione:

- [ ] Dalla card di un dispositivo: `Preferito` (va nel widget, CASA-001),
      e `Nascondi` (non compare più in ron1nOS).
- [ ] L'ordine dei preferiti si cambia trascinando, nella pagina.
- [ ] Il nome è quello di Home Assistant; si cambia lì.
- [ ] Le scelte stanno in Postgres, legate all'id dell'entità, e valgono
      per web e iOS.
- [ ] I dispositivi nascosti si rivedono e si ripristinano da un filtro
      `Nascosti`.

#### CASA-012 · Dettaglio e storico

Stato: proposto

Accettazione:

- [ ] Un pannello laterale con stato, stanza, marca e modello (dal
      registro dei dispositivi di Home Assistant) e ultima modifica.
- [ ] Per prese con consumi e sensori numerici: grafico delle ultime 24
      ore, con scelta 24 ore o 7 giorni, dallo storico di Home Assistant.
- [ ] Per i condizionatori: grafico della temperatura della stanza e dei
      periodi di accensione nelle ultime 24 ore.
- [ ] Lo storico non si copia in Postgres: si chiede a Home Assistant,
      che lo tiene per 10 giorni.

### Server

#### CASA-009 · Stato in tempo reale

Stato: proposto

Accettazione:

- [ ] Il backend tiene una connessione WebSocket con Home Assistant
      (`subscribe_entities`) e una copia in memoria dello stato delle
      entità mostrate.
- [ ] Il client chiede lo stato ogni 5 secondi mentre la pagina è
      visibile, come i download; la risposta esce dalla copia in memoria,
      senza chiamate a Home Assistant.
- [ ] Se il WebSocket cade, il backend riprova con attesa crescente fino a
      un minuto e intanto risponde con l'ultimo stato e l'ora
      dell'ultimo aggiornamento (`aggiornato alle HH:MM`).
- [ ] Un dispositivo cambiato dall'app della marca o da Home Assistant si
      aggiorna in ron1nOS entro 5 secondi.

#### CASA-010 · Integrazione Home Assistant

Stato: proposto

Accettazione:

- [ ] Configurazione da `.env`: `HA_URL` (di default
      `http://host.docker.internal:8123`) e `HA_TOKEN`, un token di lunga
      durata creato nel profilo di Home Assistant.
- [ ] Senza `HA_TOKEN` il modulo è spento: le rotte rispondono `503` con
      un messaggio, il widget lo dice (CASA-001).
- [ ] Impostazioni › Integrazioni (SET-009) mostra lo stato vero di Home
      Assistant al posto di `Arriva con il modulo Casa`, con `HA_URL` e
      `HA_TOKEN` tra le variabili da impostare.
- [ ] I comandi passano da un elenco chiuso di servizi per tipo
      (`switch.turn_on`, `climate.set_temperature`, `scene.turn_on`…):
      il backend non inoltra mai una chiamata qualsiasi a Home Assistant.
- [ ] I valori si validano nel backend (temperatura dentro il minimo e il
      massimo del dispositivo, modalità tra quelle supportate) prima di
      chiamare Home Assistant.
- [ ] Token, indirizzi ed errori grezzi di Home Assistant non arrivano
      mai al client.
- [ ] Ogni rotta è in `api/openapi.yaml`.

#### CASA-011 · Stack Home Assistant sul server

Stato: proposto · Repo: ron1n

Lavoro nell'hub, `infra/homeassistant/compose.yaml`.

Accettazione:

- [ ] Immagine `ghcr.io/home-assistant/home-assistant` con tag esplicito
      della versione, aggiornata da Watchtower come gli altri stack.
- [ ] `network_mode: host`, come Glances: serve per trovare i
      dispositivi in LAN (mDNS, SSDP, broadcast di Tuya e simili).
- [ ] Configurazione in `/srv/homeassistant`, fuori dall'immagine.
- [ ] Interfaccia di Home Assistant su `ha.DOMINIO` via Caddy e Cloudflare
      Tunnel, dietro Cloudflare Access come gli altri siti; in
      `configuration.yaml` `http.use_x_forwarded_for` con i proxy fidati.
- [ ] Nello stack in `ORDER` di `infra.sh`; il bootstrap lo crea e il
      cleanup lo toglie (cartella compresa, con conferma).
- [ ] Il `.env` di ron1nOS riceve `HA_URL`; il token si crea a mano dopo
      il primo avvio, con le istruzioni nel README dello stack.

### App iOS

#### CASA-013 · Parità nell'app iOS

Stato: proposto · Repo: ron1nos-ios

Seconda fase, dopo il web: requisiti `IOS-1xx` in ron1nos-ios con le
stesse rotte. Widget Casa nella Home dell'app, pagina con stanze e
controlli, scene; poi i widget e i Controlli di iOS (Centro di Controllo)
per i preferiti, se xtool li compila.

## Note

Mockup: [canvas ron1nOS · Modulo Casa](https://claude.ai/artifact/Y4YRbF1WXw9U4nXX1qhYSD)
(widget, pagina, dettaglio).

### Architettura

```text
Browser / app iOS ──► ron1nOS /api/v1/home ──► Home Assistant ──► dispositivi
      (Access)          (token HA, cache WS)     (rete host, LAN)
```

Home Assistant usa la rete dell'host, quindi ron1nOS lo raggiunge su
`host.docker.internal:8123`, come Glances. L'interfaccia di Home Assistant
resta raggiungibile su `ha.DOMINIO` per aggiungere dispositivi e creare
scene.

Tipi mostrati: `switch`, `climate`, `light`, `fan` (come una presa, con la
velocità se c'è), `sensor` e `binary_sensor` (CASA-006), `scene`, `script`.
Gli altri domini si ignorano.

Tabella proposta:

- `home_entities`: id dell'entità, preferito, posizione, nascosto.

### Endpoint proposti

Sotto `/api/v1/home`, dietro il login:

| Metodo e rotta                     | Uso                                     | Requisiti |
| ---------------------------------- | --------------------------------------- | --------- |
| `GET /summary`                     | preferiti, accesi, potenza, temperatura | 001       |
| `GET /devices`                     | stanze, dispositivi e stato             | 002…006   |
| `POST /devices/{id}/actions`       | comando validato per tipo               | 003…005   |
| `PATCH /devices/{id}`              | preferito, nascosto                     | 008       |
| `PUT /favorites`                   | ordine dei preferiti                    | 008       |
| `GET /devices/{id}/history?range=` | storico 24 ore o 7 giorni               | 012       |
| `GET /scenes`                      | scene e script                          | 007       |
| `POST /scenes/{id}/run`            | avvia                                   | 007       |

Esempio di comando:
`POST /devices/climate.soggiorno/actions` con
`{ "action": "set_temperature", "value": 24 }`.

### Piano di lavoro

1. **Infra** (ron1n, CASA-011): stack Home Assistant, `ha.DOMINIO`,
   bootstrap e cleanup. Poi il proprietario aggiunge i dispositivi in Home
   Assistant e crea il token.
2. **Base** (CASA-010, CASA-009): client REST e WebSocket, cache,
   integrazione nelle Impostazioni, `GET /devices`.
3. **Pagina** (CASA-002) con prese (CASA-003) e sensori (CASA-006).
4. **Clima** (CASA-004), poi **luci** (CASA-005).
5. **Preferiti** (CASA-008), poi **widget** (CASA-001).
6. **Scene** (CASA-007), poi **dettaglio e storico** (CASA-012).
7. **App iOS** (CASA-013).

### Servizi gratuiti

Home Assistant è open source e gratuito; Nabu Casa non serve. Alcune
integrazioni di marca in Home Assistant passano dal cloud del produttore
invece che dalla LAN: sono gratuite, ma dipendono da internet. Dove esiste,
si sceglie l'integrazione locale (per esempio Tuya Local al posto di Tuya,
Tapo e Shelly in LAN, Matter via Wi‑Fi).

### Decisioni

Prese nel thread il 2026-10-28:

1. **Ponte.** Home Assistant in Docker sul server, controllo locale.
2. **Dispositivi.** Li aggiunge il proprietario in Home Assistant; il
   modulo non dipende dalle marche.

3. **Interfaccia di Home Assistant.** Pubblica su `ha.DOMINIO` dietro
   Access (consigliata, in attesa di risposta; in alternativa solo in LAN
   su `http://IP-del-server:8123`).
4. **Widget.** Preferiti scelti a mano.
5. **Consumi e storico.** Watt, kWh di oggi e grafico da Home Assistant.
6. **Conferme.** Nessuna: ogni interruttore agisce subito, senza prese
   protette.
