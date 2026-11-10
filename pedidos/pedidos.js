/* Lácteos NC — página Pedidos
   Flujo: En espera --(admin acepta)--> Armando --(empleado o admin)--> Retirado
          En espera --(admin cancela)--> Cancelado
   Los empleados solo ven Armando y Retirados (lo controla también la base). */
(async () => {
  "use strict";
  const { sb, $, esc, plata, cantidad, fecha, chipPedido, mensajeError, avisar, ventana, exigir, cambiarClave, salir } = window.NC;
  const ROLES = { empleado: "Empleado", administrador: "Administrador", superadmin: "Superadministrador" };

  const perfil = await exigir(["empleado", "administrador", "superadmin"]);
  const esAdmin = perfil.rol !== "empleado";
  const contenido = $("#contenido");
  $("#usuario-nombre").textContent = perfil.usuario || [perfil.nombre, perfil.apellido].filter(Boolean).join(" ");
  $("#usuario-rol").textContent = ROLES[perfil.rol];
  $("#ir-panel").hidden = !esAdmin;
  document.querySelectorAll("[data-solo-admin]").forEach(a => { a.hidden = !esAdmin; });
  $("#btn-mi-clave").onclick = cambiarClave;
  $("#btn-salir").onclick = salir;

  const FILTROS = esAdmin ? ["en_espera", "armando", "retirado", "cancelado", "todos"] : ["armando", "retirado"];
  const INICIAL = esAdmin ? "en_espera" : "armando";
  const TITULOS = {
    en_espera: ["Pedidos en espera", "Revisá cada pedido y <strong>aceptalo</strong> (pasa a Armando, donde lo ven los empleados) o <strong>cancelalo</strong>."],
    armando: ["Pedidos para armar", esAdmin ? "Pedidos aceptados. Cuando el cliente lo retira, se marca como <strong>retirado</strong>." : "Abrí un pedido para ver qué lleva. Cuando el cliente lo retira, tocá <strong>Marcar como retirado</strong>."],
    retirado: ["Pedidos retirados", "Pedidos entregados."],
    cancelado: ["Pedidos cancelados", "Pedidos que la cooperativa no aceptó."],
    todos: ["Todos los pedidos", ""]
  };
  let filtro = INICIAL, busqueda = "";

  const nombreCliente = c => [c?.nombre, c?.apellido].filter(Boolean).join(" ") || c?.email || "—";

  const contar = async () => {
    const estados = esAdmin ? ["en_espera", "armando"] : ["armando"];
    const res = await Promise.all(estados.map(e => sb.from("pedidos").select("numero", { count: "exact", head: true }).eq("estado", e)));
    estados.forEach((e, i) => { const c = $("#cont-" + e); const n = res[i].count; c.hidden = !n; c.textContent = n || ""; });
    const pendientes = res[0].count;
    document.title = `${pendientes ? `(${pendientes}) ` : ""}Pedidos | Lácteos NC`;
  };

  // ---------- Acciones (solo administradores) ----------
  const aceptar = async numero => {
    const { error } = await sb.rpc("aceptar_pedido", { p_numero: numero });
    if (error) throw error;
    avisar(`Pedido ${numero} aceptado: pasó a Armando.`);
    refrescar();
  };
  const cancelar = numero => ventana({
    titulo: `Cancelar el pedido N.º ${numero}`,
    cuerpo: `<p>El pedido pasa a <strong>Cancelados</strong> y el cliente lo ve como cancelado. No se puede deshacer.</p>
      <label for="motivo">Motivo (opcional, lo ve el cliente)</label>
      <textarea id="motivo" maxlength="300" rows="3" placeholder="Ej.: sin stock de sardo estacionado"></textarea>`,
    botones: [{ texto: "Volver" }, { texto: "Cancelar pedido", clase: "btn--rojo", accion: async () => {
      const { error } = await sb.rpc("cancelar_pedido", { p_numero: numero, p_motivo: $("#motivo").value.trim() || null });
      if (error) throw error;
      avisar(`Pedido ${numero} cancelado.`);
      refrescar();
    } }]
  });

  // ---------- Nuevo pedido a nombre de un cliente (solo administradores) ----------
  // Ej.: el cliente lo pasó por WhatsApp; queda asociado a él y lo ve en "Mis pedidos".
  const nuevoPedido = async () => {
    const { data: clientes, error } = await sb.from("perfiles")
      .select("id, usuario, nombre, apellido, cuit, email, lista_precio_id, listas_precio(nombre)")
      .eq("rol", "cliente").eq("estado", "activa").order("usuario").limit(2000);
    if (error) return avisar(mensajeError(error), true);
    let cliente = null, articulos = [], cant = {}, filtroArt = "";

    const resumen = () => {
      const ren = articulos.filter(a => cant[a.id] > 0);
      const total = ren.reduce((t, a) => t + (a.precio == null ? 0 : a.precio * cant[a.id]), 0);
      const sinPrecio = ren.some(a => a.precio == null);
      $("#np-resumen").innerHTML = ren.length
        ? `<strong>${ren.length} ${ren.length === 1 ? "renglón" : "renglones"}</strong> · Total estimado ${esc(plata(total))}${sinPrecio ? " (hay artículos sin precio en su lista)" : ""}`
        : "Todavía no cargaste cantidades.";
    };
    const pintarArticulos = () => {
      const t = filtroArt.toLowerCase();
      const vis = articulos.filter(a => !t || (a.codigo + " " + a.descripcion).toLowerCase().includes(t));
      $("#np-articulos").innerHTML = vis.length ? vis.map(a => `<tr>
          <td><strong>${esc(a.codigo)}</strong></td><td>${esc(a.descripcion)}</td>
          <td class="num">${esc(plata(a.precio))}</td>
          <td class="num"><input class="np-cant" type="text" inputmode="decimal" data-id="${a.id}" value="${cant[a.id] ? esc(String(cant[a.id]).replace(".", ",")) : ""}" placeholder="0" aria-label="Cantidad de ${esc(a.descripcion)}"></td></tr>`).join("")
        : '<tr><td colspan="4" class="vacio">No hay artículos con esa búsqueda.</td></tr>';
      $("#np-articulos").querySelectorAll(".np-cant").forEach(inp => inp.oninput = () => {
        const v = inp.value.trim().replace(/\./g, "").replace(",", ".");
        const n = Number(v);
        if (!v) delete cant[inp.dataset.id]; else if (Number.isFinite(n) && n > 0) cant[inp.dataset.id] = Math.round(n * 100) / 100;
        inp.classList.toggle("np-cant--mal", !!v && !(Number.isFinite(n) && n > 0));
        resumen();
      });
    };
    const elegir = async c => {
      cliente = c; cant = {};
      $("#ventana-error").hidden = true;
      $("#np-cliente-elegido").innerHTML = `<strong>${esc(c.usuario || "")}</strong> ${esc(nombreCliente(c))} · CUIT ${esc(c.cuit || "—")} · ${esc(c.listas_precio?.nombre || "sin lista")}
        <button type="button" class="btn btn--linea btn--chico" id="np-cambiar">Cambiar</button>`;
      $("#np-busca-cliente").hidden = true; $("#np-paso2").hidden = false;
      $("#np-cambiar").onclick = () => { cliente = null; $("#np-busca-cliente").hidden = false; $("#np-paso2").hidden = true; $("#np-cliente-elegido").innerHTML = ""; $("#np-q").focus(); };
      const [ar, pr] = await Promise.all([
        sb.from("articulos").select("id, codigo, descripcion").eq("activo", true).order("descripcion"),
        c.lista_precio_id ? sb.from("precios").select("articulo_id, precio").eq("lista_id", c.lista_precio_id) : Promise.resolve({ data: [] })
      ]);
      if (ar.error || pr.error) { $("#np-articulos").innerHTML = `<tr><td colspan="4" class="error">${esc(mensajeError(ar.error || pr.error))}</td></tr>`; return; }
      const precio = Object.fromEntries((pr.data || []).map(x => [x.articulo_id, x.precio]));
      articulos = ar.data.map(a => ({ ...a, precio: precio[a.id] ?? null }));
      pintarArticulos(); resumen();
      $("#np-art-q").focus();
    };
    const buscarClientes = () => {
      const t = $("#np-q").value.trim().toLowerCase();
      const res = clientes.filter(c => !t || [c.usuario, c.nombre, c.apellido, c.cuit, c.email].join(" ").toLowerCase().includes(t)).slice(0, 8);
      $("#np-resultados").innerHTML = res.length ? res.map(c => `<li><button type="button" data-id="${c.id}">
          <strong>${esc(c.usuario || "")}</strong> ${esc(nombreCliente(c))} <span class="ayuda">CUIT ${esc(c.cuit || "—")}</span></button></li>`).join("")
        : `<li class="ayuda">${clientes.length ? "No hay clientes activos con esa búsqueda." : "Todavía no hay clientes activos."}</li>`;
      $("#np-resultados").querySelectorAll("button[data-id]").forEach(b => b.onclick = () => elegir(clientes.find(c => c.id === b.dataset.id)));
    };

    ventana({
      titulo: "Nuevo pedido para un cliente", ancho: true,
      cuerpo: `<p class="ayuda">Para pedidos que llegan por WhatsApp, teléfono o en persona. Queda a nombre del cliente, con los precios de su lista, y él lo ve en <strong>Mis pedidos</strong>.</p>
        <label for="np-q">Cliente</label>
        <div id="np-cliente-elegido" class="np-elegido"></div>
        <div id="np-busca-cliente">
          <input id="np-q" type="search" placeholder="Buscar por usuario, nombre o CUIT" autocomplete="off">
          <ul id="np-resultados" class="np-resultados"></ul>
        </div>
        <div id="np-paso2" hidden>
          <label for="np-art-q">Artículos</label>
          <input id="np-art-q" type="search" placeholder="Buscar por código o descripción" autocomplete="off">
          <div class="tabla-caja np-tabla"><table>
            <thead><tr><th>Código</th><th>Descripción</th><th class="num">Precio</th><th class="num">Cantidad</th></tr></thead>
            <tbody id="np-articulos"><tr><td colspan="4" class="vacio">Cargando…</td></tr></tbody>
          </table></div>
          <p id="np-resumen" class="np-resumen"></p>
          <label for="np-obs">Observaciones (opcional)</label>
          <textarea id="np-obs" maxlength="500" rows="2" placeholder="Ej.: pedido por WhatsApp, retira el jueves"></textarea>
          <label class="check"><input type="checkbox" id="np-aceptar" checked> <span>Aceptarlo ahora (pasa directo a <strong>Armando</strong>)</span></label>
        </div>`,
      botones: [{ texto: "Cancelar" }, { texto: "Crear pedido", clase: "btn--rojo", accion: async () => {
        if (!cliente) throw new Error("Elegí el cliente.");
        if ($("#np-paso2").querySelector(".np-cant--mal")) throw new Error("Revisá las cantidades marcadas en rojo.");
        const items = Object.entries(cant).map(([id, c]) => ({ articulo_id: Number(id), cantidad: c }));
        if (!items.length) throw new Error("Cargá la cantidad de al menos un artículo.");
        const { data: p, error } = await sb.rpc("crear_pedido_para", {
          p_cliente: cliente.id, p_items: items, p_observaciones: $("#np-obs").value.trim() || null, p_aceptar: $("#np-aceptar").checked
        });
        if (error) throw error;
        avisar(`Pedido N.º ${p.numero} creado para ${cliente.usuario || nombreCliente(cliente)}.`);
        refrescar();
        mostrar(p);
        return false;
      } }]
    });
    $("#np-q").oninput = buscarClientes;
    $("#np-art-q").oninput = () => { filtroArt = $("#np-art-q").value.trim(); pintarArticulos(); };
    buscarClientes();
    $("#np-q").focus();
  };

  const listar = async () => {
    let q = sb.from("pedidos")
      .select("numero, estado, creado, total, observaciones, aceptado, retirado, cancelado, perfiles!pedidos_cliente_id_fkey(usuario, nombre, apellido, email, cuit), pedido_items(count)")
      .order("creado", { ascending: ["en_espera", "armando"].includes(filtro) })
      .limit(300);
    if (filtro !== "todos") q = q.eq("estado", filtro);
    const { data, error } = await q;
    if (error) throw error;
    const t = busqueda.toLowerCase();
    const filas = data.filter(p => !t || String(p.numero).includes(t) ||
      [p.perfiles?.usuario, p.perfiles?.nombre, p.perfiles?.apellido, p.perfiles?.cuit, p.perfiles?.email].join(" ").toLowerCase().includes(t));
    const conAccion = esAdmin && filtro === "en_espera";
    const [titulo, texto] = TITULOS[filtro];

    contenido.innerHTML = `<div class="cabecera"><div><h1>${esc(titulo)}</h1>
        <p>${texto}${texto ? " " : ""}La lista se actualiza cada 30 segundos.</p></div>
        <div class="botones-cabecera">${esAdmin ? '<button class="btn btn--rojo" type="button" id="nuevo-pedido">+ Nuevo pedido</button>' : ""}
        <button class="btn btn--linea" type="button" id="actualizar">Actualizar</button></div></div>
      <div class="herramientas"><input type="search" id="buscar" placeholder="Buscar por número, cliente o CUIT" aria-label="Buscar pedido" value="${esc(busqueda)}">
        <span class="ayuda">${filas.length} pedido${filas.length === 1 ? "" : "s"}</span></div>
      <div class="tabla-caja"><table>
        <thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th class="num">Renglones</th><th class="num">Total estimado</th>${conAccion ? '<th>Acción</th>' : ""}</tr></thead>
        <tbody>${filas.length ? filas.map(p => `<tr class="clic" data-numero="${p.numero}" tabindex="0">
          <td><strong>${p.numero}</strong></td><td>${esc(fecha(p.creado))}</td>
          <td><strong>${esc(p.perfiles?.usuario || "")}</strong> ${esc(nombreCliente(p.perfiles))}${p.observaciones ? ' <span class="chip chip--gris" title="Tiene observaciones">Obs.</span>' : ""}</td>
          <td>${chipPedido(p.estado)}</td><td class="num">${p.pedido_items?.[0]?.count ?? 0}</td><td class="num">${esc(plata(p.total))}</td>
          ${conAccion ? `<td><span class="accion-pedido">
            <button type="button" class="icono-accion icono-accion--si" data-aceptar="${p.numero}" title="Aceptar pedido ${p.numero}" aria-label="Aceptar pedido ${p.numero}">✓</button>
            <button type="button" class="icono-accion icono-accion--no" data-cancelar="${p.numero}" title="Cancelar pedido ${p.numero}" aria-label="Cancelar pedido ${p.numero}">✕</button>
          </span></td>` : ""}</tr>`).join("")
          : `<tr><td colspan="${conAccion ? 7 : 6}" class="vacio">No hay pedidos en este estado.</td></tr>`}</tbody>
      </table></div>`;

    $("#actualizar").onclick = refrescar;
    if (esAdmin) $("#nuevo-pedido").onclick = nuevoPedido;
    const b = $("#buscar");
    b.oninput = () => { busqueda = b.value.trim(); clearTimeout(b._t); b._t = setTimeout(() => listar().then(() => { const n = $("#buscar"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }), 300); };
    contenido.querySelectorAll("tr[data-numero]").forEach(tr => {
      tr.onclick = e => { if (!e.target.closest("button")) abrir(Number(tr.dataset.numero)); };
      tr.onkeydown = e => { if (e.key === "Enter" && !e.target.closest("button")) abrir(Number(tr.dataset.numero)); };
    });
    contenido.querySelectorAll("[data-aceptar]").forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      try { await aceptar(Number(btn.dataset.aceptar)); } catch (ex) { avisar(mensajeError(ex), true); btn.disabled = false; }
    });
    contenido.querySelectorAll("[data-cancelar]").forEach(btn => btn.onclick = () => cancelar(Number(btn.dataset.cancelar)));
  };

  // ---------- Armado: pesadas y bultos ----------
  const kg = n => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  // "4,255" → 4.255 · "1.250,5" → 1250.5 · "4.255" (sin coma) → 4.255
  const numero = t => {
    t = String(t || "").trim().replace(/\s/g, "");
    if (!t) return null;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };
  const avance = i => {
    const dif = Math.round((Number(i.cantidad_pesada || 0) - Number(i.cantidad)) * 100) / 100;
    if (!Number(i.cantidad_pesada)) return '<span class="chip chip--gris">Sin pesar</span>';
    if (dif === 0) return '<span class="chip chip--verde">Completo ✓</span>';
    return dif < 0 ? `<span class="chip chip--ambar">Faltan ${esc(cantidad(-dif))}</span>`
                   : `<span class="chip chip--rojo">Sobran ${esc(cantidad(dif))}</span>`;
  };
  const pendientes = p => p.items.filter(i => Math.round((Number(i.cantidad_pesada || 0) - Number(i.cantidad)) * 100) !== 0);

  const fichaPedido = p => `
    <div class="ficha">
      <div><b>Estado</b>${chipPedido(p.estado)}</div>
      <div><b>Fecha del pedido</b>${esc(fecha(p.creado))}</div>
      <div><b>Cliente</b>${esc(p.cliente?.usuario || "—")}<br>${esc(nombreCliente(p.cliente))}</div>
      <div><b>CUIT</b>${esc(p.cliente?.cuit || "—")}</div>
      <div><b>Email</b>${esc(p.cliente?.email || "—")}</div>
      <div><b>Total estimado</b>${esc(plata(p.total))}</div>
      ${p.cargado_por ? `<div><b>Cargado por</b>${esc(p.cargado_por)}</div>` : ""}
      ${p.aceptado ? `<div><b>Aceptado</b>${esc(fecha(p.aceptado))}</div>` : ""}
      ${p.retirado ? `<div><b>Retirado</b>${esc(fecha(p.retirado))}</div>` : ""}
      ${p.cancelado ? `<div><b>Cancelado</b>${esc(fecha(p.cancelado))}</div>` : ""}
    </div>
    ${p.motivo_cancelacion ? `<p class="nota"><b>Motivo de cancelación:</b> ${esc(p.motivo_cancelacion)}</p>` : ""}
    ${p.observaciones ? `<p class="nota"><b>Observaciones del cliente:</b> ${esc(p.observaciones)}</p>` : ""}`;

  // Tabla de renglones. En "armando" se puede pesar y poner bultos; en "retirado" se ve lo que se pesó.
  const tablaItems = p => {
    const armando = p.estado === "armando";
    const huboArmado = armando || p.items.some(i => Number(i.cantidad_pesada) || i.bultos != null);
    if (!huboArmado) return `<div class="tabla-caja"><table>
      <thead><tr><th>Código</th><th>Descripción</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${p.items.map(i => `<tr><td><strong>${esc(i.codigo)}</strong></td><td>${esc(i.descripcion)}</td>
        <td class="num"><strong>${esc(cantidad(i.cantidad))}</strong></td><td class="num">${esc(plata(i.precio_unitario))}</td>
        <td class="num">${i.subtotal == null ? "—" : esc(plata(i.subtotal))}</td></tr>`).join("")}</tbody>
    </table></div>`;

    const totKg = p.items.reduce((t, i) => t + Number(i.kilos || 0), 0);
    const totBultos = p.items.reduce((t, i) => t + Number(i.bultos || 0), 0);
    const falta = pendientes(p).length;
    return `${armando ? `<p class="ayuda">Por cada renglón cargá las pesadas (<strong>Peso o Kilos</strong> y <strong>Cantidad pesada</strong>) hasta que la cantidad pesada sea igual a la pedida.</p>` : ""}
    <div class="tabla-caja"><table class="armado">
      <thead><tr><th>Código</th><th>Descripción</th><th class="num">Cantidad pedida</th><th class="num">Peso o Kilos</th><th class="num">Cantidad pesada</th><th class="num">Bultos</th></tr></thead>
      <tbody>${p.items.map(i => `<tr class="armado__item">
          <td><strong>${esc(i.codigo)}</strong></td><td>${esc(i.descripcion)}</td>
          <td class="num"><strong>${esc(cantidad(i.cantidad))}</strong></td>
          <td class="num">${esc(kg(i.kilos))} kg</td>
          <td class="num">${esc(cantidad(i.cantidad_pesada || 0))}<br>${avance(i)}</td>
          <td class="num">${armando
            ? `<input class="armado__bultos" type="text" inputmode="numeric" data-item="${i.id}" value="${i.bultos ?? ""}" placeholder="—" aria-label="Bultos de ${esc(i.descripcion)}">`
            : esc(i.bultos ?? "—")}</td></tr>
        <tr class="armado__pesadas"><td colspan="6">
          ${i.pesadas.length ? `<ol class="pesadas">${i.pesadas.map((w, n) => `<li>
              <span class="pesadas__n">Pesada ${n + 1}</span> ${esc(kg(w.kilos))} kg · cantidad ${esc(cantidad(w.cantidad))}
              ${armando ? `<button type="button" class="pesadas__quitar" data-quitar="${w.id}" title="Quitar la pesada ${n + 1}" aria-label="Quitar la pesada ${n + 1} de ${esc(i.descripcion)}">✕</button>` : ""}</li>`).join("")}</ol>`
            : armando ? "" : '<span class="ayuda">Sin pesadas.</span>'}
          ${armando ? `<div class="pesar" data-item="${i.id}">
              <label>Peso o Kilos <input class="pesar__kilos" type="text" inputmode="decimal" placeholder="0,000" aria-label="Peso o kilos para ${esc(i.descripcion)}"></label>
              <label>Cantidad pesada <input class="pesar__cant" type="text" inputmode="decimal" value="${(() => { const r = Math.round((Number(i.cantidad) - Number(i.cantidad_pesada || 0)) * 100) / 100; return r > 0 ? esc(cantidad(r)) : ""; })()}" aria-label="Cantidad pesada para ${esc(i.descripcion)}"></label>
              <button type="button" class="btn btn--linea btn--chico pesar__agregar">+ Agregar pesada</button>
            </div>` : ""}
        </td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="3"><strong>Totales</strong>${armando ? ` · ${falta ? `${falta} renglón${falta === 1 ? "" : "es"} sin completar` : "todo pesado ✓"}` : ""}</td>
        <td class="num"><strong>${esc(kg(totKg))} kg</strong></td><td></td><td class="num"><strong>${esc(cantidad(totBultos))}</strong></td></tr></tfoot>
    </table></div>`;
  };

  const detalle = p => fichaPedido(p) + `<div id="items-pedido">${tablaItems(p)}</div>`;

  // Conecta los controles de armado. Cada cambio se guarda en la base y se redibuja la tabla.
  const conectarArmado = p => {
    const caja = $("#items-pedido");
    if (!caja || p.estado !== "armando") return;
    const actualizar = (nuevo, foco) => {
      Object.assign(p, nuevo);
      caja.innerHTML = tablaItems(p);
      conectarArmado(p);
      if (foco) caja.querySelector(`.pesar[data-item="${foco}"] .pesar__kilos`)?.focus();
    };
    const llamar = async (fn, args, boton, foco) => {
      if (boton) boton.disabled = true;
      try {
        const { data, error } = await sb.rpc(fn, args);
        if (error) throw error;
        actualizar(data, foco);
        return true;
      } catch (ex) { avisar(mensajeError(ex), true); if (boton) boton.disabled = false; return false; }
    };
    caja.querySelectorAll(".pesar").forEach(f => {
      const kilos = f.querySelector(".pesar__kilos"), cant = f.querySelector(".pesar__cant"), btn = f.querySelector(".pesar__agregar");
      const agregar = () => {
        const k = numero(kilos.value), c = numero(cant.value);
        kilos.classList.toggle("np-cant--mal", !(k > 0)); cant.classList.toggle("np-cant--mal", !(c > 0));
        if (!(k > 0)) { kilos.focus(); return avisar("Escribí el peso en kilos (por ejemplo 4,255).", true); }
        if (!(c > 0)) { cant.focus(); return avisar("Escribí la cantidad pesada.", true); }
        llamar("agregar_pesada", { p_item: Number(f.dataset.item), p_kilos: k, p_cantidad: c }, btn, f.dataset.item);
      };
      btn.onclick = agregar;
      [kilos, cant].forEach(inp => inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); agregar(); } });
    });
    caja.querySelectorAll("[data-quitar]").forEach(b => b.onclick = () => {
      if (confirm("¿Quitar esta pesada?")) llamar("quitar_pesada", { p_pesada: Number(b.dataset.quitar) }, b);
    });
    caja.querySelectorAll(".armado__bultos").forEach(inp => {
      inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } };
      inp.onchange = () => {
        const t = inp.value.trim();
        const b = t === "" ? null : Number(t);
        if (b !== null && !(Number.isInteger(b) && b >= 0)) { inp.classList.add("np-cant--mal"); return avisar("Los bultos van en número entero (0, 1, 2…).", true); }
        llamar("guardar_bultos", { p_item: Number(inp.dataset.item), p_bultos: b }).then(ok => ok && avisar("Bultos guardados."));
      };
    });
  };

  const abrir = async numero => {
    try {
      const { data: p, error } = await sb.rpc("abrir_pedido", { p_numero: numero });
      if (error) throw error;
      mostrar(p);
    } catch (ex) { avisar(mensajeError(ex), true); }
  };

  const mostrar = p => {
    const botones = [{ texto: "Imprimir", accion: () => { print(); return false; } }];
    if (esAdmin && p.estado === "en_espera") {
      botones.push({ texto: "Cancelar pedido", clase: "btn--peligro", accion: () => { cancelar(p.numero); return false; } });
      botones.push({ texto: "Aceptar pedido", clase: "btn--rojo", accion: async () => { await aceptar(p.numero); } });
    } else if (p.estado === "armando") {
      botones.push({ texto: "Marcar como retirado", clase: "btn--rojo", accion: async () => {
        const falta = pendientes(p);
        const aviso = falta.length
          ? `Hay ${falta.length} renglón${falta.length === 1 ? "" : "es"} donde la cantidad pesada no es igual a la pedida:\n${falta.map(i => "• " + i.descripcion).join("\n")}\n\n¿Marcar el pedido N.º ${p.numero} como retirado igual?`
          : `¿Confirmás que el cliente retiró el pedido N.º ${p.numero}?`;
        if (!confirm(aviso)) return false;
        const { error } = await sb.rpc("marcar_retirado", { p_numero: p.numero });
        if (error) throw error;
        avisar(`Pedido ${p.numero} retirado: pasó a Retirados.`);
        refrescar();
      } });
    }
    botones.push({ texto: "Cerrar" });
    ventana({ titulo: `Pedido N.º ${p.numero}`, ancho: true, cuerpo: detalle(p), botones });
    conectarArmado(p);
  };

  const refrescar = async () => {
    try { await Promise.all([listar(), contar()]); }
    catch (ex) { contenido.innerHTML = `<p class="error">${esc(mensajeError(ex))}</p>`; }
  };

  const irA = () => {
    const h = location.hash.slice(1);
    filtro = FILTROS.includes(h) ? h : INICIAL;
    document.querySelectorAll(".pestanas a[href^='#']").forEach(a => {
      if (a.getAttribute("href") === "#" + filtro) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    refrescar();
  };
  window.addEventListener("hashchange", irA);
  setInterval(() => {
    if (document.hidden || $("#ventana").open || document.activeElement?.id === "buscar") { contar().catch(() => {}); return; }
    refrescar();
  }, 30000);
  irA();
})();
