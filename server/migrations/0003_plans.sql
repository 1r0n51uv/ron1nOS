-- Pianificare un pasto (NUT-009): un piano per giorno e slot, e le righe
-- del diario create segnandolo mangiato, da cancellare se lo si spegne
-- (ADR-0032).
create unique index planned_meals_day_slot_idx on planned_meals (day, slot);

alter table meal_entry_items
  add column planned_meal_id uuid references planned_meals (id) on delete set null;
