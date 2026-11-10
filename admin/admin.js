/* =====================================================================
   Lácteos NC — panel de administración
   Usa Supabase (Auth + base + Storage). Los permisos reales los controla
   la base (RLS); este archivo solo arma las pantallas.
   ===================================================================== */
(() => {
  "use strict";

  const sb = window.supabase.createClient(window.NC_CONFIG.supabaseUrl, window.NC_CONFIG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const ROLES = { cliente: "Cliente", empleado: "Empleado", administrador: "Administrador", superadmin: "Superadministrador" };
  const ESTADOS = {
    pendiente_verificacion: ["Sin verificar mail", "chip--gris"],
    pendiente_activacion: ["Pendiente de activación", "chip--ambar"],
    activa: ["Activa", "chip--verde"],
    bloqueada: ["Bloqueada", "chip--rojo"]
  };
  const MAX_ARCHIVO = 5 * 1024 * 1024; // 5 MB
  const MAX_VIDEO_SEG = 10;

  const $ = s => document.querySelector(s);
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const contenido = $("#contenido");
  let perfil = null;
  const esSuper = () => perfil?.rol === "superadmin";

  /* ---------- Avisos ---------- */
  let avisoTimer;
  const avisar = (texto, error = false) => {
    const a = $("#aviso");
    a.textContent = texto;
    a.classList.toggle("error-aviso", error);
    a.classList.add("ver");
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => a.classList.remove("ver"), error ? 6000 : 3000);
  };

  // Traduce los errores más comunes a algo entendible
  const mensajeError = err => {
    const m = String(err?.message || err || "");
    if (/Invalid login credentials/i.test(m)) return "Email, usuario o contraseña incorrectos.";
    if (/Email not confirmed/i.test(m)) return "Ese email todavía no está confirmado.";
    if (/duplicate key.*codigo/i.test(m)) return "Ya existe un artículo con ese código.";
    if (/duplicate key.*slug/i.test(m)) return "Ya existe un producto con ese nombre. Cambiá el nombre.";
    if (/duplicate key.*usuario/i.test(m)) return "Ese nombre de usuario ya está en uso.";
    if (/duplicate key.*nombre/i.test(m)) return "Ya existe una lista con ese nombre.";
    if (/row-level security|permission denied|42501/i.test(m)) return "No tenés permiso para hacer esto.";
    if (/Payload too large|exceeded the maximum/i.test(m)) return "El archivo supera los 5 MB.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "No hay conexión con el servidor. Probá de nuevo.";
    return m || "Ocurrió un error inesperado.";
  };

  /* ---------- Ventana de edición ---------- */
  const ventana = $("#ventana");
  const abrirVentana = ({ titulo, cuerpo, onGuardar, onBorrar, textoGuardar = "Guardar" }) => {
    $("#ventana-titulo").textContent = titulo;
    $("#ventana-cuerpo").innerHTML = cuerpo;
    const err = $("#ventana-error");
    err.hidden = true;
    const pie = $("#ventana-pie");
    pie.innerHTML = `${onBorrar ? '<button type="button" class="btn btn--peligro" id="v-borrar">Eliminar</button>' : ""}
      <div class="derecha"><button type="button" class="btn btn--linea" id="v-cancelar">Cancelar</button>
      <button type="submit" class="btn btn--rojo" id="v-guardar">${esc(textoGuardar)}</button></div>`;
    $("#v-cancelar").onclick = () => ventana.close();
    $("#ventana-form").onsubmit = async e => {
      e.preventDefault();
      const btn = $("#v-guardar");
      btn.disabled = true; err.hidden = true;
      try {
        await onGuardar();
        ventana.close();
      } catch (ex) {
        err.textContent = mensajeError(ex);
        err.hidden = false;
      } finally { btn.disabled = false; }
    };
    if (onBorrar) $("#v-borrar").onclick = async () => {
      if (!confirm("¿Seguro que querés eliminarlo? No se puede deshacer.")) return;
      try { await onBorrar(); ventana.close(); }
      catch (ex) { err.textContent = mensajeError(ex); err.hidden = false; }
    };
    ventana.showModal();
    ventana.querySelector("input, select, textarea")?.focus();
  };
  $("#ventana-cerrar").onclick = () => ventana.close();

  /* ---------- Utilidades de datos ---------- */
  const q = async promesa => {
    const { data, error } = await promesa;
    if (error) throw error;
    return data;
  };
  const slugDe = t => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "producto";

  const opciones = (lista, valor, vacio) =>
    (vacio !== undefined ? `<option value="">${esc(vacio)}</option>` : "") +
    lista.map(o => `<option value="${esc(o.value)}"${String(o.value) === String(valor ?? "") ? " selected" : ""}>${esc(o.text)}</option>`).join("");

  // Editor de "datos" (pares etiqueta / valor)
  const editorDatos = datos => `
    <label>Datos que se muestran en la ficha</label>
    <div class="datos-editor" id="datos-editor">
      ${(datos?.length ? datos : [["", ""]]).map(([k, v]) => filaDato(k, v)).join("")}
    </div>
    <button type="button" class="enlace" id="dato-agregar">+ Agregar dato</button>
    <p class="ayuda">Ejemplo: "Maduración" / "8 meses".</p>`;
  const filaDato = (k = "", v = "") => `<div class="par">
      <input placeholder="Etiqueta" value="${esc(k)}" maxlength="40">
      <input placeholder="Valor" value="${esc(v)}" maxlength="60">
      <button type="button" class="btn btn--linea btn--chico" data-quitar-dato aria-label="Quitar dato">✕</button></div>`;
  const activarEditorDatos = () => {
    const caja = $("#datos-editor");
    $("#dato-agregar").onclick = () => caja.insertAdjacentHTML("beforeend", filaDato());
    caja.onclick = e => { if (e.target.matches("[data-quitar-dato]")) e.target.closest(".par").remove(); };
  };
  const leerDatos = () => [...document.querySelectorAll("#datos-editor .par")]
    .map(p => [...p.querySelectorAll("input")].map(i => i.value.trim()))
    .filter(([k, v]) => k && v);

  /* ---------- Archivos: fotos y videos ---------- */
  const redimensionar = (archivo, max) => new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const esc_ = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * esc_); c.height = Math.round(img.height * esc_);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? ok(b) : mal(new Error("No se pudo procesar la imagen.")), "image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => mal(new Error("El archivo no es una imagen válida."));
    img.src = URL.createObjectURL(archivo);
  });

  const subir = async (bucket, ruta, blob, tipo) => {
    await q(sb.storage.from(bucket).upload(ruta, blob, { contentType: tipo, upsert: false, cacheControl: "31536000" }));
    return sb.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
  };

  // Sube una foto en dos tamaños (grande 1400 px y chica 720 px)
  const subirFoto = async (bucket, base, archivo) => {
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error("La foto tiene que ser JPG, PNG o WebP.");
    const sello = Date.now();
    const [grande, chica] = await Promise.all([redimensionar(archivo, 1400), redimensionar(archivo, 720)]);
    if (grande.size > MAX_ARCHIVO) throw new Error("La foto procesada supera los 5 MB.");
    const [urlGrande, urlChica] = await Promise.all([
      subir(bucket, `${base}-${sello}.jpg`, grande, "image/jpeg"),
      subir(bucket, `${base}-${sello}-sm.jpg`, chica, "image/jpeg")
    ]);
    return { grande: urlGrande, chica: urlChica };
  };

  const duracionVideo = archivo => new Promise((ok, mal) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); ok(v.duration); };
    v.onerror = () => mal(new Error("No se pudo leer el video."));
    v.src = URL.createObjectURL(archivo);
  });

  // Borra un archivo viejo del Storage si es nuestro (no falla si no puede)
  const borrarArchivo = async url => {
    const m = String(url || "").match(/\/storage\/v1\/object\/public\/(productos|novedades)\/(.+)$/);
    if (m) await sb.storage.from(m[1]).remove([decodeURIComponent(m[2])]).catch(() => {});
  };

  const idYoutube = url => (String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/) || [])[1] || null;
  const fotoDe = u => (u && /^(https:\/\/|\/)/.test(u)) ? u : "/img/sin-foto.jpg";

  // Mail al cliente avisando que su cuenta está activa (función del servidor "cuentas")
  const avisarActivacion = async perfilId => {
    const { data } = await sb.auth.getSession();
    const r = await fetch(`${window.NC_CONFIG.supabaseUrl}/functions/v1/cuentas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: window.NC_CONFIG.supabaseKey, Authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify({ accion: "avisar_activacion", perfil_id: perfilId })
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Error del servidor.");
  };

  /* =====================================================================
     SECCIONES
     ===================================================================== */
  const cache = { categorias: [], productos: [], listas: [] };
  const cargarCategorias = async () => (cache.categorias = await q(sb.from("categorias").select("id, slug, nombre").order("orden")));
  const cargarProductosLista = async () => (cache.productos = await q(sb.from("productos").select("id, nombre").order("orden")));
  const cargarListas = async () => (cache.listas = await q(sb.from("listas_precio").select("id, nombre, descripcion, activa").order("id")));

  const cabecera = (titulo, texto, boton) => `<div class="cabecera"><div><h1>${esc(titulo)}</h1>${texto ? `<p>${texto}</p>` : ""}</div>${boton || ""}</div>`;

  /* ---------- Productos de la web (tarjetas) ---------- */
  const seccionProductos = async () => {
    const [prods] = await Promise.all([
      q(sb.from("productos").select("id, slug, nombre, tipo, descripcion, datos, imagen_url, imagen_sm_url, foco, nuevo, visible, orden, categoria_id, categorias(nombre), articulos(count)").order("orden")),
      cargarCategorias()
    ]);
    contenido.innerHTML = cabecera("Productos de la web",
      "Son las tarjetas con foto que se ven en la sección Productos. Una tarjeta oculta no aparece en la web.",
      `<button class="btn btn--rojo" id="nuevo-prod">+ Nuevo producto</button>`) + `
      <div class="tabla-caja"><table>
        <thead><tr><th>Foto</th><th>Nombre</th><th>Categoría</th><th class="num">Artículos</th><th>Estado</th><th class="num">Orden</th><th></th></tr></thead>
        <tbody>${prods.map(p => `<tr>
          <td><img class="mini" src="${esc(fotoDe(p.imagen_sm_url))}" alt="" loading="lazy"></td>
          <td><strong>${esc(p.nombre)}</strong>${p.nuevo ? ' <span class="chip">Nuevo</span>' : ""}<br><small>${esc(p.tipo || "")}</small></td>
          <td>${esc(p.categorias?.nombre || "—")}</td>
          <td class="num">${p.articulos?.[0]?.count ?? 0}</td>
          <td>${p.visible ? '<span class="chip chip--verde">Visible</span>' : '<span class="chip chip--gris">Oculto</span>'}${!p.imagen_url ? ' <span class="chip chip--ambar">Sin foto</span>' : ""}</td>
          <td class="num">${p.orden}</td>
          <td class="acciones"><button class="btn btn--linea btn--chico" data-editar="${p.id}">Editar</button></td>
        </tr>`).join("")}</tbody></table></div>`;
    $("#nuevo-prod").onclick = () => editarProducto(null);
    contenido.querySelectorAll("[data-editar]").forEach(b =>
      b.onclick = () => editarProducto(prods.find(p => p.id === Number(b.dataset.editar))));
  };

  const editarProducto = p => {
    const nuevo = !p;
    p = p || { nombre: "", tipo: "", descripcion: "", datos: [], foco: "50% 50%", nuevo: false, visible: false, orden: 99, categoria_id: cache.categorias[0]?.id };
    abrirVentana({
      titulo: nuevo ? "Nuevo producto" : `Editar: ${p.nombre}`,
      cuerpo: `
        <label for="p-nombre">Nombre</label>
        <input id="p-nombre" required maxlength="120" value="${esc(p.nombre)}">
        <div class="fila2">
          <div><label for="p-cat">Categoría (filtro de la web)</label>
            <select id="p-cat">${opciones(cache.categorias.map(c => ({ value: c.id, text: c.nombre })), p.categoria_id)}</select></div>
          <div><label for="p-tipo">Tipo (texto debajo del nombre)</label>
            <input id="p-tipo" maxlength="80" value="${esc(p.tipo)}" placeholder="Ej.: Queso duro"></div>
        </div>
        <label for="p-desc">Descripción</label>
        <textarea id="p-desc" rows="3" maxlength="1000">${esc(p.descripcion)}</textarea>
        ${editorDatos(p.datos)}
        <label for="p-foto">Foto ${p.imagen_url ? "(elegí otra para reemplazarla)" : ""}</label>
        <input id="p-foto" type="file" accept="image/jpeg,image/png,image/webp">
        <p class="ayuda">JPG, PNG o WebP. Se achica sola a 1400 px y se genera la versión chica.</p>
        <div class="foto-previa"><img id="p-previa" src="${esc(fotoDe(p.imagen_sm_url))}" alt="Vista previa"></div>
        <div class="fila2">
          <div><label for="p-foco">Encuadre de la foto en la tarjeta</label>
            <select id="p-foco">${opciones([
              { value: "50% 50%", text: "Centro" }, { value: "50% 25%", text: "Arriba" }, { value: "50% 75%", text: "Abajo" },
              { value: "30% 50%", text: "Izquierda" }, { value: "70% 50%", text: "Derecha" }
            ].concat(["50% 50%", "50% 25%", "50% 75%", "30% 50%", "70% 50%"].includes(p.foco) ? [] : [{ value: p.foco, text: `Actual (${p.foco})` }]), p.foco)}</select></div>
          <div><label for="p-orden">Orden en la web</label>
            <input id="p-orden" type="number" min="0" max="999" value="${p.orden}"></div>
        </div>
        <label class="check"><input type="checkbox" id="p-nuevo"${p.nuevo ? " checked" : ""}> Mostrar etiqueta "Nuevo"</label>
        <label class="check"><input type="checkbox" id="p-visible"${p.visible ? " checked" : ""}> Visible en la web</label>`,
      onGuardar: async () => {
        const nombre = $("#p-nombre").value.trim();
        if (nombre.length < 2) throw new Error("Escribí el nombre del producto.");
        const visible = $("#p-visible").checked;
        const archivo = $("#p-foto").files[0];
        if (visible && !archivo && !p.imagen_url) throw new Error("Para que sea visible en la web necesita una foto.");
        const fila = {
          nombre, categoria_id: Number($("#p-cat").value) || null, tipo: $("#p-tipo").value.trim() || null,
          descripcion: $("#p-desc").value.trim() || null, datos: leerDatos(), foco: $("#p-foco").value,
          nuevo: $("#p-nuevo").checked, visible, orden: Number($("#p-orden").value) || 0
        };
        if (nuevo) fila.slug = slugDe(nombre);
        if (archivo) {
          const urls = await subirFoto("productos", p.slug || fila.slug, archivo);
          fila.imagen_url = urls.grande; fila.imagen_sm_url = urls.chica;
        }
        if (nuevo) await q(sb.from("productos").insert(fila));
        else await q(sb.from("productos").update(fila).eq("id", p.id));
        if (archivo && !nuevo) { borrarArchivo(p.imagen_url); borrarArchivo(p.imagen_sm_url); }
        avisar("Producto guardado.");
        seccionProductos();
      },
      onBorrar: nuevo ? null : async () => {
        await q(sb.from("productos").delete().eq("id", p.id));
        borrarArchivo(p.imagen_url); borrarArchivo(p.imagen_sm_url);
        avisar("Producto eliminado. Sus artículos quedaron sin tarjeta.");
        seccionProductos();
      }
    });
    activarEditorDatos();
    $("#p-foto").onchange = e => { const f = e.target.files[0]; if (f) $("#p-previa").src = URL.createObjectURL(f); };
  };

  /* ---------- Artículos ---------- */
  const seccionArticulos = async () => {
    const [arts] = await Promise.all([
      q(sb.from("articulos").select("id, codigo, descripcion, producto_id, activo, productos(nombre)").order("codigo")),
      cargarProductosLista()
    ]);
    contenido.innerHTML = cabecera("Artículos",
      "Son los códigos del sistema de la cooperativa. Tienen precio en cada lista y son los que piden los clientes. Un artículo inactivo no lo ven los clientes.",
      `<button class="btn btn--rojo" id="nuevo-art">+ Nuevo artículo</button>`) + `
      <div class="herramientas"><input type="search" id="art-buscar" placeholder="Buscar por código o descripción" aria-label="Buscar artículo">
        <span class="ayuda">${arts.length} artículos</span></div>
      <div class="tabla-caja"><table>
        <thead><tr><th>Código</th><th>Descripción</th><th>Producto de la web</th><th>Estado</th><th></th></tr></thead>
        <tbody id="art-cuerpo">${arts.map(a => `<tr data-texto="${esc((a.codigo + " " + a.descripcion).toLowerCase())}">
          <td><strong>${esc(a.codigo)}</strong></td><td>${esc(a.descripcion)}</td>
          <td>${esc(a.productos?.nombre || "—")}</td>
          <td>${a.activo ? '<span class="chip chip--verde">Activo</span>' : '<span class="chip chip--gris">Inactivo</span>'}</td>
          <td class="acciones"><button class="btn btn--linea btn--chico" data-editar="${a.id}">Editar</button></td></tr>`).join("")}</tbody>
      </table></div>`;
    $("#art-buscar").oninput = e => {
      const t = e.target.value.trim().toLowerCase();
      document.querySelectorAll("#art-cuerpo tr").forEach(tr => { tr.hidden = t && !tr.dataset.texto.includes(t); });
    };
    $("#nuevo-art").onclick = () => editarArticulo(null);
    contenido.querySelectorAll("[data-editar]").forEach(b =>
      b.onclick = () => editarArticulo(arts.find(a => a.id === Number(b.dataset.editar))));
  };

  const editarArticulo = a => {
    const nuevo = !a;
    a = a || { codigo: "", descripcion: "", producto_id: null, activo: true };
    abrirVentana({
      titulo: nuevo ? "Nuevo artículo" : `Editar artículo ${a.codigo}`,
      cuerpo: `
        <div class="fila2">
          <div><label for="a-cod">Código (del sistema)</label><input id="a-cod" required maxlength="30" value="${esc(a.codigo)}"></div>
          <div><label for="a-prod">Producto de la web</label>
            <select id="a-prod">${opciones(cache.productos.map(p => ({ value: p.id, text: p.nombre })), a.producto_id, "— Sin tarjeta —")}</select></div>
        </div>
        <label for="a-desc">Descripción</label><input id="a-desc" required maxlength="120" value="${esc(a.descripcion)}">
        <label class="check"><input type="checkbox" id="a-activo"${a.activo ? " checked" : ""}> Activo (lo ven y lo pueden pedir los clientes)</label>`,
      onGuardar: async () => {
        const fila = { codigo: $("#a-cod").value.trim(), descripcion: $("#a-desc").value.trim(),
          producto_id: Number($("#a-prod").value) || null, activo: $("#a-activo").checked };
        if (!fila.codigo) throw new Error("Escribí el código.");
        if (fila.descripcion.length < 2) throw new Error("Escribí la descripción.");
        if (nuevo) await q(sb.from("articulos").insert(fila));
        else await q(sb.from("articulos").update(fila).eq("id", a.id));
        avisar("Artículo guardado.");
        seccionArticulos();
      },
      onBorrar: nuevo ? null : async () => {
        await q(sb.from("articulos").delete().eq("id", a.id));
        avisar("Artículo eliminado.");
        seccionArticulos();
      }
    });
  };

  /* ---------- Novedades ---------- */
  const seccionNovedades = async () => {
    const [novs] = await Promise.all([
      q(sb.from("novedades").select("id, titulo, descripcion, datos, tipo_medio, medio_url, producto_id, destacada, visible, orden, productos(nombre)").order("orden")),
      cargarProductosLista()
    ]);
    const vista = n => n.tipo_medio === "youtube" ? `https://img.youtube.com/vi/${idYoutube(n.medio_url)}/mqdefault.jpg`
      : n.tipo_medio === "video" ? "/img/sin-foto.jpg" : fotoDe(n.medio_url);
    const tipoTxt = { imagen: "Foto", youtube: "YouTube", video: "Video" };
    contenido.innerHTML = cabecera("Novedades",
      "Se muestran en la sección Novedades de la web, en este orden. La primera, si está marcada como destacada, sale más grande.",
      `<button class="btn btn--rojo" id="nueva-nov">+ Nueva novedad</button>`) + `
      <div class="tabla-caja"><table>
        <thead><tr><th>Vista</th><th>Título</th><th>Tipo</th><th>Producto</th><th>Estado</th><th class="num">Orden</th><th></th></tr></thead>
        <tbody>${novs.length ? novs.map(n => `<tr>
          <td><img class="mini" src="${esc(vista(n))}" alt="" loading="lazy"></td>
          <td><strong>${esc(n.titulo)}</strong>${n.destacada ? ' <span class="chip">Destacada</span>' : ""}</td>
          <td>${tipoTxt[n.tipo_medio]}</td><td>${esc(n.productos?.nombre || "—")}</td>
          <td>${n.visible ? '<span class="chip chip--verde">Visible</span>' : '<span class="chip chip--gris">Oculta</span>'}</td>
          <td class="num">${n.orden}</td>
          <td class="acciones"><button class="btn btn--linea btn--chico" data-editar="${n.id}">Editar</button></td></tr>`).join("")
          : '<tr><td colspan="7" class="vacio">Todavía no hay novedades. Creá la primera con el botón de arriba.</td></tr>'}</tbody>
      </table></div>`;
    $("#nueva-nov").onclick = () => editarNovedad(null);
    contenido.querySelectorAll("[data-editar]").forEach(b =>
      b.onclick = () => editarNovedad(novs.find(n => n.id === Number(b.dataset.editar))));
  };

  const editarNovedad = n => {
    const nueva = !n;
    n = n || { titulo: "", descripcion: "", datos: [], tipo_medio: "imagen", medio_url: "", producto_id: null, destacada: false, visible: true, orden: 1 };
    abrirVentana({
      titulo: nueva ? "Nueva novedad" : `Editar: ${n.titulo}`,
      cuerpo: `
        <label for="n-tit">Título</label><input id="n-tit" required maxlength="120" value="${esc(n.titulo)}">
        <label for="n-desc">Descripción</label><textarea id="n-desc" rows="3" maxlength="1000">${esc(n.descripcion)}</textarea>
        ${editorDatos(n.datos)}
        <label>Tipo de contenido</label>
        <div class="opciones-medio">
          ${["imagen", "youtube", "video"].map(t => `<label><input type="radio" name="n-tipo" value="${t}"${n.tipo_medio === t ? " checked" : ""}>
            ${{ imagen: "Foto", youtube: "Enlace de YouTube", video: "Video propio (máx. 10 s y 5 MB)" }[t]}</label>`).join("")}
        </div>
        <div id="n-caja-archivo">
          <label for="n-archivo" id="n-archivo-label">Archivo</label>
          <input id="n-archivo" type="file">
          <p class="ayuda" id="n-archivo-ayuda"></p>
        </div>
        <div id="n-caja-yt"><label for="n-yt">Enlace de YouTube</label>
          <input id="n-yt" type="url" placeholder="https://www.youtube.com/watch?v=..." value="${n.tipo_medio === "youtube" ? esc(n.medio_url) : ""}">
          <p class="ayuda">Podés subir el video a YouTube como "No listado" y pegar el enlace acá.</p></div>
        <div class="foto-previa" id="n-previa"></div>
        <div class="fila2">
          <div><label for="n-prod">Producto relacionado (opcional)</label>
            <select id="n-prod">${opciones(cache.productos.map(p => ({ value: p.id, text: p.nombre })), n.producto_id, "— Ninguno —")}</select></div>
          <div><label for="n-orden">Orden</label><input id="n-orden" type="number" min="0" max="999" value="${n.orden}"></div>
        </div>
        <label class="check"><input type="checkbox" id="n-dest"${n.destacada ? " checked" : ""}> Destacada (se muestra más grande si va primera)</label>
        <label class="check"><input type="checkbox" id="n-vis"${n.visible ? " checked" : ""}> Visible en la web</label>`,
      onGuardar: async () => {
        const titulo = $("#n-tit").value.trim();
        if (titulo.length < 2) throw new Error("Escribí el título.");
        const tipo = document.querySelector('input[name="n-tipo"]:checked').value;
        const archivo = $("#n-archivo").files[0];
        let medio_url = n.tipo_medio === tipo ? n.medio_url : "";
        const base = `${slugDe(titulo)}`;
        if (tipo === "youtube") {
          const url = $("#n-yt").value.trim();
          if (!idYoutube(url)) throw new Error("El enlace de YouTube no es válido.");
          medio_url = url;
        } else if (tipo === "imagen" && archivo) {
          medio_url = (await subirFoto("novedades", base, archivo)).grande;
        } else if (tipo === "video" && archivo) {
          if (!/^video\/(mp4|webm)$/.test(archivo.type)) throw new Error("El video tiene que ser MP4 o WebM.");
          if (archivo.size > MAX_ARCHIVO) throw new Error(`El video pesa ${(archivo.size / 1048576).toFixed(1)} MB y el máximo es 5 MB.`);
          const seg = await duracionVideo(archivo);
          if (seg > MAX_VIDEO_SEG + 0.5) throw new Error(`El video dura ${Math.round(seg)} segundos y el máximo es ${MAX_VIDEO_SEG}.`);
          medio_url = await subir("novedades", `${base}-${Date.now()}.${archivo.type === "video/webm" ? "webm" : "mp4"}`, archivo, archivo.type);
        }
        if (!medio_url) throw new Error(tipo === "imagen" ? "Elegí una foto." : "Elegí un video.");
        const fila = { titulo, descripcion: $("#n-desc").value.trim() || null, datos: leerDatos(), tipo_medio: tipo, medio_url,
          producto_id: Number($("#n-prod").value) || null, destacada: $("#n-dest").checked, visible: $("#n-vis").checked,
          orden: Number($("#n-orden").value) || 0 };
        if (nueva) await q(sb.from("novedades").insert(fila));
        else await q(sb.from("novedades").update(fila).eq("id", n.id));
        if (!nueva && n.medio_url !== medio_url) borrarArchivo(n.medio_url);
        avisar("Novedad guardada.");
        seccionNovedades();
      },
      onBorrar: nueva ? null : async () => {
        await q(sb.from("novedades").delete().eq("id", n.id));
        borrarArchivo(n.medio_url);
        avisar("Novedad eliminada.");
        seccionNovedades();
      }
    });
    activarEditorDatos();

    const previa = $("#n-previa");
    const mostrarPrevia = () => {
      const tipo = document.querySelector('input[name="n-tipo"]:checked').value;
      const f = $("#n-archivo").files[0];
      if (tipo === "youtube") {
        const id = idYoutube($("#n-yt").value);
        previa.innerHTML = id ? `<img src="https://img.youtube.com/vi/${id}/mqdefault.jpg" alt="Vista previa del video">` : "";
      } else if (f) {
        const u = URL.createObjectURL(f);
        previa.innerHTML = tipo === "video" ? `<video src="${u}" muted autoplay loop playsinline></video>` : `<img src="${u}" alt="Vista previa">`;
      } else if (n.tipo_medio === tipo && n.medio_url) {
        previa.innerHTML = tipo === "video" ? `<video src="${esc(n.medio_url)}" muted autoplay loop playsinline></video>` : `<img src="${esc(fotoDe(n.medio_url))}" alt="Actual">`;
      } else previa.innerHTML = "";
    };
    const ajustarTipo = () => {
      const tipo = document.querySelector('input[name="n-tipo"]:checked').value;
      $("#n-caja-yt").hidden = tipo !== "youtube";
      $("#n-caja-archivo").hidden = tipo === "youtube";
      const inp = $("#n-archivo");
      inp.value = "";
      inp.accept = tipo === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp";
      $("#n-archivo-label").textContent = tipo === "video" ? "Video (MP4 o WebM)" : "Foto";
      $("#n-archivo-ayuda").textContent = tipo === "video"
        ? "Máximo 10 segundos y 5 MB. Se reproduce sin sonido y en bucle."
        : "JPG, PNG o WebP. Se achica sola.";
      mostrarPrevia();
    };
    document.querySelectorAll('input[name="n-tipo"]').forEach(r => r.onchange = ajustarTipo);
    $("#n-archivo").onchange = mostrarPrevia;
    $("#n-yt").oninput = mostrarPrevia;
    ajustarTipo();
  };

  /* ---------- Listas de precio ---------- */
  const seccionListas = async () => {
    const listas = await cargarListas();
    contenido.innerHTML = cabecera("Listas de precio",
      "Cada cliente tiene asignada una lista y solo ve esos precios.",
      `<button class="btn btn--rojo" id="nueva-lista">+ Nueva lista</button>`) + `
      <div class="tabla-caja"><table>
        <thead><tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th></th></tr></thead>
        <tbody>${listas.map(l => `<tr><td><strong>${esc(l.nombre)}</strong></td><td>${esc(l.descripcion || "")}</td>
          <td>${l.activa ? '<span class="chip chip--verde">Activa</span>' : '<span class="chip chip--gris">Inactiva</span>'}</td>
          <td class="acciones"><button class="btn btn--linea btn--chico" data-editar="${l.id}">Editar</button></td></tr>`).join("")}</tbody>
      </table></div>`;
    $("#nueva-lista").onclick = () => editarLista(null);
    contenido.querySelectorAll("[data-editar]").forEach(b =>
      b.onclick = () => editarLista(listas.find(l => l.id === Number(b.dataset.editar))));
  };

  const editarLista = l => {
    const nueva = !l;
    l = l || { nombre: "", descripcion: "", activa: true };
    abrirVentana({
      titulo: nueva ? "Nueva lista de precio" : `Editar: ${l.nombre}`,
      cuerpo: `<label for="l-nom">Nombre</label><input id="l-nom" required maxlength="60" value="${esc(l.nombre)}" placeholder="Ej.: Lista 4">
        <label for="l-desc">Descripción</label><input id="l-desc" maxlength="120" value="${esc(l.descripcion || "")}" placeholder="Ej.: Precio Patagonia">
        <label class="check"><input type="checkbox" id="l-act"${l.activa ? " checked" : ""}> Activa</label>`,
      onGuardar: async () => {
        const fila = { nombre: $("#l-nom").value.trim(), descripcion: $("#l-desc").value.trim() || null, activa: $("#l-act").checked };
        if (fila.nombre.length < 2) throw new Error("Escribí el nombre de la lista.");
        if (nueva) await q(sb.from("listas_precio").insert(fila));
        else await q(sb.from("listas_precio").update(fila).eq("id", l.id));
        avisar("Lista guardada.");
        seccionListas();
      },
      onBorrar: nueva ? null : async () => {
        await q(sb.from("listas_precio").delete().eq("id", l.id));
        avisar("Lista eliminada. Los clientes que la tenían quedaron sin lista.");
        seccionListas();
      }
    });
  };

  /* ---------- Precios ---------- */
  let listaElegida = null;
  const seccionPrecios = async () => {
    const listas = await cargarListas();
    if (!listas.length) { contenido.innerHTML = cabecera("Precios") + '<p class="vacio">Primero creá una lista de precio.</p>'; return; }
    if (!listas.some(l => l.id === listaElegida)) listaElegida = listas[0].id;
    const [arts, precios] = await Promise.all([
      q(sb.from("articulos").select("id, codigo, descripcion, activo").order("codigo")),
      q(sb.from("precios").select("articulo_id, precio").eq("lista_id", listaElegida))
    ]);
    const mapa = new Map(precios.map(p => [p.articulo_id, p.precio]));
    contenido.innerHTML = cabecera("Precios",
      "Elegí la lista, escribí los precios y tocá <strong>Guardar cambios</strong>. Dejá vacío un precio para quitarlo de la lista.",
      `<button class="btn btn--rojo" id="guardar-precios">Guardar cambios</button>`) + `
      <div class="herramientas">
        <select id="pr-lista" aria-label="Lista de precio">${opciones(listas.map(l => ({ value: l.id, text: `${l.nombre}${l.descripcion ? " — " + l.descripcion : ""}` })), listaElegida)}</select>
        <input type="search" id="pr-buscar" placeholder="Buscar por código o descripción" aria-label="Buscar artículo">
        <button class="btn btn--linea" id="pr-pegar">Pegar desde Excel</button>
        <span class="ayuda" id="pr-estado"></span>
      </div>
      <div class="tabla-caja"><table>
        <thead><tr><th>Código</th><th>Descripción</th><th class="num">Precio ($)</th></tr></thead>
        <tbody id="pr-cuerpo">${arts.map(a => `<tr data-id="${a.id}" data-codigo="${esc(a.codigo)}" data-texto="${esc((a.codigo + " " + a.descripcion).toLowerCase())}">
          <td><strong>${esc(a.codigo)}</strong></td>
          <td>${esc(a.descripcion)}${a.activo ? "" : ' <span class="chip chip--gris">Inactivo</span>'}</td>
          <td class="num"><input class="precio" inputmode="decimal" aria-label="Precio de ${esc(a.descripcion)}"
            value="${mapa.has(a.id) ? Number(mapa.get(a.id)).toFixed(2) : ""}" data-original="${mapa.has(a.id) ? Number(mapa.get(a.id)).toFixed(2) : ""}"></td>
        </tr>`).join("")}</tbody></table></div>`;

    const cuerpo = $("#pr-cuerpo");
    const contar = () => {
      const n = cuerpo.querySelectorAll("tr.cambiado").length;
      $("#pr-estado").textContent = n ? `${n} cambio${n > 1 ? "s" : ""} sin guardar` : `${mapa.size} de ${arts.length} artículos con precio`;
    };
    const normalizar = v => {
      const t = String(v).trim().replace(/\$/g, "").replace(/\s/g, "");
      if (!t) return "";
      // Acepta 1.234,56 · 1234,56 · 1234.56
      const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, ""));
      return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
    };
    const marcar = inp => {
      const tr = inp.closest("tr");
      const v = normalizar(inp.value);
      tr.classList.toggle("cambiado", v !== null && v !== inp.dataset.original);
      inp.setCustomValidity(v === null ? "Precio inválido" : "");
      contar();
    };
    cuerpo.oninput = e => { if (e.target.matches("input.precio")) marcar(e.target); };
    cuerpo.addEventListener("blur", e => {
      if (e.target.matches("input.precio")) { const v = normalizar(e.target.value); if (v !== null) e.target.value = v; }
    }, true);
    contar();

    $("#pr-lista").onchange = e => {
      if (cuerpo.querySelector("tr.cambiado") && !confirm("Hay cambios sin guardar. ¿Cambiar de lista igual?")) { e.target.value = listaElegida; return; }
      listaElegida = Number(e.target.value); seccionPrecios();
    };
    $("#pr-buscar").oninput = e => {
      const t = e.target.value.trim().toLowerCase();
      cuerpo.querySelectorAll("tr").forEach(tr => { tr.hidden = t && !tr.dataset.texto.includes(t); });
    };
    $("#pr-pegar").onclick = () => abrirVentana({
      titulo: "Pegar precios desde Excel",
      textoGuardar: "Cargar en la tabla",
      cuerpo: `<p>Copiá en Excel dos columnas, <strong>código</strong> y <strong>precio</strong>, y pegalas acá. Después revisá y tocá "Guardar cambios".</p>
        <label for="pegado">Datos</label><textarea id="pegado" rows="10" placeholder="31562&#9;12500,50&#10;31563&#9;13200"></textarea>`,
      onGuardar: async () => {
        const filas = $("#pegado").value.split(/\r?\n/).map(l => l.split(/\t|;/)).filter(c => c.length >= 2 && c[0].trim());
        let ok = 0; const faltan = [];
        filas.forEach(([cod, precio]) => {
          const tr = cuerpo.querySelector(`tr[data-codigo="${CSS.escape(cod.trim())}"]`);
          const v = normalizar(precio);
          if (!tr || v === null) { faltan.push(cod.trim()); return; }
          const inp = tr.querySelector("input.precio"); inp.value = v; marcar(inp); ok++;
        });
        if (!ok) throw new Error("No se reconoció ningún código. Revisá que la primera columna sea el código.");
        avisar(`Se cargaron ${ok} precios.${faltan.length ? ` No se encontraron: ${faltan.slice(0, 8).join(", ")}${faltan.length > 8 ? "…" : ""}` : ""}`, faltan.length > 0);
      }
    });
    $("#guardar-precios").onclick = async e => {
      const cambiadas = [...cuerpo.querySelectorAll("tr.cambiado")];
      if (!cambiadas.length) { avisar("No hay cambios para guardar."); return; }
      const upserts = [], borrar = [];
      cambiadas.forEach(tr => {
        const v = normalizar(tr.querySelector("input.precio").value);
        if (v === "") borrar.push(Number(tr.dataset.id));
        else if (v !== null) upserts.push({ lista_id: listaElegida, articulo_id: Number(tr.dataset.id), precio: Number(v) });
      });
      e.target.disabled = true;
      try {
        if (upserts.length) await q(sb.from("precios").upsert(upserts, { onConflict: "lista_id,articulo_id" }));
        if (borrar.length) await q(sb.from("precios").delete().eq("lista_id", listaElegida).in("articulo_id", borrar));
        avisar(`Precios guardados (${upserts.length + borrar.length}).`);
        seccionPrecios();
      } catch (ex) { avisar(mensajeError(ex), true); }
      finally { e.target.disabled = false; }
    };
  };

  /* ---------- Cuentas ---------- */
  let filtroCuentas = "pendiente_activacion";
  const seccionCuentas = async () => {
    const [cuentas] = await Promise.all([
      q(sb.from("perfiles").select("id, usuario, nombre, apellido, email, cuit, rol, estado, lista_precio_id, creado, listas_precio(nombre)").order("creado", { ascending: false })),
      cargarListas()
    ]);
    const pendientes = cuentas.filter(c => c.estado === "pendiente_activacion").length;
    const filtradas = filtroCuentas === "todas" ? cuentas : cuentas.filter(c => c.estado === filtroCuentas);
    contenido.innerHTML = cabecera("Cuentas",
      `Los clientes se registran desde la web o los podés crear vos. Para activar una cuenta asignale un <strong>usuario</strong> y una <strong>lista de precio</strong>.${pendientes ? ` Hay <strong>${pendientes}</strong> pendiente${pendientes > 1 ? "s" : ""} de activación.` : ""}`,
      `<button class="btn btn--rojo" id="nueva-cuenta">+ Nueva cuenta</button>`) + `
      <div class="herramientas">
        <select id="cu-filtro" aria-label="Filtrar cuentas">${opciones([
          { value: "pendiente_activacion", text: "Pendientes de activación" }, { value: "activa", text: "Activas" },
          { value: "bloqueada", text: "Bloqueadas" }, { value: "pendiente_verificacion", text: "Sin verificar mail" }, { value: "todas", text: "Todas" }
        ], filtroCuentas)}</select>
        <span class="ayuda">${filtradas.length} cuenta${filtradas.length === 1 ? "" : "s"}</span>
      </div>
      <div class="tabla-caja"><table>
        <thead><tr><th>Usuario</th><th>Nombre</th><th>Email</th><th>CUIT</th><th>Rol</th><th>Lista</th><th>Estado</th><th></th></tr></thead>
        <tbody>${filtradas.length ? filtradas.map(c => `<tr>
          <td><strong>${esc(c.usuario || "—")}</strong></td>
          <td>${esc([c.nombre, c.apellido].filter(Boolean).join(" ") || "—")}</td>
          <td>${esc(c.email)}</td><td>${esc(c.cuit || "—")}</td>
          <td>${esc(ROLES[c.rol])}</td><td>${esc(c.listas_precio?.nombre || "—")}</td>
          <td><span class="chip ${ESTADOS[c.estado][1]}">${ESTADOS[c.estado][0]}</span></td>
          <td class="acciones">${(["administrador", "superadmin"].includes(c.rol) && !esSuper() && c.id !== perfil.id) || c.estado === "pendiente_verificacion" ? ""
            : `<button class="btn btn--linea btn--chico" data-editar="${c.id}">${c.estado === "pendiente_activacion" ? "Activar" : "Editar"}</button>`}</td>
        </tr>`).join("") : '<tr><td colspan="8" class="vacio">No hay cuentas en este estado.</td></tr>'}</tbody>
      </table></div>`;
    $("#cu-filtro").onchange = e => { filtroCuentas = e.target.value; seccionCuentas(); };
    $("#nueva-cuenta").onclick = nuevaCuenta;
    contenido.querySelectorAll("[data-editar]").forEach(b =>
      b.onclick = () => editarCuenta(cuentas.find(c => c.id === b.dataset.editar)));
  };

  const editarCuenta = c => {
    const esPropia = c.id === perfil.id;
    const rolesPermitidos = esPropia ? [c.rol] : esSuper() ? ["cliente", "empleado", "administrador", "superadmin"] : ["cliente", "empleado"];
    abrirVentana({
      titulo: c.estado === "pendiente_activacion" ? "Activar cuenta" : "Editar cuenta",
      textoGuardar: c.estado === "activa" ? "Guardar" : "Activar cuenta",
      cuerpo: `
        <p><strong>${esc([c.nombre, c.apellido].filter(Boolean).join(" ") || c.email)}</strong><br>${esc(c.email)}${c.cuit ? ` · CUIT ${esc(c.cuit)}` : ""}</p>
        <div class="fila2">
          <div><label for="c-usr">Usuario</label>
            <input id="c-usr" required maxlength="30" pattern="[A-Za-z0-9._\\-]{3,30}" value="${esc(c.usuario || "")}" placeholder="Ej.: Jperez">
            <p class="ayuda">3 a 30 caracteres: letras, números, punto o guion. Personal interno: inicial del nombre + apellido.</p></div>
          <div><label for="c-rol">Rol</label>
            <select id="c-rol"${esPropia ? " disabled" : ""}>${opciones(rolesPermitidos.map(r => ({ value: r, text: ROLES[r] })), c.rol)}</select>
            ${esPropia ? '<p class="ayuda">No podés cambiar tu propio rol.</p>' : ""}</div>
        </div>
        <label for="c-lista">Lista de precio</label>
        <select id="c-lista">${opciones(cache.listas.filter(l => l.activa || l.id === c.lista_precio_id).map(l => ({ value: l.id, text: `${l.nombre}${l.descripcion ? " — " + l.descripcion : ""}` })), c.lista_precio_id, "— Sin lista (personal interno) —")}</select>
        ${c.estado === "activa" && !esPropia ? `<label class="check"><input type="checkbox" id="c-bloq"> Bloquear esta cuenta (no podrá ver precios ni pedir)</label>` : ""}
        ${c.estado === "bloqueada" ? '<p class="ayuda">La cuenta está bloqueada. Al guardar se vuelve a activar.</p>' : ""}`,
      onGuardar: async () => {
        const usuario = $("#c-usr").value.trim();
        const rol = esPropia ? c.rol : $("#c-rol").value;
        const lista = Number($("#c-lista").value) || null;
        if (!/^[A-Za-z0-9._-]{3,30}$/.test(usuario)) throw new Error("El usuario debe tener entre 3 y 30 caracteres: letras, números, punto o guion.");
        if (rol === "cliente" && !lista) throw new Error("Un cliente necesita una lista de precio.");
        if ($("#c-bloq")?.checked) {
          if (!confirm(`¿Bloquear la cuenta de ${c.email}?`)) return;
          await q(sb.from("perfiles").update({ estado: "bloqueada" }).eq("id", c.id));
          avisar("Cuenta bloqueada.");
        } else {
          await q(sb.rpc("activar_cuenta", { p_perfil_id: c.id, p_usuario: usuario, p_lista_id: lista, p_rol: rol }));
          if (c.estado === "pendiente_activacion") {
            try {
              await avisarActivacion(c.id);
              avisar("Cuenta activada. Le enviamos un mail avisándole.");
            } catch (ex) {
              avisar(`Cuenta activada, pero no se pudo enviar el mail: ${mensajeError(ex)}`, true);
            }
          } else avisar(c.estado === "activa" ? "Cuenta actualizada." : "Cuenta activada.");
        }
        seccionCuentas();
      }
    });
  };

  /* ---------- Actividad (eventos para el bot) ---------- */
  const TIPOS_EVENTO = {
    cliente_para_activar: ["Cliente para activar", "chip--ambar"],
    cuenta_activada: ["Cuenta activada", "chip--verde"],
    cuenta_bloqueada: ["Cuenta bloqueada", "chip--rojo"],
    pedido_nuevo: ["Pedido nuevo", "chip--ambar"],
    pedido_aceptado: ["Pedido aceptado", "chip"],
    pedido_armando: ["Pedido armando", "chip"],
    pedido_cancelado: ["Pedido cancelado", "chip--rojo"],
    pedido_retirado: ["Pedido retirado", "chip--verde"]
  };
  let soloPendientes = true;
  const seccionActividad = async () => {
    let consulta = sb.from("eventos").select("id, tipo, datos, pedido_numero, creado, procesado, procesado_por").order("id", { ascending: false }).limit(200);
    if (soloPendientes) consulta = consulta.is("procesado", null);
    const evs = await q(consulta);
    const quien = d => { const c = d.cliente || d; return [c.usuario, [c.nombre, c.apellido].filter(Boolean).join(" "), c.email].filter(Boolean).join(" · "); };
    const fecha = f => new Date(f).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    contenido.innerHTML = cabecera("Actividad",
      "Registro automático de novedades: clientes para activar, cuentas activadas y pedidos. Es lo que va a leer el bot; cuando el bot (o vos) lo procesa, se marca como <strong>procesado</strong>.",
      `<button class="btn btn--linea" id="marcar-todos"${evs.some(e => !e.procesado) ? "" : " disabled"}>Marcar todo como procesado</button>`) + `
      <div class="herramientas"><label class="check" style="margin:0"><input type="checkbox" id="solo-pend"${soloPendientes ? " checked" : ""}> Ver solo sin procesar</label>
        <span class="ayuda">${evs.length} evento${evs.length === 1 ? "" : "s"}</span></div>
      <div class="tabla-caja"><table>
        <thead><tr><th>Fecha</th><th>Novedad</th><th>Detalle</th><th>Estado</th><th></th></tr></thead>
        <tbody>${evs.length ? evs.map(e => `<tr>
          <td>${esc(fecha(e.creado))}</td>
          <td><span class="chip ${TIPOS_EVENTO[e.tipo]?.[1] || ""}">${esc(TIPOS_EVENTO[e.tipo]?.[0] || e.tipo)}</span></td>
          <td>${e.pedido_numero ? `<strong>Pedido ${e.pedido_numero}</strong> · ${(e.datos.items || []).length} renglón(es) · ` : ""}${esc(quien(e.datos))}</td>
          <td>${e.procesado ? `<span class="chip chip--gris">Procesado${e.procesado_por ? " por " + esc(e.procesado_por) : ""}</span>` : '<span class="chip chip--ambar">Sin procesar</span>'}</td>
          <td class="acciones">${e.tipo === "cliente_para_activar" ? '<a class="btn btn--linea btn--chico" href="#cuentas">Activar</a> ' : ""}${e.pedido_numero ? `<a class="btn btn--linea btn--chico" href="/pedidos/#todos">Ver</a> ` : ""}${e.procesado ? "" : `<button class="btn btn--linea btn--chico" data-marcar="${e.id}">Procesado</button>`}</td>
        </tr>`).join("") : '<tr><td colspan="5" class="vacio">No hay novedades sin procesar.</td></tr>'}</tbody>
      </table></div>`;
    $("#solo-pend").onchange = e => { soloPendientes = e.target.checked; seccionActividad(); };
    const marcar = async ids => {
      try { await q(sb.rpc("marcar_eventos", { p_ids: ids })); avisar("Marcado como procesado."); seccionActividad(); }
      catch (ex) { avisar(mensajeError(ex), true); }
    };
    $("#marcar-todos").onclick = () => marcar(evs.filter(e => !e.procesado).map(e => e.id));
    contenido.querySelectorAll("[data-marcar]").forEach(b => b.onclick = () => marcar([Number(b.dataset.marcar)]));
  };

  // Alta de una cuenta desde el panel: queda activa y la persona recibe un mail para elegir su contraseña
  const nuevaCuenta = () => {
    const roles = esSuper() ? ["cliente", "empleado", "administrador", "superadmin"] : ["cliente", "empleado"];
    abrirVentana({
      titulo: "Nueva cuenta",
      textoGuardar: "Crear cuenta",
      cuerpo: `
        <div class="fila2">
          <div><label for="nc-nombre">Nombre</label><input id="nc-nombre" required maxlength="80"></div>
          <div><label for="nc-apellido">Apellido</label><input id="nc-apellido" maxlength="80"></div>
        </div>
        <div class="fila2">
          <div><label for="nc-email">Email</label><input id="nc-email" type="email" required maxlength="254" autocomplete="off"></div>
          <div><label for="nc-usr">Usuario</label><input id="nc-usr" required maxlength="30" placeholder="Ej.: Jperez" autocomplete="off">
            <p class="ayuda">Único. Personal interno: inicial del nombre + apellido.</p></div>
        </div>
        <div class="fila2">
          <div><label for="nc-rol">Rol</label><select id="nc-rol">${opciones(roles.map(r => ({ value: r, text: ROLES[r] })), "cliente")}</select></div>
          <div><label for="nc-cuit">CUIT <span id="nc-cuit-oblig">(obligatorio para clientes)</span></label><input id="nc-cuit" inputmode="numeric" maxlength="13" placeholder="20-12345678-9"></div>
        </div>
        <div id="nc-caja-lista"><label for="nc-lista">Lista de precio</label>
          <select id="nc-lista">${opciones(cache.listas.filter(l => l.activa).map(l => ({ value: l.id, text: `${l.nombre}${l.descripcion ? " — " + l.descripcion : ""}` })), "", "— Elegí una lista —")}</select></div>
        <p class="ayuda">La cuenta queda <strong>activa</strong>. Le llega un mail de Lácteos NC para elegir su contraseña; después puede ingresar con su usuario o su email.</p>`,
      onGuardar: async () => {
        const rol = $("#nc-rol").value;
        const datos = {
          accion: "crear_usuario", nombre: $("#nc-nombre").value.trim(), apellido: $("#nc-apellido").value.trim(),
          email: $("#nc-email").value.trim(), usuario: $("#nc-usr").value.trim(), rol,
          cuit: $("#nc-cuit").value.replace(/\D/g, ""), lista_id: rol === "cliente" ? Number($("#nc-lista").value) || null : null
        };
        if (!datos.nombre) throw new Error("Escribí el nombre.");
        if (!/^[A-Za-z0-9._-]{3,30}$/.test(datos.usuario)) throw new Error("El usuario debe tener entre 3 y 30 caracteres: letras, números, punto o guion.");
        if (rol === "cliente" && datos.cuit.length !== 11) throw new Error("Para un cliente el CUIT es obligatorio (11 números).");
        if (rol === "cliente" && !datos.lista_id) throw new Error("Elegí la lista de precio del cliente.");
        const { data } = await sb.auth.getSession();
        const r = await fetch(`${window.NC_CONFIG.supabaseUrl}/functions/v1/cuentas`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: window.NC_CONFIG.supabaseKey, Authorization: `Bearer ${data.session?.access_token}` },
          body: JSON.stringify(datos)
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "No se pudo crear la cuenta.");
        avisar(j.mensaje, !j.mail);
        filtroCuentas = "activa";
        seccionCuentas();
      }
    });
    const ajustar = () => {
      const cliente = $("#nc-rol").value === "cliente";
      $("#nc-caja-lista").hidden = !cliente;
      $("#nc-cuit-oblig").textContent = cliente ? "(obligatorio)" : "(opcional)";
    };
    $("#nc-rol").onchange = ajustar;
    $("#nc-cuit").oninput = e => {
      const d = e.target.value.replace(/\D/g, "").slice(0, 11);
      e.target.value = d.length > 10 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d;
    };
    ajustar();
  };

  /* ---------- Indicadores (KPI) ---------- */
  const seccionIndicadores = async () => {
    const k = await q(sb.rpc("kpis"));
    const P = k.pedidos, C = k.cuentas, G = k.catalogo;
    const plata = n => "$ " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const num = n => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
    const minutos = m => m == null ? "—" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
    const tile = (titulo, valor, detalle = "", enlace = "") => `<${enlace ? `a href="${enlace}"` : "div"} class="kpi">
      <span class="kpi__titulo">${esc(titulo)}</span><span class="kpi__valor">${esc(valor)}</span>${detalle ? `<span class="kpi__detalle">${detalle}</span>` : ""}</${enlace ? "a" : "div"}>`;

    // Barras de pedidos por día (últimos 30 días)
    const dias = k.por_dia || [];
    const max = Math.max(1, ...dias.map(d => d.pedidos));
    const W = 720, H = 180, base = H - 22, ancho = W / Math.max(1, dias.length);
    const fechaCorta = f => { const [, m, d] = f.split("-"); return `${d}/${m}`; };
    const barras = dias.map((d, i) => {
      const h = d.pedidos ? Math.max(4, (d.pedidos / max) * (base - 14)) : 0;
      const x = i * ancho + 1, w = Math.max(2, ancho - 2);
      return `<g class="barra"><title>${fechaCorta(d.dia)}: ${d.pedidos} pedido${d.pedidos === 1 ? "" : "s"}</title>
        <rect class="barra__zona" x="${i * ancho}" y="0" width="${ancho}" height="${base}" fill="transparent"/>
        ${h ? `<path d="M${x},${base} v-${h - 4} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${h - 4} z" fill="var(--rojo)"/>` : ""}</g>`;
    }).join("");
    const etiquetas = dias.map((d, i) => i % 5 === 4 || i === dias.length - 1
      ? `<text x="${i * ancho + ancho / 2}" y="${H - 6}" text-anchor="middle">${fechaCorta(d.dia)}</text>` : "").join("");

    const lista = (filas, vacio, fila) => filas.length ? `<table class="kpi-tabla"><tbody>${filas.map(fila).join("")}</tbody></table>` : `<p class="vacio">${vacio}</p>`;

    contenido.innerHTML = cabecera("Indicadores",
      "Resumen de pedidos y cuentas. Los totales son estimados (precios de lista, sin contar pedidos cancelados). El mes es el mes calendario actual.",
      `<button class="btn btn--linea" id="kpi-actualizar">Actualizar</button>`) + `
      <div class="kpis">
        ${tile("Pedidos en espera", num(P.en_espera), "Para aceptar o cancelar", "/pedidos/#en_espera")}
        ${tile("Armando", num(P.armando), "Aceptados, esperando retiro", "/pedidos/#armando")}
        ${tile("Pedidos hoy", num(P.hoy), `${num(P.semana)} en los últimos 7 días`)}
        ${tile("Pedidos del mes", num(P.mes), `${num(P.retirados_mes)} retirados · ${num(P.cancelados_mes)} cancelados`)}
        ${tile("Total estimado del mes", plata(P.total_mes), `Promedio por pedido ${plata(P.promedio_mes)}`)}
        ${tile("Tiempo para aceptar", minutos(P.min_aceptar), `Aceptado → retirado: ${minutos(P.min_retirar)}`)}
        ${tile("Clientes activos", num(C.clientes_activos), `${num(C.nuevos_mes)} nuevos este mes`, "#cuentas")}
        ${tile("Cuentas para activar", num(C.para_activar), `${num(C.sin_verificar)} sin verificar el mail`, "#cuentas")}
      </div>
      <div class="kpi-bloques">
        <section class="kpi-bloque kpi-bloque--ancho">
          <h2>Pedidos por día <small>últimos 30 días, sin cancelados</small></h2>
          <svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pedidos por día en los últimos 30 días">
            <line x1="0" y1="${base}" x2="${W}" y2="${base}" class="grafico__base"/>
            <text x="0" y="10" class="grafico__max">${max} ${max === 1 ? "pedido" : "pedidos"}</text>
            <line x1="0" y1="14" x2="${W}" y2="14" class="grafico__guia"/>
            ${barras}${etiquetas}
          </svg>
          <details class="kpi-datos"><summary>Ver como tabla</summary>
            ${lista(dias.filter(d => d.pedidos), "Sin pedidos en los últimos 30 días.", d => `<tr><td>${fechaCorta(d.dia)}</td><td class="num">${d.pedidos}</td></tr>`)}
          </details>
        </section>
        <section class="kpi-bloque">
          <h2>Artículos más pedidos <small>este mes</small></h2>
          ${lista(k.top_articulos || [], "Todavía no hay pedidos este mes.", a => `<tr><td><strong>${esc(a.codigo)}</strong> ${esc(a.descripcion)}</td><td class="num">${num(a.cantidad)}<br><small>${a.pedidos} ped.</small></td></tr>`)}
        </section>
        <section class="kpi-bloque">
          <h2>Clientes con más pedidos <small>este mes</small></h2>
          ${lista(k.top_clientes || [], "Todavía no hay pedidos este mes.", c => `<tr><td><strong>${esc(c.usuario || "—")}</strong> ${esc(c.nombre)}</td><td class="num">${c.pedidos} ped.<br><small>${plata(c.total)}</small></td></tr>`)}
        </section>
        <section class="kpi-bloque">
          <h2>Catálogo</h2>
          <table class="kpi-tabla"><tbody>
            <tr><td>Artículos activos</td><td class="num">${num(G.articulos_activos)}</td></tr>
            <tr><td>Tarjetas visibles en la web</td><td class="num">${num(G.tarjetas_visibles)}</td></tr>
            <tr><td><a href="#productos">Tarjetas sin foto</a></td><td class="num">${num(G.tarjetas_sin_foto)}</td></tr>
            <tr><td>Empleados activos</td><td class="num">${num(C.empleados)}</td></tr>
          </tbody></table>
        </section>
      </div>`;
    $("#kpi-actualizar").onclick = () => seccionIndicadores().catch(ex => avisar(mensajeError(ex), true));
  };

  /* =====================================================================
     NAVEGACIÓN, SESIÓN E INGRESO
     ===================================================================== */
  const SECCIONES = { indicadores: seccionIndicadores, productos: seccionProductos, articulos: seccionArticulos, novedades: seccionNovedades,
    listas: seccionListas, precios: seccionPrecios, cuentas: seccionCuentas, actividad: seccionActividad };

  const irA = async () => {
    const nombre = SECCIONES[location.hash.slice(1)] ? location.hash.slice(1) : "indicadores";
    document.querySelectorAll(".menu a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + nombre));
    document.querySelectorAll(".menu a[aria-current]").forEach(a => a.setAttribute("aria-current", "page"));
    contenido.innerHTML = '<p class="vacio">Cargando…</p>';
    try { await SECCIONES[nombre](); }
    catch (ex) { contenido.innerHTML = `<p class="error">${esc(mensajeError(ex))}</p>`; }
    contenido.focus({ preventScroll: true });
  };
  window.addEventListener("hashchange", () => { if (perfil) irA(); });

  const mostrar = vista => {
    $("#vista-ingreso").hidden = vista !== "ingreso";
    $("#vista-panel").hidden = vista !== "panel";
  };

  const entrar = async session => {
    try {
      perfil = await q(sb.from("perfiles").select("id, usuario, nombre, apellido, rol, estado").eq("id", session.user.id).single());
    } catch { perfil = null; }
    const rechazar = async texto => {
      await sb.auth.signOut();
      perfil = null;
      mostrar("ingreso");
      const e = $("#ingreso-error");
      e.innerHTML = texto;
      e.hidden = false;
    };
    if (!perfil) return rechazar("No encontramos los datos de tu cuenta. Comunicate con la cooperativa.");
    if (perfil.estado === "bloqueada") return rechazar("Tu cuenta está bloqueada. Comunicate con la cooperativa.");
    if (perfil.estado === "pendiente_activacion") {
      return rechazar("Tu email ya está verificado. La cooperativa tiene que <strong>activar tu cuenta</strong>; te vamos a avisar por mail.");
    }
    if (perfil.estado !== "activa") return rechazar("Tu cuenta todavía no está activa.");
    // Cada rol a su página
    if (perfil.rol === "cliente") { location.replace("/clientes/"); return; }
    if (perfil.rol === "empleado") { location.replace("/pedidos/"); return; }
    $("#usuario-nombre").textContent = perfil.usuario || [perfil.nombre, perfil.apellido].filter(Boolean).join(" ");
    $("#usuario-rol").textContent = ROLES[perfil.rol];
    document.title = "Panel de administración | Lácteos NC";
    mostrar("panel");
    irA();
  };

  // ---------- Ingreso y "Olvidé mi contraseña" (mismo formulario, dos modos) ----------
  let modoRecuperar = false;
  const modoIngreso = recuperar => {
    modoRecuperar = recuperar;
    $("#ingreso-titulo").textContent = recuperar ? "Recuperar contraseña" : "Ingresar";
    $("#ingreso-ayuda").textContent = recuperar
      ? "Escribí el email de tu cuenta y te enviamos un enlace para elegir una contraseña nueva."
      : "Clientes y personal de la cooperativa: ingresá con tu email o tu usuario y tu contraseña.";
    $("#i-email-label").textContent = recuperar ? "Email" : "Email o usuario";
    $("#i-email").type = recuperar ? "email" : "text";
    $("#campo-clave").hidden = recuperar;
    $("#i-clave").required = !recuperar;
    $("#btn-ingresar").textContent = recuperar ? "Solicitar nueva contraseña" : "Ingresar";
    $("#btn-olvide").textContent = recuperar ? "← Volver a ingresar" : "Olvidé mi contraseña";
    $("#ingreso-error").hidden = true;
    $("#ingreso-ok").hidden = true;
    $("#i-email").focus();
  };
  $("#btn-olvide").onclick = () => modoIngreso(!modoRecuperar);

  // Pide el enlace de recuperación a la función del servidor (mail de Lácteos NC por Resend)
  const pedirRecuperacion = async email => {
    const r = await fetch(`${window.NC_CONFIG.supabaseUrl}/functions/v1/cuentas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: window.NC_CONFIG.supabaseKey },
      body: JSON.stringify({ accion: "recuperar", email })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo enviar el mail. Probá de nuevo.");
    return j;
  };

  $("#form-ingreso").onsubmit = async e => {
    e.preventDefault();
    const err = $("#ingreso-error"), ok = $("#ingreso-ok");
    const btn = $("#btn-ingresar");
    const email = $("#i-email").value.trim();
    err.hidden = true; ok.hidden = true;
    const esEmail = email.includes("@");
    if (modoRecuperar && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = "Escribí un email válido."; err.hidden = false; return; }
    if (!modoRecuperar && !esEmail && !/^[A-Za-z0-9._-]{3,30}$/.test(email)) { err.textContent = "Escribí tu email o tu usuario."; err.hidden = false; return; }
    btn.disabled = true;
    try {
      if (modoRecuperar) {
        const j = await pedirRecuperacion(email);
        ok.textContent = j.mensaje || "Si el email está registrado, te llegará un enlace para elegir una contraseña nueva.";
        ok.hidden = false;
        return;
      }
      let session;
      if (esEmail) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: $("#i-clave").value });
        if (error) throw error;
        session = data.session;
      } else {
        // Con usuario: el servidor busca el email y devuelve la sesión (nunca muestra el email)
        const r = await fetch(`${window.NC_CONFIG.supabaseUrl}/functions/v1/cuentas`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: window.NC_CONFIG.supabaseKey },
          body: JSON.stringify({ accion: "ingresar", usuario: email, clave: $("#i-clave").value })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Usuario o contraseña incorrectos.");
        const { data, error } = await sb.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
        if (error) throw error;
        session = data.session;
      }
      $("#i-clave").value = "";
      await entrar(session);
    } catch (ex) {
      if (!modoRecuperar && /Email not confirmed/i.test(ex?.message || "")) {
        err.innerHTML = `Todavía no verificaste tu email. <a href="/registro/?verificar=${encodeURIComponent(email)}">Ingresá el código que te enviamos</a>.`;
      } else err.textContent = mensajeError(ex);
      err.hidden = false;
    }
    finally { btn.disabled = false; }
  };

  // Formulario de contraseña nueva (enlace de recuperación o "Cambiar mi contraseña")
  const pedirClaveNueva = () => {
    mostrar("ingreso");
    $("#form-ingreso").hidden = true;
    $("#form-nueva-clave").hidden = false;
    $("#n-clave").focus();
  };
  $("#form-nueva-clave").onsubmit = async e => {
    e.preventDefault();
    const err = $("#nueva-error");
    const c1 = $("#n-clave").value, c2 = $("#n-clave2").value;
    err.hidden = true;
    if (c1.length < 8) { err.textContent = "La contraseña debe tener al menos 8 caracteres."; err.hidden = false; return; }
    if (c1 !== c2) { err.textContent = "Las contraseñas no coinciden."; err.hidden = false; return; }
    const { error } = await sb.auth.updateUser({ password: c1 });
    if (error) { err.textContent = mensajeError(error); err.hidden = false; return; }
    $("#n-clave").value = $("#n-clave2").value = "";
    $("#form-nueva-clave").hidden = true;
    $("#form-ingreso").hidden = false;
    avisar("Contraseña actualizada.");
    const { data } = await sb.auth.getSession();
    if (data.session) entrar(data.session); else mostrar("ingreso");
  };
  $("#btn-mi-clave").onclick = pedirClaveNueva;

  $("#btn-salir").onclick = async () => { await sb.auth.signOut(); };

  sb.auth.onAuthStateChange((evento, session) => {
    if (evento === "PASSWORD_RECOVERY") pedirClaveNueva();
    if (evento === "SIGNED_OUT") { perfil = null; mostrar("ingreso"); contenido.innerHTML = ""; }
  });

  (async () => {
    const token = new URLSearchParams(location.search).get("recuperar");
    if (token) {
      history.replaceState(null, "", location.pathname); // saca el token de la barra de direcciones
      const { error } = await sb.auth.verifyOtp({ token_hash: token, type: "recovery" });
      if (!error) { pedirClaveNueva(); return; }
      mostrar("ingreso");
      modoIngreso(true);
      const err = $("#ingreso-error");
      err.textContent = "El enlace venció o ya se usó. Pedí uno nuevo con tu email.";
      err.hidden = false;
      return;
    }
    const { data } = await sb.auth.getSession();
    if (location.hash.includes("type=recovery")) return; // enlaces viejos: lo maneja PASSWORD_RECOVERY
    if (data.session) entrar(data.session); else mostrar("ingreso");
  })();
})();
