-- Categorie e ricette composte (NUT-037). Le categorie sono etichette libere
-- fra un insieme fisso (pranzo, cena, spuntino, freddo, caldo). Una ricetta
-- composta è fatta di altre ricette, una per ruolo; non ha alimenti suoi.
alter table recipes add column categories text[] not null default '{}';

create table recipe_parts (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  part_recipe_id uuid not null references recipes (id) on delete restrict,
  role text not null check (role in ('course', 'side', 'bread')),
  factor numeric not null default 1 check (factor > 0),
  order_index integer not null default 0
);
create index recipe_parts_recipe_idx on recipe_parts (recipe_id);
create index recipe_parts_part_idx on recipe_parts (part_recipe_id);
