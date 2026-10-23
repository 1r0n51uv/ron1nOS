-- Token per l'app iOS (AUTH-005): l'app lo manda come Authorization:
-- Bearer. Qui solo il suo SHA-256, come per le sessioni.
create table auth_tokens (
  id text primary key,
  name text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
