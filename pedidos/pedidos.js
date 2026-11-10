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

  const listar = async () => {
    let q = sb.from("pedidos")
      .select("numero, estado, creado, total, observaciones, aceptado, retirado, cancelado, perfiles(usuario, nombre, apellido, email, cuit), pedido_items(count)")
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
        <button class="btn btn--linea" type="button" id="actualizar">Actualizar</button></div>
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

  const detalle = p => `
    <div class="ficha">
      <div><b>Estado</b>${chipPedido(p.estado)}</div>
      <div><b>Fecha del pedido</b>${esc(fecha(p.creado))}</div>
      <div><b>Cliente</b>${esc(p.cliente?.usuario || "—")}<br>${esc(nombreCliente(p.cliente))}</div>
      <div><b>CUIT</b>${esc(p.cliente?.cuit || "—")}</div>
      <div><b>Email</b>${esc(p.cliente?.email || "—")}</div>
      <div><b>Total estimado</b>${esc(plata(p.total))}</div>
      ${p.aceptado ? `<div><b>Aceptado</b>${esc(fecha(p.aceptado))}</div>` : ""}
      ${p.retirado ? `<div><b>Retirado</b>${esc(fecha(p.retirado))}</div>` : ""}
      ${p.cancelado ? `<div><b>Cancelado</b>${esc(fecha(p.cancelado))}</div>` : ""}
    </div>
    ${p.motivo_cancelacion ? `<p class="nota"><b>Motivo de cancelación:</b> ${esc(p.motivo_cancelacion)}</p>` : ""}
    ${p.observaciones ? `<p class="nota"><b>Observaciones del cliente:</b> ${esc(p.observaciones)}</p>` : ""}
    <div class="tabla-caja"><table>
      <thead><tr><th>Código</th><th>Descripción</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${p.items.map(i => `<tr><td><strong>${esc(i.codigo)}</strong></td><td>${esc(i.descripcion)}</td>
        <td class="num"><strong>${esc(cantidad(i.cantidad))}</strong></td><td class="num">${esc(plata(i.precio_unitario))}</td>
        <td class="num">${i.subtotal == null ? "—" : esc(plata(i.subtotal))}</td></tr>`).join("")}</tbody>
    </table></div>`;

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
        if (!confirm(`¿Confirmás que el cliente retiró el pedido N.º ${p.numero}?`)) return false;
        const { error } = await sb.rpc("marcar_retirado", { p_numero: p.numero });
        if (error) throw error;
        avisar(`Pedido ${p.numero} retirado: pasó a Retirados.`);
        refrescar();
      } });
    }
    botones.push({ texto: "Cerrar" });
    ventana({ titulo: `Pedido N.º ${p.numero}`, ancho: true, cuerpo: detalle(p), botones });
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
