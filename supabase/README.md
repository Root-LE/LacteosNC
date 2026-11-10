# Base de datos — Supabase (proyecto LacteosNC)

Proyecto: `clztzhkjjulnmdaiobgl` · URL: `https://clztzhkjjulnmdaiobgl.supabase.co`

Las migraciones de `migrations/` ya están aplicadas, en este orden. Cualquier cambio nuevo
se agrega como un archivo nuevo con fecha (`AAAAMMDD_NN_descripcion.sql`); nunca se editan
las que ya se aplicaron.

| Archivo | Qué hace |
|---|---|
| `20261105_01_estructura.sql` | Tablas, tipos y fechas de actualización |
| `20261105_02_seguridad.sql` | Reglas por rol (RLS), alta automática de perfiles y funciones de pedidos |
| `20261105_03_archivos.sql` | Carpetas de archivos `productos` y `novedades` |
| `20261105_04_datos_iniciales.sql` | 3 listas de precio, 4 categorías, 11 productos y 3 novedades |
| `20261106_05_superadmin_rol.sql` | Agrega el rol `superadmin` |
| `20261106_06_superadmin_permisos.sql` | Permisos del superadministrador y protección de roles |
| `20261106_07_articulos.sql` | Tabla de artículos con los 59 códigos reales; precios y pedidos pasan a ser por artículo |
| `20261106_08_precios_solo_activos.sql` | El cliente ve solo precios de artículos activos |
| `20261106_09_limpieza_y_tarjetas.sql` | Borra 11 artículos internos, categoría Blandos y 13 tarjetas nuevas ocultas |
| `20261106_10_registro_codigos.sql` | Tabla `verificaciones` y funciones del código de 6 dígitos (solo las usa la Edge Function) |
| `20261106_11_eventos.sql` | Tabla `eventos` (novedades para el bot), disparadores y función `marcar_eventos` |
| `20261110_12_recuperar_clave.sql` | Tabla `recuperaciones` y `recup_permitir`: límite de mails de "Olvidé mi contraseña" (1 por minuto, 5 por hora) |

## Tablas

| Tabla | Para qué |
|---|---|
| `listas_precio` | Lista 1 (precio sur), Lista 2 (precio CABA), Lista 3 (precio cliente)… |
| `perfiles` | Un registro por usuario: usuario, nombre, apellido, CUIT, email, **rol**, **estado**, lista de precio |
| `categorias` | Familias de productos (quesos duros, semiduros, pasta hilada, cremas y dulces) |
| `productos` | Las tarjetas de la web: nombre, tipo, descripción, datos, fotos, "Nuevo", visible, orden |
| `articulos` | Los códigos del sistema de la cooperativa (campo ARTICULO) con su descripción (DENOMINACION); pueden pertenecer a un producto de la web; activo/inactivo |
| `precios` | Precio de cada **artículo** en cada lista |
| `novedades` | Título, descripción, datos, foto / YouTube / video, producto relacionado |
| `pedidos` | Número (desde 1001), cliente, lista, estado, observaciones, total, quién lo aceptó, abrió, retiró o canceló (y el motivo) |
| `pedido_items` | Renglones: artículo, código, descripción, cantidad, precio unitario y subtotal (copiados al crear el pedido) |
| `mensajes_contacto` | Mensajes del formulario de contacto |
| `eventos` | Novedades automáticas para el bot: cliente para activar, cuenta activada o bloqueada, pedido nuevo, armando y retirado (con los datos completos en `datos`) |
| `intentos_ingreso` | Errores al ingresar con **usuario**: 5 errores seguidos bloquean ese usuario 15 minutos. Nadie la ve salvo el servidor |
| `verificaciones` | Código de verificación de cada registro pendiente (guardado cifrado), errores, esperas y bloqueos. Nadie la ve salvo el servidor |

## Roles y permisos

