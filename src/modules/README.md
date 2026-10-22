# Moduli

Ogni modulo della dashboard vive nella sua cartella, con due file:

- `data.ts`: tipi, sorgente dati e hook di React Query. Nei moduli non
  ancora collegati la sorgente è un mock in memoria; per collegare il
  servizio vero si riscrive solo il corpo delle funzioni `get…` e delle
  mutazioni, lasciando tipi e hook invariati.
- `Widget.tsx`: il widget della dashboard, che legge solo dall'hook.

| Modulo     | Sorgente prevista                                                                 |
| ---------- | --------------------------------------------------------------------------------- |
| nutrition  | Postgres e YAZIO, tramite il backend ([specifica](../../docs/specs/nutrition.md)) |
| workout    | API allenamenti (da 1r0-gym)                                                      |
| weight     | HealthKit tramite l'API                                                           |
| home       | Home Assistant                                                                    |
| server     | Glances, tramite il backend di ron1nOS ([specifica](../../docs/specs/server.md))  |
| containers | Docker Engine API                                                                 |
| downloads  | qBittorrent Web API, tramite il backend (`/api/v1/downloads`)                     |
| notes      | da decidere                                                                       |
