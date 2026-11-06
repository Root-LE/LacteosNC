-- =====================================================================
-- Lácteos NC — Migración 09: limpieza de artículos y tarjetas nuevas
--
-- 1) Se eliminan los 11 artículos de uso interno (pedido de Fer, 06/11/2026).
-- 2) Se crea la categoría "Quesos blandos".
-- 3) Se crean 13 tarjetas nuevas para la web, OCULTAS y sin foto: se hacen
--    visibles desde el panel cuando se carga la foto y se revisa el texto.
-- 4) Cada artículo sin tarjeta se vincula a su tarjeta nueva.
-- =====================================================================

delete from public.articulos
 where codigo in ('31578', '31587', '31543', '31604', '77826', '77825',
                  '77828', '77779', '31910', '77830', '77831');

insert into public.categorias (slug, nombre, orden) values ('blandos', 'Quesos blandos', 3)
on conflict (slug) do nothing;
update public.categorias set orden = 4 where slug = 'hilados';
update public.categorias set orden = 5 where slug = 'cremas';

insert into public.productos (slug, nombre, categoria_id, tipo, descripcion, datos, visible, orden)
select v.slug, v.nombre, c.id, v.tipo, v.descripcion, '[]'::jsonb, false, v.orden
from (values
  ('port-salut',          'Port Salut',              'blandos',   'Queso blando',          'Queso de pasta blanda y sabor suave. También en versión sin sal.', 12),
  ('cremoso',             'Cremoso',                 'blandos',   'Queso blando',          'Queso cremoso de pasta blanda, entero o en porción.',            13),
  ('ricotta',             'Ricotta',                 'blandos',   'Ricotta',               'Ricotta fresca, entera o en porción.',                           14),
  ('tybo',                'Tybo',                    'semiduros', 'Queso semiduro',        'Queso tybo de pasta semidura, ideal para sándwiches.',           15),
  ('gouda',               'Gouda',                   'semiduros', 'Queso semiduro',        'Queso gouda en horma y en barra.',                               16),
  ('cheddar',             'Cheddar',                 'semiduros', 'Queso semiduro',        'Queso cheddar por kilo y en pouch de 1 y 3 kg.',                 17),
  ('barra-sandwich',      'Barra sándwich',          'semiduros', 'Queso semiduro',        'Barra de queso para sándwiches.',                                18),
  ('provolone',           'Provolone',               'hilados',   'Pasta hilada',          'Queso provolone de pasta hilada.',                               19),
  ('queso-pizzero',       'Queso pizzero',           'hilados',   'Pasta hilada',          'Queso para pizza que funde parejo.',                             20),
  ('manteca',             'Manteca',                 'cremas',    'Manteca',               'Manteca en caja de 200 g.',                                      21),
  ('crema-gran-formato',  'Crema de leche en sachet','cremas',    'Cremas',                'Crema de leche en sachet de 1, 5 y 10 litros.',                  22),
  ('dulce-de-leche-clasico','Dulce de leche clásico','cremas',    'Dulces',                'Dulce de leche clásico La Emancipación.',                        23),
  ('untable-cheddar',     'Untable de cheddar',      'cremas',    'Untables',              'Queso cheddar untable.',                                         24)
) as v(slug, nombre, categoria, tipo, descripcion, orden)
join public.categorias c on c.slug = v.categoria
on conflict (slug) do nothing;

update public.articulos a
   set producto_id = p.id
  from public.productos p,
       (values
         ('31554','port-salut'), ('31555','port-salut'),
         ('31538','cremoso'), ('31551','cremoso'),
         ('31542','ricotta'), ('31582','ricotta'),
         ('31539','tybo'),
         ('31636','gouda'), ('31907','gouda'),
         ('31686','cheddar'), ('77855','cheddar'), ('77856','cheddar'),
         ('77850','barra-sandwich'),
         ('31906','provolone'),
         ('77858','queso-pizzero'),
         ('31679','manteca'),
         ('31911','crema-gran-formato'), ('31912','crema-gran-formato'),
         ('77822','crema-gran-formato'), ('77823','crema-gran-formato'), ('77824','crema-gran-formato'),
         ('77861','dulce-de-leche-clasico'),
         ('77900','untable-cheddar')
       ) as m(codigo, slug)
 where a.codigo = m.codigo and p.slug = m.slug;
