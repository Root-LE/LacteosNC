-- Migración 15 — "cargado_por" apunta a auth.users (como aceptado_por, retirado_por, etc.)
-- Con la referencia a perfiles había DOS relaciones pedidos→perfiles y la API respondía
-- "Could not embed because more than one relationship was found for 'pedidos' and 'perfiles'".
alter table public.pedidos drop constraint pedidos_cargado_por_fkey;
alter table public.pedidos add constraint pedidos_cargado_por_fkey foreign key (cargado_por) references auth.users(id) on delete set null;
notify pgrst, 'reload schema';
