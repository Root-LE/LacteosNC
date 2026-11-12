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

---

## Plan 10 — Botón Login y Fase 5: registro de clientes, área de clientes y pedidos

**Fecha:** 06/11/2026 · **Estado:** hecho en código; falta configurar el envío de mails y "no soy un robot" (ver `PENDIENTES.md`)

**Objetivo:** que los clientes se registren solos, vean su lista de precios y hagan pedidos, y que el personal arme y entregue esos pedidos.

**Pasos:**
1. **Botón Login** en el menú del sitio (contorno rojo con ícono), lleva a `https://lacteosnc.com.ar/admin/`. Esa página pasó a ser el **ingreso único**, que envía a cada uno a su lugar:
   - cliente → `/clientes/`;
   - empleado → `/pedidos/`;
   - administrador y superadministrador → panel (con acceso a Pedidos);
   - cuenta sin verificar → enlace para ingresar el código;
   - pendiente de activación o bloqueada → mensaje y no entra.
2. **Migración 10:** tabla `verificaciones` y funciones `verif_estado`, `verif_guardar` y `verif_comprobar`. El código se guarda cifrado (SHA-256 con sal). Solo el servidor puede usarlas. Probado en la base: errores 1 a 5 → esperas de 1, 2, 3, 4 y 5 min; desde el 5.º pide "no soy un robot"; el 6.º cancela el registro y bloquea el email 1 hora; un código vencido (20 min) se rechaza; no se puede reenviar antes de 60 s.
3. **Edge Function `cuentas`** (ver `supabase/README.md`): registra, verifica, reenvía, consulta el estado y manda el mail de cuenta activa. Mails con Resend y control "no soy un robot" con Cloudflare Turnstile. Revisa el dígito verificador del CUIT y que el CUIT y el email no estén repetidos.
4. **`/registro/`:** paso 1 con Usuario (grisado, "lo asigna la cooperativa"), Nombre, Apellido, \*Contraseña (y repetirla), \*CUIT (se escribe con guiones solo), \*Email, \*acepto términos y \*no soy un robot; paso 2 con el código, cuenta regresiva del vencimiento y de la espera, reenvío de código; paso 3 "Tu email quedó verificado, la cooperativa va a activar tu cuenta".
5. **`/terminos/`:** términos y condiciones en **borrador** (cuenta, activación, precios informativos, pedidos sujetos a stock, datos personales según Ley 25.326).
6. **Panel → Cuentas:** al activar una cuenta pendiente se manda el mail "Tu cuenta está activa" con usuario y email.
7. **`/clientes/`:**
   - **Lista de precios:** solo los precios de la lista asignada (los que faltan dicen "A confirmar"), con buscador.
   - **Pedido tipo carrito:** cantidad con − / + o escrita (acepta decimales), resumen con total estimado y observaciones. El carrito queda guardado en el navegador.
   - **Revisar y confirmar:** muestra "Su pedido fue generado correctamente" con el **número de pedido** y el detalle (código, descripción, cantidad), con opción de imprimir.
   - **Mis pedidos:** cada pedido con su estado (en espera / armando pedido / pedido retirado) y su detalle.
8. **`/pedidos/`** (empleados y administradores):
   - Pestañas En espera / Armando / Retirados / Todos, con contadores; los activos se ven del más viejo al más nuevo.
   - Buscador por número, cliente o CUIT; se actualiza cada 30 s.
   - Al abrir un pedido en espera pasa solo a **armando pedido**. Muestra cliente, CUIT, observaciones y renglones.
   - Botones **Marcar como retirado** e **Imprimir**.
9. `robots.txt` y `_headers`: `/clientes/` y `/pedidos/` fuera de los buscadores. Versión `?v=6`.
10. Supabase → Authentication → Sign In / Providers: **desactivado "Allow new users to sign up"** (con permiso de Fer), para que nadie cree cuentas salteando el código y el "no soy un robot". La web registra a través de la función del servidor, así que sigue funcionando. "Confirm email" queda activado.
11. Verificado en el sitio publicado: botón Login, `/registro/`, `/terminos/`, `/clientes/` y `/pedidos/` responden; la función `cuentas` contesta y, sin las claves cargadas, se niega a crear cuentas ("todavía no está configurado"); `/pedidos/` funcionó con la sesión real de Fnardi.
12. Prueba en navegador con datos simulados: registro con error de código y espera, compra con dos artículos (uno sin precio), confirmación con número, apertura y retiro de un pedido. Sin errores.

