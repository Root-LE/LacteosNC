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

**Fecha:** 05/11/2026 · **Estado:** casi completo (falta conectar el dominio, ver `PENDIENTES.md`)

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

**Pasos que faltan:** conectar `lacteosnc.com.ar` y `www.lacteosnc.com.ar` cuando el dominio quede activo.
