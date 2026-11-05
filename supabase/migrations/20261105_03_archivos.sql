-- =====================================================================
-- Lácteos NC — Migración 03: carpetas de archivos (Storage)
--   productos  → fotos de productos (JPG, PNG o WebP, máx. 5 MB)
--   novedades  → fotos y videos cortos de novedades (máx. 5 MB; el panel
--                además controla que el video dure 10 segundos o menos)
-- Las dos son públicas para leer; solo el administrador sube, cambia o borra.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('productos', 'productos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('novedades', 'novedades', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "archivos: admin sube"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('productos', 'novedades') and (select privado.es_admin()));

create policy "archivos: admin reemplaza"
  on storage.objects for update to authenticated
  using (bucket_id in ('productos', 'novedades') and (select privado.es_admin()))
  with check (bucket_id in ('productos', 'novedades') and (select privado.es_admin()));

create policy "archivos: admin borra"
  on storage.objects for delete to authenticated
  using (bucket_id in ('productos', 'novedades') and (select privado.es_admin()));
