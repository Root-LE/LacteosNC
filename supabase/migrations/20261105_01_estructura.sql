-- =====================================================================
-- Lácteos NC — Migración 01: estructura de la base
-- Tablas, tipos y disparadores de fecha de actualización.
-- =====================================================================

-- ---------- Tipos ----------
create type public.rol_usuario   as enum ('cliente', 'empleado', 'administrador');
create type public.estado_cuenta as enum ('pendiente_verificacion', 'pendiente_activacion', 'activa', 'bloqueada');
create type public.estado_pedido as enum ('en_espera', 'armando', 'retirado');
create type public.tipo_medio    as enum ('imagen', 'youtube', 'video');

-- ---------- Fecha de actualización automática ----------
create or replace function public.tocar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

-- ---------- Listas de precio ----------
create table public.listas_precio (
  id          smallint generated always as identity primary key,
  nombre      text not null unique check (length(nombre) between 2 and 60),
  descripcion text,
  activa      boolean not null default true,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
comment on table public.listas_precio is 'Listas de precio (ej.: Lista 1 precio sur, Lista 2 precio CABA). Cada cliente ve solo la suya.';

-- ---------- Perfiles de usuario (uno por cada usuario de Supabase Auth) ----------
create table public.perfiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  usuario           text unique check (usuario is null or usuario ~ '^[A-Za-z0-9._-]{3,30}$'),
  nombre            text check (nombre is null or length(nombre) <= 80),
  apellido          text check (apellido is null or length(apellido) <= 80),
  cuit              text unique check (cuit is null or cuit ~ '^[0-9]{11}$'),
  email             text not null,
  rol               public.rol_usuario   not null default 'cliente',
  estado            public.estado_cuenta not null default 'pendiente_verificacion',
  lista_precio_id   smallint references public.listas_precio (id) on delete set null,
  acepto_terminos   timestamptz,
  activado          timestamptz,
  activado_por      uuid references auth.users (id) on delete set null,
  creado            timestamptz not null default now(),
  actualizado       timestamptz not null default now()
);
comment on table  public.perfiles is 'Datos de cada usuario. El campo usuario lo completa el administrador al activar la cuenta.';
comment on column public.perfiles.cuit is 'CUIT sin guiones, 11 dígitos.';
create index perfiles_lista_idx  on public.perfiles (lista_precio_id);
create index perfiles_estado_idx on public.perfiles (estado);
create index perfiles_activado_por_idx on public.perfiles (activado_por);

