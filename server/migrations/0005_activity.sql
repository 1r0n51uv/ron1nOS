-- Energia attiva del giorno letta da YAZIO (NUT-016, NUT-024): la quota la
-- somma all'obiettivo di base solo se in YAZIO è attivo "conta le calorie
-- delle attività" (counted).
create table day_activity (
  day date primary key,
  active_kcal numeric not null,
  counted boolean not null,
  updated_at timestamptz not null default now()
);
