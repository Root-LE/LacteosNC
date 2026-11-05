-- =====================================================================
-- Lácteos NC — Migración 04: datos iniciales
-- Listas de precio, categorías, los 11 productos del sitio y las 3 novedades.
-- Los CÓDIGOS de producto (NC-001…) son PROVISORIOS: reemplazarlos por los
-- códigos reales del sistema de la cooperativa desde el panel o con un UPDATE.
-- No se cargan precios: los carga el administrador.
-- =====================================================================

insert into public.listas_precio (nombre, descripcion) values
  ('Lista 1', 'Precio sur'),
  ('Lista 2', 'Precio CABA'),
  ('Lista 3', 'Precio cliente');

insert into public.categorias (slug, nombre, orden) values
  ('duros', 'Quesos duros', 1),
  ('semiduros', 'Semiduros y saborizados', 2),
  ('hilados', 'Pasta hilada', 3),
  ('cremas', 'Cremas y dulces', 4);

insert into public.productos (codigo, slug, nombre, categoria_id, tipo, descripcion, datos, imagen_url, imagen_sm_url, foco, nuevo, orden)
select v.codigo, v.slug, v.nombre, c.id, v.tipo, v.descripcion, v.datos::jsonb, v.imagen_url, v.imagen_sm_url, v.foco, v.nuevo, v.orden
from (values
  ('NC-001', 'reggianito', 'Reggianito', 'duros', 'Queso duro', 'Horma de corteza negra y pasta firme. El clásico para rallar sobre pastas, sopas y gratinados.', '[["Tipo","Duro, de rallar"],["Corteza","Negra"],["Ideal para","Pastas y gratinados"]]', '/img/productos/reggianito.jpg', '/img/productos/reggianito-sm.jpg', '40% 70%', false, 1),
  ('NC-002', 'sbrinz', 'Sbrinz', 'duros', 'Queso duro', 'Estacionado durante 8 meses. Sabor intenso y pasta que se quiebra en lascas. Para rallar o para comer en trozos con un buen vino.', '[["Maduración","8 meses"],["Tipo","Duro"],["Ideal para","Rallar y picadas"]]', '/img/productos/sbrinz.jpg', '/img/productos/sbrinz-sm.jpg', '30% 60%', false, 2),
  ('NC-003', 'sardo', 'Sardo', 'duros', 'Queso duro', 'Horma negra de sabor pronunciado y levemente picante. Rinde en la picada y rallado sobre cualquier plato.', '[["Tipo","Duro"],["Corteza","Negra"],["Ideal para","Picadas y rallar"]]', '/img/productos/sardo.jpg', '/img/productos/sardo-sm.jpg', '50% 55%', false, 3),
  ('NC-004', 'pategras', 'Pategrás', 'semiduros', 'Queso semiduro', 'Horma de corteza roja, pasta amarilla con ojos y sabor suave. Va bien en sándwiches, tablas y para fundir.', '[["Tipo","Semiduro"],["Corteza","Roja"],["Ideal para","Sándwiches y tablas"]]', '/img/productos/pategras.jpg', '/img/productos/pategras-sm.jpg', '60% 50%', false, 4),
  ('NC-005', 'gouda-ahumado', 'Gouda ahumado', 'semiduros', 'Queso semiduro saborizado', 'Queso tipo gouda con sabor ahumado. Se presenta en horma entera y en trozos envasados.', '[["Tipo","Semiduro saborizado"],["Presentación","Horma y trozos"],["Ideal para","Picadas y burgers"]]', '/img/productos/gouda-ahumado.jpg', '/img/productos/gouda-ahumado-sm.jpg', '45% 55%', false, 5),
  ('NC-006', 'gouda-pesto', 'Gouda sabor pesto', 'semiduros', 'Queso semiduro saborizado', 'Gouda con albahaca y especias en toda la pasta. Color verde y aroma a pesto, para sorprender en la tabla.', '[["Tipo","Semiduro saborizado"],["Presentación","Horma y trozos"],["Ideal para","Tablas y tartas"]]', '/img/productos/gouda-pesto.jpg', '/img/productos/gouda-pesto-sm.jpg', '50% 50%', false, 6),
  ('NC-007', 'provoleta', 'Provoleta', 'hilados', 'Pasta hilada', 'Para la parrilla: se dora por fuera y queda cremosa por dentro. Con orégano y ají molido, no falla.', '[["Tipo","Pasta hilada"],["Ideal para","Parrilla y horno"]]', '/img/productos/provoleta.jpg', '/img/productos/provoleta-sm.jpg', '42% 60%', false, 7),
  ('NC-008', 'mozzarella', 'Mozzarella', 'hilados', 'Pasta hilada', 'Funde parejo y estira. La base de toda buena pizza casera.', '[["Tipo","Pasta hilada"],["Ideal para","Pizzas y empanadas"]]', '/img/productos/mozzarella.jpg', '/img/productos/mozzarella-sm.jpg', '38% 55%', false, 8),
  ('NC-009', 'dulce-de-leche', 'Dulce de leche repostero', 'cremas', 'Dulces', 'Firme, ideal para rellenar tortas, alfajores y facturas sin que se escurra. Libre de gluten.', '[["Presentación","Pote de 400 g"],["Apto","Sin gluten"],["Ideal para","Repostería"]]', '/img/productos/dulce-de-leche.jpg', '/img/productos/dulce-de-leche-sm.jpg', '50% 45%', true, 9),
  ('NC-010', 'crema-batir', 'Crema para batir', 'cremas', 'Cremas', 'Pasteurizada, con un mínimo de 35 % de materia grasa para que monte bien.', '[["Presentación","200 cc"],["Tenor graso","35 % mín."],["Ideal para","Batir y cocinar"]]', '/img/productos/crema-batir.jpg', '/img/productos/crema-batir-sm.jpg', '30% 70%', true, 10),
  ('NC-011', 'crema-de-leche', 'Crema de leche estilo campo', 'cremas', 'Cremas', 'Pasteurizada, espesa y con sabor a crema de tambo. Para salsas, postres y frutas.', '[["Presentación","400 cc"],["Tipo","Pasteurizada"],["Ideal para","Salsas y postres"]]', '/img/productos/crema-de-leche.jpg', '/img/productos/crema-de-leche-sm.jpg', '50% 50%', true, 11)
) as v(codigo, slug, nombre, categoria, tipo, descripcion, datos, imagen_url, imagen_sm_url, foco, nuevo, orden)
join public.categorias c on c.slug = v.categoria;

insert into public.novedades (titulo, descripcion, datos, tipo_medio, medio_url, producto_id, destacada, orden)
select v.titulo, pr.descripcion, v.datos::jsonb, 'imagen', v.medio_url, pr.id, v.destacada, v.orden
from (values
  ('dulce-de-leche', 'Dulce de leche repostero', '[["Presentación","Pote de 400 g"],["Apto","Sin gluten"]]', '/img/productos/dulce-de-leche.jpg', true, 1),
  ('crema-batir', 'Crema para batir', '[["Presentación","200 cc"],["Tenor graso","35 % mín."]]', '/img/productos/crema-batir-sm.jpg', false, 2),
  ('crema-de-leche', 'Crema de leche estilo campo', '[["Presentación","400 cc"],["Tipo","Pasteurizada"]]', '/img/productos/crema-de-leche-sm.jpg', false, 3)
) as v(slug, titulo, datos, medio_url, destacada, orden)
join public.productos pr on pr.slug = v.slug;
