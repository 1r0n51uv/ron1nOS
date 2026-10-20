# Server

Prefisso ID: `SRV` · Label: `mod:server`

Il modulo mostra quanto sta lavorando il mini PC: CPU, RAM, disco, rete,
temperatura e consumo dei singoli container. La sorgente è Glances, stack
`glances` in
[`ron1n/infra/glances`](https://github.com/1r0n51uv/ron1n/tree/main/infra/glances).

Fa: widget Server nella dashboard con anelli CPU, RAM e disco, velocità di
rete, temperatura, uptime, container che consumano di più; segnale rosso
oltre soglia; stato offline se Glances non risponde.

Non fa, per ora: storico oltre l'ultima ora, grafici nel tempo, avvisi e
notifiche, elenco dei processi, azioni sui container (riavvio e stato sono
del modulo Container). Per il dettaglio resta l'interfaccia di Glances su
`glances.ron1n.home`.

## Requisiti

### SRV-001 · Anelli CPU, RAM e disco
Stato: proposto

Il widget Server mostra a colpo d'occhio quanto sono occupate le tre
risorse principali.

Accettazione:
- [ ] Tre anelli (ProgressRing) con didascalie `CPU`, `RAM`, `SSD` e il
      valore in percentuale intera, in `font-mono`.
- [ ] CPU: uso totale di tutti i core. RAM: memoria usata senza cache e
      buffer. SSD: spazio occupato sul disco di sistema.
- [ ] Il valore di ogni anello ha un `aria-label` completo, per esempio
      `CPU 23%` o `SSD 82%, sopra soglia`.

### SRV-002 · Temperatura e uptime
Stato: proposto

Nella testata del widget la temperatura della CPU e da quanto il server è
acceso.

Accettazione:
- [ ] Testata nel formato `52 °C · 41 g`: temperatura della CPU (sensore
      `k10temp`, voce `Tctl`) arrotondata al grado, uptime in giorni.
- [ ] Sotto un giorno l'uptime è in ore (`7 h`).
- [ ] Se il sensore non è disponibile la temperatura viene omessa e resta
      solo l'uptime.

### SRV-003 · Rete
Stato: proposto

Il widget mostra quanto traffico sta passando dalla scheda di rete del
server.

Accettazione:
- [ ] Una riga con velocità in ingresso e in uscita dell'interfaccia
      fisica, per esempio `↓ 12,4 MB/s · ↑ 0,8 MB/s`, in `font-mono`.
- [ ] Unità che si adatta al valore: `kB/s` sotto 1 MB/s, `MB/s` sopra.
- [ ] Il traffico delle interfacce virtuali (Docker, Tailscale, loopback)
      non si somma.

### SRV-004 · Consumo per container
Stato: proposto

Il widget dice quali container stanno usando più risorse.

Accettazione:
- [ ] Elenca i 3 container in esecuzione con la CPU più alta: nome
      (troncato), CPU in percentuale di un core, RAM in MB o GB.
- [ ] A parità di CPU (per esempio tutti a 0%) l'ordine è per RAM.
- [ ] Container fermi o in riavvio non compaiono qui: il loro stato è del
      modulo Container.

### SRV-005 · Soglie
Stato: proposto

Il rosso del marchio segnala solo ciò che merita attenzione.

Accettazione:
- [ ] Un anello diventa rosso (`tone="brand"`) da 80% in su.
- [ ] La temperatura diventa rossa da 85 °C in su.
- [ ] Senza valori oltre soglia il widget non ha nessun elemento rosso.
- [ ] Le soglie stanno in un punto solo del codice del modulo.

### SRV-006 · Glances non raggiungibile
Stato: proposto

Se la dashboard non riesce a leggere le risorse, il widget lo dice invece
di mostrare valori vecchi.

Accettazione:
- [ ] Con Glances spento il widget mostra `Glances non raggiungibile` con
      lo stato `offline` (StatusPill), entro due aggiornamenti.
- [ ] Quando Glances torna disponibile il widget riprende da solo.
- [ ] Se manca solo una parte dei dati (per esempio i container, con il
      socket Docker non montato) il resto del widget funziona e la parte
      mancante viene omessa.

### SRV-007 · Aggiornamento continuo
Stato: proposto

Il widget segue il server senza ricaricare la pagina.

Accettazione:
- [ ] I dati si aggiornano ogni 5 secondi senza far lampeggiare il widget.
- [ ] Durante il primo caricamento mostra lo skeleton, come gli altri
      widget.
- [ ] Con la scheda del browser in background gli aggiornamenti si
      fermano e riprendono al ritorno.

### SRV-008 · Solo i dati che servono
Stato: proposto

Il browser non parla con Glances e riceve solo i numeri del widget.

Accettazione:
- [ ] Il browser chiama solo `GET /api/server/stats` di ron1nOS; l'API di
      Glances non è raggiungibile da fuori del server se non tramite Caddy
      sulla tailnet.
- [ ] La risposta non contiene processi, righe di comando, variabili
      d'ambiente, indirizzi IP né nomi di immagini dei container.
- [ ] L'endpoint è in sola lettura.

## Note

### Architettura dell'integrazione

Glances gira in rete host e ascolta solo su `172.17.0.1:61208` (bridge
`docker0`). La sua API non ha login e espone anche l'elenco dei processi
con le righe di comando, quindi il browser non la chiama direttamente.

Il modulo usa lo stesso backend della dashboard (**BFF**) proposto nella
specifica Download ([downloads.md](downloads.md), "Architettura
dell'integrazione"): un server Node nell'immagine ron1nOS che serve `dist/`
e le rotte `/api/*`. Per il modulo Server il BFF:

- chiama Glances su `http://host.docker.internal:61208/api/4/...` (nel
  compose di ron1nOS: `extra_hosts: host.docker.internal:host-gateway`);
- riduce le risposte a un oggetto piccolo e stabile (sotto), così il
  frontend non dipende dal formato di Glances;
- tiene in cache l'ultima lettura per 2 secondi, così più schede aperte non
  moltiplicano le chiamate.

Nel frontend non cambia la regola dei moduli: `data.ts` passa dal mock a
`fetch('/api/server/stats')`, il widget legge solo dall'hook.

Alternativa scartata: Nginx inoltra `/api/glances/` a Glances. Funziona
anche prima del BFF, ma dà al browser tutta l'API, processi compresi.

### Endpoint del BFF

`GET /api/server/stats`, risposta prevista:

```json
{
  "cpu": 23,
  "ram": 57,
  "disk": 82,
  "tempC": 52,
  "uptimeSec": 3542400,
  "net": { "rxBps": 13002342, "txBps": 838860 },
  "containers": [
    { "name": "qbittorrent", "cpu": 14.2, "memBytes": 412000000 }
  ]
}
```

`tempC` e `containers` possono mancare (SRV-002, SRV-006). Con Glances
irraggiungibile l'endpoint risponde `503`.

| Campo | Chiamata Glances (API 4) |
|---|---|
| `cpu` | `cpu` → `total` |
| `ram` | `mem` → `percent` |
| `disk` | `fs` → `percent` della voce `/rootfs` |
| `tempC` | `sensors` → voce `Tctl` (`k10temp`) |
| `uptimeSec` | `uptime` (restituisce una stringa `g days, h:mm:ss`, da convertire) |
| `net` | `network` → somma di `bytes_recv_rate_per_sec` e `bytes_sent_rate_per_sec` |
| `containers` | `containers` → `name`, `status`, `cpu_percent`, `memory_usage` |

Campi verificati su Glances 4.5.8 in locale, tranne `sensors` e
`containers` (da verificare sul mini PC). Il filtro delle interfacce e dei
dischi è già in `glances.conf`.

### Rapporto con gli altri moduli

- **Container** (`src/modules/containers`): stato dei container e riavvio.
  Leggere lo stato da Glances è possibile, ma il riavvio richiede la Docker
  Engine API dal BFF. La sua specifica deciderà se condividere un
  `docker-socket-proxy` con Glances.
- **Download**: condivide il BFF. Chi arriva prima lo introduce.

### Dipendenze e ordine

1. Stack `glances` attivo sul server (ron1n, `infra/glances`).
2. BFF nell'immagine ron1nOS e stack `infra/ron1nos` in ron1n (in comune
   con il modulo Download).
3. SRV-001, SRV-002, SRV-005…SRV-008 (il widget di oggi con dati veri),
   poi SRV-003 e SRV-004.

I mockup del widget con rete e container si fanno dopo l'approvazione di
questa specifica, con i componenti del design system (WidgetCard,
ProgressRing, Metric, StatusPill).
