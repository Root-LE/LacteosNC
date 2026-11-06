# Planes implementados — Lácteos NC

Registro de lo que ya está hecho, en orden, con los pasos seguidos.
Cada plan nuevo se agrega al final con la misma estructura.

---

## Plan 1 — Diseño del sitio web

**Fecha:** 02/11/2026 · **Estado:** hecho

**Objetivo:** crear la página de Lácteos NC en rojo y blanco, tomando como referencia la estructura del sitio de Convertir.

**Pasos:**
1. Se analizó `convertir/index.html` para tomar su estructura: menú fijo, portada, institucional, productos, novedades, contacto y pie.
2. Se tomaron de `convertir/NC` el logo principal (`LOGO_NC.png`), el logo con La Emancipación (`logoNC2.jpeg`) y las fotos de los 11 productos.
3. Se buscó información pública sobre la planta: Cooperativa «Nuestra Casa» (1940), La Emancipación desde fines de 2018, ampliación de 3.000 a ~30.000 litros diarios (notas de La Arena y FACC).
4. Se optimizaron las imágenes: versión grande (1400 px) y chica (`-sm`, 720 px) de cada producto, logos y favicon.
5. Se definió la identidad: rojo `#E1141C`, azul de etiquetas, Barlow Condensed + Barlow + Yellowtail, corchetes rojos y franja diagonal de las fotos.
6. Se armaron las secciones:
   - **Inicio:** "Lácteos" en letra script, título, foto del Reggianito con corchetes rojos.
   - **Institucional:** historia y línea de tiempo 1940 → hoy.
   - **Productos:** catálogo generado desde la lista `PRODUCTOS` en `js/main.js`, filtros por familia y ventana de detalle con foto completa y datos.
   - **Novedades:** dulce de leche repostero, crema para batir y crema de leche estilo campo, sobre fondo madera.
   - **Contacto:** formulario que abre el correo del visitante, datos de La Emancipación y mapa de Jacinto Arauz.
7. Las tipografías se alojaron en el propio sitio (`fonts/`) para que funcionen sin internet.
8. Se probó en escritorio y celular.

**Archivos:** `index.html`, `css/styles.css`, `js/main.js`, `img/`, `fonts/`.

---

## Plan 2 — Logo animado: el logo NC cae en la leche

**Fechas:** 04/11/2026 · **Estado:** hecho (segunda versión)

**Objetivo:** reemplazar la imagen fija `logo-nc-emancipacion.jpg` de la sección Institucional por una versión con movimiento, usando las salpicaduras reales de la imagen.

**Pasos:**
1. Primera versión con olas y salpicaduras dibujadas; se descartó porque se pidieron las formas reales de la imagen.
2. Se ubicó el círculo del logo en la imagen original (detección automática) y se borraron los logos con relleno inteligente (inpainting).
3. Se separó la leche del fondo beige calculando la transparencia de cada píxel, y se ajustó para que la leche quede opaca como en el original.
4. Se dividió la leche en 4 capas: `leche-charco.webp`, `leche-corona.webp`, `leche-gotas1.webp` (cercanas) y `leche-gotas2.webp` (lejanas).
5. Se recortó el logo de La Emancipación con fondo transparente (`logo-emancipacion.png`).
6. Se verificó que al superponer todas las capas se reconstruye la imagen original.
7. Animación (unos 3 s): cae el logo NC y rebota → el charco se hunde → crece la corona → las gotas salen desde el centro → asoma La Emancipación → queda respirando suave.
8. Arranca al aparecer en pantalla, se repite con clic, y muestra la imagen quieta si el visitante tiene activado "reducir movimiento".

**Archivos:** `index.html` (bloque `.leche`), `css/styles.css` (sección "Logo animado"), `js/main.js`, `img/leche-*.webp`, `img/logo-emancipacion.png`.

---

## Plan 3 — Estilo del menú (peluche y Convertir)

**Fecha:** 04/11/2026 · **Estado:** hecho

**Objetivo:** que los botones del menú se pongan rojos con letra blanca al pasar el mouse.

**Pasos:**
1. Se revisó el menú de Convertir como referencia.
2. **Estilo peluche (activo):** mancha roja con bordes peludos (filtro SVG `#peluche` con turbulencia y desplazamiento), crece con rebote, se aplasta al hacer clic y marca la sección en la que se está.
3. **Estilo Convertir (alternativo):** fondo rojo rectangular y letra blanca.
4. Para cambiar: en `index.html`, `<nav class="nav nav--peluche">` → `nav--clasico`.
5. Se agregó número de versión a los enlaces de CSS y JS (`?v=3`) porque el navegador mostraba la versión vieja guardada.

