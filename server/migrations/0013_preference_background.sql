-- Immagine di sfondo caricata in Impostazioni › Aspetto (SET-003): una sola.
create table preference_background (
  id boolean primary key default true check (id),
  mime text not null,
  content bytea not null,
  updated_at timestamptz not null default now()
);