**Archivos:** `index.html`, `css/styles.css`, `js/config.js`, `js/cuenta.js`, `admin/*`, `registro/*`, `terminos/index.html`, `clientes/*`, `pedidos/*`, `supabase/migrations/20261106_10_registro_codigos.sql`, `supabase/functions/cuentas/index.ts`, `robots.txt`, `_headers`.

---

## Plan 11 — Servicios para el registro: Resend, Turnstile y secretos

**Fecha:** 06/11/2026 · **Estado:** hecho

**Pasos:**
1. Fer creó la cuenta de **Resend** (sistemas.emancipacion@gmail.com), agregó `lacteosnc.com.ar` (región São Paulo) y creó la API key.
2. En Cloudflare → DNS se cargaron los registros que pide Resend:
   - `resend._domainkey` (TXT, DKIM);
   - `rsend` → `rsend-sae1.forge.rmta.net` y `send` → `send.forge.rmta.net` (CNAME, **DNS only**);
   - `_dmarc` = `v=DMARC1; p=none;` (TXT).
   
   Resend verificó el dominio a los pocos minutos: estado **Verified** (06/11/2026 17:50).
3. Cloudflare → **Turnstile**: widget "Lácteos NC - registro", dominio `lacteosnc.com.ar`, modo *Managed*. La **Site Key** (pública) quedó en `js/config.js`; la Secret Key no se copió a ningún lado.
4. Supabase → Edge Functions → Secrets: `MAIL_REMITENTE` = `Lácteos NC <no-responder@lacteosnc.com.ar>` y `MAIL_AVISOS` = `sistemas@laemancipacion.com.ar` (recibe el aviso de cada cliente que verifica su mail, para activarlo).
5. Versión de `config.js` subida a `?v=7`.
6. Fer cargó `RESEND_API_KEY` y `TURNSTILE_SECRET`. Comprobado: los 4 secretos están en Supabase; la función rechaza un "no soy un robot" falso (o sea, lee la clave de Turnstile) y el widget aparece en `/registro/`.

---

## Plan 12 — Menú estilo Convertir y registro de novedades para el bot

**Fecha:** 06/11/2026 · **Estado:** hecho

**Pasos:**
1. Menú del sitio: `nav--peluche` → **`nav--clasico`** en `index.html` (botón rojo rectangular con texto blanco al pasar el mouse). El botón Login conserva su contorno rojo redondeado.
2. **Migración 11 — `eventos`:** tabla de novedades que llenan disparadores de la base:
   - cliente para activar;
   - cuenta activada y cuenta bloqueada;
   - pedido nuevo, con sus renglones; se registra al cerrar la transacción, cuando ya tiene los ítems;
   - pedido armando y pedido retirado, con quién lo cambió.
   
   Además: función `marcar_eventos` para marcarlos como procesados y Supabase Realtime activado en la tabla.
3. Pruebas en la base (todo deshecho al terminar): un cliente simulado generó, en orden, `cliente_para_activar → cuenta_activada → pedido_nuevo (1 renglón) → pedido_armando (por Fnardi) → pedido_retirado (por Fnardi)`; `marcar_eventos` marcó los 5. Un cliente ve 0 eventos y no puede marcarlos; un visitante no tiene acceso.
4. Panel → nueva sección **Actividad**: lista de novedades (solo sin procesar o todas), botón para marcarlas como procesadas y accesos a Cuentas y Pedidos.
5. Cómo conecta el bot: ver `supabase/README.md` → "Novedades para el bot".

**Archivos:** `index.html`, `supabase/migrations/20261106_11_eventos.sql`, `admin/admin.js`, `admin/index.html`, `supabase/README.md`.

---

## Plan 13 — Indexación en Google (Search Console)

**Fecha:** 06/11/2026 · **Estado:** hecho (Google tarda de unos días a un par de semanas en mostrar el sitio)

