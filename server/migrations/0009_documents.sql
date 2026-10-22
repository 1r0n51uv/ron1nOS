-- Modulo Documenti (docs/specs/documents.md). In chiaro solo quello che
-- serve a elenco, ricerca e scadenze; campi, note e file stanno in buste
-- AES-256-GCM (DOC-015) che il database non sa leggere.

-- Tipi di documento (DOC-003, DOC-016). I campi sono un array ordinato di
-- { key, label, kind: text|date|code, copyable }. key è null per i tipi
-- creati dall'utente, valorizzata per quelli già pronti.
create table document_types (
  id uuid primary key default gen_random_uuid(),
  key text unique,
  name text not null,
  icon text not null default 'file',
  fields jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- type_id null: file con info o file libero. envelope cifra
-- { fields, extra, notes } con AAD "document:<id>".
create table documents (
  id uuid primary key default gen_random_uuid(),
  type_id uuid references document_types (id) on delete restrict,
  title text not null,
  holder text not null,
  expires_on date,
  warnings smallint[] not null default '{90,30,7}',
  tags text[] not null default '{}',
  pinned_at timestamptz,
  key_version smallint not null,
  envelope bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_type_id on documents (type_id);
create index documents_expires_on on documents (expires_on) where expires_on is not null;

-- Allegati (DOC-011): contenuto e miniatura cifrati, AAD
-- "file:<document_id>:<id>" e "thumb:<document_id>:<id>". Tabella a parte,
-- così gli elenchi non caricano i file.
create table document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  name text not null,
  mime text not null,
  size integer not null,
  label text not null default 'altro' check (label in ('fronte', 'retro', 'pagina', 'altro')),
  position integer not null default 0,
  key_version smallint not null,
  ciphertext bytea not null,
  thumb bytea,
  created_at timestamptz not null default now()
);

create index document_files_document_id on document_files (document_id, position);

insert into document_types (key, name, icon, fields) values
  ('identity_card', 'Carta d''identità', 'id-card', '[
    {"key": "number", "label": "Numero", "kind": "code", "copyable": true},
    {"key": "surname", "label": "Cognome", "kind": "text", "copyable": true},
    {"key": "name", "label": "Nome", "kind": "text", "copyable": true},
    {"key": "birth_date", "label": "Data di nascita", "kind": "date", "copyable": true},
    {"key": "birth_place", "label": "Luogo di nascita", "kind": "text", "copyable": true},
    {"key": "issue_city", "label": "Comune di rilascio", "kind": "text", "copyable": true},
    {"key": "issue_date", "label": "Data di rilascio", "kind": "date", "copyable": true},
    {"key": "tax_code", "label": "Codice fiscale", "kind": "code", "copyable": true}
  ]'),
  ('passport', 'Passaporto', 'passport', '[
    {"key": "number", "label": "Numero", "kind": "code", "copyable": true},
    {"key": "surname", "label": "Cognome", "kind": "text", "copyable": true},
    {"key": "name", "label": "Nome", "kind": "text", "copyable": true},
    {"key": "nationality", "label": "Nazionalità", "kind": "text", "copyable": true},
    {"key": "birth_date", "label": "Data di nascita", "kind": "date", "copyable": true},
    {"key": "authority", "label": "Autorità", "kind": "text", "copyable": true},
    {"key": "issue_date", "label": "Data di rilascio", "kind": "date", "copyable": true}
  ]'),
  ('driving_license', 'Patente', 'car', '[
    {"key": "number", "label": "Numero", "kind": "code", "copyable": true},
    {"key": "surname", "label": "Cognome", "kind": "text", "copyable": true},
    {"key": "name", "label": "Nome", "kind": "text", "copyable": true},
    {"key": "birth_date", "label": "Data di nascita", "kind": "date", "copyable": true},
    {"key": "categories", "label": "Categorie", "kind": "text", "copyable": true},
    {"key": "issued_by", "label": "Rilasciata da", "kind": "text", "copyable": true},
    {"key": "issue_date", "label": "Data di rilascio", "kind": "date", "copyable": true}
  ]'),
  ('health_card', 'Tessera sanitaria', 'health', '[
    {"key": "tax_code", "label": "Codice fiscale", "kind": "code", "copyable": true},
    {"key": "card_number", "label": "Numero tessera", "kind": "code", "copyable": true},
    {"key": "surname", "label": "Cognome", "kind": "text", "copyable": true},
    {"key": "name", "label": "Nome", "kind": "text", "copyable": true}
  ]');
