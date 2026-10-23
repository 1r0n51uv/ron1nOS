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

**Stato del documento: confermato il 2026-10-22**, con le scelte in
"Decisioni". Ogni requisito ha la sua issue; la base comune è #118. Ogni requisito porta l'origine: **pkm** (già fatto in
1r0-pkm), **pkm, cambia** (ripreso con modifiche) o **nuovo**.

## Requisiti

### Dashboard

#### GYM-001 · Widget Allenamento

Stato: fatto (#122) · Origine: pkm, cambia

Il widget in dashboard sostituisce il mock della sessione in corso con
l'ultimo allenamento e la settimana.

Accettazione:

- [x] Una foto dell'ultimo allenamento: l'immagine (GYM-014) del suo primo
      esercizio, con sopra il nome della routine, il giorno (`oggi`, `ieri`
      o data estesa) e la durata.
- [x] Sotto, solo due numeri: allenamenti questa settimana e giorni di
      fila (GYM-013), in `font-mono`, e un piccolo grafico a barre degli
      allenamenti per settimana sulle ultime 12 settimane, con la settimana
      corrente in rosso.
- [x] Senza dati mostra `Nessun allenamento · importa il CSV di Liftin'`
      con il link alla pagina.
- [x] Il link `Dettagli` apre la pagina Allenamenti (GYM-002).
- [x] Durante il primo caricamento mostra lo skeleton.

#### GYM-002 · Pagina Allenamenti

Stato: pianificato (#123) · Origine: pkm, cambia

Una pagina `/allenamenti` (oggi `ComingSoon`) fatta soprattutto di
immagini e con pochi numeri. Dall'alto: titolo con una riga di costanza
(GYM-013), la dashboard esercizi (GYM-007), i nuovi record (GYM-010)
accanto al volume per gruppo muscolare (GYM-012), lo storico delle sessioni
(GYM-004). In testata il pulsante `Importa CSV` (GYM-003) e il link
all'elenco degli esercizi (GYM-009).

Accettazione:

- [ ] La voce Allenamenti della barra di navigazione apre la pagina.
- [ ] Senza dati la pagina mostra solo un invito a importare il CSV.
- [ ] Card compatte: le immagini sono piccole e le card stanno in griglie
      da 4 a 6 colonne.
- [ ] Ogni esercizio mostrato ha la sua immagine (GYM-014); le foto sono in
      bianco e nero e scurite, così l'unico colore resta l'accento rosso.
- [ ] Ogni sezione ha il suo skeleton e il suo messaggio di errore, senza
      bloccare le altre.

### Import

#### GYM-003 · Import del CSV di Liftin'

Stato: fatto (#119) · Origine: pkm, cambia

Dalla pagina si carica il file esportato da Liftin' (`Date;Duration;
Routine;Exercise;Set;Warmup;Weight;Reps/Time;Goal;Perception`, separatore
`;`). Il file va al backend, che lo legge e lo unisce ai dati esistenti.

Accettazione:

- [x] Dialog con area di trascinamento e scelta del file, solo `.csv`,
      massimo 5 MB.
- [x] Il parser sta nel server ed è quello di pkm portato in TypeScript:
      colonne cercate per nome e non per posizione, `Reps/Time` intero =
      ripetizioni, `mm:ss` = durata, virgole o punti nei decimali, righe
      senza data o esercizio scartate e contate.
- [x] Una sessione è un giorno più una routine; la serie è identificata da
      giorno, routine, esercizio (confronto senza maiuscole e spazi in più)
      e numero di serie. Un re-import aggiorna le righe già presenti e non
      le duplica; un re-import identico non cambia nulla.
- [x] Prima di confermare il dialog mostra l'anteprima calcolata dal
      server, in tre righe: allenamenti nuovi, allenamenti aggiornati,
      righe scartate, più il periodo coperto. `Importa` applica, `Annulla` non scrive
      niente.
- [x] Errori chiari: file vuoto, colonne mancanti (con i nomi), nessuna
      riga valida, file troppo grande.
- [x] Le sessioni eliminate (GYM-006) non tornano con un re-import.
- [x] Dopo l'import widget e pagina si aggiornano senza ricaricare.

### Storico

#### GYM-004 · Storico delle sessioni

Stato: fatto (#124) · Origine: pkm

Accettazione:

- [x] Elenco dalla più recente: le miniature dei primi tre esercizi,
      routine, giorno e durata. Niente altri numeri nella riga.
- [x] Filtro per routine, con i nomi presi dai dati.
- [x] Caricamento a pagine da 20 sessioni.

#### GYM-005 · Dettaglio di una sessione

Stato: pianificato (#125) · Origine: pkm

Accettazione:

- [ ] In testata routine, giorno e ora, durata e volume della sessione.
- [ ] Sotto, un grafico a barre orizzontali del volume per esercizio, con
      l'esercizio più pesante in rosso.
- [ ] Una card per esercizio, nell'ordine del CSV, con l'immagine
      (GYM-014) e le serie come `peso × reps` (o durata); niente colonne di
      1RM o percezione.
- [ ] Le serie di riscaldamento sono tratteggiate e non entrano nei totali.
- [ ] Un record personale stabilito in quella sessione è segnato sulla
      card (GYM-010).
- [ ] I dati sono in sola lettura.

#### GYM-006 · Eliminare una sessione

Stato: pianificato (#126) · Origine: nuovo

Unica modifica possibile sui dati importati, per togliere una sessione
sbagliata. Le correzioni si fanno in Liftin' e si re-importano.

Accettazione:

- [ ] Dal dettaglio, `Elimina sessione` con conferma.
- [ ] La sessione sparisce da storico, grafici, record e costanza.
- [ ] Il server ricorda giorno e routine eliminati, così un re-import non
      la ripristina (GYM-003).

### Esercizi

#### GYM-007 · Dashboard esercizi

Stato: pianificato (#127) · Origine: pkm (ADR-0030)

Accettazione:

- [ ] Una riga di 6 card compatte, i 6 esercizi più allenati per numero di
      serie: immagine (GYM-014), nome, miglior 1RM stimato e sparkline
      dell'andamento.
- [ ] Per un esercizio a tempo la card mostra la durata migliore al posto
      dell'1RM.
- [ ] Un clic apre i grafici dell'esercizio (GYM-008).

#### GYM-008 · Pagina di un esercizio

Stato: pianificato (#128) · Origine: pkm, cambia

Accettazione:

- [ ] In testata l'immagine grande dell'esercizio (GYM-014) con nome,
      gruppo e tre numeri: 1RM stimato, peso più alto, sessioni.
- [ ] Un grafico per volta, con un selettore `1RM stimato` / `Volume`; per
      gli esercizi a tempo `Durata migliore` / `Durata totale`.
- [ ] Periodo: 3 mesi, 6 mesi, 1 anno, tutto.
- [ ] Sotto il grafico le ultime 3 volte: giorno, serie e peso, 1RM, con
      link al dettaglio.
- [ ] Il gruppo muscolare dell'esercizio, modificabile da qui (GYM-011).

#### GYM-009 · Elenco degli esercizi

Stato: pianificato (#130) · Origine: nuovo

Accettazione:

- [ ] Griglia di card compatte, 6 per riga, con immagine (GYM-014), nome, gruppo e ultima volta,
      dalla più recente; ricerca per nome.
- [ ] Un filtro `Da completare` mostra gli esercizi senza gruppo o senza
      immagine, con un'etichetta sulla card che dice cosa manca.
- [ ] Un clic apre i grafici dell'esercizio (GYM-008).
- [ ] I nomi sono quelli del CSV, senza alias né unione.

#### GYM-010 · Record personali

Stato: pianificato (#132) · Origine: nuovo

Accettazione:

- [ ] Per esercizio: miglior 1RM stimato, peso più alto, più ripetizioni a
      un dato peso, volume più alto in una sessione; per gli esercizi a
      tempo, durata più lunga. Ognuno con la data.
- [ ] Nella pagina, al massimo 3 record degli ultimi 30 giorni, dal più
      recente, con la miniatura dell'esercizio.
- [ ] Riscaldamento e serie a 0 kg esclusi, come nelle altre metriche.

### Gruppi muscolari

#### GYM-011 · Gruppo muscolare di un esercizio

Stato: pianificato (#133) · Origine: nuovo

Il CSV di Liftin' non porta il gruppo muscolare: lo si assegna una volta
per esercizio e vale per tutto lo storico.

Accettazione:

- [ ] Elenco fisso: `Petto`, `Schiena`, `Spalle`, `Bicipiti`, `Tricipiti`,
      `Gambe`, `Glutei`, `Addome`, `Altro`.
- [ ] Un gruppo per esercizio, assegnato dall'elenco esercizi (GYM-009) o
      dai grafici (GYM-008).
- [ ] Gli esercizi senza gruppo finiscono in `Non assegnato` e compaiono
      nel filtro `Da completare` (GYM-009).
- [ ] Quando si sceglie l'immagine (GYM-014), il gruppo viene proposto dai
      muscoli principali del catalogo, se non è già assegnato.
- [ ] L'assegnazione è legata al nome dell'esercizio e sopravvive ai
      re-import.

#### GYM-012 · Volume per gruppo muscolare

Stato: pianificato (#134) · Origine: nuovo

Accettazione:

- [ ] Volume e numero di serie per gruppo, settimana per settimana, sulle
      ultime 12 settimane, in barre impilate.
- [ ] Sotto, solo la legenda dei gruppi; niente tabella.
- [ ] `Non assegnato` compare come gruppo a sé.

### Immagini

#### GYM-014 · Immagine di un esercizio

Stato: fatto (#120) · Origine: nuovo

Ogni esercizio ha una foto, presa da
[free-exercise-db](https://github.com/yuhonas/free-exercise-db): 876
esercizi in pubblico dominio (Unlicense), ognuno con due foto, muscoli
principali e attrezzatura.

Accettazione:

- [x] Il backend tiene una copia del catalogo (JSON e foto) in un volume
      del server, scaricata al primo avvio e aggiornabile; le pagine non
      caricano immagini da GitHub.
- [x] I nomi italiani più comuni (panca piana, squat, stacco, rematore,
      military press, lat machine, plank…) hanno un abbinamento già pronto
      in un dizionario nel codice.
- [x] Per gli altri, `Scegli immagine` apre un dialog con ricerca nel
      catalogo (nomi in inglese) e una griglia di foto; la scelta vale per
      tutto lo storico di quel nome e sopravvive ai re-import.
- [x] Senza immagine la card mostra un riquadro neutro con l'icona della
      palestra e l'etichetta `Scegli immagine`.
- [x] Le foto si mostrano in bianco e nero e scurite, con il testo sopra su
      una sfumatura scura.

### Costanza

#### GYM-013 · Allenamenti della settimana e giorni di fila

Stato: fatto (#121) · Origine: pkm

Accettazione:

- [x] Allenamenti questa settimana: sessioni da lunedì a oggi, fuso
      `Europe/Rome`.
- [x] Giorni di fila: giorni di calendario consecutivi con almeno una
      sessione, che finiscono oggi o ieri (`GymMath.currentStreakDays` di
      pkm).
- [x] Usati da widget (GYM-001) e pagina (GYM-002).
- [x] Nella pagina, un grafico a barre degli allenamenti per settimana
      sulle ultime 26 settimane, con la media.

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
- `workout_exercises`: nome normalizzato dell'esercizio, gruppo e id
  dell'immagine nel catalogo.
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
| `GET /catalog?q=`                     | ricerca nel catalogo immagini          | 014       |
| `PUT /exercises/{name}/image`         | immagine scelta                        | 014       |
| `GET /catalog/images/{id}/{n}.jpg`    | foto servita dal backend               | 014       |
| `GET /records?days=`                  | record personali                       | 010       |
| `GET /muscle-groups?weeks=`           | volume per gruppo                      | 012       |

`POST /import/preview` e `POST /import` ricevono il file come
`multipart/form-data`; il client non interpreta il CSV.

### Piano di lavoro

1. **Specifica**, confermata il 2026-10-22.
2. **Mockup** del widget e delle pagine:
   [canvas Modulo Allenamento](https://claude.ai/artifact/PRfY9udWyoGFidTM26i81W)
   (widget in tre stati, pagina `/allenamenti`, import con anteprima,
   dettaglio sessione, pagina di un esercizio, elenco esercizi, scelta
   dell'immagine), approvati il 2026-10-22.
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
10. **Immagini e densità** (2026-10-22, dopo i primi mockup). Un'immagine
    per ogni esercizio (GYM-014) e schermate con meno numeri: widget,
    pagina, dettaglio, esercizio ed elenco rifatti di conseguenza. Poi
    card più piccole e qualche grafico in più: barre settimanali nel
    widget e nella pagina, sparkline sulle card, volume per esercizio nel
    dettaglio.
11. **Rimandati.** Calcolatore dischi e riscaldamento, peso corporeo
    accanto ai grafici, Apple Salute, progressione suggerita.
