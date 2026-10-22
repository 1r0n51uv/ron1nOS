# Documenti

Prefisso ID: `DOC` · Label: `mod:documents`

Il modulo è un archivio dei documenti personali: carta d'identità,
passaporto, patente, tessera sanitaria e codice fiscale, contratti e
qualsiasi altro documento. Per ognuno si caricano i file (immagini, PDF o
altro) e si compilano i campi con i valori del documento. In consultazione
i documenti importanti sono in evidenza, ogni campo si copia con un tocco
e i file si copiano o si scaricano.

Riprende le idee della bozza di design del modulo `documenti` di 1r0-pkm
(ADR-0040, mai realizzata), con una differenza di fondo: lì la cifratura
era end-to-end, con la chiave sul telefono e il server che vedeva solo
ciphertext. Qui la logica sta nel backend di ron1nOS (`/api/v1`), che
serve allo stesso modo la dashboard web e la futura app iOS, quindi i dati
sono cifrati a riposo sul server e il backend li decifra per i client
autenticati (decisione 4).

Non fa, per ora: lettura automatica del testo (OCR, MRZ), storico dei
rinnovi, condivisione con link, notifiche push (arrivano con l'app iOS).

**Prerequisito: il login della dashboard** ([auth.md](auth.md)). Senza
login chiunque sia nella tailnet vedrebbe i documenti; il modulo non va in
produzione prima di AUTH-001…004.

**Stato del documento: proposto il 2026-10-22.** Le scelte sono in fondo,
in "Decisioni". La disposizione della pagina si decide con i mockup, dopo
che la specifica è confermata (decisione 7).

## Requisiti

### Consultazione

#### DOC-001 · Widget Documenti

Stato: proposto

Il widget in dashboard mostra i documenti in evidenza e quelli in
scadenza.

Accettazione:

- [ ] Fino a 4 documenti fissati (DOC-008), con icona del tipo e titolo;
      un clic apre il dettaglio (DOC-004).
- [ ] Sotto, i documenti scaduti o in scadenza entro 90 giorni (DOC-010),
      con `Scade tra N giorni` o `Scaduto`; lo scaduto usa il rosso
      `brand`.
- [ ] Nessun valore dei campi nel widget: solo tipo, titolo, titolare e
      scadenza.
- [ ] Il link `Dettagli` apre la pagina Documenti (DOC-002).
- [ ] Stato vuoto con `Aggiungi documento`.

#### DOC-002 · Pagina Documenti

Stato: proposto

Una pagina `/documenti` con tutti i documenti.

Accettazione:

- [ ] In alto i documenti fissati, sotto gli altri raggruppati per tipo.
- [ ] Ricerca per titolo e tag; filtri per tipo e titolare (DOC-007).
- [ ] Ogni documento mostra tipo, titolo, titolare, scadenza e una
      miniatura del primo allegato se è un'immagine.
- [ ] Disposizione (griglia di card o lista) decisa con i mockup.

#### DOC-003 · Tipi di documento

Stato: proposto

I tipi sono definiti in codice, ognuno con i suoi campi fissi. Aggiungere
un tipo o un campo non richiede migrazioni.

| Tipo              | Campi                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `identity_card`   | numero, cognome, nome, data di nascita, luogo di nascita, comune di rilascio, data di rilascio, CF |
| `passport`        | numero, cognome, nome, nazionalità, data di nascita, autorità, data di rilascio                    |
| `driving_license` | numero, cognome, nome, data di nascita, categorie, rilasciata da, data di rilascio                 |
| `health_card`     | codice fiscale, numero tessera, cognome, nome                                                      |
| `contract`        | nessun campo fisso: allegati e campi liberi (DOC-006)                                              |
| `other`           | nessun campo fisso: allegati e campi liberi (DOC-006)                                              |

Accettazione:

- [ ] Ogni campo ha chiave stabile, etichetta, tipo (`text`, `date`,
      `code`) e se è copiabile.
- [ ] La data di scadenza è comune a tutti i tipi e sta fuori dai campi.
- [ ] Il backend valida i campi contro il tipo: chiavi sconosciute
      rifiutate, date in formato `YYYY-MM-DD`.
- [ ] I tipi e i loro campi si leggono da `GET /documents/types`, così
      web e iOS non li duplicano.
- [ ] Il tipo non si cambia dopo la creazione.

#### DOC-004 · Dettaglio del documento

Stato: proposto

Accettazione:

- [ ] Allegati in alto: immagini e PDF con anteprima, gli altri file con
      icona, nome e dimensione. Clic su un'immagine → schermo intero.
- [ ] Sotto, i campi del tipo e i campi liberi, ognuno con il pulsante
      copia (DOC-009).
- [ ] Scadenza, titolare, tag, note.
- [ ] Azioni: modifica, fissa/togli dall'evidenza, scarica PDF di
      riepilogo, elimina (con conferma).

### Inserimento

#### DOC-005 · Creare e modificare un documento

Stato: proposto

Accettazione:

- [ ] Si sceglie il tipo, poi un form con titolo (precompilato con il
      nome del tipo), titolare, campi del tipo, campi liberi, scadenza,
      tag e note.
- [ ] Tutti i campi sono facoltativi tranne tipo e titolo.
- [ ] Gli allegati si aggiungono nello stesso form (DOC-011).
- [ ] Salvataggio solo se il backend accetta; gli errori di validazione
      si mostrano sul campo.

#### DOC-006 · Campi liberi

Stato: proposto

Su ogni documento si possono aggiungere coppie etichetta/valore, oltre ai
campi del tipo. Per `contract` e `other` sono gli unici campi.

Accettazione:

- [ ] Aggiungere, rinominare, riordinare ed eliminare un campo libero.
- [ ] Un campo libero si copia come quelli del tipo.
- [ ] Massimo 30 campi liberi per documento, etichetta fino a 60
      caratteri, valore fino a 2000.

#### DOC-007 · Titolare

Stato: proposto

Ogni documento ha un titolare, per tenere anche quelli dei familiari.

Accettazione:

- [ ] Il titolare è un nome libero; di default il proprietario della
      dashboard.
- [ ] Nel form si sceglie tra i titolari già usati o se ne scrive uno
      nuovo.
- [ ] La pagina filtra per titolare (DOC-002).

#### DOC-008 · Documenti in evidenza

Stato: proposto

Accettazione:

- [ ] Un documento si fissa o si toglie dall'evidenza dal dettaglio e
      dalla pagina.
- [ ] I fissati stanno in cima alla pagina e nel widget, nell'ordine in
      cui sono stati fissati.

### Copia e download

#### DOC-009 · Copia dei valori e delle immagini

Stato: proposto

Accettazione:

- [ ] Ogni campo ha un pulsante copia; un toast conferma `Copiato`.
- [ ] Un'immagine si copia negli appunti come immagine (PNG), dove il
      browser lo permette; altrimenti il pulsante non compare.
- [ ] `Copia tutto` copia campi ed etichette come testo, una riga per
      campo.

#### DOC-010 · Scadenze e preavvisi

Stato: proposto

Accettazione:

- [ ] Ogni documento può avere una data di scadenza e dei preavvisi a
      90, 30 e 7 giorni, attivabili uno per uno (di default tutti).
- [ ] Il documento è `in scadenza` dal primo preavviso attivo e
      `scaduto` dal giorno dopo la scadenza.
- [ ] Il widget (DOC-001) e la pagina mostrano lo stato.
- [ ] Le notifiche push arrivano con l'app iOS; i testi non conterranno
      numeri né nomi, solo tipo e data (`Passaporto · scade tra 30 giorni`).

#### DOC-011 · Allegati

Stato: proposto

Accettazione:

- [ ] Più file per documento, di qualsiasi tipo, fino a 20 MB l'uno e
      100 MB per documento.
- [ ] Ogni allegato ha un'etichetta (`fronte`, `retro`, `pagina`,
      `altro`) e un ordine, modificabili.