| Quién | Qué puede hacer |
|---|---|
| **Visitante** (sin sesión) | Ver categorías, productos y novedades visibles. Enviar un mensaje de contacto. |
| **Cliente** (cuenta activa) | Lo anterior + ver los artículos activos con **solo su lista de precios**, crear pedidos y ver **solo sus pedidos**. |
| **Empleado** | Ver los pedidos **aceptados** (*armando*) y los *retirados*, abrirlos y marcarlos como *retirado*. No ve los pedidos en espera ni los cancelados, y no puede aceptar ni cancelar. |
| **Administrador** | Todo lo anterior + ver todos los pedidos, **aceptarlos o cancelarlos**, ver los indicadores, crear cuentas, cargar productos, precios, listas, novedades y archivos; activar cuentas de clientes y empleados. No puede crear administradores ni modificar a un superadministrador. |
| **Superadministrador** | Acceso absoluto: todo lo del administrador y además asigna o quita los roles administrador y superadministrador. Es el único que puede modificar a otro superadministrador. |

Una cuenta que no está **activa** (pendiente de verificación, pendiente de activación o bloqueada)
no ve precios ni puede pedir, aunque tenga sesión iniciada.

Estados de una cuenta: `pendiente_verificacion` → (verifica el mail) → `pendiente_activacion` →
(el administrador asigna usuario y lista) → `activa`. También puede quedar `bloqueada`.

Estados de un pedido: `en_espera` → (un administrador lo **acepta**) → `armando` → (empleado o admin) → `retirado`.
Desde `en_espera` un administrador también puede **cancelarlo** (`cancelado`, con motivo opcional que ve el cliente).

Usuario y email son **únicos** (sin distinguir mayúsculas): la base no deja repetirlos.

## Funciones que llama el sitio

| Función | Quién | Qué hace |
|---|---|---|
| `crear_pedido(p_items, p_observaciones)` | Cliente activo | Crea el pedido con los precios de su lista. `p_items` = `[{"articulo_id":1,"cantidad":2}]`. Devuelve número y detalle. |
| `detalle_pedido(p_numero)` | Dueño o personal | Devuelve el pedido con cliente, renglones, fechas y motivo de cancelación (el empleado solo los aceptados). |
| `abrir_pedido(p_numero)` | Empleado / admin | Devuelve el detalle (ya no cambia el estado; anota quién lo abrió primero). |
| `aceptar_pedido(p_numero)` | Administrador | Pasa de *en espera* a *armando*. |
| `cancelar_pedido(p_numero, p_motivo)` | Administrador | Pasa de *en espera* a *cancelado*, con motivo opcional (hasta 300 caracteres). |
| `marcar_retirado(p_numero)` | Empleado / admin | Pasa de *armando* a *retirado*. |
| `activar_cuenta(p_perfil_id, p_usuario, p_lista_id, p_rol)` | Administrador | Asigna usuario, lista y rol, y activa la cuenta. |
| `kpis()` | Administrador | Indicadores del panel: pedidos (en espera, armando, hoy, semana, mes, retirados, cancelados, total, promedio, tiempos), pedidos por día (30 días), artículos y clientes con más pedidos, cuentas y catálogo. |

## Archivos (Storage)

- `productos`: fotos JPG, PNG o WebP, máximo 5 MB.
- `novedades`: fotos y videos MP4/WebM, máximo 5 MB (el panel controla que el video dure 10 s o menos).
- Se pueden ver públicamente; solo el administrador sube, reemplaza o borra.

## Usuarios administradores

| Persona | Email | Usuario | Rol |
|---|---|---|---|
| Fernando Nardi | sistemas@laemancipacion.com.ar | Fnardi | superadmin |
| Macarena Fernandez | administracionqueseria@laemancipacion.com.ar | Mfernandez | administrador |

Regla para usuarios internos (superadmin, administrador, empleado): **primera letra del nombre + apellido** (ej.: Fernando Nardi → `Fnardi`).

Para crear un administrador nuevo:

1. En Supabase: **Authentication → Users → Add user → Create new user**, con el email y una contraseña, tildando **Auto Confirm User**.
2. En **SQL Editor**, ejecutar (cambiando email, usuario, nombre y rol):

