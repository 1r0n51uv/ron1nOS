# Dashboard personalizzabile

Prefisso ID: `DASH` · Label: `mod:dashboard`

Oggi la dashboard mostra otto widget fissi, uno per modulo, in una griglia
che si dispone da sola. Con questa specifica diventa personalizzabile: si
aggiungono e tolgono widget, si spostano e ridimensionano liberamente e di
ognuno si sceglie variante e dati mostrati. Non è un modulo: è la cornice
in cui stanno i widget di tutti i moduli.

Il layout si salva sul backend (`/api/v1`), uno per dispositivo: quello
del desktop e quello della futura app iOS sono separati ma vivono nello
stesso posto, così l'app li legge e li modifica con le stesse rotte.

Le impostazioni generali (aspetto, moduli accesi, account…) sono in
[settings.md](settings.md).

Non fa, per ora: più dashboard a schede, widget duplicati con
impostazioni diverse, titoli o colori personalizzati per widget, layout
mobile del web (vale la regola desktop di `CLAUDE.md`).

**Stato del documento: approvato il 2026-10-22, requisiti pianificati.** Le scelte sono in fondo,
in "Decisioni".

## Requisiti

### Widget

#### DASH-001 · Catalogo dei widget

Stato: fatto (#158)

Ogni modulo dichiara uno o più widget in un catalogo unico, invece di un
solo `Widget.tsx` importato a mano in `Dashboard.tsx`.

Accettazione:

- [x] Ogni modulo ha un file `widgets.ts` che esporta le sue definizioni:
      id stabile `<modulo>.<nome>` (es. `nutrition.calories`), titolo,
      descrizione di una riga e componente.
- [x] Modulo, dimensione minima, massima e predefinita e varianti di ogni
      id stanno nel catalogo `server/dashboard/catalog.ts`, unica fonte
      per il backend (validazione dei layout, DASH-007) e per la
      dashboard. Le opzioni dei dati arrivano con DASH-005.
- [x] Un registro (`src/widgets/registry.ts`) unisce le due parti; la
      dashboard e il pannello `Aggiungi widget` leggono solo da lì. Un
      test controlla che ogni voce del catalogo abbia il suo componente e
      viceversa.
- [x] I widget di un modulo spento (SET-005) non compaiono né in griglia
      né nel catalogo (`availableWidgets`).

#### DASH-002 · Primi widget del catalogo

Stato: pianificato (#145)

Gli otto widget di oggi restano, con lo stesso id del loro modulo
(`<modulo>.summary`), e alcuni moduli ne aggiungono di più piccoli. I
moduli futuri (Documenti, Allenamenti) dichiarano i loro nella propria
specifica.

| Modulo     | Widget                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| nutrition  | `summary` (giornata, come oggi), `calories` (solo anello), `next-meal` (prossimo pasto), `supplements` |
| server     | `summary` (come oggi), `metric` (una sola risorsa a scelta: CPU, RAM, disco, rete)                     |
| downloads  | `summary` (come oggi), `speed` (velocità e numero di torrent attivi)                                   |
| containers | `summary` (elenco, come oggi), `status` (solo il conteggio attivi/fermi)                               |
| workout    | `summary`                                                                                              |
| weight     | `summary`                                                                                              |
| home       | `summary`                                                                                              |
| notes      | `summary`                                                                                              |

Accettazione:

- [ ] Ogni widget nuovo legge dallo stesso hook del modulo, senza rotte
      nuove.
- [ ] Ogni widget ha uno scenario e2e che lo aggiunge e lo vede in
      griglia.

### Disposizione

#### DASH-003 · Griglia libera

Stato: fatto (#162)

Accettazione:

- [x] La griglia ha 24 colonne e righe da 24px; ogni widget occupa un
      rettangolo `x, y, w, h` in queste unità.
- [x] I widget stanno dove li si lascia: niente compattazione verso
      l'alto, gli spazi vuoti restano.
- [x] Due widget non si sovrappongono: se il rilascio cade su un widget
      occupato, l'altro si sposta sotto quanto basta.
- [x] La griglia è larga quanto l'area dei contenuti (minimo 1024px); la
      sua altezza cresce con il widget più in basso.

#### DASH-004 · Modifica sempre attiva

Stato: in corso (#142)

Non c'è una modalità modifica da aprire e chiudere: la dashboard si
cambia mentre la si usa.

Accettazione:

- [x] Al passaggio del mouse su un widget compaiono la maniglia di
      trascinamento nell'intestazione, l'angolo di ridimensionamento in
      basso a destra e il menu `⋯` (`Opzioni`, `Rimuovi`). Il resto del
      widget resta cliccabile come oggi. `Opzioni` entra nel menu con
      DASH-005.
- [x] Si trascina solo dalla maniglia, per non spostare un widget per
      sbaglio cliccando un link o un pulsante.
- [x] Il ridimensionamento rispetta le dimensioni minime e massime del
      widget (DASH-001).
- [x] `Rimuovi` toglie subito il widget e mostra `Widget rimosso ·
Annulla` per 8 secondi.
- [x] `Aggiungi widget`, accanto alla testata, apre il catalogo diviso per
      modulo, con anteprima; il widget scelto entra nel primo spazio
      libero in alto, alla dimensione predefinita.
- [x] Tutto si fa anche da tastiera: maniglia focalizzabile, frecce per
      spostare, `Shift` + frecce per ridimensionare, `Canc` per rimuovere.

#### DASH-005 · Opzioni del widget

Stato: in corso (#143)

Accettazione:

- [x] `Opzioni` apre un pannello con l'anteprima del widget e le sue
      impostazioni.
- [x] Variante `compatta` o `dettagliata`, se il widget le supporta.
- [x] Dati mostrati, dichiarati dal widget: per esempio quale risorsa per
      `server.metric`, quali macro per `nutrition.summary`, quanti elementi
      per gli elenchi.
- [x] Le opzioni si salvano con il layout (DASH-007) e il widget le riceve
      come proprietà; senza opzioni salvate usa i valori predefiniti.

Primi widget con opzioni: `nutrition.summary` (macro mostrate),
`weight.summary` (variante compatta senza andamento), `downloads.summary`
(quanti download). `server.metric` arriva con DASH-002.

#### DASH-006 · Testata riducibile

Stato: pianificato (#144)

La testata è il blocco in alto con data, saluto, frase di stato e pill
dell'homelab.

Accettazione:

- [ ] Tre forme: `completa` (come oggi), `una riga` (data · frase di
      stato · pill, senza saluto grande) e `nascosta`.
- [ ] Si cambia dal menu `⋯` della testata e dalle impostazioni (SET-004);
      si salva con il layout.
- [ ] Con la testata nascosta `Aggiungi widget` resta raggiungibile in
      alto a destra.

### Salvataggio

#### DASH-007 · Layout sul server

Stato: fatto (#161)

Accettazione:

- [x] Tabella `dashboard_layouts` (migrazione nuova): `device`
      (`desktop` o `iphone`), elenco dei widget con id, posizione,
      dimensione, variante e opzioni, forma della testata, data di
      modifica.
- [x] `GET /api/v1/dashboard/layouts/{device}` restituisce il layout
      salvato, o quello predefinito (DASH-008) se non ce n'è.
- [x] `PUT /api/v1/dashboard/layouts/{device}` lo sostituisce. Il backend
      rifiuta con `422` id sconosciuti, dimensioni fuori dai limiti,
      sovrapposizioni e opzioni non valide per quel widget.
- [x] Le rotte sono in `api/openapi.yaml`, con lo schema del layout.
- [x] La dashboard salva da sola un secondo dopo l'ultima modifica, senza
      pulsante. Se il salvataggio fallisce compare `Layout non salvato ·
Riprova` e il layout resta quello sullo schermo.
- [x] Senza database (`DATABASE_URL` assente) la dashboard mostra il
      layout predefinito e le modifiche non si salvano, con un avviso.
- [x] Gli elementi di un modulo spento restano nel layout salvato, così
      riaccendendolo il widget torna dov'era.

#### DASH-008 · Layout predefinito e ripristino

Stato: pianificato (#140)

Accettazione:

- [ ] Il layout predefinito del desktop riproduce la dashboard di oggi:
      gli otto `summary` nello stesso ordine.
- [ ] `Ripristina layout predefinito`, nelle impostazioni (SET-004), con
      conferma, rimette quello e cancella le opzioni dei widget.

## Decisioni

Prese il 2026-10-22 dal proprietario, con le schede di scelta.

1. **Catalogo.** Più widget per modulo (es. anello delle calorie,
   prossimo pasto separati), non copie dello stesso widget.
2. **Modifica.** Sempre attiva, senza pulsante `Personalizza`.
3. **Disposizione.** Posizione libera e ridimensionabile su griglia fine,
   con spazi vuoti possibili.
4. **Aspetto del widget.** Dimensione, variante compatta o dettagliata e
   dati mostrati. Niente titolo, colore o stile della superficie per
   widget.
5. **Salvataggio.** Sul server, un layout per il desktop e uno per
   l'iPhone.
6. **Quante dashboard.** Una sola, con la testata riducibile a una riga o
   nascosta.

Scelte fatte nella stesura, da confermare con i mockup:

- Dimensioni e varianti dei widget stanno in un catalogo unico condiviso
  da backend e web, invece di ripeterle nel `widgets.ts` di ogni modulo
  (DASH-001, 2026-10-23).

- Con la modifica sempre attiva, il trascinamento parte solo dalla
  maniglia e la rimozione ha `Annulla`, per evitare modifiche per sbaglio.
- Griglia di 24 colonne × 24px, abbastanza fine per una posizione libera
  ma con allineamenti puliti. Due widget non si sovrappongono mai.
- Primi widget nuovi della tabella DASH-002: si possono cambiare dopo i
  mockup.
