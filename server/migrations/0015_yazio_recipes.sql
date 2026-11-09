-- Ricette importate dai preferiti YAZIO: l'id YAZIO rende l'import ripetibile
-- (la stessa ricetta si aggiorna, non si duplica).
alter table recipes add column yazio_recipe_id text;
create unique index recipes_yazio_recipe_idx on recipes (yazio_recipe_id) where yazio_recipe_id is not null;
