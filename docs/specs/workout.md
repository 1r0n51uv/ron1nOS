# Allenamento

Prefisso ID: `GYM` · Label: `mod:workout`

Il modulo tiene lo storico della palestra: gli allenamenti entrano dal CSV
esportato dall'app Liftin', caricato dalla pagina web, e la dashboard ne
ricava sessioni, grafici per esercizio, record personali, volume per gruppo
muscolare e costanza.

Riprende il modulo `1r0-gym` di
[1r0-pkm](https://github.com/1r0n51uv/1r0-pkm) nella forma decisa da
ADR-0027 e ADR-0030 (import CSV, storico, grafici), che resta solo come
riferimento. Come per la nutrizione, la logica che in pkm stava nell'app
iOS (parser `LiftinCSV`, `WorkoutImport`, `GymMath`, `GymStats`) qui sta nel
backend di ron1nOS (`/api/v1/workout`), che serve allo stesso modo la
dashboard web e la futura app iOS.

Non fa, per ora: registrazione delle serie durante l'allenamento, schede
con esercizi e obiettivi, modifica delle serie importate, calcolatore dei
dischi e riscaldamento, peso corporeo accanto ai grafici, allenamenti da
Apple Salute, progressione suggerita, import dallo storico di pkm.

**Stato del documento: proposto il 2026-10-22**, sulla base delle risposte
in "Decisioni". Ogni requisito porta l'origine: **pkm** (già fatto in
1r0-pkm), **pkm, cambia** (ripreso con modifiche) o **nuovo**.

## Requisiti

### Dashboard

#### GYM-001 · Widget Allenamento

Stato: proposto · Origine: pkm, cambia

Il widget in dashboard sostituisce il mock della sessione in corso con
l'ultimo allenamento e la settimana.

Accettazione:

- [ ] In testata il nome della routine dell'ultimo allenamento (dal CSV).
- [ ] Ultimo allenamento: giorno (`oggi`, `ieri` o data breve), durata,
      numero di esercizi e serie, volume in kg, numeri in `font-mono`.
- [ ] Due valori della settimana: allenamenti questa settimana e giorni di
      fila (GYM-013).
- [ ] Senza dati mostra `Nessun allenamento · importa il CSV di Liftin'`
      con il link alla pagina.
- [ ] Il link `Dettagli` apre la pagina Allenamenti (GYM-002).
- [ ] Durante il primo caricamento mostra lo skeleton.

#### GYM-002 · Pagina Allenamenti

Stato: proposto · Origine: pkm, cambia

Una pagina `/allenamenti` (oggi `ComingSoon`) con, dall'alto: i valori di
costanza (GYM-013), la dashboard esercizi (GYM-007), i record personali
(GYM-010), il volume per gruppo muscolare (GYM-012) e lo storico delle
sessioni (GYM-004). In testata il pulsante `Importa CSV` (GYM-003) e il
link all'elenco degli esercizi (GYM-009).

Accettazione:

- [ ] La voce Allenamenti della barra di navigazione apre la pagina.
- [ ] Senza dati la pagina mostra solo un invito a importare il CSV.
- [ ] Ogni sezione ha il suo skeleton e il suo messaggio di errore, senza
      bloccare le altre.

### Import

#### GYM-003 · Import del CSV di Liftin'

Stato: proposto · Origine: pkm, cambia

