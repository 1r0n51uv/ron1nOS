-- Modulo Nutrizione (docs/specs/nutrition.md). Schema unito dalle
-- migrazioni 0004, 0006…0008 e 0010 di 1r0-pkm, con le differenze di
-- ron1nOS: un solo utente (niente profiles né user_id), 5 slot senza
-- `snack`, obiettivo senza `phase_linked` né TDEE, template settimanali sul
-- server e colonne per la sincronizzazione con YAZIO.
-- I giorni sono date locali Europe/Rome.

create type meal_slot as enum ('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner');

-- Stato di una riga verso YAZIO (NUT-023): `local` non va inviata
-- (sincronizzazione spenta), `pending` è in coda, `synced` è inviata,
-- `error` ha fallito e riprova, `unmatched` non ha un prodotto YAZIO.
create type yazio_sync as enum ('local', 'pending', 'synced', 'error', 'unmatched');

create table foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null check (source in ('custom', 'openfoodfacts', 'usda', 'yazio')),
  external_id text,
  barcode text,
  brand text,
  serving_size_g numeric,
  calories_per_100g numeric not null,
  protein_g_per_100g numeric not null default 0,
  carbs_g_per_100g numeric not null default 0,
  fat_g_per_100g numeric not null default 0,
  caffeine_mg_per_100g numeric,
  -- Prodotto YAZIO equivalente (NUT-021, NUT-023): per gli alimenti presi
  -- da YAZIO è il loro id, per OpenFoodFacts e USDA l'abbinamento trovato.
  yazio_product_id text,
  yazio_matched_by text check (yazio_matched_by in ('source', 'barcode', 'name', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index foods_barcode_idx on foods (barcode) where barcode is not null;
create unique index foods_external_idx on foods (source, external_id) where external_id is not null;
create index foods_name_idx on foods using gin (to_tsvector('simple', name));

create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nome dell'alimento copiato sulla riga: resta leggibile anche se
-- l'alimento viene rinominato o cancellato.
create table recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  food_id uuid references foods (id) on delete set null,
  food_name text not null,
  quantity_g numeric not null check (quantity_g > 0),
  order_index int not null default 0
);

create table meal_entries (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  slot meal_slot not null,
  recipe_id uuid references recipes (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create unique index meal_entries_day_slot_idx on meal_entries (day, slot);

-- Kcal e macro copiati al momento della registrazione (NUT-003): lo storico
-- non cambia se l'alimento viene corretto dopo. L'id è anche l'id della
-- voce in YAZIO (NUT-022, NUT-023).
create table meal_entry_items (
  id uuid primary key default gen_random_uuid(),
  meal_entry_id uuid not null references meal_entries (id) on delete cascade,
  food_id uuid references foods (id) on delete set null,
  food_name text not null,
  quantity_g numeric not null check (quantity_g > 0),
  calories numeric not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  caffeine_mg numeric not null default 0,
  order_index int not null default 0,
  origin text not null default 'ron1nos' check (origin in ('ron1nos', 'yazio')),
  yazio_sync yazio_sync not null default 'local',
  yazio_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_entry_items_entry_idx on meal_entry_items (meal_entry_id);
create index meal_entry_items_sync_idx on meal_entry_items (yazio_sync) where yazio_sync in ('pending', 'error');

-- Righe cancellate in ron1nOS ancora da cancellare in YAZIO (NUT-023).
create table yazio_deletions (
  item_id uuid primary key,
  created_at timestamptz not null default now(),
  attempts int not null default 0,
  last_error text
);

create table planned_meals (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  slot meal_slot not null,
  recipe_id uuid references recipes (id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'eaten', 'skipped')),
  meal_entry_id uuid references meal_entries (id) on delete set null,
  template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planned_meals_day_idx on planned_meals (day);

create table planned_meal_items (
  id uuid primary key default gen_random_uuid(),
  planned_meal_id uuid not null references planned_meals (id) on delete cascade,
  food_id uuid references foods (id) on delete set null,
  food_name text not null,
  quantity_g numeric not null check (quantity_g > 0),
  order_index int not null default 0
);

-- Template settimanali (NUT-010): per ogni giorno della settimana
-- (1 = lunedì) e slot una ricetta o un alimento, mai entrambi.
create table diet_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table planned_meals
  add constraint planned_meals_template_fkey
  foreign key (template_id) references diet_templates (id) on delete set null;

create table diet_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references diet_templates (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  slot meal_slot not null,
  recipe_id uuid references recipes (id) on delete cascade,
  food_id uuid references foods (id) on delete cascade,
  quantity_g numeric check (quantity_g > 0),
  check ((recipe_id is null) <> (food_id is null)),
  check (food_id is null or quantity_g is not null),
  unique (template_id, weekday, slot)
);

create table shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  food_id uuid references foods (id) on delete set null,
  name text not null,
  quantity_g numeric,
  quantity_text text,
  is_checked boolean not null default false,
  source text not null default 'manual' check (source in ('generated', 'manual')),
  created_at timestamptz not null default now()
);

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  amount_ml numeric not null,
  logged_at timestamptz not null default now()
);

create index water_logs_day_idx on water_logs (day);

create table caffeine_logs (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  source_name text not null,
  caffeine_mg numeric not null,
  logged_at timestamptz not null default now()
);

create index caffeine_logs_day_idx on caffeine_logs (day);

create table supplements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dose_text text,
  schedule_text text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table supplement_logs (
  supplement_id uuid not null references supplements (id) on delete cascade,
  day date not null,
  logged_at timestamptz not null default now(),
  primary key (supplement_id, day)
);

-- Solo aggiunte: ogni cambio di obiettivo inserisce una riga, quella valida
-- in un giorno è la più recente con effective_from <= giorno (ADR-0019).
create table nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('manual', 'yazio')),
  calories_target numeric not null,
  protein_g_target numeric not null,
  carbs_g_target numeric not null,
  fat_g_target numeric not null,
  water_ml_target numeric,
  effective_from date not null,
  created_at timestamptz not null default now()
);

create index nutrition_goals_from_idx on nutrition_goals (effective_from desc, created_at desc);

-- Pesate (NUT-017, NUT-024): da YAZIO, più avanti da Salute (NUT-018).
create table body_weights (
  day date not null,
  source text not null check (source in ('yazio', 'health')),
  weight_kg numeric not null,
  primary key (day, source)
);
