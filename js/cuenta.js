/* =====================================================================
   Lácteos NC — utilidades compartidas de las páginas con cuenta
   (registro, área de clientes y pedidos). Necesita antes:
   /admin/vendor/supabase-2.119.0.js y /js/config.js
   ===================================================================== */
(() => {
  "use strict";
  const C = window.NC_CONFIG;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  const $ = s => document.querySelector(s);
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plata = n => n == null ? "A confirmar" : "$ " + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cantidad = n => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  const fecha = f => new Date(f).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const ESTADOS_PEDIDO = {
    en_espera: ["En espera", "chip--ambar"],
    armando: ["Armando pedido", "chip--azul"],
    retirado: ["Pedido retirado", "chip--verde"]
  };
  const chipPedido = e => `<span class="chip ${ESTADOS_PEDIDO[e]?.[1] || ""}">${esc(ESTADOS_PEDIDO[e]?.[0] || e)}</span>`;

  const mensajeError = err => {
    const m = String(err?.message || err || "");
    if (/Invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
    if (/row-level security|permission denied/i.test(m)) return "No tenés permiso para hacer esto.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "No hay conexión con el servidor. Probá de nuevo.";
    return m || "Ocurrió un error inesperado.";
  };

  let avisoTimer;
  const avisar = (texto, error = false) => {
    const a = $("#aviso");
    if (!a) return alert(texto);
    a.textContent = texto;
    a.classList.toggle("error-aviso", error);
    a.classList.add("ver");
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => a.classList.remove("ver"), error ? 6000 : 3500);
  };

  // Ventana simple: { titulo, cuerpo (html), botones: [{texto, clase, accion}] }
  const ventana = ({ titulo, cuerpo, botones = [], ancho }) => {
    const d = $("#ventana");
    d.classList.toggle("ventana--ancha", !!ancho);
    $("#ventana-titulo").textContent = titulo;
    $("#ventana-cuerpo").innerHTML = cuerpo;
    const err = $("#ventana-error"); err.hidden = true;
    const pie = $("#ventana-pie");
    pie.innerHTML = '<div class="derecha"></div>';
    const der = pie.firstChild;
    botones.forEach(b => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn " + (b.clase || "btn--linea");
      btn.textContent = b.texto;
      btn.onclick = async () => {
        if (!b.accion) return d.close();
        btn.disabled = true; err.hidden = true;
        try { if ((await b.accion()) !== false) d.close(); }
        catch (ex) { err.textContent = mensajeError(ex); err.hidden = false; }
        finally { btn.disabled = false; }
      };
      der.appendChild(btn);
    });
    $("#ventana-cerrar").onclick = () => d.close();
    if (!d.open) d.showModal();
    return d;
  };

  // Llama a la función del servidor "cuentas"
  const funcion = async (accion, datos = {}) => {
    const { data } = await sb.auth.getSession();
    const r = await fetch(`${C.supabaseUrl}/functions/v1/cuentas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: C.supabaseKey,
        Authorization: `Bearer ${data.session?.access_token || C.supabaseKey}`
      },
      body: JSON.stringify({ accion, ...datos })
    });
    const j = await r.json().catch(() => ({ error: "Respuesta inválida del servidor." }));
    if (!r.ok) { const e = new Error(j.error || "Error del servidor."); e.datos = j; e.estado = r.status; throw e; }
    return j;
  };

  // Perfil de la sesión actual (o null)
  const miPerfil = async () => {
    const { data } = await sb.auth.getSession();
    if (!data.session) return null;
    const { data: p } = await sb.from("perfiles")
      .select("id, usuario, nombre, apellido, email, rol, estado, lista_precio_id")
      .eq("id", data.session.user.id).maybeSingle();
    return p || null;
  };

  // Exige sesión activa con alguno de los roles; si no, manda al Login
  const exigir = async roles => {
    const p = await miPerfil();
    if (!p || p.estado !== "activa" || !roles.includes(p.rol)) {
      location.replace("/admin/");
      return new Promise(() => {}); // corta la ejecución mientras redirige
    }
    return p;
  };

  // Formulario de cambio de contraseña dentro de la ventana
  const cambiarClave = () => ventana({
    titulo: "Cambiar mi contraseña",
    cuerpo: `<label for="cc-1">Contraseña nueva (mínimo 8 caracteres)</label>
      <input id="cc-1" type="password" autocomplete="new-password" minlength="8">
      <label for="cc-2">Repetila</label><input id="cc-2" type="password" autocomplete="new-password" minlength="8">`,
    botones: [{ texto: "Cancelar" }, { texto: "Guardar", clase: "btn--rojo", accion: async () => {
      const a = $("#cc-1").value, b = $("#cc-2").value;
      if (a.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
      if (a !== b) throw new Error("Las contraseñas no coinciden.");
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) throw error;
      avisar("Contraseña actualizada.");
    } }]
  });

  const salir = async () => { await sb.auth.signOut(); location.replace("/admin/"); };

  // Cloudflare Turnstile ("no soy un robot")
  let turnstileListo;
  const cargarTurnstile = () => turnstileListo ??= new Promise((ok, mal) => {
    if (!C.turnstileSiteKey) return mal(new Error("El control \"no soy un robot\" todavía no está configurado."));
    window.__ncTurnstile = () => ok(window.turnstile);
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__ncTurnstile";
    s.async = true; s.onerror = () => mal(new Error("No se pudo cargar el control \"no soy un robot\"."));
    document.head.appendChild(s);
  });
  // Devuelve { token(), reiniciar() } para un contenedor
  const captcha = async contenedor => {
    const ts = await cargarTurnstile();
    let token = "";
    const id = ts.render(contenedor, {
      sitekey: C.turnstileSiteKey, language: "es", theme: "light",
      callback: t => { token = t; }, "expired-callback": () => { token = ""; }, "error-callback": () => { token = ""; }
    });
    return { token: () => token, reiniciar: () => { token = ""; ts.reset(id); }, quitar: () => ts.remove(id) };
  };

  window.NC = { sb, $, esc, plata, cantidad, fecha, chipPedido, ESTADOS_PEDIDO, mensajeError, avisar, ventana,
    funcion, miPerfil, exigir, cambiarClave, salir, captcha };
})();