- [ ] Anteprima per immagini (JPEG, PNG, HEIC, WebP) e PDF; gli altri si
      possono solo scaricare.
- [ ] Il tipo del file si ricava dal contenuto, non solo
      dall'estensione; il nome originale si conserva.
- [ ] Caricamento con barra di avanzamento; un errore su un file non
      blocca gli altri.

#### DOC-012 · Scaricare gli allegati

Stato: proposto

Accettazione:

- [ ] Ogni allegato si scarica con il suo nome originale.
- [ ] Le risposte hanno `Cache-Control: no-store`: niente copie nella
      cache del browser.

#### DOC-013 · PDF di riepilogo

Stato: proposto

Accettazione:

- [ ] Il backend genera al volo un PDF A4: titolo, titolare, scadenza, le
      immagini allegate in alto e i campi sotto.
- [ ] Gli allegati PDF si accodano come pagine; gli altri file sono solo
      elencati per nome.
- [ ] Il PDF non viene salvato sul server. La UI avvisa che il file
      scaricato è in chiaro.

#### DOC-014 · Eliminare

Stato: proposto

Accettazione:

- [ ] Si elimina un allegato o un intero documento, con conferma.
- [ ] L'eliminazione è definitiva: via dal database i campi e i file.

### Sicurezza

#### DOC-015 · Cifratura a riposo

Stato: proposto

Accettazione:

- [ ] Campi del tipo, campi liberi, note e contenuto degli allegati sono
      cifrati con AES-256-GCM prima di finire in Postgres.
- [ ] La chiave è `DOCUMENTS_KEY` (32 byte in base64) nel `.env` del
      server, mai nel database né nel repo. Senza chiave il modulo si
      spegne e lo dice, il resto della dashboard funziona.
- [ ] Ogni busta porta la versione della chiave e usa come dati
      associati (AAD) l'id del record, così un ciphertext spostato su un
      altro record non si decifra.
- [ ] In chiaro restano solo tipo, titolo, titolare, scadenza, tag,
      evidenza e, per gli allegati, nome, tipo, dimensione, etichetta e
      ordine: servono a elenco, ricerca e scadenze.
