-- =====================================================================
-- Lácteos NC — Migración 06: permisos del superadministrador
--
--   superadmin     acceso absoluto: todo lo del administrador y además
--                  asigna o quita los roles administrador y superadmin,
--                  y es el único que puede modificar a otro superadmin.
--   administrador  carga productos, precios, novedades y archivos;
--                  activa cuentas de clientes y empleados.
--                  NO puede crear administradores ni tocar a un superadmin.
-- =====================================================================

-- El superadmin cuenta como administrador y como personal en todas las reglas
create or replace function privado.es_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(privado.rol_actual() in ('administrador', 'superadmin'), false); $$;

create or replace function privado.es_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(privado.rol_actual() in ('empleado', 'administrador', 'superadmin'), false); $$;

create or replace function privado.es_superadmin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(privado.rol_actual() = 'superadmin', false); $$;

revoke all on function privado.es_superadmin() from public;
grant execute on function privado.es_superadmin() to anon, authenticated;

-- Protección de roles: aunque un administrador edite perfiles, no puede
-- dar ni quitar los roles administrador/superadmin ni modificar a un superadmin.
-- (Los cambios hechos desde el SQL Editor de Supabase, sin usuario, no se frenan.)
create or replace function privado.proteger_roles()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or privado.es_superadmin() then
    return new;
  end if;

  if old.rol = 'superadmin' then
    raise exception 'Solo un superadministrador puede modificar a otro superadministrador.' using errcode = '42501';
  end if;

  if new.rol is distinct from old.rol
     and (new.rol in ('administrador', 'superadmin') or old.rol in ('administrador', 'superadmin')) then
    raise exception 'Solo un superadministrador puede asignar o quitar el rol de administrador.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function privado.proteger_roles() from public, anon, authenticated;

create trigger perfiles_proteger_roles
  before update on public.perfiles
  for each row execute function privado.proteger_roles();

-- activar_cuenta: el administrador activa clientes y empleados;
-- solo el superadmin puede activar con rol administrador o superadmin.
create or replace function public.activar_cuenta(p_perfil_id uuid, p_usuario text, p_lista_id smallint,
                                                 p_rol public.rol_usuario default 'cliente')
returns public.perfiles language plpgsql security definer set search_path = ''
as $$
declare v_res public.perfiles;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador puede activar cuentas.' using errcode = '42501';
  end if;
  if p_rol in ('administrador', 'superadmin') and not privado.es_superadmin() then
    raise exception 'Solo un superadministrador puede dar el rol de administrador.' using errcode = '42501';
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
