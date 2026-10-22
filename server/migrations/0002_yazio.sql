-- Token di YAZIO (adattatore server/yazio), cifrati con YAZIO_TOKEN_KEY.
-- Una sola riga: un solo account.
create table yazio_tokens (
  id smallint primary key default 1 check (id = 1),
  access_token_enc text not null,
  refresh_token_enc text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