- [ ] Nei log non finiscono mai valori dei campi né contenuti dei file.
- [ ] Test: busta che si apre con la chiave giusta, che fallisce con
      chiave o AAD sbagliate, e che il database contiene solo ciphertext.

## Note

### Architettura

- **Rotte** sotto `/api/v1/documents`, dietro il login (AUTH-003), in
  `api/openapi.yaml`.
- **Database.** Tabelle nel database `ron1nos` già usato da Nutrizione,
  con una migrazione nuova in `server/migrations/`:
  - `documents`: id, tipo, titolo, titolare, scadenza, preavvisi, tag,
    fissato (con ordine), `key_version`, `envelope` (bytea: JSON cifrato
    di campi, campi liberi e note), date di creazione e modifica;
  - `document_files`: id, documento, nome, tipo MIME, dimensione,
    etichetta, ordine, `key_version`, `ciphertext` (bytea). Tabella a
    parte, così gli elenchi non caricano i file.
- **File in Postgres** (decisione 6): pochi documenti per pochi MB l'uno;
  un solo posto per dati e file. Il limite di 20 MB per file tiene le
  righe ragionevoli.
- **Miniature.** Per la pagina servono miniature delle immagini: il
  backend le genera al caricamento (lato lungo 400 px, JPEG) e le salva
  cifrate accanto all'originale. La libreria (`sharp` o simile) si sceglie
  nella issue.
- **Backup.** Per ora nessuno, come per tutto il server. Senza backup un
  disco rotto fa perdere i documenti; se i dump verranno riattivati,
  coprono anche i file. La `DOCUMENTS_KEY` va conservata a parte (password
  manager): senza, i dati non si leggono più.

### Endpoint proposti

| Metodo e rotta                                     | Uso                            | Requisiti     |
| -------------------------------------------------- | ------------------------------ | ------------- |
| `GET /types`                                       | tipi e campi                   | 003           |
| `GET /documents?q=&type=&holder=`                  | elenco, ricerca, filtri        | 001, 002, 007 |
| `POST /documents`                                  | crea                           | 005           |
| `GET`/`PATCH`/`DELETE /documents/{id}`             | dettaglio, modifica, elimina   | 004–008, 014  |
| `POST /documents/{id}/files`                       | carica un allegato (multipart) | 011           |
| `PATCH`/`DELETE /documents/{id}/files/{fileId}`    | etichetta, ordine, elimina     | 011, 014      |
| `GET /documents/{id}/files/{fileId}?variant=thumb` | scarica o anteprima            | 004, 012      |
| `GET /documents/{id}/summary.pdf`                  | PDF di riepilogo               | 013           |
| `GET /holders`                                     | titolari già usati             | 007           |

Tutte le rotte sono relative a `/api/v1/documents`.

### Rispetto alla bozza di pkm (ADR-0040)

Si tengono: campi fissi per tipo definiti in codice, busta AES-GCM con
versione della chiave e AAD per record, metadati in chiaro solo dove
servono, file in Postgres in una tabella a parte, testi dei preavvisi
senza dati sensibili, PDF generato al volo e mai salvato.

Cambiano: niente chiave sul telefono né passphrase di recupero (la chiave
sta sul server, decisione 4); lo sblocco è il login generale e non Face
ID (decisione 5); allegati di qualsiasi tipo e non solo immagini; campi
liberi su ogni tipo; titolare.

### Piano di lavoro

1. **Specifica** (questa PR) e login ([auth.md](auth.md)).
2. **Mockup** della pagina, del dettaglio e del form.
3. **Issue** con label `mod:documents`, una per requisito più una per la
   base (migrazione e cifratura).
4. **Login** (AUTH-001…004) prima di tutto il resto.
5. **Base**: migrazione, busta, tipi (DOC-003, DOC-015).
6. **API e web**: inserimento, allegati, dettaglio, copia, download,
   widget.

## Decisioni

Prese il 2026-10-22.

1. **Tipi.** Preset in codice più campi liberi su ogni documento.
2. **Contratti.** Allegati PDF più campi liberi facoltativi, senza campi
   fissi; i documenti d'identità si caricano come immagini. (Lettura
   della risposta "solo immagini, allegati PDF più campi opzionali
   liberi": da correggere se intendevi altro.)
3. **Allegati.** Qualsiasi file, con anteprima per immagini e PDF.
4. **Cifratura.** A riposo sul server, chiave nel `.env`; il backend
   decifra per web e iOS.
5. **Sblocco.** Niente PIN del modulo: serve il login generale della
   dashboard, specificato a parte in [auth.md](auth.md).
6. **Archivio.** File cifrati nel Postgres condiviso, in una tabella a
   parte.
7. **Evidenza e disposizione.** Si decidono con i mockup dopo la
   specifica.
8. **Titolare.** Sì, con filtro; di default il proprietario.
9. **Copia e download.** Copia per campo, copia immagine, scarica
   originale, PDF di riepilogo. Niente ZIP.
10. **Scadenze.** Data di scadenza con preavvisi 90/30/7, mostrati nel
    widget; push con l'app iOS.
11. **Rimandati.** OCR e lettura MRZ, storico rinnovi, condivisione con
    link.
