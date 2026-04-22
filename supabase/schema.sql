create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sessions_user_active on sessions(user_id, is_active, updated_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  meta_message_id text unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null,
  text_body text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_user_created on messages(user_id, created_at desc);

create table if not exists advisors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text not null unique,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  advisor_id uuid not null references advisors(id) on delete restrict,
  branch text,
  step_label text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists app_state (
  key text primary key,
  value_int integer,
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row execute function set_updated_at();

drop trigger if exists trg_sessions_updated_at on sessions;
create trigger trg_sessions_updated_at
before update on sessions
for each row execute function set_updated_at();

drop trigger if exists trg_advisors_updated_at on advisors;
create trigger trg_advisors_updated_at
before update on advisors
for each row execute function set_updated_at();

insert into advisors (name, phone_number, priority)
values
  ('Asesor 1', '5552968168', 1),
  ('Asesor 2', '5588183946', 2)
on conflict (phone_number) do nothing;
