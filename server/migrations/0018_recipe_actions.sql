-- Le azioni collegate a una ricetta (NUT-035): promemoria prima del pasto,
-- come scongelare il pesce la sera prima. Un elenco, ognuna disattivabile.
alter table recipes add column actions jsonb not null default '[]'::jsonb;