**Pasos:**
1. La propiedad de dominio `lacteosnc.com.ar` ya estaba verificada en Google Search Console (registro TXT `google-site-verification` en Cloudflare).
2. **Inspección de URLs** de `https://lacteosnc.com.ar/`: figuraba "La URL no está en Google". Se tocó **Solicitar indexación** → "Se ha añadido la URL a una cola de rastreo prioritaria".
3. `sitemap.xml` actualizado: se agregaron `/registro/` y `/terminos/` y se cambió la fecha. Las páginas privadas (`/admin/`, `/clientes/`, `/pedidos/`) siguen excluidas en `robots.txt`.
4. **Sitemaps** → se envió `https://lacteosnc.com.ar/sitemap.xml`: "Se ha enviado el sitemap correctamente", 3 páginas descubiertas.
5. Para revisar más adelante: Search Console → Páginas (qué está indexado) y Rendimiento (búsquedas y clics).

---

## Plan 14 — Ingresar, redes sociales y firma de La Emancipación en el pie

**Fecha:** 10/11/2026 · **Estado:** hecho

**Pasos:**
1. Google ya muestra `lacteosnc.com.ar` indexada (confirmado por Fer).
2. Menú: el botón **Login** pasó a decir **Ingresar** (sigue llevando a `/admin/`).
3. Al lado de Ingresar se agregaron los íconos de **Instagram** (`https://www.instagram.com/lacteosncla/`) y **Facebook** (`https://www.facebook.com/p/L%C3%A1cteos-NC-61564084072348/`):
   - se abren en otra pestaña;
   - son grises y se ponen rojos con el ícono blanco al pasar el mouse;
   - en el celular quedan centrados debajo de Ingresar, que ahora ocupa todo el ancho como Contacto.
4. Las dos redes se agregaron también en los datos para Google (`sameAs` del JSON-LD).
5. **Pie de página**, debajo de Institucional · Productos · Novedades · Contacto: "Lácteos NC es una marca de" + logo de La Emancipación.
   - El logo es `img/logo-la-emancipacion.png` / `.webp`, recortado de `laemancipacionSinfondo.png`.
   - Mide 52 px de alto, menos que el sello NC de la izquierda (70 px).
   - El texto de la izquierda pasó a "Quesos, cremas y dulce de leche elaborados en Jacinto Arauz, La Pampa." para no repetir la leyenda.
6. Versión de `styles.css` subida a `?v=7` en `index.html` y `404.html`. Probado en computadora y celular, sin errores.

**Archivos:** `index.html`, `404.html`, `css/styles.css`, `img/logo-la-emancipacion.png`, `img/logo-la-emancipacion.webp`.

---

## Plan 15 — Íconos de redes de Flaticon (UIcons Brands)

**Fecha:** 10/11/2026 · **Estado:** reemplazado por el Plan 16

**Pasos:**
1. Los íconos dibujados de Instagram y Facebook se reemplazaron por los de **Flaticon UIcons Brands** que eligió Fer: `<i class="fi fi-brands-instagram"></i>` (icono 6422200) y `<i class="fi fi-brands-facebook"></i>` (icono 6422199).
2. Se tomó la fuente oficial del paquete `@flaticon/flaticon-uicons` 3.3.1 y se recortó a esos 2 íconos (`fonts/uicons-brands-nc.woff2`, 600 bytes en vez de 37 KB). Queda alojada en el sitio, como las demás tipografías.
3. Las clases `fi`, `fi-brands-instagram` y `fi-brands-facebook` están en `css/styles.css` con los mismos códigos de Flaticon (`\f16e` y `\f14f`).
4. **Licencia:** el uso gratuito de Flaticon exige darles crédito. Se agregó en el pie: "Íconos de redes: Uicons de Flaticon", con enlace a https://www.flaticon.es/uicons. Con una suscripción Premium de Flaticon se podría quitar.
5. Versión de `styles.css` subida a `?v=8`. Probado: la fuente carga y los íconos se ven en gris y en rojo al pasar el mouse.

**Archivos:** `index.html`, `404.html`, `css/styles.css`, `fonts/uicons-brands-nc.woff2`.

---

## Plan 16 — Íconos de redes sin crédito (Simple Icons, dominio público)

**Fecha:** 10/11/2026 · **Estado:** hecho

**Objetivo:** sacar del pie la leyenda "Íconos de redes: Uicons de Flaticon".

