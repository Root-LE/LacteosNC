/* Lácteos NC — página Pedidos para empleados y administradores */
(async () => {
  "use strict";
  const { sb, $, esc, plata, cantidad, fecha, chipPedido, ESTADOS_PEDIDO, mensajeError, avisar, ventana, exigir, cambiarClave, salir } = window.NC;
  const ROLES = { empleado: "Empleado", administrador: "Administrador", superadmin: "Superadministrador" };

  const perfil = await exigir(["empleado", "administrador", "superadmin"]);
  const contenido = $("#contenido");
  $("#usuario-nombre").textContent = perfil.usuario || [perfil.nombre, perfil.apellido].filter(Boolean).join(" ");
  $("#usuario-rol").textContent = ROLES[perfil.rol];
  $("#ir-panel").hidden = perfil.rol === "empleado";
  $("#btn-mi-clave").onclick = cambiarClave;
  $("#btn-salir").onclick = salir;

  const FILTROS = ["en_espera", "armando", "retirado", "todos"];
  const TITULOS = { en_espera: "Pedidos en espera", armando: "Pedidos que se están armando", retirado: "Pedidos retirados", todos: "Todos los pedidos" };
  let filtro = "en_espera", busqueda = "";

  const nombreCliente = c => [c?.nombre, c?.apellido].filter(Boolean).join(" ") || c?.email || "—";

  // Cantidades por estado para las pestañas y el título de la pestaña del navegador
  const contar = async () => {
    const [esp, arm] = await Promise.all(["en_espera", "armando"].map(e =>
      sb.from("pedidos").select("numero", { count: "exact", head: true }).eq("estado", e)));
    [["en_espera", esp.count], ["armando", arm.count]].forEach(([e, n]) => {
      const c = $("#cont-" + e); c.hidden = !n; c.textContent = n || "";
    });
    document.title = `${esp.count ? `(${esp.count}) ` : ""}Pedidos | Lácteos NC`;
  };

  const listar = async () => {
    let q = sb.from("pedidos")
      .select("numero, estado, creado, total, observaciones, abierto, retirado, perfiles(usuario, nombre, apellido, email, cuit), pedido_items(count)")
      .order("creado", { ascending: filtro !== "en_espera" && filtro !== "armando" ? false : true })
      .limit(300);
    if (filtro !== "todos") q = q.eq("estado", filtro);
    const { data, error } = await q;
    if (error) throw error;
    const t = busqueda.toLowerCase();
    const filas = data.filter(p => !t || String(p.numero).includes(t) ||
      [p.perfiles?.usuario, p.perfiles?.nombre, p.perfiles?.apellido, p.perfiles?.cuit, p.perfiles?.email].join(" ").toLowerCase().includes(t));

    contenido.innerHTML = `<div class="cabecera"><div><h1>${esc(TITULOS[filtro])}</h1>
        <p>Al abrir un pedido <strong>en espera</strong> pasa solo a <strong>armando pedido</strong>. La lista se actualiza cada 30 segundos.</p></div>
        <button class="btn btn--linea" type="button" id="actualizar">Actualizar</button></div>
      <div class="herramientas"><input type="search" id="buscar" placeholder="Buscar por número, cliente o CUIT" aria-label="Buscar pedido" value="${esc(busqueda)}">
        <span class="ayuda">${filas.length} pedido${filas.length === 1 ? "" : "s"}</span></div>
      <div class="tabla-caja"><table>
        <thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th class="num">Renglones</th><th class="num">Total estimado</th></tr></thead>
        <tbody>${filas.length ? filas.map(p => `<tr class="clic" data-numero="${p.numero}" tabindex="0">
          <td><strong>${p.numero}</strong></td><td>${esc(fecha(p.creado))}</td>
          <td><strong>${esc(p.perfiles?.usuario || "")}</strong> ${esc(nombreCliente(p.perfiles))}${p.observaciones ? ' <span class="chip chip--gris" title="Tiene observaciones">Obs.</span>' : ""}</td>
          <td>${chipPedido(p.estado)}</td><td class="num">${p.pedido_items?.[0]?.count ?? 0}</td><td class="num">${esc(plata(p.total))}</td></tr>`).join("")
          : '<tr><td colspan="6" class="vacio">No hay pedidos en este estado.</td></tr>'}</tbody>
      </table></div>`;

    $("#actualizar").onclick = refrescar;
    const b = $("#buscar");
    b.oninput = () => { busqueda = b.value.trim(); clearTimeout(b._t); b._t = setTimeout(() => listar().then(() => { const n = $("#buscar"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }), 300); };
    contenido.querySelectorAll("tr[data-numero]").forEach(tr => {
      tr.onclick = () => abrir(Number(tr.dataset.numero));
      tr.onkeydown = e => { if (e.key === "Enter") abrir(Number(tr.dataset.numero)); };
    });
  };

  const detalle = p => `
    <div class="ficha">
      <div><b>Estado</b>${chipPedido(p.estado)}</div>
      <div><b>Fecha del pedido</b>${esc(fecha(p.creado))}</div>
      <div><b>Cliente</b>${esc(p.cliente?.usuario || "—")}<br>${esc(nombreCliente(p.cliente))}</div>
      <div><b>CUIT</b>${esc(p.cliente?.cuit || "—")}</div>
      <div><b>Email</b>${esc(p.cliente?.email || "—")}</div>
      <div><b>Total estimado</b>${esc(plata(p.total))}</div>
    </div>
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
      refrescar();
    } catch (ex) { avisar(mensajeError(ex), true); }
  };

  const mostrar = p => ventana({
    titulo: `Pedido N.º ${p.numero}`, ancho: true,
    cuerpo: detalle(p),
    botones: [
      { texto: "Imprimir", accion: () => { print(); return false; } },
      ...(p.estado === "armando" ? [{ texto: "Marcar como retirado", clase: "btn--rojo", accion: async () => {
        if (!confirm(`¿Confirmás que el cliente retiró el pedido N.º ${p.numero}?`)) return false;
        const { data, error } = await sb.rpc("marcar_retirado", { p_numero: p.numero });
        if (error) throw error;
        avisar(`Pedido ${data.numero}: ${ESTADOS_PEDIDO.retirado[0].toLowerCase()}.`);
        refrescar();
      } }] : []),
      { texto: "Cerrar", clase: p.estado === "armando" ? "btn--linea" : "btn--rojo" }
    ]
  });

  const refrescar = async () => {
    try { await Promise.all([listar(), contar()]); }
    catch (ex) { contenido.innerHTML = `<p class="error">${esc(mensajeError(ex))}</p>`; }
  };

  const irA = () => {
    const h = location.hash.slice(1);
    filtro = FILTROS.includes(h) ? h : "en_espera";
    document.querySelectorAll(".pestanas a[href^='#']").forEach(a => {
      if (a.getAttribute("href") === "#" + filtro) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    refrescar();
  };
  window.addEventListener("hashchange", irA);
  // Actualización automática (no interrumpe si hay una ventana abierta o se está escribiendo)
  setInterval(() => {
    if (document.hidden || $("#ventana").open || document.activeElement?.id === "buscar") { contar().catch(() => {}); return; }
    refrescar();
  }, 30000);
  irA();
})();
