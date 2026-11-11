-- Il procedimento di una ricetta (NUT-030): un elenco di passi, modificabile.
-- L'import dei preferiti YAZIO non lo tocca.
alter table recipes add column steps jsonb not null default '[]'::jsonb;
