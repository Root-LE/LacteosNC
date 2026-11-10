-- =====================================================================
-- Migración 13 — Aceptar / cancelar pedidos, permisos por rol,
-- ingreso con usuario e indicadores (KPI)
-- (13a agregó el valor 'cancelado' al tipo estado_pedido)
--
-- Flujo nuevo de pedidos:
--   en_espera  --(administrador acepta)-->  armando  --(empleado o admin)-->  retirado
--   en_espera  --(administrador cancela)--> cancelado
-- Los empleados solo ven pedidos "armando" y "retirado".
-- =====================================================================

-- 1. Datos de aceptación y cancelación
alter table public.pedidos
  add column aceptado timestamptz,
  add column aceptado_por uuid references auth.users (id) on delete set null,
  add column cancelado timestamptz,
  add column cancelado_por uuid references auth.users (id) on delete set null,
  add column motivo_cancelacion text check (motivo_cancelacion is null or length(motivo_cancelacion) <= 300);

-- 2. Quién ve cada pedido
drop policy if exists "pedidos: ver los propios o todos si es personal" on public.pedidos;
create policy "pedidos: cliente los suyos, admin todos, empleado armando y retirados" on public.pedidos
  for select to authenticated using (
    cliente_id = (select auth.uid())
    or (select privado.es_admin())
    or ((select privado.rol_actual()) = 'empleado' and estado in ('armando', 'retirado'))
  );

drop policy if exists "pedido_items: ver los de sus pedidos o todos si es personal" on public.pedido_items;
create policy "pedido_items: los de pedidos que se pueden ver" on public.pedido_items
  for select to authenticated using (
    exists (select 1 from public.pedidos p where p.numero = pedido_items.pedido_numero)
  );

