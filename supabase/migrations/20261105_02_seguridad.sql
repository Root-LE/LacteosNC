-- =====================================================================
-- Lácteos NC — Migración 02: seguridad por rol (RLS) y funciones
--
-- Roles:
--   visitante     (sin sesión)  ve productos, categorías y novedades visibles; puede escribir en contacto
--   cliente       (cuenta activa) además ve SU lista de precios y SUS pedidos; crea pedidos con crear_pedido()
--   empleado      ve todos los pedidos; los abre (pasan a "armando") y los marca como retirados
--   administrador todo lo anterior y además carga productos, precios, novedades y activa cuentas
-- =====================================================================

-- ---------- Funciones auxiliares (esquema privado, no expuesto en la API) ----------
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to anon, authenticated;

-- Rol del usuario actual, solo si su cuenta está activa
create or replace function privado.rol_actual()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol
  from public.perfiles p
  where p.id = (select auth.uid()) and p.estado = 'activa';
$$;

create or replace function privado.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(privado.rol_actual() = 'administrador', false);
$$;

create or replace function privado.es_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(privado.rol_actual() in ('empleado', 'administrador'), false);
$$;

-- Lista de precio del usuario actual, solo si su cuenta está activa
create or replace function privado.mi_lista()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select p.lista_precio_id
  from public.perfiles p
  where p.id = (select auth.uid()) and p.estado = 'activa';
$$;

revoke all on function privado.rol_actual(), privado.es_admin(), privado.es_staff(), privado.mi_lista() from public;
grant execute on function privado.rol_actual(), privado.es_admin(), privado.es_staff(), privado.mi_lista() to anon, authenticated;

-- ---------- Alta automática del perfil al registrarse ----------
create or replace function privado.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuit text := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'cuit', ''), '[^0-9]', '', 'g'), '');
begin
  if v_cuit is not null and length(v_cuit) <> 11 then
    v_cuit := null;
  end if;

  insert into public.perfiles (id, email, nombre, apellido, cuit, acepto_terminos, estado)
  values (
    new.id,
    new.email,
    left(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), 80),
    left(nullif(trim(new.raw_user_meta_data ->> 'apellido'), ''), 80),
    v_cuit,
    case when (new.raw_user_meta_data ->> 'acepto_terminos')::boolean then now() end,
    case when new.email_confirmed_at is not null then 'pendiente_activacion'::public.estado_cuenta
         else 'pendiente_verificacion'::public.estado_cuenta end
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function privado.crear_perfil();

-- Cuando el usuario verifica su email, la cuenta pasa a "pendiente de activación"
create or replace function privado.email_verificado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.perfiles
       set estado = 'pendiente_activacion'
     where id = new.id and estado = 'pendiente_verificacion';
  end if;
  if new.email is distinct from old.email then
    update public.perfiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger al_actualizar_usuario
  after update of email_confirmed_at, email on auth.users
  for each row execute function privado.email_verificado();

-- ---------- Reglas (políticas RLS) ----------

-- Listas de precio
create policy "listas: ver la propia o todas si es personal"
  on public.listas_precio for select to authenticated
  using ((select privado.es_staff()) or id = (select privado.mi_lista()));
create policy "listas: admin carga"   on public.listas_precio for insert to authenticated with check ((select privado.es_admin()));
create policy "listas: admin edita"   on public.listas_precio for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "listas: admin borra"   on public.listas_precio for delete to authenticated using ((select privado.es_admin()));

-- Perfiles
create policy "perfiles: ver el propio o todos si es personal"
  on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select privado.es_staff()));
create policy "perfiles: admin edita"
  on public.perfiles for update to authenticated
  using ((select privado.es_admin())) with check ((select privado.es_admin()));

-- Categorías
create policy "categorias: todos ven" on public.categorias for select to anon, authenticated using (true);
create policy "categorias: admin carga" on public.categorias for insert to authenticated with check ((select privado.es_admin()));
create policy "categorias: admin edita" on public.categorias for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "categorias: admin borra" on public.categorias for delete to authenticated using ((select privado.es_admin()));

-- Productos
create policy "productos: todos ven los visibles, el personal ve todos"
  on public.productos for select to anon, authenticated
  using (visible or (select privado.es_staff()));
