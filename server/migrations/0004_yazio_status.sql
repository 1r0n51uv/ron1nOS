-- Stato del collegamento a YAZIO (NUT-020): l'interruttore della
-- sincronizzazione e l'esito dell'ultimo giro. Una sola riga; senza riga
-- valgono i default (sincronizzazione accesa, mai sincronizzato).
create table yazio_status (
  id smallint primary key default 1 check (id = 1),
  sync_enabled boolean not null default true,
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz
);
