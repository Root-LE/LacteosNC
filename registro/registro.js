/* Lácteos NC — registro de clientes con código de 6 dígitos */
(() => {
  "use strict";
  const { $, funcion, captcha, mensajeError } = window.NC;
  const CLAVE = "nc-registro";
  const VIGENCIA = 20 * 60 * 1000;

  let estado = leer() || {};        // { email, enviado }
  let robot1 = null, robot2 = null;
  let esperaHasta = 0, timer = null, pideCaptcha = false;

  function leer() { try { return JSON.parse(sessionStorage.getItem(CLAVE)); } catch { return null; } }
  function guardar() { try { sessionStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin almacenamiento */ } }

  const paso = n => {
    $("#form-datos").hidden = n !== 1;
    $("#form-codigo").hidden = n !== 2;
    $("#listo").hidden = n !== 3;
    [1, 2, 3].forEach(i => $("#paso-" + i).toggleAttribute("aria-current", i === n));
    document.querySelector('.pasos li[aria-current]')?.setAttribute("aria-current", "step");
  };
  const mostrarError = (sel, texto) => { const e = $(sel); e.textContent = texto; e.hidden = !texto; };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  /* ---------- CUIT ---------- */
  const cuitValido = c => {
    if (!/^\d{11}$/.test(c)) return false;
    const suma = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((s, p, i) => s + p * Number(c[i]), 0);
    let dv = 11 - (suma % 11); if (dv === 11) dv = 0;
    return dv !== 10 && dv === Number(c[10]);
  };
  $("#r-cuit").addEventListener("input", e => {
    const d = e.target.value.replace(/\D/g, "").slice(0, 11);
    e.target.value = d.length > 10 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d;
  });

  /* ---------- Paso 1: datos ---------- */
  const prepararRobot1 = async () => {
    try { robot1 = await captcha($("#robot-1")); }
    catch (ex) { mostrarError("#datos-error", ex.message); $("#form-datos button[type=submit]").disabled = true; }
  };

  $("#form-datos").onsubmit = async e => {
    e.preventDefault();
    mostrarError("#datos-error", "");
    const datos = {
      nombre: $("#r-nombre").value.trim(), apellido: $("#r-apellido").value.trim(),
      clave: $("#r-clave").value, cuit: $("#r-cuit").value.replace(/\D/g, ""),
      email: $("#r-email").value.trim().toLowerCase(), acepto: $("#r-acepto").checked
    };
    if (datos.clave.length < 8) return mostrarError("#datos-error", "La contraseña debe tener al menos 8 caracteres.");
    if (datos.clave !== $("#r-clave2").value) return mostrarError("#datos-error", "Las contraseñas no coinciden.");
    if (!cuitValido(datos.cuit)) return mostrarError("#datos-error", "El CUIT no es válido. Revisá los 11 números.");
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(datos.email)) return mostrarError("#datos-error", "Revisá el email.");
    if (!datos.acepto) return mostrarError("#datos-error", "Tenés que aceptar los términos y condiciones.");
    datos.captcha = robot1?.token();
    if (!datos.captcha) return mostrarError("#datos-error", "Tildá \"no soy un robot\".");

    const btn = e.submitter || $("#form-datos button[type=submit]");
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      await funcion("registrar", datos);
      estado = { email: datos.email, enviado: Date.now() };
      guardar();
      $("#r-clave").value = $("#r-clave2").value = "";
      irACodigo(0, false);
    } catch (ex) {
      mostrarError("#datos-error", mensajeError(ex));
    } finally {
      robot1?.reiniciar();
      btn.disabled = false; btn.textContent = "Registrarme";
    }
  };

  /* ---------- Paso 2: código ---------- */
  const irACodigo = (esperaSeg, captchaNecesario) => {
    paso(2);
    $("#c-email").textContent = estado.email;
    $("#c-codigo").value = "";
    mostrarError("#codigo-error", "");
    $("#codigo-ok").hidden = true;
    esperar(esperaSeg);
    necesitaCaptcha(captchaNecesario);
    $("#c-codigo").focus();
  };

  const necesitaCaptcha = async si => {
    pideCaptcha = si;
    if (!si) return;
    $("#robot-2").hidden = false;
    if (!robot2) {
      try { robot2 = await captcha($("#robot-2")); }
      catch (ex) { mostrarError("#codigo-error", ex.message); }
    }
  };

  const esperar = seg => { esperaHasta = seg > 0 ? Date.now() + seg * 1000 : 0; tic(); };
  const tic = () => {
    clearTimeout(timer);
    const ahora = Date.now();
    const resta = esperaHasta - ahora;
    $("#c-enviar").disabled = resta > 0;
    $("#c-espera").hidden = resta <= 0;
    if (resta > 0) $("#c-espera").innerHTML = `Podés volver a intentar en <strong>${mmss(resta)}</strong>`;
    if (estado.enviado) {
      const vence = estado.enviado + VIGENCIA - ahora;
      $("#c-vence").innerHTML = vence > 0 ? `El código vence en <strong>${mmss(vence)}</strong>` : "El código venció. Pedí uno nuevo.";
    } else $("#c-vence").textContent = "";
    timer = setTimeout(tic, 1000);
  };

  $("#c-codigo").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });

  const reaccionar = ex => {
    const d = ex.datos || {};
    mostrarError("#codigo-error", mensajeError(ex));
    if (d.reiniciar) {
      sessionStorage.removeItem(CLAVE);
      estado = {};
      $("#c-enviar").disabled = true;
      $("#c-reenviar").hidden = true;
    }
    if (d.espera_seg) esperar(d.espera_seg);
    if (d.requiere_captcha || d.captcha) necesitaCaptcha(true);
  };

  $("#form-codigo").onsubmit = async e => {
    e.preventDefault();
    mostrarError("#codigo-error", ""); $("#codigo-ok").hidden = true;
    const codigo = $("#c-codigo").value;
    if (!/^\d{6}$/.test(codigo)) return mostrarError("#codigo-error", "El código tiene 6 números.");
    const datos = { email: estado.email, codigo };
    if (pideCaptcha) {
      datos.captcha = robot2?.token();
      if (!datos.captcha) return mostrarError("#codigo-error", "Tildá \"no soy un robot\" para seguir.");
    }
    $("#c-enviar").disabled = true;
    try {
      await funcion("verificar", datos);
      sessionStorage.removeItem(CLAVE);
      clearTimeout(timer);
      paso(3);
    } catch (ex) {
      reaccionar(ex);
      $("#c-codigo").select();
    } finally {
      robot2?.reiniciar();
      if (esperaHasta <= Date.now() && estado.email) $("#c-enviar").disabled = false;
    }
  };

  $("#c-reenviar").onclick = async () => {
    mostrarError("#codigo-error", ""); $("#codigo-ok").hidden = true;
    if (!robot2 || $("#robot-2").hidden) {
      await necesitaCaptcha(true);
      return mostrarError("#codigo-error", "Tildá \"no soy un robot\" y tocá de nuevo \"enviar otro código\".");
    }
    const token = robot2.token();
    if (!token) return mostrarError("#codigo-error", "Tildá \"no soy un robot\" y tocá de nuevo \"enviar otro código\".");
    const btn = $("#c-reenviar"); btn.disabled = true;
    try {
      const r = await funcion("reenviar", { email: estado.email, captcha: token });
      estado.enviado = Date.now(); guardar();
      const ok = $("#codigo-ok"); ok.textContent = r.mensaje; ok.hidden = false;
      $("#c-codigo").value = ""; $("#c-codigo").focus();
    } catch (ex) { reaccionar(ex); }
    finally { robot2.reiniciar(); btn.disabled = false; }
  };

  $("#c-volver").onclick = () => { clearTimeout(timer); paso(1); if (!robot1) prepararRobot1(); };

  /* ---------- Inicio ---------- */
  (async () => {
    const pedido = new URLSearchParams(location.search).get("verificar");
    if (pedido) { estado = { email: pedido.trim().toLowerCase(), enviado: estado.email === pedido ? estado.enviado : 0 }; guardar(); }
    if (estado.email) {
      try {
        const r = await funcion("estado", { email: estado.email });
        if (r.pendiente || r.espera_seg) { irACodigo(r.espera_seg, r.requiere_captcha); return; }
      } catch { /* sigue al paso 1 */ }
      sessionStorage.removeItem(CLAVE); estado = {};
      if (pedido) mostrarError("#datos-error", "No hay un registro pendiente para ese email. Registrate de nuevo.");
    }
    paso(1);
    prepararRobot1();
  })();
})();
