# Documenti

Prefisso ID: `DOC` · Label: `mod:documents`

Il modulo è un archivio di documenti e file personali. Si parte sempre da
un file (immagine, PDF o altro) e si sceglie cosa è:

- **un documento con tipo** (carta d'identità, passaporto, patente…): compare
  il form con i campi di quel tipo da compilare;
- **un file con info**: per esempio un PDF generico, con un titolo e le
  informazioni che si vogliono copiare al volo, come campi liberi;
- **un file libero**: solo un titolo, da tenere perché servirà più avanti.

I tipi si configurano dall'interfaccia: oltre a quelli già pronti se ne
creano di nuovi con i propri campi. In consultazione gli elementi
importanti sono in evidenza, ogni campo si copia con un tocco e i file si
copiano o si scaricano. Nel testo "documento" indica uno qualsiasi dei tre.

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

**Stato del documento: confermato il 2026-10-22.** Le scelte sono in
fondo, in "Decisioni". Mockup:
[canvas Modulo Documenti](https://claude.ai/artifact/5qreuPuuYCu468dGvmbULg).

## Requisiti

### Consultazione

#### DOC-001 · Widget Documenti

Stato: fatto (#102)

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

Stato: fatto (#103)

Una pagina `/documenti` con tutti i documenti.

Accettazione:

- [ ] In alto i documenti fissati, sotto gli altri raggruppati per tipo; quelli senza tipo stanno nel gruppo `File`.
- [ ] Ricerca per titolo e tag; filtri per tipo e titolare (DOC-007).
- [ ] Ogni documento mostra tipo, titolo, titolare, scadenza e una
      miniatura del primo allegato se è un'immagine.
- [ ] Griglia di card con miniatura, come la tavola A dei mockup
      (decisione 7).

#### DOC-003 · Tipi di documento

Stato: fatto (#104)

Ogni tipo ha un nome, un'icona e un elenco di campi. I tipi stanno nel
database e si gestiscono dalla UI (DOC-016); questi sono già pronti alla
prima installazione:

| Tipo              | Campi                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `identity_card`   | numero, cognome, nome, data di nascita, luogo di nascita, comune di rilascio, data di rilascio, CF |
| `passport`        | numero, cognome, nome, nazionalità, data di nascita, autorità, data di rilascio                    |
| `driving_license` | numero, cognome, nome, data di nascita, categorie, rilasciata da, data di rilascio                 |
| `health_card`     | codice fiscale, numero tessera, cognome, nome                                                      |

Accettazione:

- [ ] Ogni campo ha chiave stabile, etichetta, tipo (`text`, `date`,
      `code`) e se è copiabile.
- [ ] La data di scadenza è comune a tutti i tipi e sta fuori dai campi.
- [ ] Il backend valida i campi contro il tipo: chiavi sconosciute
      rifiutate, date in formato `YYYY-MM-DD`.
- [ ] I tipi e i loro campi si leggono da `GET /types`, così web e iOS non
      li duplicano.
- [ ] Un documento senza tipo è un file con info o un file libero: ha solo
      titolo e, se servono, campi liberi (DOC-006).
- [ ] Il tipo si può assegnare o cambiare anche dopo: i valori dei campi
      che il nuovo tipo non ha diventano campi liberi, niente si perde.

#### DOC-004 · Dettaglio del documento

Stato: fatto (#105)

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

Stato: fatto (#106)

Accettazione:

- [ ] Si parte dal file: lo si trascina o lo si sceglie (uno o più, DOC-011),
      poi si sceglie cosa è: `Documento` (con il suo tipo), `File con info`
      o `File libero`.
- [ ] `Documento`: form con titolo (precompilato con il nome del tipo),
      titolare, campi del tipo, campi liberi, scadenza, tag e note.
- [ ] `File con info`: titolo, campi liberi, tag e note.
- [ ] `File libero`: titolo (precompilato con il nome del file), tag e
      note.
- [ ] Solo il titolo è obbligatorio. Si può creare anche un documento senza
      file e aggiungerli dopo.
- [ ] Altri file si aggiungono in seguito dal dettaglio.
- [ ] Salvataggio solo se il backend accetta; gli errori di validazione
      si mostrano sul campo.

#### DOC-006 · Campi liberi

Stato: fatto (#107)

Su ogni documento si possono aggiungere coppie etichetta/valore, oltre ai
campi del tipo. Per i file con info sono gli unici campi.

Accettazione:

- [ ] Aggiungere, rinominare, riordinare ed eliminare un campo libero.
- [ ] Un campo libero si copia come quelli del tipo.
- [ ] Massimo 30 campi liberi per documento, etichetta fino a 60
      caratteri, valore fino a 2000.

#### DOC-007 · Titolare

Stato: fatto (#108)

Ogni documento ha un titolare, per tenere anche quelli dei familiari.

Accettazione:

- [ ] Il titolare è un nome libero; di default il proprietario della
      dashboard.
- [ ] Nel form si sceglie tra i titolari già usati o se ne scrive uno
      nuovo.
- [ ] La pagina filtra per titolare (DOC-002).

#### DOC-008 · Documenti in evidenza

Stato: fatto (#109)

Accettazione:

- [ ] Un documento si fissa o si toglie dall'evidenza dal dettaglio e
      dalla pagina.
- [ ] I fissati stanno in cima alla pagina e nel widget, nell'ordine in
      cui sono stati fissati.

### Copia e download

#### DOC-009 · Copia dei valori e delle immagini

Stato: fatto (#110)

Accettazione:

- [ ] Ogni campo ha un pulsante copia; un toast conferma `Copiato`.
- [ ] Un'immagine si copia negli appunti come immagine (PNG), dove il
      browser lo permette; altrimenti il pulsante non compare.
- [ ] `Copia tutto` copia campi ed etichette come testo, una riga per
      campo.

#### DOC-010 · Scadenze e preavvisi

Stato: fatto (#111)

Accettazione:

- [ ] Ogni documento può avere una data di scadenza e dei preavvisi a
      90, 30 e 7 giorni, attivabili uno per uno (di default tutti).
- [ ] Il documento è `in scadenza` dal primo preavviso attivo e
      `scaduto` dal giorno dopo la scadenza.
- [ ] Il widget (DOC-001) e la pagina mostrano lo stato.
- [ ] Le notifiche push arrivano con l'app iOS; i testi non conterranno
      numeri né nomi, solo tipo e data (`Passaporto · scade tra 30 giorni`).

#### DOC-011 · Allegati

Stato: fatto (#112)

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

Stato: fatto (#113)

Accettazione:

- [ ] Ogni allegato si scarica con il suo nome originale.
- [ ] Le risposte hanno `Cache-Control: no-store`: niente copie nella
      cache del browser.

#### DOC-013 · PDF di riepilogo

Stato: fatto (#114)

Accettazione:

- [ ] Il backend genera al volo un PDF A4: titolo, titolare, scadenza, le
      immagini allegate in alto e i campi sotto.
- [ ] Gli allegati PDF si accodano come pagine; gli altri file sono solo
      elencati per nome.
- [ ] Il PDF non viene salvato sul server. La UI avvisa che il file
      scaricato è in chiaro.

#### DOC-014 · Eliminare

Stato: fatto (#115)

Accettazione:

- [ ] Si elimina un allegato o un intero documento, con conferma.
- [ ] L'eliminazione è definitiva: via dal database i campi e i file.

#### DOC-016 · Tipi personalizzati

Stato: fatto (#116)

Dalle impostazioni del modulo si configurano i tipi.

Accettazione:

- [ ] Creare un tipo: nome, icona (da un elenco), campi con etichetta,
      tipo (`text`, `date`, `code`) e se è copiabile; riordinare i campi.
- [ ] Modificare un tipo, anche tra quelli già pronti: aggiungere,
      rinominare, riordinare e togliere campi. Un campo tolto non cancella
      i valori: sui documenti esistenti diventano campi liberi.
- [ ] Eliminare un tipo solo se nessun documento lo usa; altrimenti la UI
      dice quanti lo usano.
- [ ] Un campo nuovo non obbliga a compilare i documenti esistenti.

#### DOC-017 · Preavvisi nell'elenco

Stato: pianificato (#215)

Serve agli avvisi di scadenza dell'app iOS (IOS-065), che sono notifiche
locali: una per ogni preavviso attivo.

Accettazione:

- [ ] L'elenco dei documenti porta `warnings` per ogni documento, come il
      dettaglio.
- [ ] Nessun valore dei campi in più: l'elenco resta solo dati in chiaro.

### Sicurezza

#### DOC-015 · Cifratura a riposo

Stato: fatto (#101)

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
  - `document_types`: id, nome, icona, campi (JSON: chiave, etichetta,
    tipo, copiabile, ordine); i tipi già pronti entrano con la migrazione;
  - `documents`: id, tipo (facoltativo), titolo, titolare, scadenza, preavvisi, tag,
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
| `POST /types`, `PATCH`/`DELETE /types/{id}`        | tipi personalizzati            | 016           |
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

Si tengono: campi definiti per tipo, busta AES-GCM con
versione della chiave e AAD per record, metadati in chiaro solo dove
servono, file in Postgres in una tabella a parte, testi dei preavvisi
senza dati sensibili, PDF generato al volo e mai salvato.

Cambiano: tipi nel database e configurabili dalla UI; niente chiave sul telefono né passphrase di recupero (la chiave
sta sul server, decisione 4); lo sblocco è il login generale e non Face
ID (decisione 5); allegati di qualsiasi tipo e non solo immagini; campi
liberi su ogni tipo; titolare.

### Piano di lavoro

1. **Specifica** e login ([auth.md](auth.md)), confermate.
2. **Mockup** della pagina, del dettaglio e del form, approvati.
3. **Issue** con label `mod:documents` e `mod:auth` (#97…#116), una per requisito; la base è #101.
4. **Login** (AUTH-001…004) prima di tutto il resto.
5. **Base**: migrazione, busta, tipi (DOC-003, DOC-015).
6. **API e web**: inserimento, allegati, dettaglio, copia, download,
   widget.

## Decisioni

Prese il 2026-10-22.

1. **Tipi.** Tipi già pronti più tipi configurabili dalla UI, e campi
   liberi su ogni documento (precisato il 2026-10-22).
2. **Tre modi.** Si parte dal file e si sceglie: documento con tipo (form
   del tipo), file con info (titolo e campi liberi, per esempio un PDF o
   un contratto), file libero (solo titolo). Nessun tipo `contratto`
   fisso: se serve, lo si crea come tipo personalizzato.
3. **Allegati.** Qualsiasi file, con anteprima per immagini e PDF.
4. **Cifratura.** A riposo sul server, chiave nel `.env`; il backend
   decifra per web e iOS.
5. **Sblocco.** Niente PIN del modulo: serve il login generale della
   dashboard, specificato a parte in [auth.md](auth.md).
6. **Archivio.** File cifrati nel Postgres condiviso, in una tabella a
   parte.
7. **Disposizione.** Griglia di card con miniatura (tavola A dei mockup),
   con i documenti in evidenza in cima; scelta il 2026-10-22.
8. **Titolare.** Sì, con filtro; di default il proprietario.
9. **Copia e download.** Copia per campo, copia immagine, scarica
   originale, PDF di riepilogo. Niente ZIP.
10. **Scadenze.** Data di scadenza con preavvisi 90/30/7, mostrati nel
    widget; push con l'app iOS.
11. **Rimandati.** OCR e lettura MRZ, storico rinnovi, condivisione con
    link.