create policy "productos: admin carga" on public.productos for insert to authenticated with check ((select privado.es_admin()));
create policy "productos: admin edita" on public.productos for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "productos: admin borra" on public.productos for delete to authenticated using ((select privado.es_admin()));

-- Precios
create policy "precios: el cliente ve su lista, el personal ve todas"
  on public.precios for select to authenticated
  using ((select privado.es_staff()) or lista_id = (select privado.mi_lista()));
create policy "precios: admin carga" on public.precios for insert to authenticated with check ((select privado.es_admin()));
create policy "precios: admin edita" on public.precios for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "precios: admin borra" on public.precios for delete to authenticated using ((select privado.es_admin()));

-- Novedades
create policy "novedades: todos ven las visibles, el personal ve todas"
  on public.novedades for select to anon, authenticated
  using (visible or (select privado.es_staff()));
create policy "novedades: admin carga" on public.novedades for insert to authenticated with check ((select privado.es_admin()));
create policy "novedades: admin edita" on public.novedades for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "novedades: admin borra" on public.novedades for delete to authenticated using ((select privado.es_admin()));

-- Pedidos: se ven los propios (o todos si es personal). Se crean y cambian de estado solo con las funciones de abajo.
create policy "pedidos: ver los propios o todos si es personal"
  on public.pedidos for select to authenticated
  using (cliente_id = (select auth.uid()) or (select privado.es_staff()));

create policy "pedido_items: ver los de sus pedidos o todos si es personal"
  on public.pedido_items for select to authenticated
  using (
    (select privado.es_staff())
    or exists (select 1 from public.pedidos p
               where p.numero = pedido_items.pedido_numero and p.cliente_id = (select auth.uid()))
  );

-- Contacto: cualquiera escribe, solo el administrador lee
create policy "contacto: cualquiera envía"
  on public.mensajes_contacto for insert to anon, authenticated
  with check (leido = false);
create policy "contacto: admin lee"   on public.mensajes_contacto for select to authenticated using ((select privado.es_admin()));
create policy "contacto: admin marca" on public.mensajes_contacto for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "contacto: admin borra" on public.mensajes_contacto for delete to authenticated using ((select privado.es_admin()));

-- ---------- Funciones para pedidos (se llaman desde el sitio) ----------

