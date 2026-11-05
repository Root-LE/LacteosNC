# Lácteos NC — sitio web

Sitio de Lácteos NC (Jacinto Arauz, La Pampa), marca de la Cooperativa La Emancipación.
Dominio: **https://lacteosnc.com.ar**

## Estructura

```
index.html      Página principal (Inicio, Institucional, Productos, Novedades, Contacto)
404.html        Página que se muestra cuando una dirección no existe
css/styles.css  Estilos
js/main.js      Menú, catálogo de productos, logo animado y formulario
img/            Logos, fotos de productos y capas de la animación de leche
fonts/          Tipografías Barlow, Barlow Condensed y Yellowtail (alojadas en el sitio)
robots.txt      Indicaciones para Google
sitemap.xml     Mapa del sitio para Google
_headers        Cabeceras de caché y seguridad para Cloudflare Pages
```

## Publicar en Cloudflare Pages

1. Subí el contenido de esta carpeta a un repositorio de GitHub (por ejemplo `lacteosnc`).
2. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** y elegí el repositorio.
3. Configuración de compilación:
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Build output directory: `/`
4. Guardar y publicar. Queda una dirección de prueba `https://lacteosnc.pages.dev`.
   Cada cambio que se suba a GitHub se publica solo en uno o dos minutos.

## Conectar el dominio lacteosnc.com.ar

1. En Cloudflare: **Add a site → lacteosnc.com.ar → plan Free**. Anotá los dos servidores de nombres que te da (terminan en `ns.cloudflare.com`).
2. En **nic.ar**: ingresá, elegí el dominio → **Delegar** → agregá los dos servidores de Cloudflare → guardar.
   No uses "Transferir".
3. Esperá a que Cloudflare marque el dominio como **Active** (puede tardar hasta 48 h).
4. En el proyecto de Pages: **Custom domains → Set up a custom domain** y agregá
   `lacteosnc.com.ar` y `www.lacteosnc.com.ar`. El certificado SSL se genera solo.

## Al modificar CSS o JS

En `index.html` y `404.html` subí el número de versión de los enlaces
(`styles.css?v=3` → `?v=4`, `main.js?v=3` → `?v=4`) para que los visitantes
no vean la versión vieja guardada en su navegador.
