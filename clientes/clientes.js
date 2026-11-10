/* Lácteos NC — área de clientes: lista de precios, pedido tipo carrito y mis pedidos */
(async () => {
  "use strict";
  const { sb, $, esc, plata, cantidad, fecha, chipPedido, mensajeError, avisar, ventana, exigir, cambiarClave, salir } = window.NC;

  const perfil = await exigir(["cliente"]);
  const contenido = $("#contenido");
  $("#usuario-nombre").textContent = perfil.usuario || [perfil.nombre, perfil.apellido].filter(Boolean).join(" ");
  $("#btn-mi-clave").onclick = cambiarClave;
  $("#btn-salir").onclick = salir;

  /* ---------- Carrito (se guarda en este navegador) ---------- */
  const CLAVE = "nc-carrito-" + perfil.id;
  const carrito = new Map(); // articulo_id -> cantidad
  try { Object.entries(JSON.parse(localStorage.getItem(CLAVE) || "{}")).forEach(([k, v]) => carrito.set(Number(k), Number(v))); } catch { /* vacío */ }
  const guardarCarrito = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify(Object.fromEntries(carrito))); } catch { /* sin almacenamiento */ }
    const n = carrito.size;
    $("#contador-carrito").hidden = !n;
    $("#contador-carrito").textContent = n;
  };

  const normalizar = v => {
    const t = String(v).trim().replace(",", ".");
    if (!t) return 0;
    const n = Math.round(Number(t) * 100) / 100;
    return Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 0;
  };

  /* ---------- Datos ---------- */
  let articulos = [];
  const cargar = async () => {
    const [lista, arts, precios] = await Promise.all([
      perfil.lista_precio_id ? sb.from("listas_precio").select("nombre, descripcion").eq("id", perfil.lista_precio_id).maybeSingle() : { data: null },
      sb.from("articulos").select("id, codigo, descripcion, orden, productos(nombre)").eq("activo", true).order("codigo"),
      sb.from("precios").select("articulo_id, precio")
    ]);
    if (arts.error) throw arts.error;
    if (lista.data) $("#usuario-lista").textContent = lista.data.descripcion || lista.data.nombre;
    else $("#usuario-lista").hidden = true;
    const mapa = new Map((precios.data || []).map(p => [p.articulo_id, Number(p.precio)]));
    articulos = arts.data.map(a => ({ ...a, precio: mapa.has(a.id) ? mapa.get(a.id) : null }));
    // Quita del carrito lo que ya no existe
    [...carrito.keys()].forEach(id => { if (!articulos.some(a => a.id === id)) carrito.delete(id); });
    guardarCarrito();
  };

  /* ---------- Lista de precios y pedido ---------- */
  const seccionPedir = () => {
    contenido.innerHTML = `
      <div class="cabecera"><div><h1>Lista de precios</h1>
        <p>Escribí la cantidad de cada artículo que necesitás. Al terminar tocá <strong>Revisar y confirmar</strong>.</p></div></div>
      <div class="compra">
        <div>
          <div class="herramientas"><input type="search" id="buscar" placeholder="Buscar por código o descripción" aria-label="Buscar artículo">
            <label class="check" style="margin:0"><input type="checkbox" id="solo-carrito"> Ver solo lo que voy a pedir</label></div>
          <div class="tabla-caja"><table>
            <thead><tr><th>Código</th><th>Descripción</th><th class="num">Precio</th><th class="num">Cantidad</th></tr></thead>
            <tbody id="cuerpo">${articulos.map(a => `<tr data-id="${a.id}" data-texto="${esc((a.codigo + " " + a.descripcion + " " + (a.productos?.nombre || "")).toLowerCase())}">
              <td><strong>${esc(a.codigo)}</strong></td>
              <td>${esc(a.descripcion)}</td>
              <td class="num">${a.precio == null ? '<span class="sin-precio">A confirmar</span>' : esc(plata(a.precio))}</td>
              <td class="num"><span class="cant">
                <button type="button" data-menos aria-label="Restar uno">−</button>
                <input inputmode="decimal" aria-label="Cantidad de ${esc(a.descripcion)}" value="${carrito.has(a.id) ? cantidad(carrito.get(a.id)) : ""}" placeholder="0">
                <button type="button" data-mas aria-label="Sumar uno">+</button></span></td>
            </tr>`).join("") || '<tr><td colspan="4" class="vacio">Todavía no hay artículos cargados.</td></tr>'}</tbody>
          </table></div>
        </div>
        <aside class="resumen" aria-label="Tu pedido">
          <h2>Tu pedido</h2>
          <ul id="res-lista"></ul>
          <div class="total"><span>Total estimado</span><span id="res-total"></span></div>
          <p class="ayuda" id="res-nota" hidden>Hay artículos con precio a confirmar: no están sumados en el total.</p>
          <label for="obs">Observaciones (opcional)</label>
          <textarea id="obs" maxlength="500" placeholder="Ej.: retiro el jueves por la mañana"></textarea>
          <button class="btn btn--rojo btn--ancho" type="button" id="btn-revisar" style="margin-top:.8rem">Revisar y confirmar</button>
          <button class="enlace" type="button" id="btn-vaciar" style="display:block;margin:.4rem auto 0">Vaciar pedido</button>
        </aside>
      </div>`;

    const cuerpo = $("#cuerpo");
    const fila = id => cuerpo.querySelector(`tr[data-id="${id}"]`);
    const fijar = (id, n) => {
      if (n > 0) carrito.set(id, n); else carrito.delete(id);
      fila(id)?.classList.toggle("en-carrito", n > 0);
      guardarCarrito(); resumen();
    };
    carrito.forEach((_, id) => fila(id)?.classList.add("en-carrito"));

    cuerpo.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      const tr = b.closest("tr"), inp = tr.querySelector("input"), id = Number(tr.dataset.id);
      let n = normalizar(inp.value) + (b.hasAttribute("data-mas") ? 1 : -1);
      n = Math.max(0, Math.round(n * 100) / 100);
      inp.value = n ? cantidad(n) : "";
      fijar(id, n);
    });
    cuerpo.addEventListener("input", e => {
      if (!e.target.matches("input")) return;
      fijar(Number(e.target.closest("tr").dataset.id), normalizar(e.target.value));
    });
    cuerpo.addEventListener("blur", e => {
      if (!e.target.matches("input")) return;
      const n = normalizar(e.target.value); e.target.value = n ? cantidad(n) : "";
    }, true);

    const filtrar = () => {
      const t = $("#buscar").value.trim().toLowerCase(), solo = $("#solo-carrito").checked;
      cuerpo.querySelectorAll("tr[data-id]").forEach(tr => {
        tr.hidden = (t && !tr.dataset.texto.includes(t)) || (solo && !carrito.has(Number(tr.dataset.id)));
      });
    };
    $("#buscar").oninput = filtrar;
    $("#solo-carrito").onchange = filtrar;
    $("#btn-vaciar").onclick = () => {
      if (!carrito.size || !confirm("¿Vaciar el pedido?")) return;
      carrito.clear(); guardarCarrito(); seccionPedir();
    };
    $("#btn-revisar").onclick = revisar;
    resumen();
  };

  const renglones = () => articulos.filter(a => carrito.has(a.id)).map(a => ({ ...a, cantidad: carrito.get(a.id) }));

  const resumen = () => {
    const r = renglones();
    $("#res-lista").innerHTML = r.length ? r.map(a => `<li><span>${esc(cantidad(a.cantidad))} × ${esc(a.descripcion)}</span>
      <span>${a.precio == null ? "—" : esc(plata(a.precio * a.cantidad))}</span></li>`).join("")
      : '<li class="ayuda" style="border:0">Todavía no agregaste artículos.</li>';
    $("#res-total").textContent = plata(r.reduce((s, a) => s + (a.precio ?? 0) * a.cantidad, 0));
    $("#res-nota").hidden = !r.some(a => a.precio == null);
    $("#btn-revisar").disabled = !r.length;
  };

  const tablaRenglones = (items, conPrecio = true) => `<div class="tabla-caja"><table>
    <thead><tr><th>Código</th><th>Descripción</th><th class="num">Cantidad</th>${conPrecio ? '<th class="num">Precio</th><th class="num">Subtotal</th>' : ""}</tr></thead>
    <tbody>${items.map(i => `<tr><td><strong>${esc(i.codigo)}</strong></td><td>${esc(i.descripcion)}</td><td class="num">${esc(cantidad(i.cantidad))}</td>
      ${conPrecio ? `<td class="num">${esc(plata(i.precio ?? i.precio_unitario))}</td><td class="num">${(i.precio ?? i.precio_unitario) == null ? "—" : esc(plata((i.subtotal ?? (i.precio * i.cantidad))))}</td>` : ""}</tr>`).join("")}</tbody>
  </table></div>`;

  const revisar = () => {
    const r = renglones();
    if (!r.length) return;
    const obs = $("#obs").value.trim();
    ventana({
      titulo: "Revisá tu pedido", ancho: true,
      cuerpo: `${tablaRenglones(r)}
        <p class="total" style="display:flex;justify-content:space-between;font:700 1.3rem var(--f-titulo);margin:.8rem 0">
          <span>Total estimado</span><span>${esc(plata(r.reduce((s, a) => s + (a.precio ?? 0) * a.cantidad, 0)))}</span></p>
        ${r.some(a => a.precio == null) ? '<p class="nota">Algunos artículos tienen precio a confirmar. La cooperativa te lo informa al preparar el pedido.</p>' : ""}
        ${obs ? `<p><b>Observaciones:</b> ${esc(obs)}</p>` : ""}
        <p class="ayuda">Los precios son informativos y se confirman al facturar. El pedido queda sujeto a disponibilidad.</p>`,
      botones: [{ texto: "Seguir editando" }, { texto: "Confirmar pedido", clase: "btn--rojo", accion: async () => {
        const { data, error } = await sb.rpc("crear_pedido", {
          p_items: r.map(a => ({ articulo_id: a.id, cantidad: a.cantidad })), p_observaciones: obs || null
        });
        if (error) throw error;
        carrito.clear(); guardarCarrito();
        seccionPedir();
        generado(data);
        return false; // la ventana ya muestra la confirmación
      } }]
    });
  };

  const generado = p => ventana({
    titulo: "Pedido generado", ancho: true,
    cuerpo: `<div class="confirmado"><p>Su pedido fue generado correctamente</p>
        <p class="numero">N.º ${esc(p.numero)}</p>${chipPedido(p.estado)}</div>
      ${tablaRenglones(p.items, false)}
      ${p.observaciones ? `<p style="margin-top:.8rem"><b>Observaciones:</b> ${esc(p.observaciones)}</p>` : ""}
      <p class="ayuda" style="margin-top:.8rem">La cooperativa lo va a revisar y confirmar. Podés seguir el estado en <strong>Mis pedidos</strong>.</p>`,
    botones: [{ texto: "Imprimir", accion: () => { print(); return false; } }, { texto: "Listo", clase: "btn--rojo" }]
  });

  /* ---------- Mis pedidos ---------- */
  const seccionMisPedidos = async () => {
    const { data, error } = await sb.from("pedidos").select("numero, estado, creado, total, pedido_items(count)")
      .eq("cliente_id", perfil.id).order("creado", { ascending: false }).limit(200);
    if (error) throw error;
    contenido.innerHTML = `<div class="cabecera"><div><h1>Mis pedidos</h1><p>Tocá un pedido para ver el detalle.</p></div>
        <button class="btn btn--linea" type="button" id="actualizar">Actualizar</button></div>
      <div class="tabla-caja"><table>
        <thead><tr><th>N.º</th><th>Fecha</th><th>Estado</th><th class="num">Renglones</th><th class="num">Total estimado</th></tr></thead>
        <tbody>${data.length ? data.map(p => `<tr class="clic" data-numero="${p.numero}" tabindex="0">
          <td><strong>${p.numero}</strong></td><td>${esc(fecha(p.creado))}</td><td>${chipPedido(p.estado)}</td>
          <td class="num">${p.pedido_items?.[0]?.count ?? 0}</td><td class="num">${esc(plata(p.total))}</td></tr>`).join("")
          : '<tr><td colspan="5" class="vacio">Todavía no hiciste pedidos.</td></tr>'}</tbody>
      </table></div>`;
    $("#actualizar").onclick = () => seccionMisPedidos().catch(ex => avisar(mensajeError(ex), true));
    const abrir = async tr => {
      try {
        const { data: p, error: e } = await sb.rpc("detalle_pedido", { p_numero: Number(tr.dataset.numero) });
        if (e) throw e;
        ventana({
          titulo: `Pedido N.º ${p.numero}`, ancho: true,
          cuerpo: `<div class="ficha"><div><b>Fecha</b>${esc(fecha(p.creado))}</div><div><b>Estado</b>${chipPedido(p.estado)}</div>
              <div><b>Total estimado</b>${esc(plata(p.total))}</div></div>
            ${p.estado === "cancelado" ? `<p class="nota"><b>La cooperativa canceló este pedido.</b>${p.motivo_cancelacion ? " Motivo: " + esc(p.motivo_cancelacion) : ""}</p>` : ""}
            ${p.estado === "en_espera" ? '<p class="nota">La cooperativa todavía no confirmó este pedido.</p>' : ""}
            ${tablaRenglones(p.items)}
            ${p.observaciones ? `<p style="margin-top:.8rem"><b>Observaciones:</b> ${esc(p.observaciones)}</p>` : ""}`,
          botones: [{ texto: "Imprimir", accion: () => { print(); return false; } }, { texto: "Cerrar", clase: "btn--rojo" }]
        });
      } catch (ex) { avisar(mensajeError(ex), true); }
    };
    contenido.querySelectorAll("tr[data-numero]").forEach(tr => {
      tr.onclick = () => abrir(tr);
      tr.onkeydown = e => { if (e.key === "Enter") abrir(tr); };
    });
  };

  /* ---------- Navegación ---------- */
  const irA = async () => {
    const s = location.hash === "#mis-pedidos" ? "mis-pedidos" : "pedir";
    document.querySelectorAll(".pestanas a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + s));
    document.querySelector(".pestanas a[aria-current]")?.setAttribute("aria-current", "page");
    try { s === "pedir" ? seccionPedir() : await seccionMisPedidos(); }
    catch (ex) { contenido.innerHTML = `<p class="error">${esc(mensajeError(ex))}</p>`; }
  };
  window.addEventListener("hashchange", irA);

  try { await cargar(); }
  catch (ex) { contenido.innerHTML = `<p class="error">${esc(mensajeError(ex))}</p>`; return; }
  irA();
})();