-- ---------- Categorías de productos ----------
create table public.categorias (
  id          smallint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  nombre      text not null check (length(nombre) between 2 and 60),
  orden       smallint not null default 0,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

-- ---------- Productos ----------
create table public.productos (
  id            integer generated always as identity primary key,
  codigo        text not null unique check (length(codigo) between 1 and 30),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  nombre        text not null check (length(nombre) between 2 and 120),
  categoria_id  smallint references public.categorias (id) on delete set null,
  tipo          text check (tipo is null or length(tipo) <= 80),
  descripcion   text check (descripcion is null or length(descripcion) <= 1000),
  datos         jsonb not null default '[]'::jsonb check (jsonb_typeof(datos) = 'array'),
  imagen_url    text,
  imagen_sm_url text,
  foco          text not null default '50% 50%',
  nuevo         boolean not null default false,
  visible       boolean not null default true,
  orden         smallint not null default 0,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);
comment on column public.productos.datos is 'Lista de pares [etiqueta, valor], ej.: [["Maduración","8 meses"]].';
comment on column public.productos.foco  is 'object-position de la foto en la tarjeta, ej.: 40% 70%.';
create index productos_categoria_idx on public.productos (categoria_id);
create index productos_visible_idx   on public.productos (visible, orden);

-- ---------- Precios por lista ----------
create table public.precios (
  lista_id    smallint not null references public.listas_precio (id) on delete cascade,
  producto_id integer  not null references public.productos (id) on delete cascade,
  precio      numeric(12, 2) not null check (precio >= 0),
  actualizado timestamptz not null default now(),
  primary key (lista_id, producto_id)
);
create index precios_producto_idx on public.precios (producto_id);

-- ---------- Novedades ----------
create table public.novedades (
  id          integer generated always as identity primary key,
  titulo      text not null check (length(titulo) between 2 and 120),
  descripcion text check (descripcion is null or length(descripcion) <= 1000),
  datos       jsonb not null default '[]'::jsonb check (jsonb_typeof(datos) = 'array'),
  tipo_medio  public.tipo_medio not null default 'imagen',
  medio_url   text,
  producto_id integer references public.productos (id) on delete set null,
  destacada   boolean not null default false,
  visible     boolean not null default true,
  orden       smallint not null default 0,
  publicada   timestamptz not null default now(),
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
comment on column public.novedades.medio_url is 'URL de la imagen, del video de YouTube o del video propio (máx. 10 s y 5 MB).';
create index novedades_producto_idx on public.novedades (producto_id);
create index novedades_visible_idx  on public.novedades (visible, orden);

-- ---------- Pedidos ----------
create table public.pedidos (
  numero          integer generated always as identity (start with 1001) primary key,
  cliente_id      uuid not null references public.perfiles (id) on delete restrict,
  lista_precio_id smallint references public.listas_precio (id) on delete set null,
  estado          public.estado_pedido not null default 'en_espera',
  observaciones   text check (observaciones is null or length(observaciones) <= 500),
  total           numeric(14, 2) not null default 0,
  abierto         timestamptz,
  abierto_por     uuid references auth.users (id) on delete set null,
  retirado        timestamptz,
  retirado_por    uuid references auth.users (id) on delete set null,
  creado          timestamptz not null default now(),
  actualizado     timestamptz not null default now()
);
comment on table public.pedidos is 'Pedidos de clientes. Numeración desde 1001. Estados: en espera → armando → retirado.';
create index pedidos_cliente_idx on public.pedidos (cliente_id, creado desc);
create index pedidos_estado_idx  on public.pedidos (estado, creado desc);
create index pedidos_lista_idx   on public.pedidos (lista_precio_id);
create index pedidos_abierto_por_idx  on public.pedidos (abierto_por);
create index pedidos_retirado_por_idx on public.pedidos (retirado_por);

create table public.pedido_items (
  id              bigint generated always as identity primary key,
  pedido_numero   integer not null references public.pedidos (numero) on delete cascade,
  producto_id     integer references public.productos (id) on delete set null,
  codigo          text not null,
  descripcion     text not null,
  cantidad        numeric(10, 2) not null check (cantidad > 0),
  precio_unitario numeric(12, 2),
  subtotal        numeric(14, 2) generated always as (cantidad * coalesce(precio_unitario, 0)) stored
);
comment on table public.pedido_items is 'Renglones del pedido. Código, descripción y precio se copian al crearlo para que no cambien después.';
create index pedido_items_pedido_idx   on public.pedido_items (pedido_numero);
create index pedido_items_producto_idx on public.pedido_items (producto_id);

-- ---------- Mensajes del formulario de contacto ----------
create table public.mensajes_contacto (
  id       bigint generated always as identity primary key,
  nombre   text not null check (length(nombre) between 2 and 120),
  email    text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  telefono text check (telefono is null or length(telefono) <= 40),
  motivo   text check (motivo is null or length(motivo) <= 80),
  mensaje  text not null check (length(mensaje) between 5 and 3000),
  leido    boolean not null default false,
  creado   timestamptz not null default now()
);

-- ---------- Disparadores de "actualizado" ----------
create trigger listas_precio_actualizado before update on public.listas_precio for each row execute function public.tocar_actualizado();
create trigger perfiles_actualizado      before update on public.perfiles      for each row execute function public.tocar_actualizado();
create trigger categorias_actualizado    before update on public.categorias    for each row execute function public.tocar_actualizado();
create trigger productos_actualizado     before update on public.productos     for each row execute function public.tocar_actualizado();
create trigger precios_actualizado       before update on public.precios       for each row execute function public.tocar_actualizado();
create trigger novedades_actualizado     before update on public.novedades     for each row execute function public.tocar_actualizado();
create trigger pedidos_actualizado       before update on public.pedidos       for each row execute function public.tocar_actualizado();

-- ---------- Activar RLS en todas las tablas (las reglas van en la migración 02) ----------
alter table public.listas_precio     enable row level security;
alter table public.perfiles          enable row level security;
alter table public.categorias        enable row level security;
alter table public.productos         enable row level security;
alter table public.precios           enable row level security;
alter table public.novedades         enable row level security;
alter table public.pedidos           enable row level security;
alter table public.pedido_items      enable row level security;
alter table public.mensajes_contacto enable row level security;
