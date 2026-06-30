-- DEALWATCH MX / APPCOMERCIO
-- FASE 10: Multi-admin, equipos/workspaces y RLS compartido
-- Ejecuta este SQL DESPUÉS del SQL de Fase 9.

create extension if not exists pgcrypto;

-- =========================
-- PERFILES DE USUARIO
-- =========================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- EQUIPOS / WORKSPACES
-- =========================
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'DealWatch MX',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null default 'viewer' check (role in ('owner','admin','viewer')),
  status text not null default 'pending' check (status in ('pending','active')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_member_user_or_email check (user_id is not null or invited_email is not null)
);

create unique index if not exists workspace_members_unique_user
on public.workspace_members(workspace_id, user_id)
where user_id is not null;

create index if not exists workspace_members_invited_email_idx
on public.workspace_members(lower(invited_email));

-- =========================
-- COLUMNAS NUEVAS EN TABLAS EXISTENTES
-- =========================
alter table public.products
add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.price_history
add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

create index if not exists products_workspace_id_idx on public.products(workspace_id);
create index if not exists price_history_workspace_id_idx on public.price_history(workspace_id);

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

-- =========================
-- FUNCIONES DE SEGURIDAD PARA RLS
-- Evitan recursión en políticas de workspace_members.
-- =========================
create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.status = 'active'
      and (
        wm.user_id = auth.uid()
        or lower(coalesce(wm.invited_email, '')) = public.current_user_email()
      )
  );
$$;

create or replace function public.has_workspace_role(p_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.status = 'active'
      and wm.user_id = auth.uid()
      and wm.role = any(allowed_roles)
  );
$$;

grant execute on function public.current_user_email() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;

-- =========================
-- RLS
-- =========================
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.products enable row level security;
alter table public.price_history enable row level security;

-- Permisos API

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.price_history to authenticated;

-- =========================
-- POLÍTICAS: profiles
-- =========================
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles for select to authenticated
using (user_id = auth.uid());

create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (user_id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- =========================
-- POLÍTICAS: workspaces
-- =========================
drop policy if exists "workspaces_select_member" on public.workspaces;
drop policy if exists "workspaces_insert_owner" on public.workspaces;
drop policy if exists "workspaces_update_admin" on public.workspaces;
drop policy if exists "workspaces_delete_owner" on public.workspaces;

create policy "workspaces_select_member"
on public.workspaces for select to authenticated
using (public.is_workspace_member(id) or owner_id = auth.uid());

create policy "workspaces_insert_owner"
on public.workspaces for insert to authenticated
with check (owner_id = auth.uid());

create policy "workspaces_update_admin"
on public.workspaces for update to authenticated
using (public.has_workspace_role(id, array['owner','admin']))
with check (public.has_workspace_role(id, array['owner','admin']));

create policy "workspaces_delete_owner"
on public.workspaces for delete to authenticated
using (public.has_workspace_role(id, array['owner']));

-- =========================
-- POLÍTICAS: workspace_members
-- =========================
drop policy if exists "workspace_members_select_visible" on public.workspace_members;
drop policy if exists "workspace_members_insert_admin" on public.workspace_members;
drop policy if exists "workspace_members_update_admin_or_invited" on public.workspace_members;
drop policy if exists "workspace_members_delete_admin" on public.workspace_members;

create policy "workspace_members_select_visible"
on public.workspace_members for select to authenticated
using (
  public.is_workspace_member(workspace_id)
  or user_id = auth.uid()
  or lower(coalesce(invited_email, '')) = public.current_user_email()
);

create policy "workspace_members_insert_admin"
on public.workspace_members for insert to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner','admin'])
  or (user_id = auth.uid() and role = 'owner' and status = 'active')
);

create policy "workspace_members_update_admin_or_invited"
on public.workspace_members for update to authenticated
using (
  public.has_workspace_role(workspace_id, array['owner','admin'])
  or lower(coalesce(invited_email, '')) = public.current_user_email()
)
with check (
  public.has_workspace_role(workspace_id, array['owner','admin'])
  or (user_id = auth.uid() and status = 'active')
);

create policy "workspace_members_delete_admin"
on public.workspace_members for delete to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']));

-- =========================
-- REEMPLAZO DE POLÍTICAS FASE 9: products
-- =========================
drop policy if exists "products_select_own" on public.products;
drop policy if exists "products_insert_own" on public.products;
drop policy if exists "products_update_own" on public.products;
drop policy if exists "products_delete_own" on public.products;
drop policy if exists "products_select_workspace" on public.products;
drop policy if exists "products_insert_workspace" on public.products;
drop policy if exists "products_update_workspace" on public.products;
drop policy if exists "products_delete_workspace" on public.products;

create policy "products_select_workspace"
on public.products for select to authenticated
using (
  user_id = auth.uid()
  or (workspace_id is not null and public.is_workspace_member(workspace_id))
);

create policy "products_insert_workspace"
on public.products for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    workspace_id is null
    or public.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

create policy "products_update_workspace"
on public.products for update to authenticated
using (
  user_id = auth.uid()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin']))
)
with check (
  user_id = auth.uid()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin']))
);

create policy "products_delete_workspace"
on public.products for delete to authenticated
using (
  user_id = auth.uid()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin']))
);

-- =========================
-- REEMPLAZO DE POLÍTICAS FASE 9: price_history
-- =========================
drop policy if exists "price_history_select_own" on public.price_history;
drop policy if exists "price_history_insert_own" on public.price_history;
drop policy if exists "price_history_update_own" on public.price_history;
drop policy if exists "price_history_delete_own" on public.price_history;
drop policy if exists "price_history_select_workspace" on public.price_history;
drop policy if exists "price_history_insert_workspace" on public.price_history;
drop policy if exists "price_history_update_workspace" on public.price_history;
drop policy if exists "price_history_delete_workspace" on public.price_history;

create policy "price_history_select_workspace"
on public.price_history for select to authenticated
using (
  user_id = auth.uid()
  or (workspace_id is not null and public.is_workspace_member(workspace_id))
);

create policy "price_history_insert_workspace"
on public.price_history for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    workspace_id is null
    or public.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

create policy "price_history_update_workspace"
on public.price_history for update to authenticated
using (
  user_id = auth.uid()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin']))
)
with check (
  user_id = auth.uid()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin']))
);

create policy "price_history_delete_workspace"
on public.price_history for delete to authenticated
using (
  user_id = auth.uid()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin']))
);