**Pasos:**
1. Se revisaron las condiciones de los íconos de **Magnific** que propuso Fer. Magnific es el nuevo nombre de Freepik desde abril de 2026, la misma empresa de Flaticon. Sus recursos gratuitos **exigen crédito** ("Designed by Magnific" con enlace, en el pie de la web), aunque se descarguen. Sin crédito solo con la suscripción Premium. No servían para el objetivo.
2. Se eligió **Simple Icons** (paquete oficial `simple-icons` 16.37.0), que trae los glifos oficiales de Instagram y Facebook con licencia **CC0 1.0** (dominio público): uso comercial libre y **sin crédito**.
3. Los dos íconos quedaron dibujados directamente en `index.html` (SVG, 20 px, mismo comportamiento: grises y rojos al pasar el mouse). Se borró la fuente de Flaticon (`fonts/uicons-brands-nc.woff2`) y sus estilos.
4. Se quitó del pie "Íconos de redes: Uicons de Flaticon".
5. Versión de `styles.css` subida a `?v=9`. Probado sin errores.

**Archivos:** `index.html`, `404.html`, `css/styles.css`.

---

## Plan 17 — "Olvidé mi contraseña" con pantalla propia y mail de Lácteos NC

**Fecha:** 10/11/2026 · **Estado:** hecho (falta que Fer pruebe el mail real)

**Pedido de Fer:** al tocar "Olvidé mi contraseña" mostrar solo el Email y que el botón diga "Solicitar nueva contraseña". Además, que el mail no llegue como "Supabase Auth <noreply@mail.app.supabase.io>" en inglés, sino como Lácteos NC.

**Pasos:**
1. **Login (`/admin/`)** con dos modos en el mismo formulario:
   - **Ingresar:** email + contraseña.
   - **Recuperar contraseña:** solo email; el botón dice **Solicitar nueva contraseña** y aparece "← Volver a ingresar".
2. El mail ya no lo manda Supabase. Lo manda la función del servidor `cuentas` (acción nueva `recuperar`) por **Resend**:
   - remitente **Lácteos NC <no-responder@lacteosnc.com.ar>**, en español, con el mismo diseño rojo que los demás mails;
   - asunto "Elegí una contraseña nueva — Lácteos NC";
   - botón "Elegir contraseña nueva"; el enlace vence en 1 hora y sirve una sola vez.
3. El enlace apunta a `https://lacteosnc.com.ar/admin/?recuperar=…` (ya no a una dirección de Supabase). La página lo valida, saca el código de la barra de direcciones y muestra "Elegí una contraseña nueva". Si venció o ya se usó, avisa y deja pedir otro.
4. **Seguridad:**
   - Siempre responde el mismo mensaje, exista o no la cuenta, para no revelar qué emails están registrados.
   - **Migración 12** (`recuperaciones` + `recup_permitir`): como máximo 1 mail por minuto y 5 por hora por email.
   - Solo se manda a cuentas activas o pendientes de activación.
5. Probado en navegador: el campo contraseña se oculta, el botón cambia, se envía el pedido correcto, "Volver a ingresar" restaura el formulario y un enlace vencido muestra el aviso.

**Archivos:** `admin/index.html`, `admin/admin.js`, `supabase/functions/cuentas/index.ts`, `supabase/migrations/20261110_12_recuperar_clave.sql`.

---

## Plan 18 — Ingreso con usuario, alta de cuentas desde el panel, aceptar/cancelar pedidos e indicadores

**Fecha:** 10/11/2026 · **Estado:** hecho (falta la prueba real de Fer con un cliente)

**Pedido de Fer:** ingresar con email **o** usuario (los dos únicos); que superadmin y administrador puedan crear usuarios; que un pedido nuevo quede en **En espera** con una columna **Acción** (aceptar o cancelar) que solo usan superadmin y administrador; al aceptarlo pasa a **Armando**, la solapa que ven los empleados, y el empleado lo marca **Retirado**; agregar KPIs (no había).

