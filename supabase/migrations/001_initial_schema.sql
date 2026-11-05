-- RecruiterFlow: Supabase backend foundation
-- Run this in Supabase SQL Editor after creating a Supabase project.
-- New signups are ordinary users. The first Owner is assigned manually
-- by the project owner using the one-time SQL command in README.md.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'editor', 'user');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role public.app_role not null default 'user',
  can_edit_scripts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('CD','OO')),
  title text not null,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scripts_category_idx on public.scripts(category);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- Security-definer helpers avoid recursive RLS policy lookups.
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.user_can_edit_scripts()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select role in ('owner','admin') or (role = 'editor' and can_edit_scripts)
    from public.profiles where id = auth.uid()
  ), false)
$$;

create or replace function public.user_is_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false)
$$;

-- Create a basic profile automatically after signup. Role is always user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, can_edit_scripts)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    'user',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.scripts enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can read their own profile; Owner can read all profiles.
drop policy if exists "profiles_read_self_or_owner" on public.profiles;
create policy "profiles_read_self_or_owner"
on public.profiles for select to authenticated
using (id = auth.uid() or public.user_is_owner());

-- Only Owner can grant roles and edit permissions.
drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
on public.profiles for update to authenticated
using (public.user_is_owner())
with check (public.user_is_owner());

-- Scripts: all signed-in users may read. Only permitted roles may write.
drop policy if exists "scripts_read_authenticated" on public.scripts;
create policy "scripts_read_authenticated"
on public.scripts for select to authenticated
using (true);

drop policy if exists "scripts_insert_authorized" on public.scripts;
create policy "scripts_insert_authorized"
on public.scripts for insert to authenticated
with check (public.user_can_edit_scripts());

drop policy if exists "scripts_update_authorized" on public.scripts;
create policy "scripts_update_authorized"
on public.scripts for update to authenticated
using (public.user_can_edit_scripts())
with check (public.user_can_edit_scripts());

drop policy if exists "scripts_delete_authorized" on public.scripts;
create policy "scripts_delete_authorized"
on public.scripts for delete to authenticated
using (public.user_can_edit_scripts());

-- Audit logs: users may only read their own entries; client inserts are blocked.
drop policy if exists "audit_read_self_or_owner" on public.audit_logs;
create policy "audit_read_self_or_owner"
on public.audit_logs for select to authenticated
using (actor_id = auth.uid() or public.user_is_owner());

-- No client-facing insert/update/delete policy is intentionally created for audit_logs.
-- Production audit events should be written by trusted server-side functions.
