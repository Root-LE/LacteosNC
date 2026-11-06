-- =====================================================================
-- Migración 11 — Registro de novedades (eventos) para automatizar con un bot
--
-- Cada vez que pasa algo importante se guarda una fila en public.eventos:
--   cliente_para_activar  un cliente verificó su email y espera activación
--   cuenta_activada       un administrador activó una cuenta
--   cuenta_bloqueada      un administrador bloqueó una cuenta
--   pedido_nuevo          un cliente confirmó un pedido (con sus renglones)
--   pedido_armando        un empleado abrió el pedido
--   pedido_retirado       el pedido se marcó como retirado
--
-- El bot lee las filas con procesado = null, hace lo suyo y las marca con
-- public.marcar_eventos(ids, 'nombre-del-bot'). También puede escuchar en
-- tiempo real (Supabase Realtime) los INSERT de la tabla.
-- Los guardan disparadores en la base: no dependen de la página web.
-- =====================================================================

create table public.eventos (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('cliente_para_activar', 'cuenta_activada', 'cuenta_bloqueada',
                                              'pedido_nuevo', 'pedido_armando', 'pedido_retirado')),
  perfil_id     uuid references public.perfiles (id) on delete set null,
  pedido_numero integer references public.pedidos (numero) on delete set null,
  datos         jsonb not null default '{}'::jsonb,
  creado        timestamptz not null default now(),
  procesado     timestamptz,
  procesado_por text
);
comment on table public.eventos is 'Novedades para automatizar (bot): cuentas para activar, pedidos nuevos y cambios de estado.';
create index eventos_pendientes_idx on public.eventos (id) where procesado is null;
create index eventos_tipo_idx on public.eventos (tipo, creado desc);

alter table public.eventos enable row level security;
revoke all on public.eventos from anon, authenticated;
grant select on public.eventos to authenticated;
create policy "eventos: solo administradores leen" on public.eventos
  for select to authenticated using ((select privado.es_admin()));

-- Datos de un perfil para guardar en el evento
create or replace function privado.datos_perfil(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('usuario', p.usuario, 'nombre', p.nombre, 'apellido', p.apellido, 'email', p.email,
                            'cuit', p.cuit, 'rol', p.rol, 'estado', p.estado,
                            'lista', (select l.nombre from public.listas_precio l where l.id = p.lista_precio_id))
  from public.perfiles p where p.id = p_id;
$$;

-- Datos de un pedido (con renglones) para guardar en el evento
create or replace function privado.datos_pedido(p_numero integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'numero', pe.numero, 'estado', pe.estado, 'creado', pe.creado, 'total', pe.total, 'observaciones', pe.observaciones,
    'cliente', privado.datos_perfil(pe.cliente_id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('codigo', i.codigo, 'descripcion', i.descripcion,
                        'cantidad', i.cantidad, 'precio_unitario', i.precio_unitario, 'subtotal', i.subtotal) order by i.id)
                       from public.pedido_items i where i.pedido_numero = pe.numero), '[]'::jsonb))
  from public.pedidos pe where pe.numero = p_numero;
$$;

-- Cambios de estado de cuentas
create or replace function privado.evento_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tipo text;
begin
  if new.estado is not distinct from old.estado then return new; end if;
  v_tipo := case
    when new.estado = 'pendiente_activacion' and old.estado = 'pendiente_verificacion' then 'cliente_para_activar'
    when new.estado = 'activa' then 'cuenta_activada'
    when new.estado = 'bloqueada' then 'cuenta_bloqueada'
  end;
  if v_tipo is not null then
    insert into public.eventos (tipo, perfil_id, datos)
    values (v_tipo, new.id, privado.datos_perfil(new.id) || jsonb_build_object('estado_anterior', old.estado));
  end if;
  return new;
end;
$$;
create trigger perfiles_evento after update of estado on public.perfiles
  for each row execute function privado.evento_perfil();

-- Pedido nuevo: se registra al final de la transacción, cuando ya tiene sus renglones
create or replace function privado.evento_pedido_nuevo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.eventos (tipo, perfil_id, pedido_numero, datos)
  values ('pedido_nuevo', new.cliente_id, new.numero, privado.datos_pedido(new.numero));
  return null;
end;
$$;
create constraint trigger pedidos_evento_nuevo after insert on public.pedidos
  deferrable initially deferred
  for each row execute function privado.evento_pedido_nuevo();

-- Cambios de estado de pedidos
create or replace function privado.evento_pedido_estado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado is distinct from old.estado and new.estado in ('armando', 'retirado') then
    insert into public.eventos (tipo, perfil_id, pedido_numero, datos)
    values (case new.estado when 'armando' then 'pedido_armando' else 'pedido_retirado' end,
            new.cliente_id, new.numero,
            privado.datos_pedido(new.numero) || jsonb_build_object('por', (select pf.usuario from public.perfiles pf where pf.id = auth.uid())));
  end if;
  return new;
end;
$$;
create trigger pedidos_evento_estado after update of estado on public.pedidos
  for each row execute function privado.evento_pedido_estado();

-- El bot (o un administrador) marca eventos como procesados
create or replace function public.marcar_eventos(p_ids bigint[], p_por text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not privado.es_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No tenés permiso.' using errcode = '42501';
  end if;
  update public.eventos set procesado = now(), procesado_por = left(coalesce(nullif(trim(p_por), ''),
           (select pf.usuario from public.perfiles pf where pf.id = auth.uid()), 'bot'), 60)
   where id = any(p_ids) and procesado is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.marcar_eventos(bigint[], text) from public, anon;
grant execute on function public.marcar_eventos(bigint[], text) to authenticated, service_role;

revoke all on function privado.datos_perfil(uuid) from public, anon, authenticated;
revoke all on function privado.datos_pedido(integer) from public, anon, authenticated;

-- Tiempo real: el bot puede suscribirse a los eventos nuevos
alter publication supabase_realtime add table public.eventos;
