-- Foto generata di una ricetta (NUT-036): lo stato del lavoro in corso o
-- fallito. A lavoro finito resta solo l'indirizzo in `image_url`.
alter table recipes
  add column photo_state text check (photo_state in ('generating', 'failed')),
  add column photo_error text,
  add column photo_started_at timestamptz;
