-- Layout della dashboard (DASH-007): uno per dispositivo, salvato intero
-- come JSON e validato dal backend contro il catalogo dei widget.
create table dashboard_layouts (
  device text primary key check (device in ('desktop', 'iphone')),
  layout jsonb not null,
  updated_at timestamptz not null default now()
);
