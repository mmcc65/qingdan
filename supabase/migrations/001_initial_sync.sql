-- Qingdan cloud sync schema
-- Run in the Supabase SQL Editor as the project owner.

create extension if not exists pgcrypto;

create sequence if not exists public.qingdan_revision_seq;

create table if not exists public.qingdan_entities (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'project', 'history', 'setting')),
  parent_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  device_id text not null,
  revision bigint not null default nextval('public.qingdan_revision_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint qingdan_payload_is_object check (jsonb_typeof(payload) = 'object')
);

create index if not exists qingdan_entities_user_revision_idx
  on public.qingdan_entities (user_id, revision);

create index if not exists qingdan_entities_user_type_idx
  on public.qingdan_entities (user_id, entity_type)
  where deleted_at is null;

create or replace function public.qingdan_set_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.updated_at := now();
  new.revision := nextval('public.qingdan_revision_seq');
  return new;
end;
$$;

drop trigger if exists qingdan_entities_revision_trigger on public.qingdan_entities;
create trigger qingdan_entities_revision_trigger
before insert or update on public.qingdan_entities
for each row execute function public.qingdan_set_revision();

alter table public.qingdan_entities enable row level security;

revoke all on table public.qingdan_entities from anon;
grant select, insert, update, delete on table public.qingdan_entities to authenticated;
grant usage, select on sequence public.qingdan_revision_seq to authenticated;

drop policy if exists "Users read their own Qingdan data" on public.qingdan_entities;
create policy "Users read their own Qingdan data"
on public.qingdan_entities for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert their own Qingdan data" on public.qingdan_entities;
create policy "Users insert their own Qingdan data"
on public.qingdan_entities for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own Qingdan data" on public.qingdan_entities;
create policy "Users update their own Qingdan data"
on public.qingdan_entities for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own Qingdan data" on public.qingdan_entities;
create policy "Users delete their own Qingdan data"
on public.qingdan_entities for delete
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'qingdan_entities'
  ) then
    alter publication supabase_realtime add table public.qingdan_entities;
  end if;
end;
$$;

comment on table public.qingdan_entities is
  'Per-user incremental sync entities for Qingdan. deleted_at is a tombstone for offline devices.';

