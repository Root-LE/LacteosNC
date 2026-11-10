-- Migración 16 — Pesadas y bultos al armar un pedido
-- En "Armando", el empleado (o un administrador) carga por cada renglón tantas
-- pesadas como haga falta: Peso o Kilos + Cantidad pesada. El renglón queda
-- "completo" cuando la suma de cantidades pesadas es igual a la cantidad pedida.
-- "Bultos" es editable por ahora; más adelante tendrá su fórmula.

alter table public.pedido_items
  add column if not exists bultos integer check (bultos is null or (bultos >= 0 and bultos <= 100000));

create table if not exists public.pedido_pesadas (
  id         bigint generated always as identity primary key,
  item_id    bigint not null references public.pedido_items(id) on delete cascade,
  kilos      numeric(10, 3) not null check (kilos > 0 and kilos <= 100000),
  cantidad   numeric(10, 2) not null check (cantidad > 0 and cantidad <= 100000),
  creado     timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null
);
create index if not exists pedido_pesadas_item_idx on public.pedido_pesadas(item_id);
alter table public.pedido_pesadas enable row level security;
-- Sin políticas: se lee con detalle_pedido y se escribe con las funciones de abajo.

-- Controla que el renglón exista, que su pedido esté en "armando" y que quien llama sea personal
create or replace function privado.item_armando(p_item bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_num integer; v_estado public.estado_pedido;
begin
  if not privado.es_staff() then
    raise exception 'No tenés permiso para armar pedidos.' using errcode = '42501';
  end if;
  select p.numero, p.estado into v_num, v_estado
    from public.pedido_items i join public.pedidos p on p.numero = i.pedido_numero where i.id = p_item;
  if v_num is null then
    raise exception 'Renglón no encontrado.' using errcode = 'P0002';
  end if;
  if v_estado <> 'armando' then
    raise exception 'Solo se puede pesar un pedido que se está armando.' using errcode = '22023';
  end if;
  return v_num;
end;
$$;

create or replace function public.agregar_pesada(p_item bigint, p_kilos numeric, p_cantidad numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_num integer;
begin
  v_num := privado.item_armando(p_item);
  if p_kilos is null or p_kilos <= 0 or p_kilos > 100000 then
    raise exception 'Escribí el peso en kilos (mayor que 0).' using errcode = '22023';
  end if;
  if p_cantidad is null or p_cantidad <= 0 or p_cantidad > 100000 then
    raise exception 'Escribí la cantidad pesada (mayor que 0).' using errcode = '22023';
  end if;
  insert into public.pedido_pesadas (item_id, kilos, cantidad, creado_por)
  values (p_item, round(p_kilos, 3), round(p_cantidad, 2), auth.uid());
  return public.detalle_pedido(v_num);
end;
$$;

create or replace function public.quitar_pesada(p_pesada bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_item bigint; v_num integer;
begin
  select item_id into v_item from public.pedido_pesadas where id = p_pesada;
  if v_item is null then
    raise exception 'Pesada no encontrada.' using errcode = 'P0002';
  end if;
  v_num := privado.item_armando(v_item);
  delete from public.pedido_pesadas where id = p_pesada;
  return public.detalle_pedido(v_num);
end;
$$;

create or replace function public.guardar_bultos(p_item bigint, p_bultos integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_num integer;
begin
  v_num := privado.item_armando(p_item);
  if p_bultos is not null and (p_bultos < 0 or p_bultos > 100000) then
    raise exception 'Los bultos tienen que ser un número entero de 0 en adelante.' using errcode = '22023';
  end if;
  update public.pedido_items set bultos = p_bultos where id = p_item;
  return public.detalle_pedido(v_num);
end;
$$;

revoke all on function public.agregar_pesada(bigint, numeric, numeric) from public, anon;
revoke all on function public.quitar_pesada(bigint) from public, anon;
revoke all on function public.guardar_bultos(bigint, integer) from public, anon;
grant execute on function public.agregar_pesada(bigint, numeric, numeric) to authenticated;
grant execute on function public.quitar_pesada(bigint) to authenticated;
grant execute on function public.guardar_bultos(bigint, integer) to authenticated;
revoke all on function privado.item_armando(bigint) from public, anon, authenticated;

-- El detalle ahora trae, por renglón: id, bultos, pesadas, kilos y cantidad pesada totales
create or replace function public.detalle_pedido(p_numero integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_res jsonb;
begin
  select jsonb_build_object(
           'numero', p.numero, 'estado', p.estado, 'creado', p.creado,
           'observaciones', p.observaciones, 'total', p.total,
           'aceptado', p.aceptado, 'retirado', p.retirado,
           'cancelado', p.cancelado, 'motivo_cancelacion', p.motivo_cancelacion,
           'cargado_por', (select c.usuario from public.perfiles c where c.id = p.cargado_por),
           'cliente', jsonb_build_object('usuario', pf.usuario, 'nombre', pf.nombre, 'apellido', pf.apellido,
                                         'cuit', pf.cuit, 'email', pf.email),
           'items', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', i.id, 'codigo', i.codigo, 'descripcion', i.descripcion,
                      'cantidad', i.cantidad, 'precio_unitario', i.precio_unitario,
                      'subtotal', i.subtotal, 'bultos', i.bultos,
                      'kilos', (select coalesce(sum(w.kilos), 0) from public.pedido_pesadas w where w.item_id = i.id),
                      'cantidad_pesada', (select coalesce(sum(w.cantidad), 0) from public.pedido_pesadas w where w.item_id = i.id),
                      'pesadas', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'kilos', w.kilos, 'cantidad', w.cantidad, 'creado', w.creado) order by w.id)
                                           from public.pedido_pesadas w where w.item_id = i.id), '[]'::jsonb))
                    order by i.id)
             from public.pedido_items i where i.pedido_numero = p.numero), '[]'::jsonb))
    into v_res
  from public.pedidos p
  join public.perfiles pf on pf.id = p.cliente_id
  where p.numero = p_numero
    and (p.cliente_id = (select auth.uid())
         or privado.es_admin()
         or (privado.rol_actual() = 'empleado' and p.estado in ('armando', 'retirado')));
  if v_res is null then
    raise exception 'Pedido no encontrado.' using errcode = 'P0002';
  end if;
  return v_res;
end;
$$;
