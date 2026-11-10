# Guía del proyecto Lácteos NC

Reglas indispensables para cualquiera que trabaje en este sitio (personas o Claude).
Leer antes de empezar cualquier tarea.

## 1. Reglas de trabajo

1. **Responder siempre en español.**
2. **Publicar = subir a la rama `main` de GitHub** (GitHub Desktop: *Commit to main* → *Push origin*, o editar en github.com). Cloudflare Pages publica solo cada cambio en uno o dos minutos. Trabajar siempre sobre la copia clonada del repositorio, no sobre la carpeta vieja `convertir\lacteosnc`.
3. **Antes de empezar**, leer `PENDIENTES.md` para saber qué falta y `PLANES.md` para saber qué ya está hecho y cómo.
4. **Al terminar una tarea**:
   - sacarla de `PENDIENTES.md` (o marcarla como hecha),
   - agregar en `PLANES.md` el plan implementado con sus pasos.
5. **No tener abiertos en un editor** (VS Code, Notepad++, etc.) los archivos que se están modificando por otro lado: al guardar, el editor pisa los cambios nuevos con la versión vieja. Ya pasó una vez con `index.html`.
6. **Al cambiar `css/styles.css` o `js/main.js`**, subir el número de versión en los enlaces de `index.html` y `404.html` (ej. `?v=9` → `?v=10`). Si no, los visitantes siguen viendo la versión vieja guardada en su navegador.
7. **Probar en el navegador con Ctrl + F5** (recarga sin caché) después de cada cambio.
8. **Nunca subir contraseñas ni claves secretas** al repositorio. La clave pública (anon/publishable) de Supabase sí puede ir en el código; la `service_role` jamás.
9. Hacer los cambios de base de datos en Supabase siempre con **migraciones** (archivos SQL con nombre y fecha), nunca a mano sin dejar registro.

## 2. Datos del proyecto

| Qué | Dónde / valor |
|---|---|
| Carpeta local | `C:\Users\VillaIris1\Desktop\Convertir\convertir\lacteosnc` |
| Repositorio | `github.com/Root-LE/LacteosNC` (privado) |
| Dominio | `lacteosnc.com.ar` (registrado en nic.ar) |
| DNS y hosting | Cloudflare, cuenta `sistemas.emancipacion@gmail.com`, plan Free; proyecto de Pages **lacteosnc** |
| Sitio oficial | https://lacteosnc.com.ar (`www` redirige acá) |
| Dirección de prueba | https://lacteosnc.pages.dev |
| Servidores DNS de Cloudflare | `brynne.ns.cloudflare.com` y `kanye.ns.cloudflare.com` |
| Base de datos, usuarios y archivos | Supabase, proyecto **LacteosNC** (`clztzhkjjulnmdaiobgl`), plan Free |
| Mail de contacto (provisorio) | `info@laemancipacion.com.ar` |
| Teléfono casa central | (02924) 420303 |
| Compras (planta) | (02923) 436876 · info@laemancipacion.com.ar |
| Administración (planta) | (02924) 401142 · administracionqueseria@laemancipacion.com.ar |
| Login (ingreso único) | https://lacteosnc.com.ar/admin/ — clientes van a `/clientes/`, empleados a `/pedidos/`, administradores al panel |
| Registro de clientes | https://lacteosnc.com.ar/registro/ |
| Mails | Resend (dominio verificado). Remitente `no-responder@lacteosnc.com.ar`; avisos de clientes nuevos a `sistemas@laemancipacion.com.ar` |
| "No soy un robot" | Cloudflare Turnstile, widget "Lácteos NC - registro" |
| Novedades para el bot | Tabla `eventos` en Supabase (ver `supabase/README.md`); en el panel, sección Actividad |
| Redes sociales | Instagram https://www.instagram.com/lacteosncla/ · Facebook https://www.facebook.com/p/L%C3%A1cteos-NC-61564084072348/ |
| Usuarios internos | Fnardi (superadmin), Mfernandez (administrador). Regla: inicial del nombre + apellido |

## 3. Estructura del sitio

```
index.html      Página principal: Inicio, Institucional, Productos, Novedades, Contacto
404.html        Página para direcciones que no existen
css/styles.css  Estilos (colores, menú peluche/clásico, animación de leche)
js/config.js    URL y clave PÚBLICA de Supabase
js/main.js      Menú, catálogo y novedades (desde Supabase, con lista de respaldo), animación y formulario
admin/          Login único y panel de administración (productos, artículos, novedades, listas, precios, cuentas)
registro/       Registro de clientes con código de 6 dígitos
clientes/       Área de clientes: lista de precios, pedido tipo carrito, mis pedidos
pedidos/        Página Pedidos para empleados y administradores
terminos/       Términos y condiciones
js/cuenta.js    Funciones compartidas por registro, clientes y pedidos
supabase/       Migraciones SQL y documentación de la base (supabase/README.md)
img/            Logos, fotos de productos (grande y -sm) y capas de leche (.webp)
fonts/          Barlow, Barlow Condensed y Yellowtail, alojadas en el sitio
robots.txt, sitemap.xml, _headers   Archivos para Google y Cloudflare
README.md       Cómo publicar
GUIA.md         Esta guía
PENDIENTES.md   Lo que falta hacer
PLANES.md       Lo que ya se hizo, plan por plan, con sus pasos
```

## 4. Identidad visual

- **Colores:** rojo NC `#E1141C`, blanco, gris leche `#F2F4F7`, azul de etiquetas `#1F2C7A`, madera `#2A1B15` (fondo de Novedades), tinta `#231F20`.
- **Tipografías:** Barlow Condensed (títulos), Barlow (texto), Yellowtail (solo la palabra "Lácteos" de la portada).
- **Recursos de marca:** corchetes rojos en las esquinas y franja roja en diagonal (tomados de las fotos de producto).
- **Íconos de redes:** Simple Icons (CC0, sin crédito). No usar íconos gratuitos de Flaticon/Magnific/Freepik sin poner su crédito.
- **Menú:** estilo Convertir activo (`nav--clasico`); alternativa estilo peluche (`nav--peluche`).

## 5. Planes gratuitos: límites a tener en cuenta

- **Supabase Free:** el proyecto se pausa tras 7 días sin actividad; 500 MB de base y 1 GB de archivos. Pasar al plan pago (USD 25/mes) cuando el sitio esté en uso real.
- **Mails:** el envío de Supabase gratis permite muy pocos mails por hora; para códigos de verificación y avisos usar un servicio aparte (Resend).
- **Cloudflare Pages Free:** sin límite de visitas para el sitio estático.
