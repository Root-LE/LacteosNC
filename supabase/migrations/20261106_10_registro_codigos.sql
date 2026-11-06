-- =====================================================================
-- Migración 10 — Registro de clientes con código de 6 dígitos
-- La tabla y las funciones solo las usa la función del servidor
-- (Edge Function "cuentas") con la clave de servicio. Ni visitantes ni
-- usuarios con sesión pueden leerlas ni llamarlas.
--
-- Reglas del código:
--   * vence a los 20 minutos;
--   * errores 1 a 5: esperar 1, 2, 3, 4 y 5 minutos;
--   * desde el 5.º error hay que volver a tildar "no soy un robot";
--   * 6.º error: el código caduca, el registro se borra y el email queda
--     bloqueado 1 hora; después hay que registrarse de nuevo;
--   * reenviar un código: como mínimo 60 segundos entre envíos y no
--     reinicia el contador de errores.
-- =====================================================================

create table public.verificaciones (
  email            text primary key check (email = lower(email)),
  user_id          uuid,
  codigo_hash      text,
  sal              text,
  expira           timestamptz,
  fallos           smallint not null default 0,
  requiere_captcha boolean not null default false,
  bloqueado_hasta  timestamptz,
  ultimo_envio     timestamptz,
  creado           timestamptz not null default now()
);
comment on table public.verificaciones is 'Códigos de verificación de mail de clientes nuevos. Solo la usa la Edge Function "cuentas".';

alter table public.verificaciones enable row level security;
revoke all on public.verificaciones from anon, authenticated;

-- Estado actual de un email (para decidir si se puede registrar)
create or replace function public.verif_estado(p_email text)
returns jsonb language sql security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object(
      'existe', true,
      'activo', v.codigo_hash is not null,
      'espera_seg', greatest(0, ceil(extract(epoch from (v.bloqueado_hasta - now()))))::int,
      'requiere_captcha', v.requiere_captcha,
      'user_id', v.user_id)
    from public.verificaciones v where v.email = lower(trim(p_email))),
    jsonb_build_object('existe', false, 'activo', false, 'espera_seg', 0, 'requiere_captcha', false));
$$;

-- Guarda un código nuevo. p_reenvio = false: registro nuevo (reinicia todo).
create or replace function public.verif_guardar(p_email text, p_user_id uuid, p_codigo text, p_reenvio boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v       public.verificaciones;
  v_sal   text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if p_codigo !~ '^[0-9]{6}$' then
    raise exception 'Código inválido';
  end if;
  select * into v from public.verificaciones where email = v_email for update;

  if v.email is not null and v.bloqueado_hasta > now() then
    return jsonb_build_object('ok', false, 'motivo', 'espera',
      'espera_seg', ceil(extract(epoch from (v.bloqueado_hasta - now())))::int,
      'requiere_captcha', v.requiere_captcha);
  end if;

  if p_reenvio then
    if v.email is null or v.codigo_hash is null then
      return jsonb_build_object('ok', false, 'motivo', 'sin_registro');
    end if;
    if v.ultimo_envio > now() - interval '60 seconds' then
      return jsonb_build_object('ok', false, 'motivo', 'muy_pronto',
        'espera_seg', ceil(extract(epoch from (v.ultimo_envio + interval '60 seconds' - now())))::int);
    end if;
    update public.verificaciones
       set codigo_hash = encode(extensions.digest(v_sal || p_codigo, 'sha256'), 'hex'), sal = v_sal,
           expira = now() + interval '20 minutes', ultimo_envio = now()
     where email = v_email;
    return jsonb_build_object('ok', true, 'user_id', v.user_id);
  end if;

  insert into public.verificaciones as t (email, user_id, codigo_hash, sal, expira, fallos, requiere_captcha, bloqueado_hasta, ultimo_envio)
  values (v_email, p_user_id, encode(extensions.digest(v_sal || p_codigo, 'sha256'), 'hex'), v_sal,
          now() + interval '20 minutes', 0, false, null, now())
  on conflict (email) do update
     set user_id = excluded.user_id, codigo_hash = excluded.codigo_hash, sal = excluded.sal,
         expira = excluded.expira, fallos = 0, requiere_captcha = false,
         bloqueado_hasta = null, ultimo_envio = now(), creado = now();
  return jsonb_build_object('ok', true, 'user_id', p_user_id);
end;
$$;

-- Comprueba un código ingresado por el cliente
create or replace function public.verif_comprobar(p_email text, p_codigo text, p_captcha_ok boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v       public.verificaciones;
  v_n     smallint;
begin
  select * into v from public.verificaciones where email = v_email for update;

  if v.email is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_codigo');
  end if;
  if v.bloqueado_hasta > now() then
    return jsonb_build_object('ok', false, 'motivo', case when v.codigo_hash is null then 'bloqueado_hora' else 'espera' end,
      'espera_seg', ceil(extract(epoch from (v.bloqueado_hasta - now())))::int,
      'requiere_captcha', v.requiere_captcha);
  end if;
  if v.codigo_hash is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_codigo');
  end if;
  if v.expira < now() then
    return jsonb_build_object('ok', false, 'motivo', 'vencido');
  end if;
  if v.requiere_captcha and not coalesce(p_captcha_ok, false) then
    return jsonb_build_object('ok', false, 'motivo', 'captcha', 'requiere_captcha', true);
  end if;

  if coalesce(p_codigo, '') ~ '^[0-9]{6}$'
     and encode(extensions.digest(v.sal || p_codigo, 'sha256'), 'hex') = v.codigo_hash then
    delete from public.verificaciones where email = v_email;
    return jsonb_build_object('ok', true, 'user_id', v.user_id);
  end if;

  v_n := v.fallos + 1;
  if v_n >= 6 then
    update public.verificaciones
       set fallos = v_n, codigo_hash = null, sal = null, expira = null,
           requiere_captcha = false, bloqueado_hasta = now() + interval '1 hour'
     where email = v_email;
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado_hora', 'espera_seg', 3600,
                              'borrar_usuario', v.user_id);
  end if;

  update public.verificaciones
     set fallos = v_n, bloqueado_hasta = now() + make_interval(mins => v_n),
         requiere_captcha = (v_n >= 5)
   where email = v_email;
  return jsonb_build_object('ok', false, 'motivo', 'incorrecto', 'espera_seg', v_n * 60,
                            'intentos_restantes', 6 - v_n, 'requiere_captcha', v_n >= 5);
end;
$$;

revoke all on function public.verif_estado(text) from public, anon, authenticated;
revoke all on function public.verif_guardar(text, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.verif_comprobar(text, text, boolean) from public, anon, authenticated;
grant execute on function public.verif_estado(text) to service_role;
grant execute on function public.verif_guardar(text, uuid, text, boolean) to service_role;
grant execute on function public.verif_comprobar(text, text, boolean) to service_role;
