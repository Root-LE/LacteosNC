-- =====================================================================
-- Lácteos NC — Migración 07: artículos con los códigos reales del sistema
--
-- productos  = las tarjetas con foto que se ven en la web (11).
-- articulos  = cada código del sistema de la cooperativa (59, del Excel
--              productosNC.xls: ARTICULO y DENOMINACION). Cada artículo puede
--              pertenecer a un producto de la web (ej.: Sardo entero, porción,
--              estacionado → producto "Sardo").
-- Los precios por lista y los renglones de pedido pasan a ser por ARTÍCULO.
-- Precios y pedidos estaban vacíos, así que no se pierde nada.
--
-- Artículos que parecen de uso interno quedan INACTIVOS (los clientes no los
-- ven) hasta que se confirmen: 31578 (crema de suero (sección fiscal 99)), 31587 ("NU" reggianito (sección fiscal 99)), 31543 (crema de leche sin presentación (sección fiscal 99)), 31604 (recorte), 77826 (sin bolsa), 77828 (sin envasar), 77825 (sin bolsa), 77779 (miga por kg), 31910 (manteca en Marcotegui), 77830 (marca Milkey), 77831 (marca Milkey).
-- =====================================================================

create table public.articulos (
  id          integer generated always as identity primary key,
  codigo      text not null unique check (length(codigo) between 1 and 30),
  descripcion text not null check (length(descripcion) between 2 and 120),
  producto_id integer references public.productos (id) on delete set null,
  activo      boolean not null default true,
  orden       smallint not null default 0,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
comment on table public.articulos is 'Códigos del sistema de la cooperativa. Son los que tienen precio y se piden.';
create index articulos_producto_idx on public.articulos (producto_id);
create trigger articulos_actualizado before update on public.articulos for each row execute function public.tocar_actualizado();
alter table public.articulos enable row level security;

create policy "articulos: clientes activos ven los activos, el personal ve todos"
  on public.articulos for select to authenticated
  using ((activo and (select privado.rol_actual()) is not null) or (select privado.es_staff()));
create policy "articulos: admin carga" on public.articulos for insert to authenticated with check ((select privado.es_admin()));
create policy "articulos: admin edita" on public.articulos for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "articulos: admin borra" on public.articulos for delete to authenticated using ((select privado.es_admin()));

-- Precios: ahora por artículo
drop table public.precios;
create table public.precios (
  lista_id    smallint not null references public.listas_precio (id) on delete cascade,
  articulo_id integer  not null references public.articulos (id) on delete cascade,
  precio      numeric(12, 2) not null check (precio >= 0),
  actualizado timestamptz not null default now(),
  primary key (lista_id, articulo_id)
);
create index precios_articulo_idx on public.precios (articulo_id);
create trigger precios_actualizado before update on public.precios for each row execute function public.tocar_actualizado();
alter table public.precios enable row level security;
create policy "precios: el cliente ve su lista, el personal ve todas" on public.precios for select to authenticated
  using ((select privado.es_staff()) or lista_id = (select privado.mi_lista()));
create policy "precios: admin carga" on public.precios for insert to authenticated with check ((select privado.es_admin()));
create policy "precios: admin edita" on public.precios for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "precios: admin borra" on public.precios for delete to authenticated using ((select privado.es_admin()));

-- Renglones de pedido: ahora por artículo
alter table public.pedido_items drop column producto_id;
alter table public.pedido_items add column articulo_id integer references public.articulos (id) on delete set null;
create index pedido_items_articulo_idx on public.pedido_items (articulo_id);

-- Las tarjetas de la web ya no llevan código (lo llevan los artículos)
alter table public.productos drop column codigo;

-- crear_pedido: p_items = [{"articulo_id": 1, "cantidad": 3}, ...]
create or replace function public.crear_pedido(p_items jsonb, p_observaciones text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_perfil public.perfiles%rowtype;
  v_numero integer;
  v_total  numeric(14, 2);
begin
  select * into v_perfil from public.perfiles where id = v_uid;
  if v_perfil.id is null or v_perfil.estado <> 'activa' then
    raise exception 'Tu cuenta no está activa todavía.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'El pedido tiene demasiados renglones (máximo 200).' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    left join public.articulos a
      on a.id = case when (e ->> 'articulo_id') ~ '^[0-9]+$' then (e ->> 'articulo_id')::integer end
     and a.activo
    where a.id is null
       or coalesce(e ->> 'cantidad', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
       or (e ->> 'cantidad')::numeric <= 0
       or (e ->> 'cantidad')::numeric > 100000
  ) then
    raise exception 'Hay artículos o cantidades inválidas en el pedido.' using errcode = '22023';
  end if;

  insert into public.pedidos (cliente_id, lista_precio_id, observaciones)
  values (v_uid, v_perfil.lista_precio_id, left(nullif(trim(p_observaciones), ''), 500))
  returning numero into v_numero;

  insert into public.pedido_items (pedido_numero, articulo_id, codigo, descripcion, cantidad, precio_unitario)
  select v_numero, a.id, a.codigo, a.descripcion, sum((e ->> 'cantidad')::numeric), pc.precio
  from jsonb_array_elements(p_items) e
  join public.articulos a on a.id = (e ->> 'articulo_id')::integer
  left join public.precios pc on pc.articulo_id = a.id and pc.lista_id = v_perfil.lista_precio_id
  group by a.id, a.codigo, a.descripcion, pc.precio;

  select coalesce(sum(subtotal), 0) into v_total from public.pedido_items where pedido_numero = v_numero;
  update public.pedidos set total = v_total where numero = v_numero;

  return public.detalle_pedido(v_numero);
end;
$$;
revoke all on function public.crear_pedido(jsonb, text) from public, anon;
grant execute on function public.crear_pedido(jsonb, text) to authenticated;

-- Carga de los 59 artículos del Excel
insert into public.articulos (codigo, descripcion, producto_id, activo, orden)
select v.codigo, v.descripcion, p.id, v.activo, v.orden
from (values
  ('31554', 'QUESO PORSALUT NC-LAEMANCIPACION', null::text, true, 1),
  ('31555', 'QUESO PORSALUT NC-LAEMANCIPACION SIN SAL', null, true, 2),
  ('31557', 'MOZZARELLA NC CILINDRO', 'mozzarella', true, 3),
  ('31558', 'QUESO PATEGRAS NC-LA EMAN PIMIENTA', 'pategras', true, 4),
  ('31562', 'QUESO SARDO NC ESTACIONADO ENTERO', 'sardo', true, 5),
  ('31563', 'QUESO SARDO NC PEPATO', 'sardo', true, 6),
  ('31566', 'CREMA DE LECHE NC 400cc-LA EMANCIPACION', 'crema-de-leche', true, 7),
  ('31568', 'QUESO PATEGRAS NC-LA EMAN AJI', 'pategras', true, 8),
  ('31571', 'QUESO REGGIANITO NC', 'reggianito', true, 9),
  ('31572', 'QUESO SARDO NC ESTACIONADO PORCION', 'sardo', true, 10),
  ('31573', 'MOZZARELLA TUBO NC', 'mozzarella', true, 11),
  ('31574', 'MOZZARELLA NC BARRA', 'mozzarella', true, 12),
  ('31578', 'CREMA DE SUERO', null, false, 13),
  ('31582', 'RICOTTA PORCION NC-LA EMANCIPACION', null, true, 14),
  ('31587', 'NU QUESO REGGIANITO NC - LA EMANCIPACION', 'reggianito', false, 15),
  ('31604', 'RECORTE  QUESO  SARDO', 'sardo', false, 16),
  ('31617', 'PROVOLETA NC', 'provoleta', true, 17),
  ('31625', 'QUESO SBRINZ - NC LA EMANCIPACION', 'sbrinz', true, 18),
  ('31636', 'QUESO GOUDA NC - LA EMANCIPACION', null, true, 19),
  ('31679', 'MANTECA NC x CAJA (200 gr)', null, true, 20),
  ('31686', 'QUESO CHEDDAR NC-LAEMANCIPACION x Kg', null, true, 21),
  ('31715', 'QUESO PATEGRAS POSTRE NC-LA EMAN', 'pategras', true, 22),
  ('31538', 'QUESO CREMOSO NC-LA EMANCIPACION', null, true, 23),
  ('31539', 'QUESO TYBO NC-LA EMANCIPACION', null, true, 24),
  ('31540', 'QUESO SARDO NC-LA EMANCIPACION', 'sardo', true, 25),
  ('31541', 'QUESO PATEGRAS NC-LA EMANCIPACION', 'pategras', true, 26),
  ('31542', 'RICOTTA NC-LA EMANCIPACION', null, true, 27),
  ('31543', 'CREMA DE LECHE NC-LA EMANCIPACION', null, false, 28),
  ('31551', 'QUESO CREMOSO NC-LA EMAN PORCION', null, true, 29),
  ('31552', 'QUESO SARDO NC-LA EMAN PORCION', 'sardo', true, 30),
  ('31553', 'QUESO PATEGRAS NC-LA EMAN OREGANO', 'pategras', true, 31),
  ('31756', 'QUESO GOUDA NC AHUMADO', 'gouda-ahumado', true, 32),
  ('31755', 'CREMA DE LECHE NC *200CC', 'crema-batir', true, 33),
  ('31905', 'PROVOLETA PORCION', 'provoleta', true, 34),
  ('31906', 'PROVOLONE', null, true, 35),
  ('31907', 'GOUDA BARRA', null, true, 36),
  ('31911', 'CREMA DE LECHE * 5LT', null, true, 37),
  ('31912', 'CREMA DE LECHE * 10LT', null, true, 38),
  ('31910', 'MANTECA CAJA (EN MARCOTEGUI)', null, false, 39),
  ('31913', 'MOZZARELLA PLANCHA NC', 'mozzarella', true, 40),
  ('77823', 'SACHET CREMA DE LECHE 5 L NC-LA EMAN', null, true, 41),
  ('77824', 'SACHET CREMA DE LECHE 10 L NC-LA EMAN', null, true, 42),
  ('77826', 'tybo sin bolsa', null, false, 43),
  ('77779', 'MIGA X KG', null, false, 44),
  ('77828', 'sardo sin envasar', 'sardo', false, 45),
  ('77830', 'Dulce de leche 400 gr Milkey', null, false, 46),
  ('77831', 'Dulce de leche 1 kg Milkey', null, false, 47),
  ('77825', 'cremoso sin bolsa', null, false, 48),
  ('77822', 'SACHET CREMA DE LECHE 1 L NC - LA EMAN', null, true, 49),
  ('7771', 'GOUDA PESTO NC BARRA', 'gouda-pesto', true, 50),
  ('7772', 'GOUDA PESTO NC PORCION', 'gouda-pesto', true, 51),
  ('7773', 'GOUDA PESTO NC HORMA', 'gouda-pesto', true, 52),
  ('77850', 'Barra Sandwich', null, true, 53),
  ('77855', 'CHEDDAR 3 KG POUCH', null, true, 54),
  ('77856', 'CHEDDAR 1 KG POUCH', null, true, 55),
  ('77858', 'QUESO PIZZERO', null, true, 56),
  ('77861', 'DULCE DE LECHE CLASICO LE', null, true, 57),
  ('77863', 'DULCE DE LECHE REPOSTERO LE', 'dulce-de-leche', true, 58),
  ('77900', 'UNTABLE CHEDDAR', null, true, 59)
) as v(codigo, descripcion, slug, activo, orden)
left join public.productos p on p.slug = v.slug;
