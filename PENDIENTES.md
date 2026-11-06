# Pendientes — Lácteos NC

Última actualización: 06/11/2026

Al completar algo: borrarlo de acá y anotarlo en `PLANES.md`.
Responsable: **Fer** = lo hace el usuario · **Claude** = lo hace Claude.

## Fase 3 — Pendientes que quedaron de la base de datos

- [ ] **Fer / Macarena:** subir desde el panel las **fotos de las 13 tarjetas nuevas** (están ocultas hasta tener foto) y tildar "Visible en la web".
- [ ] **Fer / Macarena:** cargar los **precios por lista** desde el panel (Precios → Pegar desde Excel), cuando estén listos los Excel por zona.
- [ ] **Opcional:** activar en Supabase la protección contra contraseñas filtradas (Authentication → Policies), si el plan lo permite.

## Fase 4 — Panel de administración (`/admin`)

- [ ] **Fer y Macarena:** entrar a `https://lacteosnc.com.ar/admin/` con su email y contraseña y probar cada sección.

## Fase 5 — Lo que falta para que el registro funcione

Todo está configurado (Resend verificado, Turnstile y los 4 secretos cargados).

- [ ] **Fer:** hacer un **registro real de prueba** en `/registro/` con un email propio (Claude no puede tildar el "no soy un robot"): recibir el código, verificarlo, ver llegar el aviso a sistemas@laemancipacion.com.ar, activar la cuenta en el panel y recibir el mail de cuenta activa. Después probar un pedido y la página Pedidos.
- [ ] **Cooperativa:** revisar y aprobar el texto de los **términos y condiciones** (`/terminos/`, hoy en borrador).
- [ ] **Opcional:** cargar cuentas de **empleados** (se registran como clientes y el administrador les pone el rol Empleado al activarlas).

## Fase 6 — Contacto y mails

- [ ] Formulario de contacto que guarde los mensajes en la base y avise por mail.
- [ ] Usar Resend (ya preparado para registro y activación) también para avisar los mensajes de contacto.
- [ ] **En revisión:** definir el mail de contacto definitivo (por ahora `info@laemancipacion.com.ar`; opción `info@lacteosnc.com.ar` con Cloudflare Email Routing).

## Bot de automatización

- [ ] **Fer:** definir qué hace el bot con cada novedad (WhatsApp, Telegram, carga en el sistema, etc.). La base ya guarda todo en `eventos` (ver `supabase/README.md`).

## Contenido y fotos

- [ ] Conseguir fotos en mejor resolución de mozzarella, provoleta, sardo y pategrás (hoy ~540 px).
- [ ] Conseguir el logo de La Emancipación en buena calidad (hoy recortado de una imagen).
- [ ] Que alguien de la planta revise las descripciones y usos sugeridos de cada producto.
- [ ] Datos propios de la planta de Jacinto Arauz (teléfono, WhatsApp, redes), si los hay.

## Más adelante

- [ ] Pasar Supabase al plan pago (USD 25/mes) para que el proyecto no se pause y tenga más espacio.
- [ ] Exportar la animación de leche como video MP4/GIF para redes (opcional).
