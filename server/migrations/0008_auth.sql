-- Sessioni della dashboard (AUTH-002): nel cookie c'è un id casuale, qui
-- solo il suo SHA-256, così una copia del database non apre sessioni.
create table auth_sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text
);

create index auth_sessions_expires_at on auth_sessions (expires_at);
