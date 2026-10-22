-- Scrittura sul diario YAZIO (NUT-023).

-- Una riga che YAZIO conosceva, cancellata qui da qualunque parte (pasto,
-- piano spento, giorno), va cancellata anche in YAZIO.
create function yazio_track_delete() returns trigger language plpgsql as $$
begin
  if old.yazio_amount is not null then
    insert into yazio_deletions (item_id) values (old.id) on conflict do nothing;
  end if;
  return old;
end
$$;

create trigger meal_entry_items_yazio_delete
  after delete on meal_entry_items
  for each row execute function yazio_track_delete();

-- `local`: l'alimento resta solo in ron1nOS, scelto a mano al posto di un
-- equivalente YAZIO.
alter table foods drop constraint foods_yazio_matched_by_check;
alter table foods add constraint foods_yazio_matched_by_check
  check (yazio_matched_by in ('source', 'barcode', 'name', 'manual', 'local'));

-- Il primo giro riuscito: le righe da allora in poi vanno verso YAZIO, lo
-- storico di prima no.
alter table yazio_status add column first_sync_at timestamptz;
