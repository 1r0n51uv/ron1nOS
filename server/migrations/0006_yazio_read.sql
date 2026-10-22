-- Lettura dal diario YAZIO (NUT-022). Su ogni riga quello che YAZIO ne sa
-- dall'ultima lettura o dall'ultimo invio: se alla lettura dopo YAZIO dice
-- altro, è cambiata lì e vince YAZIO. null: YAZIO non conosce la riga.
alter table meal_entry_items
  add column yazio_amount numeric,
  add column yazio_daytime text;

-- L'ultimo totale d'acqua del giorno visto in YAZIO, con lo stesso scopo.
create table yazio_water (
  day date primary key,
  total_ml numeric not null
);
