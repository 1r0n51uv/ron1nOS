# Design e accessibilità

Prefisso ID: `DES` · Label: `mod:design`

Correzioni nate dalla revisione del design della dashboard fatta con la
skill `apple-design` il 2026-10-28 (Human Interface Guidelines di Apple).
Non è un modulo: sono regole di aspetto e accessibilità che valgono per
tutte le pagine e per i componenti condivisi in `src/components`.

Il tema resta solo scuro e il design system ron1nOS resta la fonte per
colori, vetro e caratteri. Dove la revisione e il design system non
concordano, qui sotto è scritto cosa si è scelto.

Non fa: layout mobile del web (vale la regola desktop di `CLAUDE.md`),
un selettore chiaro/scuro.

**Stato del documento: approvato il 2026-10-28** ("Correggi tutto" dopo la
revisione). Le scelte sono in fondo, in "Decisioni".

## Requisiti

### Colore

#### DES-001 · Il rosso è solo un segnale

Stato: fatto (#233)

Oggi il rosso indica sei cose insieme (allarme, stato acceso, progresso,
andamento, link, azione primaria) e l'allarme vero si perde. Il rosso resta
per gli allarmi e per l'azione primaria; il resto passa all'inchiostro
(`ink`), come già fa l'app iOS (IOS-014).

Accettazione:

- [x] `Progress` e gli anelli e le barre dei widget sono `ink`; diventano
      rossi solo con un tono `alert` esplicito, usato quando il valore
      supera una soglia.
- [x] La linea di andamento (`Sparkline`, peso) è `ink`.
- [x] Il tassello di Casa (`ToggleTile`) acceso ha fondo e bordo chiari e
      un punto pieno `ink`; spento ha il punto vuoto. Lo stato resta
      leggibile senza colore (`aria-pressed`).
- [x] I link nelle card e nel testo sono `ink` sottolineati, non rossi;
      non si riconoscono dal solo colore.
- [x] Restano rossi: il pulsante primario, il quadratino di problema
      (`StatusDot` alert), la riga di avviso (`AlertRow`), il bordo del
      campo in errore e il segmento in corso dei passi.
- [x] Il testo rosso su vetro usa `brand-text`, mai `brand`; un test
      controlla che nessun componente usi la classe `text-brand`, salvo il
      logotipo.

### Movimento e trasparenza

#### DES-002 · Movimento ridotto

Stato: fatto (#234)

Accettazione:

- [x] Con `prefers-reduced-motion: reduce` le animazioni e le transizioni
      sono azzerate: dialoghi, tooltip, menu, scheletri e anelli di
      caricamento restano fermi o appaiono di colpo.
- [x] Il movimento non è mai l'unico modo per capire che qualcosa sta
      caricando: lo scheletro e il testo restano.
- [x] Uno scenario e2e con il movimento ridotto apre un dialogo e lo
      trova senza animazione.

#### DES-003 · Trasparenza ridotta e contrasto alto

Stato: proposto

Accettazione:

- [ ] Con `prefers-reduced-transparency: reduce` il vetro diventa opaco:
      nessuna sfocatura, riempimento pieno scuro, bordo invariato.
- [ ] Con `prefers-contrast: more` i bordi sono più chiari e `ink-muted`
      diventa `ink`.
- [ ] Le due regole valgono per tutte le intensità del vetro scelte in
      Impostazioni (SET-003) e sono nei token di `src/index.css`.
- [ ] Uno scenario e2e per ciascuna preferenza controlla che le superfici
      non abbiano `backdrop-filter`.

### Controlli

#### DES-004 · Aree cliccabili da 28px

Stato: proposto

Accettazione:

- [ ] I link e i pulsanti di testo nelle card (`Dettagli`, `Gestisci`,
      `Tutti`, `+ Nuova`, `importa il CSV`) hanno un'area cliccabile di
      almeno 28px di altezza, senza cambiare dimensione o posizione del
      testo.
- [ ] Un test misura le aree dei controlli della Home e fallisce sotto i
      28px.

#### DES-005 · Pulsanti che dicono cosa fanno

Stato: proposto

Accettazione:

- [ ] I pulsanti `+` e `−` di Acqua e Caffeina hanno un nome accessibile
      che dice l'effetto, per esempio «Aggiungi 250 ml» e «Togli l'ultima
      voce», e lo stesso testo come tooltip.
- [ ] La riga di aiuto sotto i pulsanti resta.

### Pasti

#### DES-006 · Settimane nel calendario dei Pasti

Stato: proposto

Accettazione:

- [ ] I 21 giorni della striscia sono raggruppati per settimana, con uno
      spazio sottile tra una settimana e l'altra.
- [ ] La settimana di oggi si riconosce, oltre al giorno evidenziato.
- [ ] La selezione da tastiera e il giorno attivo non cambiano.

## Decisioni

Prese il 2026-10-28.

1. **Il rosso nei widget.** Il README del design system dice che `accent`
   va su azioni primarie, progressi e attenzione. Qui si va oltre: i
   progressi e l'andamento passano a `ink`, perché con il rosso ovunque
   l'allarme non si distingue (la revisione, e l'app iOS lo fa già). I
   progressi tornano rossi solo oltre una soglia. Il README del design
   system va aggiornato di conseguenza.
2. **Tessere di Casa.** Accese in `ink`, non in rosso: non sono un
   allarme.
3. **Non cambia.** La pillola di stato in testata e i titoli in Chakra
   Petch restano: sono scritti nel design system (una StatusPill per
   schermata, `display` per i titoli dei widget).
4. **Contrasto del testo rosso.** Nel codice il testo rosso pieno è solo il
   logotipo e il segno del campo a metà del checkbox: non c'era niente da
   cambiare, e DES-001 aggiunge solo il test che lo tiene così.