-- 3. Detalle del pedido (respeta lo mismo)
create or replace function public.detalle_pedido(p_numero integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_res jsonb;
begin
  select jsonb_build_object(
           'numero', p.numero, 'estado', p.estado, 'creado', p.creado,
           'observaciones', p.observaciones, 'total', p.total,
           'aceptado', p.aceptado, 'retirado', p.retirado,
           'cancelado', p.cancelado, 'motivo_cancelacion', p.motivo_cancelacion,
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

-- 4. Abrir un pedido ya no cambia su estado (solo muestra el detalle al personal)
create or replace function public.abrir_pedido(p_numero integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_staff() then
    raise exception 'No tenés permiso para ver los pedidos.' using errcode = '42501';
  end if;
  update public.pedidos set abierto = coalesce(abierto, now()), abierto_por = coalesce(abierto_por, auth.uid())
   where numero = p_numero and estado = 'armando' and abierto is null and privado.rol_actual() = 'empleado';
  return public.detalle_pedido(p_numero);
end;
$$;

-- 5. Aceptar (solo administrador o superadministrador): pasa a "armando"
create or replace function public.aceptar_pedido(p_numero integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador puede aceptar pedidos.' using errcode = '42501';
  end if;
  update public.pedidos set estado = 'armando', aceptado = now(), aceptado_por = auth.uid()
   where numero = p_numero and estado = 'en_espera';
  if not found then
    raise exception 'Solo se puede aceptar un pedido que está en espera.' using errcode = '22023';
  end if;
  return public.detalle_pedido(p_numero);
end;
$$;

-- 6. Cancelar (solo administrador o superadministrador)
create or replace function public.cancelar_pedido(p_numero integer, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador puede cancelar pedidos.' using errcode = '42501';
  end if;
  update public.pedidos set estado = 'cancelado', cancelado = now(), cancelado_por = auth.uid(),
         motivo_cancelacion = left(nullif(trim(p_motivo), ''), 300)
   where numero = p_numero and estado = 'en_espera';
  if not found then
    raise exception 'Solo se puede cancelar un pedido que está en espera.' using errcode = '22023';
  end if;
  return public.detalle_pedido(p_numero);
end;
$$;

revoke all on function public.aceptar_pedido(integer) from public, anon;
revoke all on function public.cancelar_pedido(integer, text) from public, anon;
grant execute on function public.aceptar_pedido(integer) to authenticated;
grant execute on function public.cancelar_pedido(integer, text) to authenticated;

-- 7. Novedades para el bot: pedido aceptado y cancelado
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in (
  'cliente_para_activar', 'cuenta_activada', 'cuenta_bloqueada',
  'pedido_nuevo', 'pedido_aceptado', 'pedido_armando', 'pedido_retirado', 'pedido_cancelado'));

create or replace function privado.evento_pedido_estado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tipo text;
begin
  if new.estado is not distinct from old.estado then return new; end if;
  v_tipo := case new.estado when 'armando' then 'pedido_aceptado' when 'retirado' then 'pedido_retirado'
                            when 'cancelado' then 'pedido_cancelado' end;
  if v_tipo is not null then
    insert into public.eventos (tipo, perfil_id, pedido_numero, datos)
    values (v_tipo, new.cliente_id, new.numero,
            privado.datos_pedido(new.numero)
            || jsonb_build_object('por', (select pf.usuario from public.perfiles pf where pf.id = auth.uid()))
            || case when new.estado = 'cancelado' then jsonb_build_object('motivo', new.motivo_cancelacion) else '{}'::jsonb end);
  end if;
  return new;
end;
$$;

-- 8. Usuario único sin distinguir mayúsculas (Fnardi = fnardi)
create unique index if not exists perfiles_usuario_unico_idx on public.perfiles (lower(usuario)) where usuario is not null;
create unique index if not exists perfiles_email_unico_idx on public.perfiles (lower(email));

-- 9. Ingreso con usuario: lo resuelve la Edge Function (nunca se expone el email de otro)
create table public.intentos_ingreso (
  clave           text primary key,
  fallos          smallint not null default 0,
  bloqueado_hasta timestamptz,
  actualizado     timestamptz not null default now()
);
comment on table public.intentos_ingreso is 'Errores de ingreso con usuario (5 errores = 15 minutos de espera). Solo la usa la Edge Function "cuentas".';
alter table public.intentos_ingreso enable row level security;
revoke all on public.intentos_ingreso from anon, authenticated;

create or replace function public.ingreso_buscar(p_usuario text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_clave text := lower(trim(p_usuario)); v public.intentos_ingreso; v_email text;
begin
  select * into v from public.intentos_ingreso where clave = v_clave;
  if v.bloqueado_hasta > now() then
    return jsonb_build_object('espera_seg', ceil(extract(epoch from (v.bloqueado_hasta - now())))::int);
  end if;
  select pf.email into v_email from public.perfiles pf where lower(pf.usuario) = v_clave;
  return jsonb_build_object('espera_seg', 0, 'email', v_email);
end;
$$;

create or replace function public.ingreso_resultado(p_usuario text, p_ok boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_clave text := lower(trim(p_usuario));
begin
  if p_ok then
    delete from public.intentos_ingreso where clave = v_clave;
    return;
  end if;
  insert into public.intentos_ingreso as t (clave, fallos, actualizado) values (v_clave, 1, now())
  on conflict (clave) do update
     set fallos = case when t.actualizado < now() - interval '15 minutes' then 1 else t.fallos + 1 end,
         actualizado = now();
  update public.intentos_ingreso set bloqueado_hasta = now() + interval '15 minutes', fallos = 0
   where clave = v_clave and fallos >= 5;
end;
$$;

revoke all on function public.ingreso_buscar(text) from public, anon, authenticated;
revoke all on function public.ingreso_resultado(text, boolean) from public, anon, authenticated;
grant execute on function public.ingreso_buscar(text) to service_role;
grant execute on function public.ingreso_resultado(text, boolean) to service_role;

-- 10. Indicadores (KPI) para el panel — solo administradores
create or replace function public.kpis()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz  text := 'America/Argentina/Buenos_Aires';
  v_hoy date := (now() at time zone v_tz)::date;
  v_mes timestamptz := (date_trunc('month', now() at time zone v_tz)) at time zone v_tz;
  v_res jsonb;
begin
  if not privado.es_admin() then
    raise exception 'Solo administradores.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'pedidos', (select jsonb_build_object(
        'en_espera',  count(*) filter (where estado = 'en_espera'),
        'armando',    count(*) filter (where estado = 'armando'),
        'hoy',        count(*) filter (where (creado at time zone v_tz)::date = v_hoy),
        'semana',     count(*) filter (where creado >= now() - interval '7 days'),
        'mes',        count(*) filter (where creado >= v_mes),
        'retirados_mes', count(*) filter (where estado = 'retirado' and retirado >= v_mes),
        'cancelados_mes', count(*) filter (where estado = 'cancelado' and cancelado >= v_mes),
        'total_mes',  coalesce(sum(total) filter (where creado >= v_mes and estado <> 'cancelado'), 0),
        'promedio_mes', coalesce(round(avg(total) filter (where creado >= v_mes and estado <> 'cancelado'), 2), 0),
        'min_aceptar', round(extract(epoch from avg(aceptado - creado) filter (where aceptado >= v_mes)) / 60),
        'min_retirar', round(extract(epoch from avg(retirado - aceptado) filter (where retirado >= v_mes and aceptado is not null)) / 60))
      from public.pedidos),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'pedidos', coalesce(n, 0)) order by d), '[]'::jsonb)
      from generate_series((v_hoy - 29)::timestamp, v_hoy::timestamp, interval '1 day') d
      left join (select (creado at time zone v_tz)::date dia, count(*) n from public.pedidos
                  where creado >= now() - interval '31 days' and estado <> 'cancelado' group by 1) x on x.dia = d::date),
    'top_articulos', (select coalesce(jsonb_agg(t order by t.cantidad desc), '[]'::jsonb) from (
        select i.codigo, i.descripcion, sum(i.cantidad) cantidad, count(distinct i.pedido_numero) pedidos
          from public.pedido_items i join public.pedidos p on p.numero = i.pedido_numero
         where p.creado >= v_mes and p.estado <> 'cancelado'
         group by i.codigo, i.descripcion order by sum(i.cantidad) desc limit 5) t),
    'top_clientes', (select coalesce(jsonb_agg(t order by t.pedidos desc, t.total desc), '[]'::jsonb) from (
        select pf.usuario, trim(coalesce(pf.nombre, '') || ' ' || coalesce(pf.apellido, '')) nombre,
               count(*) pedidos, coalesce(sum(p.total), 0) total
          from public.pedidos p join public.perfiles pf on pf.id = p.cliente_id
         where p.creado >= v_mes and p.estado <> 'cancelado'
         group by pf.id order by count(*) desc, sum(p.total) desc limit 5) t),
    'cuentas', (select jsonb_build_object(
        'clientes_activos', count(*) filter (where rol = 'cliente' and estado = 'activa'),
        'para_activar',     count(*) filter (where estado = 'pendiente_activacion'),
        'sin_verificar',    count(*) filter (where estado = 'pendiente_verificacion'),
        'empleados',        count(*) filter (where rol = 'empleado' and estado = 'activa'),
        'nuevos_mes',       count(*) filter (where rol = 'cliente' and creado >= v_mes))
      from public.perfiles),
    'catalogo', (select jsonb_build_object(
        'articulos_activos', (select count(*) from public.articulos where activo),
        'tarjetas_visibles', (select count(*) from public.productos where visible),
        'tarjetas_sin_foto', (select count(*) from public.productos where imagen_url is null)))
  ) into v_res;
  return v_res;
end;
$$;
revoke all on function public.kpis() from public, anon;
grant execute on function public.kpis() to authenticated;
