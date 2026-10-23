-- Preferenze di ron1nOS (SET-002): un documento unico per tutti i
-- dispositivi, salvato come JSON e validato dal backend.
create table preferences (
  id boolean primary key default true check (id),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
