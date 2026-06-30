-- DEALWATCH MX / APPCOMERCIO
-- FASE 11: monitoreo automático con GitHub Actions + Supabase
-- Ejecuta este SQL después de Fase 10.

create extension if not exists pgcrypto;

-- =========================
-- EJECUCIONES DEL MONITOR
-- =========================
create table if not exists public.monitor_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  source text not null default 'github_actions',
  mode text not null default 'rules_only',
  status text not null default 'running' check (status in ('running','success','error')),
  checked_count integer not null default 0,
  offers_count integer not null default 0,
  message text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- =========================
-- RESULTADOS DE CADA PRODUCTO
-- =========================
create table if not exists public.monitor_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.monitor_runs(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  product_name text,
  store text,
  product_url text,
  normal_price numeric(12,2) default 0,
  current_price numeric(12,2) default 0,
  target_price numeric(12,2) default 0,
  min_discount_percent numeric(5,2) default 0,
  discount_percent numeric(5,2) default 0,
  is_offer boolean not null default false,
  alert_reason text,
  raw jsonb default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

-- =========================
-- EVENTOS DE ALERTA
-- =========================
create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  event_type text not null default 'offer_detected',
  title text not null,
  message text,
  current_price numeric(12,2) default 0,
  target_price numeric(12,2) default 0,
  discount_percent numeric(5,2) default 0,
  status text not null default 'new' check (status in ('new','seen','dismissed')),
  raw jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists monitor_runs_started_at_idx on public.monitor_runs(started_at desc);
create index if not exists monitor_runs_workspace_idx on public.monitor_runs(workspace_id);
create index if not exists monitor_results_workspace_idx on public.monitor_results(workspace_id, checked_at desc);
create index if not exists monitor_results_product_idx on public.monitor_results(product_id, checked_at desc);
create index if not exists alert_events_workspace_idx on public.alert_events(workspace_id, created_at desc);
create index if not exists alert_events_product_idx on public.alert_events(product_id, created_at desc);

alter table public.monitor_runs enable row level security;
alter table public.monitor_results enable row level security;
alter table public.alert_events enable row level security;

grant select on public.monitor_runs to authenticated;
grant select on public.monitor_results to authenticated;
grant select, update on public.alert_events to authenticated;

-- =========================
-- RLS: monitor_runs
-- Las ejecuciones globales se pueden ver por usuarios autenticados.
-- Las ejecuciones por workspace solo por miembros.
-- =========================
drop policy if exists "monitor_runs_select_visible" on public.monitor_runs;
create policy "monitor_runs_select_visible"
on public.monitor_runs for select to authenticated
using (workspace_id is null or public.is_workspace_member(workspace_id));

-- =========================
-- RLS: monitor_results
-- =========================
drop policy if exists "monitor_results_select_workspace" on public.monitor_results;
create policy "monitor_results_select_workspace"
on public.monitor_results for select to authenticated
using (workspace_id is not null and public.is_workspace_member(workspace_id));

-- =========================
-- RLS: alert_events
-- =========================
drop policy if exists "alert_events_select_workspace" on public.alert_events;
drop policy if exists "alert_events_update_workspace" on public.alert_events;

create policy "alert_events_select_workspace"
on public.alert_events for select to authenticated
using (workspace_id is not null and public.is_workspace_member(workspace_id));

create policy "alert_events_update_workspace"
on public.alert_events for update to authenticated
using (workspace_id is not null and public.is_workspace_member(workspace_id))
with check (workspace_id is not null and public.is_workspace_member(workspace_id));