```sql
update public.perfiles
   set rol = 'empleado', estado = 'activa', usuario = 'Jperez', nombre = 'Juan', apellido = 'Perez', activado = now()
 where email = 'juan.perez@ejemplo.com';
```

**Ahora se hace desde el panel:** Cuentas → **Nueva cuenta** (administrador o superadministrador; solo el superadministrador crea administradores). Le llega un mail para elegir su contraseña.

## Función del servidor (Edge Function) `cuentas`

Código en `supabase/functions/cuentas/index.ts`, publicada en
`https://clztzhkjjulnmdaiobgl.supabase.co/functions/v1/cuentas` (sin exigir sesión: cada acción controla sus permisos).

| Acción | Qué hace |
|---|---|
| `registrar` | Controla "no soy un robot", CUIT válido y términos; crea la cuenta sin verificar y manda el código por mail |
| `verificar` | Comprueba el código: esperas de 1 a 5 minutos, "no soy un robot" desde el 5.º error, al 6.º borra el registro y bloquea el email 1 hora |
| `reenviar` | Manda un código nuevo (con "no soy un robot", mínimo 60 s entre envíos, no reinicia los errores) |
| `estado` | Devuelve si hay un código pendiente y cuánto falta de espera |
| `avisar_activacion` | Solo administradores: manda al cliente el mail de "cuenta activa" con su usuario y email |
| `ingresar` | Ingreso con **usuario** en vez de email: busca el email en el servidor (nunca lo muestra), inicia sesión y devuelve la sesión. 5 errores seguidos → espera de 15 minutos. Siempre dice "Usuario o contraseña incorrectos." |
| `crear_usuario` | Solo administradores: crea una cuenta ya activa (cliente con CUIT y lista, empleado, o admin si lo pide un superadministrador), controla que email, usuario y CUIT no existan y manda el mail "Te creamos una cuenta" con un enlace para elegir la contraseña (vence en 1 hora) |
| `recuperar` | "Olvidé mi contraseña": manda el mail de Lácteos NC con un enlace a `/admin/?recuperar=…` (vence en 1 hora). Siempre responde lo mismo, exista o no la cuenta |

**Secretos** (Supabase → Edge Functions → Secrets): `RESEND_API_KEY`, `MAIL_REMITENTE`, `TURNSTILE_SECRET` y, opcional, `MAIL_AVISOS`.
Sin ellos la función responde "todavía no está configurado" y no crea cuentas.

## Novedades para el bot (`eventos`)

Los guarda la base sola (disparadores), pase lo que pase en la web:

| `tipo` | Cuándo | `datos` |
|---|---|---|
| `cliente_para_activar` | un cliente verificó su email | usuario, nombre, apellido, email, CUIT |
| `cuenta_activada` / `cuenta_bloqueada` | un administrador activó o bloqueó una cuenta | lo mismo + rol, lista y estado anterior |
| `pedido_nuevo` | un cliente confirmó un pedido | número, total, observaciones, cliente y renglones (código, descripción, cantidad, precio) |
| `pedido_aceptado` / `pedido_retirado` / `pedido_cancelado` | un administrador aceptó o canceló el pedido, o se retiró | lo mismo + `por` (usuario que lo cambió) y, si se canceló, `motivo` |
| `pedido_armando` | (tipo viejo, ya no se genera: ahora es `pedido_aceptado`) | |

**Cómo lo usa el bot:**
1. Lee los pendientes: `GET /rest/v1/eventos?procesado=is.null&order=id` (o se suscribe en tiempo real con Supabase Realtime a los `INSERT` de `eventos`).
2. Hace su tarea (avisar por WhatsApp, Telegram, cargar en el sistema, etc.).
3. Los marca: `POST /rest/v1/rpc/marcar_eventos` con `{"p_ids": [1,2,3], "p_por": "bot"}`.

**Acceso:** el bot corre en un servidor y usa la clave **secret / service_role** de Supabase (Project Settings → API Keys). Esa clave **nunca** va en la página web ni en el repositorio: se guarda como variable de entorno del bot. Visitantes y clientes no pueden leer esta tabla; los administradores la ven en el panel → **Actividad**.