**Archivos:** `index.html`, `css/styles.css`.

---

## Plan 4 — Fase 1: preparar el sitio para producción

**Fecha:** 05/11/2026 · **Estado:** hecho

**Objetivo:** dejar el sitio listo para publicarse en `lacteosnc.com.ar`.

**Pasos:**
1. `index.html`: dirección canónica, datos para compartir en redes (Open Graph y Twitter) con imagen absoluta, ícono para celulares y datos de la organización para Google (JSON-LD).
2. `404.html`: página propia para direcciones inexistentes, con el estilo del sitio.
3. `robots.txt` y `sitemap.xml` para Google.
4. `_headers`: caché de imágenes, tipografías, CSS y JS, y cabeceras de seguridad para Cloudflare Pages.
5. `README.md` con los pasos para publicar y conectar el dominio.

**Archivos:** `index.html`, `404.html`, `robots.txt`, `sitemap.xml`, `_headers`, `README.md`.

---

## Plan 5 — Elección de la infraestructura

**Fecha:** 05/11/2026 · **Estado:** decidido

**Decisión:**
- **Hosting y DNS:** Cloudflare Pages + Cloudflare DNS (gratis y permitido para uso comercial). Se descartaron Vercel (plan gratuito no comercial), Railway (pensado para apps con servidor) y Render (sirve, pero igual hacía falta un DNS aparte).
- **Base de datos, usuarios y archivos:** Supabase (PostgreSQL + Auth + Storage), proyecto **LacteosNC**.
- **Código:** GitHub, repositorio `Root-LE/LacteosNC`.
- **Videos de Novedades:** enlace de YouTube o video propio de hasta 10 s y 5 MB.
- **Planes:** se arranca con los gratuitos y más adelante se pasa a pago.

---

## Plan 6 — Fase 2: publicación en GitHub y Cloudflare Pages

**Fecha:** 05/11/2026 y 06/11/2026 · **Estado:** hecho

**Pasos hechos:**
1. Desde el Chrome del usuario se agregó `lacteosnc.com.ar` a Cloudflare con el plan Free. No había registros DNS previos.
2. Cloudflare asignó los servidores `brynne.ns.cloudflare.com` y `kanye.ns.cloudflare.com`.
3. El usuario delegó el dominio en nic.ar a esos dos servidores (estado: "delegado: SI").
4. Se instaló la app **Claude** de GitHub en la cuenta Root-LE, con acceso **solo** al repositorio `LacteosNC`.
5. Se subió el sitio al repositorio, rama `main` (50 archivos). Se agregó `.gitignore` y se excluyó la imagen sin uso `logo-nc-leche.png`.
6. Se instaló la app **Cloudflare Workers and Pages** de GitHub, también con acceso **solo** a `LacteosNC`.
7. Se creó el proyecto de Pages **lacteosnc**: rama de producción `main`, framework "None", sin comando de compilación, carpeta de salida `/`.
8. Primera publicación correcta en **https://lacteosnc.pages.dev**.
9. Se pidió a Cloudflare revisar los servidores de nombres; queda esperando la propagación.

**Cómo se publica de ahora en más:** cada cambio que se sube a la rama `main` del repositorio se publica solo en Cloudflare Pages en uno o dos minutos.

**Conexión del dominio (06/11/2026):**
10. Cloudflare marcó la zona `lacteosnc.com.ar` como activa ("Your domain is now protected by Cloudflare").
11. En Pages → lacteosnc → Custom domains se agregaron `lacteosnc.com.ar` y `www.lacteosnc.com.ar`. Cloudflare creó solo los dos registros CNAME hacia `lacteosnc.pages.dev` y los certificados HTTPS. Estado de ambos: **Active**.
12. Regla de redirección (Rules → Redirect Rules): `https://www.*` → `https://${1}`, código 301 permanente, conservando los parámetros. Así `www.lacteosnc.com.ar` lleva siempre a `lacteosnc.com.ar`.
13. Se probó el sitio en `https://lacteosnc.com.ar` y en `https://www.lacteosnc.com.ar` (11 productos cargados desde la base). Durante los primeros minutos después de activar hubo cortes intermitentes mientras Cloudflare terminaba de distribuir los certificados.