**Pasos:**
1. **Base (migraciones 13a y 13b):**
   - estado nuevo `cancelado`; columnas `aceptado`, `aceptado_por`, `cancelado`, `cancelado_por`, `motivo_cancelacion`;
   - funciones `aceptar_pedido` y `cancelar_pedido` (solo administradores); `abrir_pedido` ya no cambia el estado;
   - el empleado solo ve pedidos en *armando* y *retirado* (lo controla la base, no solo la página);
   - eventos nuevos para el bot: `pedido_aceptado` y `pedido_cancelado` (con motivo);
   - usuario y email **únicos** sin distinguir mayúsculas;
   - `intentos_ingreso`: 5 errores con un usuario lo bloquean 15 minutos;
   - función `kpis()` para el panel.
2. **Función `cuentas`:** acción `ingresar` (busca el email del usuario en el servidor sin mostrarlo) y `crear_usuario` (crea la cuenta activa, controla duplicados de email, usuario y CUIT, y manda el mail "Te creamos una cuenta en Lácteos NC" con enlace para elegir contraseña).
3. **Login:** el campo dice "Email o usuario"; con @ entra directo, sin @ pasa por el servidor.
4. **Panel:** sección nueva **Indicadores** (la primera): pedidos en espera y armando, hoy, mes, total estimado, tiempos de aceptación y retiro, clientes activos, cuentas para activar, gráfico de pedidos por día (con tabla), artículos y clientes con más pedidos y estado del catálogo. En **Cuentas**, botón **Nueva cuenta**.
5. **Pedidos (`/pedidos/`):**
   - administrador: solapas En espera (con ✓ aceptar y ✕ cancelar con motivo opcional), Armando, Retirados, Cancelados y Todos;
   - empleado: solo Armando y Retirados; al abrir un pedido, **Marcar como retirado**.
6. **Área de clientes:** muestra el pedido cancelado con su motivo.
7. Probado en la base con una transacción que se deshace (duplicados, permisos de cada rol, cada cambio de estado, eventos y KPIs) y en navegador con datos simulados (vista admin, vista empleado, ingreso con usuario, nueva cuenta, indicadores). La numeración de pedidos se volvió a dejar en **1001**.

**Archivos:** `supabase/migrations/20261110_13a_estado_cancelado.sql`, `supabase/migrations/20261110_13b_pedidos_aceptar_kpis.sql`, `supabase/functions/cuentas/index.ts`, `admin/*`, `pedidos/*`, `clientes/clientes.js`, `js/cuenta.js`, `supabase/README.md`.

---

## Plan 19 — El administrador carga pedidos a nombre de un cliente

**Fecha:** 10/11/2026 · **Estado:** hecho (falta la prueba real de Fer)

**Pedido de Fer:** que superadmin y administrador puedan crear un pedido y asignárselo a un cliente (por ejemplo, el cliente lo pasa por WhatsApp), que quede asociado a ese cliente y que él lo vea.

**Pasos:**
1. **Migración 14:**
   - columna `cargado_por` en `pedidos`;
   - función `crear_pedido_para(cliente, renglones, observaciones, aceptar)`, solo para administradores. Solo admite clientes con cuenta activa y usa los precios de la lista **del cliente**;
   - si se marca "aceptar" (viene marcado), el pedido entra directo en **Armando** y lo ven los empleados; si no, queda **En espera**;
   - el detalle del pedido y el evento `pedido_nuevo` para el bot dicen quién lo cargó y en qué estado entró.
2. **`/pedidos/`:** botón **+ Nuevo pedido** (solo administradores):
   - buscar el cliente por usuario, nombre o CUIT;
   - se ven sus precios, con buscador de artículos y la cantidad en cada renglón (acepta decimales con coma);
   - total estimado, observaciones y la casilla "Aceptarlo ahora";
   - al crear, muestra el pedido con su número.
3. **Área de clientes:** el cliente ve el pedido en Mis pedidos, con la nota "Pedido cargado por la cooperativa".
4. Probado en la base con una transacción que se deshace:
   - el empleado no puede cargar pedidos;
   - aceptado entra en armando y sin aceptar queda en espera;
   - no se puede cargar a nombre de alguien que no es cliente;
   - el cliente ve sus pedidos.

   En navegador, con datos simulados: búsqueda de clientes, cantidades inválidas marcadas en rojo y creación. La numeración quedó en **1001**.

5. **Corrección (migración 15):** al apuntar `cargado_por` a `perfiles` quedaron dos relaciones entre pedidos y perfiles y la solapa En espera mostraba "Could not embed because more than one relationship was found". Se cambió para que apunte a `auth.users`, como `aceptado_por` y las demás, y la página pide explícitamente la relación del cliente.

