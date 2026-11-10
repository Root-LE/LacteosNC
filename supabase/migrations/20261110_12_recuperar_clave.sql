-- =====================================================================
-- Migración 12 — Límite de pedidos de "Olvidé mi contraseña"
-- La usa la Edge Function "cuentas" (acción recuperar) antes de mandar el
-- mail de Lácteos NC: como máximo 1 pedido por minuto y 5 por hora por email.
-- =====================================================================

create table public.recuperaciones (
  email   text primary key check (email = lower(email)),
  ultimo  timestamptz not null,
  ventana timestamptz not null,
  envios  smallint not null default 0
);
comment on table public.recuperaciones is 'Control de envíos del mail de recuperar contraseña. Solo la usa la Edge Function "cuentas".';
alter table public.recuperaciones enable row level security;
revoke all on public.recuperaciones from anon, authenticated;

-- Devuelve true si se puede mandar otro mail a este email (y lo registra)
create or replace function public.recup_permitir(p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v public.recuperaciones; v_email text := lower(trim(p_email));
begin
  select * into v from public.recuperaciones where email = v_email for update;
  if v.email is null then
    insert into public.recuperaciones (email, ultimo, ventana, envios) values (v_email, now(), now(), 1);
    return true;
  end if;
  if v.ultimo > now() - interval '60 seconds' then return false; end if;
  if v.ventana < now() - interval '1 hour' then
    update public.recuperaciones set ultimo = now(), ventana = now(), envios = 1 where email = v_email;
    return true;
  end if;
  if v.envios >= 5 then return false; end if;
  update public.recuperaciones set ultimo = now(), envios = envios + 1 where email = v_email;
  return true;
end;
$$;
revoke all on function public.recup_permitir(text) from public, anon, authenticated;
grant execute on function public.recup_permitir(text) to service_role;
