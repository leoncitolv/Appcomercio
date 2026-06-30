-- DEALWATCH MX / APPCOMERCIO
-- FASE 16: Listas familiares y amigos
-- Ejecutar una sola vez en Supabase SQL Editor antes de subir la app.

alter table public.products
  add column if not exists deal_list text default 'Compras personales · Ofertas especiales';

alter table public.monitor_results
  add column if not exists deal_list text default 'Lista general';

alter table public.alert_events
  add column if not exists deal_list text default 'Lista general';

-- Backfill sugerido para productos existentes.
update public.products
set deal_list = case
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%despensa%' then 'Familia · Despensa'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%hogar%' then 'Familia · Hogar'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%salud%'
    or lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%proteína%'
    or lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%proteina%' then 'Familia · Salud'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%regalo%' then 'Familia · Regalos'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%playstation%'
    or lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%ps5%' then 'Amigos gaming · PlayStation'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%control%' then 'Amigos gaming · Controles'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%juego%'
    or lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%gaming%' then 'Amigos gaming · Juegos'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%audio%'
    or lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%audifono%'
    or lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%audífono%' then 'Amigos gaming · Audífonos'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%monitor%' then 'Amigos gaming · Monitores'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%ropa%'
    or lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%calzado%'
    or lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%tenis%' then 'Compras personales · Ropa'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%celular%'
    or lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%smartphone%' then 'Compras personales · Celulares'
  when lower(coalesce(category,'') || ' ' || coalesce(name,'') || ' ' || coalesce(store,'')) like '%herramienta%' then 'Compras personales · Herramientas'
  else coalesce(deal_list, 'Compras personales · Ofertas especiales')
end
where deal_list is null or deal_list = '' or deal_list = 'Lista general';

-- Índices útiles para filtros/reportes.
create index if not exists products_deal_list_idx on public.products(deal_list);
create index if not exists monitor_results_deal_list_idx on public.monitor_results(deal_list);
create index if not exists alert_events_deal_list_idx on public.alert_events(deal_list);