**Archivos:** `supabase/migrations/20261110_14_pedido_para_cliente.sql`, `supabase/migrations/20261110_15_cargado_por_auth_users.sql`, `pedidos/pedidos.js`, `pedidos/index.html`, `admin/admin.css`, `clientes/clientes.js`, `supabase/README.md`.

---

## Plan 20 — Armado de pedidos: pesadas, kilos y bultos

**Fecha:** 10/11/2026 · **Estado:** hecho (la fórmula de bultos queda para más adelante)

**Pedido de Fer** (después de probar con el cliente `test`: Mfernandez aceptó el pedido y pasó bien a Armando):
- en el detalle del pedido, el email del cliente se encimaba con "Total estimado";
- agregar, solo en Armando y para que lo complete el empleado:
  - **Peso o Kilos** de cada producto;
  - **Cantidad pesada**: se van sumando pesadas hasta igualar la cantidad que pidió el cliente;
  - **Bultos**: editable por ahora, después tendrá su fórmula.

**Pasos:**
1. **Datos del pedido:** los textos largos (como el email) cortan línea dentro de su lugar y ya no se enciman.
2. **Migración 16:**
   - tabla `pedido_pesadas` (renglón, kilos con 3 decimales, cantidad, quién y cuándo) y columna `bultos` en `pedido_items`;
   - funciones `agregar_pesada`, `quitar_pesada` y `guardar_bultos`, para empleados y administradores, y solo con el pedido **en Armando** (retirado queda cerrado);
   - `detalle_pedido` devuelve por renglón las pesadas, los kilos y la cantidad pesada totales y los bultos.
3. **`/pedidos/`, pedido en Armando:**
   - tabla con Cantidad pedida, **Peso o Kilos** (suma), **Cantidad pesada** (suma) con estado *Sin pesar*, *Faltan X*, *Completo ✓* o *Sobran X*, y **Bultos**;
   - por renglón, las pesadas cargadas (se pueden quitar con ✕) y los campos para una nueva: la cantidad viene sugerida con lo que falta; Enter agrega;
   - totales de kilos y bultos, y cuántos renglones faltan completar;
   - al **Marcar como retirado**, si hay renglones sin completar avisa cuáles y pide confirmar.
4. En **Retirados** se ve lo que se pesó (sin poder cambiarlo); al imprimir no salen los campos de carga.
5. Probado en la base (transacción que se deshace) sobre el pedido 1001: dos pesadas suman bien, quitar descuenta, bultos se guardan, kilos 0 rechazado, el cliente no puede pesar ni leer la tabla, y en un pedido retirado no se puede pesar. En navegador con datos simulados: carga de pesadas, cantidad sugerida, bultos y aviso al retirar.

**Archivos:** `supabase/migrations/20261110_16_pesadas_y_bultos.sql`, `pedidos/pedidos.js`, `pedidos/index.html`, `admin/admin.css`, `supabase/README.md`.

---

## Plan 21 — Carcasa imprimible del bot: REGGI, en tres formatos de queso

**Fecha:** 11/11/2026 · **Estado:** diseño hecho (falta elegir el modelo, imprimir y armar)

**Pedido de Fer:**
- diseñar para impresora 3D el bot que se va a usar más adelante, al estilo de Troko (trokotec.com/troko), con formato de queso y el logo de Lácteos NC atrás;
- después, ponerle de nombre **REGGI** (por el Reggianito), escrito adelante, y sumar dos estilos más: uno redondo y otro con el formato de Troko.

**Los tres modelos** (misma electrónica en todos):
- **Electrónica:** ESP32-S3 DevKitC-1 N16R8, pantalla IPS 1,54" 240×240 ST7789, micrófono INMP441, amplificador MAX98357A y parlante de 40 mm. Pensada para el firmware de asistente por voz Xiaozhi, igual que Troko.
- **1 · Cuña** (90 × 75 × 92 mm; 111 × 84 × 102 con brazos y patitas):
  - la pantalla en la cara inclinada a 45°;
  - ojos de queso en las caras y "mordiscos" en las aristas (por dentro, las aristas tienen un refuerzo macizo para que no se perfore la pared);
  - REGGI en la cara de adelante y el logo atrás.
