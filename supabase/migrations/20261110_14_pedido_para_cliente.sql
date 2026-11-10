-- Migración 14 — El administrador carga un pedido a nombre de un cliente
-- (por ejemplo, el cliente lo pasó por WhatsApp). El pedido queda asociado
-- al cliente, que lo ve en "Mis pedidos", con los precios de SU lista.

-- 1. Quién cargó el pedido (null = lo hizo el propio cliente desde la web)
alter table public.pedidos
  add column if not exists cargado_por uuid references public.perfiles(id) on delete set null;

-- 2. Crear un pedido para un cliente (solo administrador o superadministrador)
create or replace function public.crear_pedido_para(
  p_cliente uuid, p_items jsonb, p_observaciones text default null, p_aceptar boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cli    public.perfiles%rowtype;
  v_numero integer;
  v_total  numeric(14, 2);
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador puede cargar pedidos para un cliente.' using errcode = '42501';
  end if;
  select * into v_cli from public.perfiles where id = p_cliente;
  if v_cli.id is null or v_cli.rol <> 'cliente' then
    raise exception 'Elegí un cliente.' using errcode = '22023';
  end if;
  if v_cli.estado <> 'activa' then
    raise exception 'La cuenta de ese cliente no está activa.' using errcode = '22023';
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

  -- Si se acepta al cargarlo, entra directo en "armando" (sin pasar por "en espera")
  insert into public.pedidos (cliente_id, lista_precio_id, observaciones, cargado_por, estado, aceptado, aceptado_por)
  values (v_cli.id, v_cli.lista_precio_id, left(nullif(trim(p_observaciones), ''), 500), auth.uid(),
          case when p_aceptar then 'armando' else 'en_espera' end::public.estado_pedido,
          case when p_aceptar then now() end, case when p_aceptar then auth.uid() end)
  returning numero into v_numero;

  insert into public.pedido_items (pedido_numero, articulo_id, codigo, descripcion, cantidad, precio_unitario)
  select v_numero, a.id, a.codigo, a.descripcion, sum((e ->> 'cantidad')::numeric), pc.precio
  from jsonb_array_elements(p_items) e
  join public.articulos a on a.id = (e ->> 'articulo_id')::integer
  left join public.precios pc on pc.articulo_id = a.id and pc.lista_id = v_cli.lista_precio_id
  group by a.id, a.codigo, a.descripcion, pc.precio;

  select coalesce(sum(subtotal), 0) into v_total from public.pedido_items where pedido_numero = v_numero;
  update public.pedidos set total = v_total where numero = v_numero;

  return public.detalle_pedido(v_numero);
end;
$$;
revoke all on function public.crear_pedido_para(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.crear_pedido_para(uuid, jsonb, text, boolean) to authenticated;

-- 3. El detalle muestra quién lo cargó
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
             select jsonb_agg(jsonb_build_object('codigo', i.codigo, 'descripcion', i.descripcion,
                                                 'cantidad', i.cantidad, 'precio_unitario', i.precio_unitario,
                                                 'subtotal', i.subtotal) order by i.id)
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

-- 4. El evento "pedido_nuevo" avisa al bot quién lo cargó y si ya entró aceptado
create or replace function privado.evento_pedido_nuevo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.eventos (tipo, perfil_id, pedido_numero, datos)
  values ('pedido_nuevo', new.cliente_id, new.numero,
          privado.datos_pedido(new.numero)
          || jsonb_build_object('estado', new.estado,
                                'cargado_por', (select c.usuario from public.perfiles c where c.id = new.cargado_por)));
  return null;
end;
$$;
