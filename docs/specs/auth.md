# Login

Prefisso ID: `AUTH` · Label: `mod:auth`

Oggi la dashboard non ha login: chi è nella tailnet vede tutto. Con il
modulo Documenti ([documents.md](documents.md)) servono dati che non
devono bastare la rete per leggerli, quindi la dashboard e le sue API
passano dietro un login. Vale per tutti i moduli, non solo per Documenti.

Un solo utente, il proprietario. L'accesso resta comunque solo dalla
tailnet via Caddy: il login si aggiunge, non sostituisce Tailscale.

Non fa, per ora: più utenti, ruoli, login con Apple/Google, 2FA.

**Stato del documento: confermato il 2026-10-22.** Mockup della pagina
di login nel
[canvas Modulo Documenti](https://claude.ai/artifact/5qreuPuuYCu468dGvmbULg).

## Requisiti

#### AUTH-001 · Pagina di login

Stato: fatto (#97)

Accettazione:

- [ ] Senza sessione valida ogni pagina porta a `/login`, con il solo
      campo password e il marchio ron1n.
- [ ] Dopo il login si torna alla pagina richiesta.
- [ ] Password sbagliata: `Password non valida`, senza dire altro.
- [ ] `Esci` nelle impostazioni chiude la sessione.

#### AUTH-002 · Sessione web

Stato: fatto (#98)

Accettazione:

- [ ] La password si confronta con l'hash `AUTH_PASSWORD_HASH` (scrypt,
      `node:crypto`) nel `.env`; uno script `npm run auth:hash` lo genera.
- [ ] La sessione è un cookie `HttpOnly`, `Secure`, `SameSite=Strict`,
      con un id casuale salvato (come hash) in Postgres.
- [ ] Durata 30 giorni, rinnovata a ogni uso; le sessioni si possono
      chiudere tutte dalle impostazioni.
- [ ] Le richieste che cambiano dati controllano l'header `Origin`.

#### AUTH-003 · API protette

Stato: fatto (#99)

Accettazione:

- [ ] Tutte le rotte `/api/v1/*` rispondono `401` senza sessione o
      token, tranne `GET /api/v1/health` e `POST /api/v1/auth/login`.
- [ ] Rotte `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` in
      `api/openapi.yaml`.
- [ ] I test e2e entrano con un login fatto una volta per tutta la suite.

#### AUTH-004 · Limite ai tentativi

Stato: fatto (#100)

Accettazione:

- [ ] Dopo 5 password sbagliate in 15 minuti dallo stesso indirizzo il
      login risponde `429` per 15 minuti.
- [ ] I tentativi falliti finiscono nei log senza la password.

#### AUTH-005 · Token per l'app iOS

Stato: fatto (#206)

Accettazione:

- [x] Dalle impostazioni si crea un token con un nome (`iPhone`), mostrato
      una volta sola; in Postgres se ne salva solo l'hash.
- [x] L'app lo manda come `Authorization: Bearer`; vale per tutte le
      rotte come la sessione web. Un token sbagliato risponde 401 senza
      ripiegare sul cookie.
- [x] Elenco dei token con ultimo uso (aggiornato al più una volta l'ora)
      e revoca.

#### AUTH-006 · Token di questo telefono

Stato: pianificato (#217)

L'app iOS segna nell'elenco il token del telefono e lo revoca con `Esci da
questo iPhone` (IOS-092).

Accettazione:

- [ ] `GET /auth/tokens` segna con `current: true` il token della
      richiesta (`Authorization: Bearer`); dal sito, con il cookie, tutti
      `false`.

## Decisioni

Prese il 2026-10-22.

1. **Login generale** al posto di un PIN del solo modulo Documenti
   (decisione 5 di [documents.md](documents.md)).
