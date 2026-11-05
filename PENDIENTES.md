# Pendientes — Lácteos NC

Última actualización: 05/11/2026

Al completar algo: borrarlo de acá y anotarlo en `PLANES.md`.
Responsable: **Fer** = lo hace el usuario · **Claude** = lo hace Claude.

## Fase 2 — Publicar el sitio (en curso)

- [ ] **Claude:** cuando Cloudflare marque `lacteosnc.com.ar` como **Active** (esperando la propagación de la delegación de nic.ar, hecha el 05/11/2026), conectar `lacteosnc.com.ar` y `www.lacteosnc.com.ar` en Pages → lacteosnc → Custom domains.
- [ ] **Claude:** verificar que el sitio abra con candado (HTTPS) en ambas direcciones y que `www` redirija a la principal.

## Fase 3 — Pendientes que quedaron de la base de datos

- [ ] **Fer:** pasar los **códigos reales** de los 11 productos (hoy tienen códigos provisorios NC-001 a NC-011).
- [ ] **Fer:** pasar los **precios** de cada producto para cada lista (Lista 1 precio sur, Lista 2 precio CABA, Lista 3 precio cliente), o cargarlos desde el panel cuando esté listo.
- [ ] **Fer + Claude:** crear el primer usuario **administrador** (pasos en `supabase/README.md`).

## Fase 4 — Panel de administración (`/admin`)

- [ ] Inicio de sesión de administradores.
- [ ] Alta, baja y modificación de productos con foto y descripción.
- [ ] Alta, baja y modificación de novedades con foto, **enlace de YouTube** o **video propio de hasta 10 segundos y 5 MB**.
- [ ] Gestión de listas de precio (lista 1 precio sur, lista 2 precio CABA, lista 3 precio cliente, etc.) y precios por producto.
- [ ] Activación de cuentas de clientes (ver Fase 5).

## Fase 5 — Clientes y pedidos

### Registro de clientes
- [ ] Botón **Ingresar** en el menú.
- [ ] Formulario de registro: Usuario (grisado, no editable por el cliente), Nombre, Apellido, \*Contraseña, \*CUIT, \*Email, \*aceptar términos y condiciones, \*"no soy un robot" (Cloudflare Turnstile). Los marcados con \* son obligatorios.
- [ ] Al aceptar: se envía un **código de 6 dígitos** por mail, que **caduca a los 20 minutos**.
- [ ] Esperas por código mal ingresado:
  | Intento erróneo | Consecuencia |
  |---|---|
  | 1.º | esperar 1 min |
  | 2.º | esperar 2 min |
  | 3.º | esperar 3 min |
  | 4.º | esperar 4 min |
  | 5.º | esperar 5 min y volver a tildar "no soy un robot" |
  | 6.º | el código caduca y se bloquea 1 hora; luego debe volver a registrarse y pedir un código nuevo |
- [ ] Con el mail verificado, la cuenta queda **pendiente de activación**.
- [ ] El administrador completa el campo **Usuario**, asigna la **lista de precio** y acepta: la cuenta queda activa.
- [ ] Se envía un mail al cliente con su usuario y email, avisando que la cuenta está activa y lista para usar.
- [ ] Redactar los términos y condiciones.

### Área de clientes
- [ ] Ver la lista de precios que tiene asignada (solo esa).
- [ ] Armar un pedido tipo carrito (sin pago): código de producto, descripción, cantidad.
- [ ] Al confirmar: mensaje "Su pedido fue generado correctamente" con el **número de pedido** y el detalle.
- [ ] Ver sus pedidos y su estado: **en espera**, **armando pedido**, **pedido retirado**.

### Página "Pedidos" (rol empleado)
- [ ] Solo la ven usuarios con permiso (rol empleado o administrador).
- [ ] Lista de todos los pedidos; al abrir uno se ve qué pidió el cliente.
- [ ] Al abrir un pedido "en espera", pasa automáticamente a **armando pedido**.
- [ ] Marcar el pedido como **pedido retirado**.

## Fase 6 — Contacto y mails

- [ ] Formulario de contacto que guarde los mensajes en la base y avise por mail.
- [ ] Servicio de envío de mails (Resend, plan gratuito) para códigos, avisos de cuenta activa y contacto.
- [ ] **En revisión:** definir el mail de contacto definitivo (por ahora `info@laemancipacion.com.ar`; opción `info@lacteosnc.com.ar` con Cloudflare Email Routing).

## Contenido y fotos

- [ ] Conseguir fotos en mejor resolución de mozzarella, provoleta, sardo y pategrás (hoy ~540 px).
- [ ] Conseguir el logo de La Emancipación en buena calidad (hoy recortado de una imagen).
- [ ] Que alguien de la planta revise las descripciones y usos sugeridos de cada producto.
- [ ] Datos propios de la planta de Jacinto Arauz (teléfono, WhatsApp, redes), si los hay.

## Más adelante

- [ ] Pasar Supabase al plan pago (USD 25/mes) para que el proyecto no se pause y tenga más espacio.
- [ ] Exportar la animación de leche como video MP4/GIF para redes (opcional).
