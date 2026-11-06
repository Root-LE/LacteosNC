-- =====================================================================
-- Lácteos NC — Migración 08: el cliente ve solo precios de artículos activos
-- =====================================================================
drop policy "precios: el cliente ve su lista, el personal ve todas" on public.precios;
create policy "precios: el cliente ve su lista, el personal ve todas" on public.precios for select to authenticated
  using (
    (select privado.es_staff())
    or (lista_id = (select privado.mi_lista())
        and exists (select 1 from public.articulos a where a.id = precios.articulo_id and a.activo))
  );

-- La numeración de pedidos vuelve a empezar en 1001 (las pruebas consumieron números)
alter table public.pedidos alter column numero restart with 1001;