-- El cliente crea un pedido. p_items = [{"producto_id": 1, "cantidad": 3}, ...]
-- Devuelve el número de pedido con su detalle.
create or replace function public.crear_pedido(p_items jsonb, p_observaciones text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
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

  -- Validar renglones: producto existente y visible, cantidad entre 0 y 100000
  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    left join public.productos pr
      on pr.id = case when (e ->> 'producto_id') ~ '^[0-9]+$' then (e ->> 'producto_id')::integer end
     and pr.visible
    where pr.id is null
       or coalesce(e ->> 'cantidad', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
       or (e ->> 'cantidad')::numeric <= 0
       or (e ->> 'cantidad')::numeric > 100000
  ) then
    raise exception 'Hay productos o cantidades inválidas en el pedido.' using errcode = '22023';
  end if;

  insert into public.pedidos (cliente_id, lista_precio_id, observaciones)
  values (v_uid, v_perfil.lista_precio_id, left(nullif(trim(p_observaciones), ''), 500))
  returning numero into v_numero;

  -- Se agrupan productos repetidos y se copian código, descripción y precio de la lista del cliente
  insert into public.pedido_items (pedido_numero, producto_id, codigo, descripcion, cantidad, precio_unitario)
  select v_numero, pr.id, pr.codigo, pr.nombre, sum((e ->> 'cantidad')::numeric), pc.precio
  from jsonb_array_elements(p_items) e
  join public.productos pr on pr.id = (e ->> 'producto_id')::integer
  left join public.precios pc on pc.producto_id = pr.id and pc.lista_id = v_perfil.lista_precio_id
  group by pr.id, pr.codigo, pr.nombre, pc.precio;

  select coalesce(sum(subtotal), 0) into v_total from public.pedido_items where pedido_numero = v_numero;
  update public.pedidos set total = v_total where numero = v_numero;

  return public.detalle_pedido(v_numero);
end;
$$;

-- Detalle de un pedido (el dueño o el personal)
create or replace function public.detalle_pedido(p_numero integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  select jsonb_build_object(
           'numero', p.numero,
           'estado', p.estado,
           'creado', p.creado,
           'observaciones', p.observaciones,
           'total', p.total,
           'cliente', jsonb_build_object('usuario', pf.usuario, 'nombre', pf.nombre, 'apellido', pf.apellido,
                                         'cuit', pf.cuit, 'email', pf.email),
           'items', coalesce((
             select jsonb_agg(jsonb_build_object('codigo', i.codigo, 'descripcion', i.descripcion,
                                                 'cantidad', i.cantidad, 'precio_unitario', i.precio_unitario,
                                                 'subtotal', i.subtotal) order by i.id)
             from public.pedido_items i where i.pedido_numero = p.numero), '[]'::jsonb)
         )
    into v_res
  from public.pedidos p
  join public.perfiles pf on pf.id = p.cliente_id
  where p.numero = p_numero
    and (p.cliente_id = (select auth.uid()) or privado.es_staff());

  if v_res is null then
    raise exception 'Pedido no encontrado.' using errcode = 'P0002';
  end if;
  return v_res;
end;
$$;

-- El personal abre un pedido: si estaba "en espera" pasa a "armando". Devuelve el detalle.
create or replace function public.abrir_pedido(p_numero integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.es_staff() then
    raise exception 'No tenés permiso para ver los pedidos.' using errcode = '42501';
  end if;

  update public.pedidos
     set estado = 'armando', abierto = now(), abierto_por = auth.uid()
   where numero = p_numero and estado = 'en_espera';

  return public.detalle_pedido(p_numero);
end;
$$;

-- El personal marca un pedido como retirado (desde "armando")
create or replace function public.marcar_retirado(p_numero integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.es_staff() then
    raise exception 'No tenés permiso para cambiar pedidos.' using errcode = '42501';
  end if;

  update public.pedidos
     set estado = 'retirado', retirado = now(), retirado_por = auth.uid()
   where numero = p_numero and estado = 'armando';

  if not found then
    raise exception 'Solo se puede marcar como retirado un pedido que se está armando.' using errcode = '22023';
  end if;

  return public.detalle_pedido(p_numero);
end;
$$;

-- El administrador activa una cuenta: asigna usuario, lista de precio y (opcional) rol
create or replace function public.activar_cuenta(
  p_perfil_id uuid,
  p_usuario   text,
  p_lista_id  smallint,
  p_rol       public.rol_usuario default 'cliente'
)
returns public.perfiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res public.perfiles;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador puede activar cuentas.' using errcode = '42501';
  end if;
  if p_usuario is null or p_usuario !~ '^[A-Za-z0-9._-]{3,30}$' then
    raise exception 'El usuario debe tener entre 3 y 30 caracteres (letras, números, punto, guion).' using errcode = '22023';
  end if;

  update public.perfiles
     set usuario = p_usuario, lista_precio_id = p_lista_id, rol = p_rol,
         estado = 'activa', activado = now(), activado_por = auth.uid()
   where id = p_perfil_id and estado in ('pendiente_activacion', 'activa', 'bloqueada')
  returning * into v_res;

  if v_res.id is null then
    raise exception 'La cuenta no existe o todavía no verificó su email.' using errcode = 'P0002';
  end if;
  return v_res;
end;
$$;

-- Permisos de ejecución: solo usuarios con sesión
revoke all on function public.crear_pedido(jsonb, text)          from public, anon;
revoke all on function public.detalle_pedido(integer)            from public, anon;
revoke all on function public.abrir_pedido(integer)              from public, anon;
revoke all on function public.marcar_retirado(integer)           from public, anon;
revoke all on function public.activar_cuenta(uuid, text, smallint, public.rol_usuario) from public, anon;
grant execute on function public.crear_pedido(jsonb, text)          to authenticated;
grant execute on function public.detalle_pedido(integer)            to authenticated;
grant execute on function public.abrir_pedido(integer)              to authenticated;
grant execute on function public.marcar_retirado(integer)           to authenticated;
grant execute on function public.activar_cuenta(uuid, text, smallint, public.rol_usuario) to authenticated;

revoke all on function privado.crear_perfil(), privado.email_verificado() from public, anon, authenticated;
revoke all on function public.tocar_actualizado() from public, anon, authenticated;
