-- DEALWATCH MX / APPCOMERCIO
-- FASE 9: Supabase Free
-- Ejecuta esto en Supabase → SQL Editor → New query → Run

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  store text not null,
  category text default 'Otro',
  icon text default '🛒',
  priority text default 'Media' check (priority in ('Alta', 'Media', 'Baja')),
  product_url text,
  normal_price numeric(12,2) default 0,
  current_price numeric(12,2) not null default 0,
  target_price numeric(12,2) not null default 0,
  min_discount_percent numeric(5,2) default 0,
  alerts_enabled boolean default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  previous_price numeric(12,2),
  new_price numeric(12,2) not null,
  source text default 'manual',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, setting_key)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products for each row execute function public.set_updated_at();

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.price_history enable row level security;
alter table public.app_settings enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.price_history to authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;

drop policy if exists "products_select_own" on public.products;
drop policy if exists "products_insert_own" on public.products;
drop policy if exists "products_update_own" on public.products;
drop policy if exists "products_delete_own" on public.products;
create policy "products_select_own" on public.products for select to authenticated using (auth.uid() = user_id);
create policy "products_insert_own" on public.products for insert to authenticated with check (auth.uid() = user_id);
create policy "products_update_own" on public.products for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "products_delete_own" on public.products for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "price_history_select_own" on public.price_history;
drop policy if exists "price_history_insert_own" on public.price_history;
drop policy if exists "price_history_update_own" on public.price_history;
drop policy if exists "price_history_delete_own" on public.price_history;
create policy "price_history_select_own" on public.price_history for select to authenticated using (auth.uid() = user_id);
create policy "price_history_insert_own" on public.price_history for insert to authenticated with check (auth.uid() = user_id);
create policy "price_history_update_own" on public.price_history for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "price_history_delete_own" on public.price_history for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "app_settings_select_own" on public.app_settings;
drop policy if exists "app_settings_insert_own" on public.app_settings;
drop policy if exists "app_settings_update_own" on public.app_settings;
drop policy if exists "app_settings_delete_own" on public.app_settings;
create policy "app_settings_select_own" on public.app_settings for select to authenticated using (auth.uid() = user_id);
create policy "app_settings_insert_own" on public.app_settings for insert to authenticated with check (auth.uid() = user_id);
create policy "app_settings_update_own" on public.app_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "app_settings_delete_own" on public.app_settings for delete to authenticated using (auth.uid() = user_id);
