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
| `pedidos` | Número (desde 1001), cliente, lista, estado, observaciones, total, quién lo abrió y retiró |
| `pedido_items` | Renglones: artículo, código, descripción, cantidad, precio unitario y subtotal (copiados al crear el pedido) |
| `mensajes_contacto` | Mensajes del formulario de contacto |

## Roles y permisos

| Quién | Qué puede hacer |
|---|---|
| **Visitante** (sin sesión) | Ver categorías, productos y novedades visibles. Enviar un mensaje de contacto. |
| **Cliente** (cuenta activa) | Lo anterior + ver los artículos activos con **solo su lista de precios**, crear pedidos y ver **solo sus pedidos**. |
| **Empleado** | Ver todos los pedidos, abrirlos (pasan a *armando pedido*) y marcarlos como *pedido retirado*. |
| **Administrador** | Todo lo anterior + cargar productos, precios, listas, novedades y archivos; activar cuentas de clientes y empleados. No puede crear administradores ni modificar a un superadministrador. |
| **Superadministrador** | Acceso absoluto: todo lo del administrador y además asigna o quita los roles administrador y superadministrador. Es el único que puede modificar a otro superadministrador. |

Una cuenta que no está **activa** (pendiente de verificación, pendiente de activación o bloqueada)
no ve precios ni puede pedir, aunque tenga sesión iniciada.

Estados de una cuenta: `pendiente_verificacion` → (verifica el mail) → `pendiente_activacion` →
(el administrador asigna usuario y lista) → `activa`. También puede quedar `bloqueada`.

Estados de un pedido: `en_espera` → (un empleado lo abre) → `armando` → `retirado`.

## Funciones que llama el sitio

| Función | Quién | Qué hace |
|---|---|---|
| `crear_pedido(p_items, p_observaciones)` | Cliente activo | Crea el pedido con los precios de su lista. `p_items` = `[{"articulo_id":1,"cantidad":2}]`. Devuelve número y detalle. |
| `detalle_pedido(p_numero)` | Dueño o personal | Devuelve el pedido con cliente y renglones. |
| `abrir_pedido(p_numero)` | Empleado / admin | Si estaba *en espera* pasa a *armando* y devuelve el detalle. |
| `marcar_retirado(p_numero)` | Empleado / admin | Pasa de *armando* a *retirado*. |
| `activar_cuenta(p_perfil_id, p_usuario, p_lista_id, p_rol)` | Administrador | Asigna usuario, lista y rol, y activa la cuenta. |

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

Cuando el panel esté listo, el superadministrador podrá hacerlo desde ahí.