**Direcciones:** sitio oficial **https://lacteosnc.com.ar** · prueba **https://lacteosnc.pages.dev**.

---

## Plan 7 — Fase 3: base de datos en Supabase

**Fecha:** 05/11/2026 · **Estado:** hecho

**Objetivo:** tener usuarios, roles, productos, listas de precio, novedades y pedidos en una base PostgreSQL, y que el sitio público lea productos y novedades desde ahí.

**Pasos:**
1. Se revisó el proyecto **LacteosNC** de Supabase: estaba vacío.
2. **Migración 01 — estructura:** 9 tablas (`listas_precio`, `perfiles`, `categorias`, `productos`, `precios`, `novedades`, `pedidos`, `pedido_items`, `mensajes_contacto`), tipos para rol, estado de cuenta, estado de pedido y tipo de medio, controles de datos (CUIT de 11 dígitos, usuario de 3 a 30 caracteres, cantidades positivas) y fechas de actualización automáticas. Los pedidos se numeran desde **1001**.
3. **Migración 02 — seguridad:** reglas por rol (RLS) en todas las tablas; funciones auxiliares en un esquema privado; alta automática del perfil cuando alguien se registra (toma nombre, apellido, CUIT y aceptación de términos); al verificar el mail pasa a *pendiente de activación*; funciones `crear_pedido`, `detalle_pedido`, `abrir_pedido`, `marcar_retirado` y `activar_cuenta`.
4. **Migración 03 — archivos:** carpetas `productos` (imágenes) y `novedades` (imágenes y videos), máximo 5 MB, solo el administrador sube.
5. **Migración 04 — datos iniciales:** Lista 1 (precio sur), Lista 2 (precio CABA), Lista 3 (precio cliente); 4 categorías; los 11 productos del sitio con códigos provisorios NC-001 a NC-011; las 3 novedades.
6. **Pruebas de permisos** con usuarios de prueba (se deshicieron al terminar):
   - visitante: ve 11 productos y 3 novedades, 0 precios, no puede pedir;
   - cliente 1: ve solo los 11 precios de su lista, crea el pedido con total correcto, no puede editar productos, hacerse administrador, insertar pedidos directo ni abrirlos;
   - cliente 2: no ve pedidos ajenos y ve solo los precios de su lista;
   - cuenta pendiente: no ve precios ni puede pedir;
   - empleado: ve todos los pedidos, al abrir pasa a *armando*, luego a *retirado*; no puede editar productos ni activar cuentas;
   - administrador: activa cuentas y edita productos.
7. Asesor de seguridad de Supabase: solo avisa que los usuarios con sesión pueden llamar a las 5 funciones de pedidos y cuentas, que es lo buscado (cada una controla permisos adentro).
8. **Sitio público:** `js/config.js` con la URL y la clave pública; `js/main.js` carga categorías, productos y novedades desde la base; si la base no responde usa la lista de respaldo. Novedades admite foto, enlace de YouTube (16:9) o video propio. Todo el texto que viene de la base se escapa antes de mostrarse.
9. Versión de CSS y JS subida a `?v=4`.

**Archivos:** `supabase/migrations/*.sql`, `supabase/README.md`, `js/config.js`, `js/main.js`, `css/styles.css`, `index.html`, `404.html`.

---

## Plan 8 — Administradores y artículos con códigos reales

**Fecha:** 06/11/2026 · **Estado:** hecho

**Objetivo:** dar de alta a los administradores y cargar los códigos reales de los productos del sistema de la cooperativa.

**Pasos:**
1. **Nuevo rol superadministrador** (migraciones 05 y 06): acceso absoluto; es el único que puede asignar o quitar los roles administrador y superadministrador y modificar a otro superadministrador. El administrador carga productos, precios, novedades y archivos y activa clientes y empleados, pero no puede crear administradores. Un disparador en `perfiles` frena cualquier intento de saltear esto.
2. Pruebas: el administrador no pudo crear administradores, ascender a un cliente, editar al superadministrador ni hacerse superadministrador; el superadministrador sí pudo todo; un cliente no pudo cambiarse el rol.
3. **Usuarios internos** (regla: primera letra del nombre + apellido). Fer creó las cuentas en Supabase y se les asignó:
   - **Fnardi** — Fernando Nardi — sistemas@laemancipacion.com.ar — superadministrador.
   - **Mfernandez** — Macarena Fernandez — administracionqueseria@laemancipacion.com.ar — administrador.
