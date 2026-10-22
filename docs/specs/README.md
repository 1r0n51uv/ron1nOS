# Specifiche di ron1nOS

ron1nOS è la dashboard dell'homelab ron1n: in una schermata desktop mostra
pasti, allenamento, peso, casa, server, container, download e note, e
permette le azioni più frequenti su ognuno.

Ogni file elenca tutto quello che un modulo fa. Il flusso (specifica → issue
→ PR → deploy) è descritto in
https://github.com/1r0n51uv/ron1n/blob/main/docs/flusso-sviluppo.md.

## Moduli

| Modulo      | File                         | Prefisso ID | Label           |
| ----------- | ---------------------------- | ----------- | --------------- |
| Download    | [downloads.md](downloads.md) | `DL`        | `mod:downloads` |
| Server      | [server.md](server.md)       | `SRV`       | `mod:server`    |
| Nutrizione  | [nutrition.md](nutrition.md) | `NUT`       | `mod:nutrition` |
| Documenti   | [documents.md](documents.md) | `DOC`       | `mod:documents` |
| Login       | [auth.md](auth.md)           | `AUTH`      | `mod:auth`      |
| Allenamento | [workout.md](workout.md)     | `GYM`       | `mod:workout`   |

Gli altri moduli (`src/modules/*`) hanno per ora solo il mock dell'MVP; la
loro specifica arriva quando si collegano a una sorgente vera.

## Stati dei requisiti

`proposto` → `pianificato (#issue)` → `in corso (#issue)` → `fatto (#PR)`,
oppure `rimosso`. Gli ID non si riusano.
