# Prova YAZIO

Script per il passo 2 del piano di lavoro della specifica Nutrizione
([docs/specs/nutrition.md](../../docs/specs/nutrition.md)): verifica con
l'account vero cosa l'API non ufficiale di YAZIO permette davvero, prima di
scrivere modelli e integrazione.

Non fa parte dell'immagine e non va in CI. Serve Node 18 o più recente,
nessuna dipendenza. Da questo ambiente cloud `yzapi.yazio.com` non è
raggiungibile, quindi va lanciato dal Mac o dal mini PC.

## Uso

```sh
cd scripts/yazio-probe
cp .env.example .env   # e scrivi email e password YAZIO
node probe.mjs         # solo lettura
node probe.mjs --write # anche scrittura, vedi sotto
```

Alla fine scrive `yazio-probe-report.json` (non versionato) e stampa una
riga `ok` / `NO` per ogni prova.

## Cosa prova

| Prova                               | Serve a                                                        |
| ----------------------------------- | -------------------------------------------------------------- |
| login su `v15` e `v20`, refresh     | quale versione usare, durata del token                         |
| impostazioni, obiettivi, riepilogo  | se l'obiettivo somma già gli esercizi (NUT-015, NUT-016)       |
| esercizi degli ultimi 7 giorni      | kcal da attività per la quota (NUT-016)                        |
| diario degli ultimi 3 giorni        | tipi di voce, slot, porzioni (NUT-022)                         |
| dettaglio di un prodotto del diario | nutrienti e se c'è il codice a barre                           |
| ricerca per nome nel catalogo IT    | qualità dei risultati italiani (NUT-021)                       |
| codice a barre                      | se esiste un modo di cercare per EAN (NUT-023)                 |
| acqua, ultimo peso, storico peso    | NUT-012, NUT-017, NUT-024                                      |
| con `--write`: voce da 1 g          | scrittura con id nostro, rilettura e cancellazione (NUT-023)   |
| con `--write`: acqua                | scrittura dello stesso totale di oggi, quindi nessuna modifica |

La voce di prova è 1 g di mela tra gli spuntini di oggi e viene cancellata
subito: nel diario non resta nulla. Se lo script si interrompe a metà,
cancellala a mano dall'app.

## Cosa c'è nel rapporto

Esiti, codici HTTP, conteggi e la forma delle risposte (chiavi e tipi).
Non contiene token, email, nomi né il contenuto del diario; contiene i
numeri degli obiettivi e le kcal degli esercizi. Leggilo prima di
condividerlo.