Dalla pagina si carica il file esportato da Liftin' (`Date;Duration;
Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception`, separatore
`;`). Il file va al backend, che lo legge e lo unisce ai dati esistenti.

Accettazione:

- [ ] Dialog con area di trascinamento e scelta del file, solo `.csv`,
      massimo 5 MB.
- [ ] Il parser sta nel server ed è quello di pkm portato in TypeScript:
      colonne cercate per nome e non per posizione, `Reps/Time` intero =
      ripetizioni, `mm:ss` = durata, virgole o punti nei decimali, righe
      senza data o esercizio scartate e contate.
- [ ] Una sessione è un giorno più una routine; la serie è identificata da
      giorno, routine, esercizio (confronto senza maiuscole e spazi in più)
      e numero di serie. Un re-import aggiorna le righe già presenti e non
      le duplica; un re-import identico non cambia nulla.
- [ ] Prima di confermare il dialog mostra l'anteprima calcolata dal
      server: sessioni nuove e aggiornate, serie nuove e aggiornate, righe
      scartate, periodo coperto. `Importa` applica, `Annulla` non scrive
      niente.
- [ ] Errori chiari: file vuoto, colonne mancanti (con i nomi), nessuna
      riga valida, file troppo grande.
- [ ] Le sessioni eliminate (GYM-006) non tornano con un re-import e
      l'anteprima le conta a parte.
- [ ] Dopo l'import widget e pagina si aggiornano senza ricaricare.

### Storico

#### GYM-004 · Storico delle sessioni

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Elenco dalla più recente: data, routine, durata, esercizi, serie,
      volume.
- [ ] Filtro per routine, con i nomi presi dai dati.
- [ ] Caricamento a pagine da 20 sessioni.

#### GYM-005 · Dettaglio di una sessione

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Serie raggruppate per esercizio nell'ordine del CSV: numero, peso,
      ripetizioni o durata, percezione se c'è.
- [ ] Le serie di riscaldamento sono segnate e non entrano nei totali.
- [ ] Per esercizio: volume e miglior 1RM stimato della sessione; un
      record personale stabilito in quella sessione è segnato (GYM-010).
- [ ] Totali della sessione: durata, serie, volume.
- [ ] I dati sono in sola lettura.

#### GYM-006 · Eliminare una sessione

Stato: proposto · Origine: nuovo

Unica modifica possibile sui dati importati, per togliere una sessione
sbagliata. Le correzioni si fanno in Liftin' e si re-importano.

Accettazione:

- [ ] Dal dettaglio, `Elimina sessione` con conferma.
- [ ] La sessione sparisce da storico, grafici, record e costanza.
- [ ] Il server ricorda giorno e routine eliminati, così un re-import non
      la ripristina (GYM-003).

### Esercizi

#### GYM-007 · Dashboard esercizi

Stato: proposto · Origine: pkm (ADR-0030)

Accettazione:

- [ ] Griglia dei 6 esercizi più allenati per numero di serie, con nome,
      ultimo 1RM stimato e sparkline; sotto `top 6 di N`.
- [ ] Per un esercizio a tempo la card mostra la durata migliore al posto
      dell'1RM.
- [ ] Un clic apre i grafici dell'esercizio (GYM-008).

#### GYM-008 · Grafici di un esercizio

Stato: proposto · Origine: pkm, cambia

Accettazione:

- [ ] Due grafici per sessione: miglior 1RM stimato e volume.
- [ ] Per gli esercizi a tempo, al posto dei due grafici, la durata
      migliore e la durata totale per sessione.
- [ ] Periodo: 3 mesi, 6 mesi, 1 anno, tutto.
- [ ] Sotto i grafici le ultime sessioni dell'esercizio, con link al
      dettaglio.
- [ ] Il gruppo muscolare dell'esercizio, modificabile da qui (GYM-011).

#### GYM-009 · Elenco degli esercizi

Stato: proposto · Origine: nuovo

Accettazione:

- [ ] Tutti gli esercizi con ricerca per nome: gruppo muscolare, numero di
      sessioni e di serie, ultima volta, miglior 1RM stimato o durata.
- [ ] Ordinamento per nome, serie o ultima volta.
- [ ] Un clic apre i grafici dell'esercizio (GYM-008).
- [ ] I nomi sono quelli del CSV, senza alias né unione.

#### GYM-010 · Record personali

Stato: proposto · Origine: nuovo

Accettazione:

- [ ] Per esercizio: miglior 1RM stimato, peso più alto, più ripetizioni a
      un dato peso, volume più alto in una sessione; per gli esercizi a
      tempo, durata più lunga. Ognuno con la data.
- [ ] Nella pagina, i record stabiliti negli ultimi 30 giorni, dal più
      recente.
- [ ] Riscaldamento e serie a 0 kg esclusi, come nelle altre metriche.

### Gruppi muscolari

#### GYM-011 · Gruppo muscolare di un esercizio

Stato: proposto · Origine: nuovo

Il CSV di Liftin' non porta il gruppo muscolare: lo si assegna una volta
per esercizio e vale per tutto lo storico.

Accettazione:

- [ ] Elenco fisso: `Petto`, `Schiena`, `Spalle`, `Bicipiti`, `Tricipiti`,
      `Gambe`, `Glutei`, `Addome`, `Altro`.
- [ ] Un gruppo per esercizio, assegnato dall'elenco esercizi (GYM-009) o
      dai grafici (GYM-008).
- [ ] Gli esercizi senza gruppo finiscono in `Non assegnato` e l'elenco
      mostra quanti sono, con un filtro per vederli.
- [ ] L'assegnazione è legata al nome dell'esercizio e sopravvive ai
      re-import.

#### GYM-012 · Volume per gruppo muscolare

Stato: proposto · Origine: nuovo

Accettazione:

- [ ] Volume e numero di serie per gruppo, settimana per settimana, sulle
      ultime 12 settimane, in barre impilate.
- [ ] Sotto, la tabella della settimana corrente e della precedente con la
      variazione.
- [ ] `Non assegnato` compare come gruppo a sé.

### Costanza

#### GYM-013 · Allenamenti della settimana e giorni di fila

Stato: proposto · Origine: pkm

Accettazione:

- [ ] Allenamenti questa settimana: sessioni da lunedì a oggi, fuso
      `Europe/Rome`.
- [ ] Giorni di fila: giorni di calendario consecutivi con almeno una
      sessione, che finiscono oggi o ieri (`GymMath.currentStreakDays` di
      pkm).
- [ ] Usati da widget (GYM-001) e pagina (GYM-002).

## Note

### Regole di calcolo

Dal `GymMath` di pkm, portate in TypeScript con gli stessi casi di test di
`GymMathTests` e `GymStatsTests`:

- **1RM stimato**, formula di Epley: `peso × (1 + reps / 30)`; a 1
  ripetizione è il peso stesso.
- **Volume**: somma di `peso × reps`.
- **Serie valide** per 1RM, volume e record: non di riscaldamento, con
  ripetizioni e peso maggiore di 0. Le serie a tempo contano solo per le
  metriche di durata.
- **Esercizio a tempo**: la maggior parte delle sue serie ha una durata e
  non le ripetizioni.

### Architettura

Come la nutrizione: rotte sotto `/api/v1/workout` nel backend Hono, schema
nel database `ron1nos` del Postgres condiviso, migrazione SQL nuova in
`server/migrations/`, applicata all'avvio. Tabelle proposte:

- `workout_sessions`: giorno, routine, ora di inizio, durata.
- `workout_sets`: sessione, esercizio, numero di serie, riscaldamento,
  peso, ripetizioni, durata, percezione.
- `workout_exercise_groups`: nome normalizzato dell'esercizio e gruppo.
- `workout_deleted_sessions`: giorno e routine delle sessioni eliminate.

Statistiche, record e serie dei grafici si calcolano nel server a ogni
richiesta: per un solo utente e qualche migliaio di serie bastano, senza
tabelle derivate.

### Endpoint proposti

Tutti sotto `/api/v1/workout`.

| Metodo e rotta                        | Uso                                    | Requisiti |
| ------------------------------------- | -------------------------------------- | --------- |
| `GET /summary`                        | ultimo allenamento, settimana, di fila | 001, 013  |
| `POST /import/preview`                | anteprima del CSV, non scrive          | 003       |
| `POST /import`                        | applica il CSV                         | 003       |
| `GET /sessions?routine=&cursor=`      | storico a pagine                       | 004       |
| `GET /sessions/{id}`, `DELETE …/{id}` | dettaglio, eliminazione                | 005, 006  |
| `GET /routines`                       | nomi delle routine per il filtro       | 004       |
| `GET /exercises?q=&sort=`             | elenco esercizi, top 6 in testa        | 007, 009  |
| `GET /exercises/{name}?range=`        | grafici e ultime sessioni              | 008       |
| `PUT /exercises/{name}/group`         | gruppo muscolare                       | 011       |
| `GET /records?days=`                  | record personali                       | 010       |
| `GET /muscle-groups?weeks=`           | volume per gruppo                      | 012       |

`POST /import/preview` e `POST /import` ricevono il file come
`multipart/form-data`; il client non interpreta il CSV.

### Piano di lavoro

1. **Specifica** (questa PR), da confermare.
2. **Mockup** del widget e della pagina, nello stesso canvas della
   nutrizione.
3. **Base dati e import**: migrazione, parser e merge, rotte di import.
4. **API di lettura**: storico, esercizi, record, gruppi, riepilogo.
5. **Web**: widget, pagina, dialog di import, un pezzo per issue.

Il parser va validato su un export vero di Liftin': il formato di `Date` e
`Duration` non è documentato e pkm prova una lista di formati comuni.

### Rapporto con gli altri moduli

- **Nutrizione**: nessun legame (la modalità obiettivo legata alla scheda
  è tolta).
- **Peso**: il peso accanto ai grafici è rimandato; quando arriva, legge lo
  storico del peso già importato da YAZIO.

### Decisioni

Prese il 2026-10-22.

1. **Fonte.** Solo import del CSV di Liftin', come pkm: nessun log
   durante l'allenamento.
2. **Caricamento.** Upload dalla pagina web, con anteprima.
3. **Storico di pkm.** Nessuna migrazione: si riparte dall'export
   completo di Liftin'.
4. **Widget.** Ultimo allenamento più allenamenti della settimana e
   giorni di fila.
5. **Pagina.** Storico con dettaglio, dashboard esercizi, elenco di tutti
   gli esercizi, record personali.
6. **Metriche.** 1RM stimato (Epley), volume per sessione ed esercizio,
   serie a tempo, volume per gruppo muscolare.
7. **Schede.** Solo il nome della routine dal CSV, usato come filtro.
8. **Modifiche.** Sola lettura; si può solo eliminare una sessione, e
   l'eliminazione resiste ai re-import.
9. **Nomi degli esercizi.** Testo libero dal CSV, senza alias.
10. **Rimandati.** Calcolatore dischi e riscaldamento, peso corporeo
    accanto ai grafici, Apple Salute, progressione suggerita.
