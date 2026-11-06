-- =====================================================================
-- Lácteos NC — Migración 05: nuevo rol "superadmin"
-- (Va sola porque Postgres no deja usar un valor nuevo de un tipo
--  en la misma transacción en que se agrega.)
-- =====================================================================
alter type public.rol_usuario add value if not exists 'superadmin';