4. **Artículos** (migración 07): del Excel `productosNC.xls` (campos ARTICULO y DENOMINACION) se cargaron los **59 artículos**. Se separó en dos niveles:
   - `productos` = las 11 tarjetas con foto de la web (sin cambios para el visitante);
   - `articulos` = los códigos reales, que son los que tienen precio y se piden.
   28 artículos quedaron vinculados a su tarjeta de la web (ej.: Sardo entero, porción, estacionado y pepato → "Sardo"). 11 quedaron inactivos por parecer de uso interno (ver `PENDIENTES.md`).
5. Precios y renglones de pedido pasaron a ser **por artículo** (estaban vacíos, no se perdió nada). `crear_pedido` ahora recibe `articulo_id` y rechaza artículos inactivos.
6. Migración 08: el cliente ve solo los precios de los artículos activos de su lista.
7. Pruebas: visitante 0 artículos; cliente 48 artículos y 48 precios de su lista; pedido con código 31562 "QUESO SARDO NC ESTACIONADO ENTERO" correcto; pedido con artículo inactivo rechazado. Numeración de pedidos reiniciada en 1001.

**Archivos:** `supabase/migrations/20261106_05` a `_08`, `supabase/README.md`.

---

## Plan 9 — Limpieza de artículos, tarjetas nuevas y panel de administración

**Fecha:** 06/11/2026 · **Estado:** hecho (falta que Fer y Macarena prueben con sus cuentas)

**Objetivo:** que Fernando y Macarena carguen productos, fotos, videos y precios sin tocar código.

**Pasos:**
1. **Migración 09:** se eliminaron los 11 artículos de uso interno (31578, 31587, 31543, 31604, 77826, 77825, 77828, 77779, 31910, 77830, 77831). Nueva categoría **Blandos**. Se crearon **13 tarjetas nuevas ocultas** (port salut, cremoso, ricotta, tybo, gouda, cheddar, barra sándwich, provolone, queso pizzero, manteca, crema gran formato, dulce de leche clásico, untable cheddar) y se vincularon los artículos. Quedan 48 artículos (todos con tarjeta) y 24 tarjetas (11 visibles). Las nuevas se publican cuando se les sube la foto.
2. **Panel en `https://lacteosnc.com.ar/admin/`** (`admin/index.html`, `admin/admin.css`, `admin/admin.js`, `admin/vendor/supabase-2.119.0.js`). Solo entran cuentas **activas** con rol administrador o superadministrador. Secciones:
   - **Productos de la web:** crear, editar, ocultar y eliminar tarjetas; la foto se achica sola (1400 px y versión chica de 720 px) y se sube al Storage; no deja publicar una tarjeta sin foto.
   - **Artículos:** códigos del sistema, descripción, tarjeta a la que pertenecen y activo/inactivo, con buscador.
   - **Novedades:** foto, enlace de YouTube o video propio (MP4/WebM, se controla que dure ≤10 s y pese ≤5 MB).
   - **Listas de precio:** crear y editar listas.
   - **Precios:** tabla por lista, edición directa y botón **Pegar desde Excel** (columnas código y precio; acepta 1.234,56).
   - **Cuentas:** activar clientes (usuario + lista + rol), editar y bloquear. El administrador ve a los administradores pero no puede modificarlos; solo el superadministrador da esos roles. Nadie puede cambiar su propio rol.
   - **Cambiar mi contraseña** y **Olvidé mi contraseña** (llega un mail con enlace a `/admin/`).
3. Los permisos reales los controla la base (RLS): aunque alguien manipule la página no puede hacer más que lo que su rol permite.
4. Imagen de reemplazo `img/sin-foto.jpg` si una foto no carga. `robots.txt` y `_headers` excluyen `/admin/` de los buscadores. Versión subida a `?v=5`.
5. Prueba local con datos simulados: las 6 secciones cargan sin errores. Publicado y verificado en `https://lacteosnc.com.ar/admin/`.
6. Supabase → Authentication → URL Configuration: Site URL `https://lacteosnc.com.ar` y dirección de retorno `https://lacteosnc.com.ar/admin/` (para el mail de recuperar contraseña).

**Archivos:** `supabase/migrations/20261106_09_limpieza_y_tarjetas.sql`, `admin/*`, `img/sin-foto.jpg`, `js/main.js`, `robots.txt`, `_headers`, `index.html`, `404.html`.