- **2 · Horma** (158 × 84 × 120 mm):
  - horma de Reggianito parada, con una porción cortada (los ojos de queso están en las caras del corte);
  - la pantalla y REGGI adelante; el logo en la tapa trasera, que va atornillada;
  - se apoya en una **tabla de quesos con manija**: una tabla con vetas encima de una bandeja que guarda el ESP32 y el amplificador, con el USB-C atrás.
- **3 · Cubito** (78 × 72 × 80 mm; 99 × 79 × 90 con brazos y patitas):
  - el formato de Troko: cubo de aristas redondeadas, la pantalla en un marco oscuro (pieza aparte para imprimir en negro) y REGGI abajo;
  - ojos de queso arriba, a los costados y en las aristas;
  - el logo y el USB-C atrás.

**Pasos:**
1. Se revisó la página de Troko: es un compañero de escritorio de ~11 cm con forma de cubo redondeado, pantalla grande al frente y el nombre abajo, con ESP32-S3 y firmware Xiaozhi.
2. Se armaron generadores paramétricos en Python con `manifold3d`:
   - `comun.py`, con las piezas compartidas: pantalla con marco y postes, rejilla del parlante con aro, micrófono, tapa con la cuna del ESP32, logo y nombre;
   - un programa por modelo: `cuna.py`, `horma.py` y `cubito.py`.
3. El logo se vectorizó desde `img/logo-nc-lg.png` (solo lo rojo), sin "Jacinto Arauz" porque a ese tamaño sus letras quedarían de 0,3 mm. REGGI está en Barlow Condensed ExtraBold, la tipografía de títulos del sitio.
4. El logo, REGGI y el marco del cubito van en huecos de 1,2 mm (1 mm el marco): se pegan impresos aparte o se imprimen juntos en multicolor, con piezas "en su lugar" ya alineadas.
5. Todas las piezas salen en posición de impresión y sin soportes: la cuña con la boca abajo, la horma con la cara de adelante sobre la cama, el cubito boca abajo y las tapas y la tabla planas.
6. Se comprobó:
   - las 25 piezas son sólidos cerrados (se releyeron los STL);
   - los agujeros pasantes son solo los funcionales: ventana, rejilla, micrófono, USB y paso de cables;
   - los ojos de queso dejan al menos 0,8 mm de pared;
   - ningún componente choca con la carcasa ni con otro;
   - los tornillos de la tabla caen en sus postes.
7. En el camino se corrigió:
   - el logo de la horma tocaba el corte de la porción: se achicó y se corrió;
   - la pestaña de la tapa trasera era fina: pasó de 2 a 6 mm donde van los tornillos;
   - el parlante y el amplificador rozaban otras piezas y se movieron;
   - había astillas y bordes dudosos que dejaban las operaciones booleanas, y se eliminaron.

8. **Brazos y patitas (12/11/2026)**, a pedido de Fer, con el ejemplo de un muñeco tipo yeti:
   - brazos regordetes con dos surcos de dedos en la mano: a los costados en la cuña y el cubito, y en la cara de adelante en la horma (las manos asoman por los costados);
   - patitas ovaladas: en la cuña y el cubito, 2 grandes adelante y 2 chicas atrás, debajo de la tapa (levantan el bot 1 cm y reemplazan a las patitas de goma); en la horma, 2 apoyadas en la tabla;
   - son piezas aparte que se imprimen planas, sin soportes, y se pegan alineadas con tarugos de filamento de 1,75 mm (agujeros de 2 mm en las dos partes);
   - para dejarles lugar, se corrió el micrófono de la cuña y el parlante del cubito, y los ojos de queso ya no caen debajo de los brazos;
   - comprobado: las 36 piezas cerradas; brazos y patitas apoyan sin meterse en la carcasa; los agujeros coinciden; las patitas no tapan los tornillos de la tapa ni cortan los rieles del ESP32.

**Entregado por el chat:**
- `reggi-carcasas.zip`: los STL de los tres modelos con brazos y patitas, los generadores, las vistas y `LEEME.md` (componentes, impresión y armado);
- `reggi-con-brazos-y-patas.png`: la lámina comparativa.

No se subió al repositorio del sitio para que no quede publicado en la web.
