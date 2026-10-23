-- Modulo Allenamento (docs/specs/workout.md). Gli allenamenti arrivano solo
-- dal CSV di Liftin' (GYM-003) e restano in sola lettura: una sessione è un
-- giorno più una routine, una serie è identificata da sessione, esercizio
-- (nome normalizzato) e numero. Un solo utente, come la nutrizione.
-- I giorni sono date locali Europe/Rome.

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  -- Nome della routine dal CSV; '' quando Liftin' non lo riporta, così la
  -- coppia (giorno, routine) resta univoca anche senza nome.
  routine text not null default '',
  started_at timestamptz not null,
  duration_seconds integer check (duration_seconds >= 0),
  imported_at timestamptz not null default now(),
  unique (day, routine)
);

create index workout_sessions_started_at on workout_sessions (started_at desc);

create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions (id) on delete cascade,
  -- Nome come scritto nel CSV e chiave normalizzata (minuscole, spazi
  -- compressi) usata per raggruppare e per i dati dell'esercizio.
  exercise_name text not null,
  exercise_key text not null,
  -- Posizione dell'esercizio nella sessione, nell'ordine del CSV.
  exercise_order integer not null,
  set_index integer not null check (set_index >= 1),
  is_warmup boolean not null default false,
  weight_kg numeric not null default 0 check (weight_kg >= 0),
  reps integer check (reps >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  -- Colonna Perception di Liftin'.
  perception numeric,
  unique (session_id, exercise_key, set_index)
);

create index workout_sets_exercise_key on workout_sets (exercise_key);

-- Dati per esercizio legati al nome normalizzato, che sopravvivono ai
-- re-import: gruppo muscolare (GYM-011) e immagine del catalogo (GYM-014).
create table workout_exercises (
  exercise_key text primary key,
  muscle_group text check (
    muscle_group in ('petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'gambe', 'glutei', 'addome', 'altro')
  ),
  catalog_id text,
  updated_at timestamptz not null default now()
);

-- Sessioni eliminate (GYM-006): un re-import non le ripristina.
create table workout_deleted_sessions (
  day date not null,
  routine text not null default '',
  deleted_at timestamptz not null default now(),
  primary key (day, routine)
);
