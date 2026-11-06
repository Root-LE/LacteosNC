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

El código ya está publicado. Falta conectar dos servicios:

- [ ] **Fer:** en Supabase → Edge Functions → **Secrets** cargar las 2 claves secretas (no se pasan por el chat):
  - `RESEND_API_KEY` = la API key de Resend;
  - `TURNSTILE_SECRET` = la Secret Key del widget "Lácteos NC - registro" (Cloudflare → Turnstile → el widget → Settings).
- [ ] **Claude:** confirmar que Resend marque el dominio `lacteosnc.com.ar` como **Verified** (los DNS ya están cargados).
- [ ] **Claude:** cuando esté todo configurado, probar un registro real de punta a punta.
- [ ] **Cooperativa:** revisar y aprobar el texto de los **términos y condiciones** (`/terminos/`, hoy en borrador).
- [ ] **Opcional:** cargar cuentas de **empleados** (se registran como clientes y el administrador les pone el rol Empleado al activarlas).

## Fase 6 — Contacto y mails

- [ ] Formulario de contacto que guarde los mensajes en la base y avise por mail.
- [ ] Usar Resend (ya preparado para registro y activación) también para avisar los mensajes de contacto.
- [ ] **En revisión:** definir el mail de contacto definitivo (por ahora `info@laemancipacion.com.ar`; opción `info@lacteosnc.com.ar` con Cloudflare Email Routing).

## Contenido y fotos

- [ ] Conseguir fotos en mejor resolución de mozzarella, provoleta, sardo y pategrás (hoy ~540 px).
- [ ] Conseguir el logo de La Emancipación en buena calidad (hoy recortado de una imagen).
- [ ] Que alguien de la planta revise las descripciones y usos sugeridos de cada producto.
- [ ] Datos propios de la planta de Jacinto Arauz (teléfono, WhatsApp, redes), si los hay.

## Más adelante

- [ ] Pasar Supabase al plan pago (USD 25/mes) para que el proyecto no se pause y tenga más espacio.
- [ ] Exportar la animación de leche como video MP4/GIF para redes (opcional).
