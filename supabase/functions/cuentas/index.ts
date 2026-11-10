// =====================================================================
// Lácteos NC — Edge Function "cuentas"
// Registro de clientes con código de 6 dígitos, reenvío, verificación
// y mail de "cuenta activa". Corre en Supabase con la clave de servicio.
//
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY    clave de Resend para mandar mails
//   MAIL_REMITENTE    ej.: Lácteos NC <no-responder@lacteosnc.com.ar>
//   TURNSTILE_SECRET  clave secreta de Cloudflare Turnstile ("no soy un robot")
//   MAIL_AVISOS       (opcional) mail que recibe el aviso de clientes nuevos
// Acciones: registrar, verificar, reenviar, estado, avisar_activacion, recuperar
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const SITIO = "https://lacteosnc.com.ar";
const ORIGENES = [SITIO, "https://www.lacteosnc.com.ar", "https://lacteosnc.pages.dev", "http://localhost:8765"];

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = (origen: string | null) => ({
  "Access-Control-Allow-Origin": origen && (ORIGENES.includes(origen) || origen.endsWith(".lacteosnc.pages.dev")) ? origen : SITIO,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

class Falla extends Error {
  constructor(public estado: number, mensaje: string, public extra: Record<string, unknown> = {}) { super(mensaje); }
}

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,}$/i;
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// CUIT: 11 dígitos con dígito verificador válido
const cuitValido = (c: string) => {
  if (!/^\d{11}$/.test(c)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(c[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  return dv !== 10 && dv === Number(c[10]);
};

const codigoNuevo = () => {
  const b = new Uint32Array(1);
  do crypto.getRandomValues(b); while (b[0] >= 4294000000); // evita sesgo
  return String(b[0] % 1000000).padStart(6, "0");
};

const esperaTexto = (seg: number) => {
  const m = Math.ceil(seg / 60);
  return m >= 60 ? "1 hora" : m <= 1 ? "1 minuto" : `${m} minutos`;
};

async function captchaOk(token: unknown, ip: string | null) {
  const secreto = Deno.env.get("TURNSTILE_SECRET");
  if (!secreto) throw new Falla(503, "El control \"no soy un robot\" todavía no está configurado. Avisá a la cooperativa.");
  if (typeof token !== "string" || !token) return false;
  const form = new FormData();
  form.append("secret", secreto);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const j = await r.json().catch(() => ({}));
  return j.success === true;
}

async function mandarMail(para: string, asunto: string, html: string, texto: string) {
  const clave = Deno.env.get("RESEND_API_KEY");
  const de = Deno.env.get("MAIL_REMITENTE");
  if (!clave || !de) throw new Falla(503, "El envío de mails todavía no está configurado. Avisá a la cooperativa.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: de, to: [para], subject: asunto, html, text: texto }),
  });
  if (!r.ok) {
    console.error("Resend", r.status, await r.text());
    throw new Falla(502, "No se pudo enviar el mail. Probá de nuevo en unos minutos.");
  }
}

const plantilla = (titulo: string, cuerpo: string) => `<!doctype html><html lang="es"><body style="margin:0;background:#F2F4F7;font-family:Arial,Helvetica,sans-serif;color:#231F20">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#E1141C;padding:18px 24px;color:#fff;font-size:20px;font-weight:bold">Lácteos NC</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${titulo}</h1>${cuerpo}</td></tr>
<tr><td style="padding:16px 24px;background:#F2F4F7;font-size:12px;color:#666">La Emancipación Coop. Ltda. · Jacinto Arauz, La Pampa · <a href="${SITIO}" style="color:#E1141C">lacteosnc.com.ar</a></td></tr>
</table></td></tr></table></body></html>`;

async function mailCodigo(email: string, nombre: string, codigo: string) {
  await mandarMail(email, `Tu código de verificación: ${codigo}`,
    plantilla("Verificá tu email", `<p>Hola${nombre ? " " + esc(nombre) : ""}:</p>
      <p>Tu código para terminar el registro en Lácteos NC es:</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#E1141C;margin:16px 0">${codigo}</p>
      <p>Vence en <strong>20 minutos</strong>. Si no pediste este registro, ignorá este mail.</p>`),
    `Tu código para terminar el registro en Lácteos NC es ${codigo}. Vence en 20 minutos.`);
}

// ---------------------------------------------------------------- acciones
async function registrar(d: Record<string, unknown>, ip: string | null) {
  const email = String(d.email ?? "").trim().toLowerCase();
  const nombre = String(d.nombre ?? "").trim().slice(0, 80);
  const apellido = String(d.apellido ?? "").trim().slice(0, 80);
  const cuit = String(d.cuit ?? "").replace(/\D/g, "");
  const clave = String(d.clave ?? "");

  if (!EMAIL_RE.test(email)) throw new Falla(400, "Revisá el email.");
  if (clave.length < 8 || clave.length > 72) throw new Falla(400, "La contraseña debe tener entre 8 y 72 caracteres.");
  if (!cuitValido(cuit)) throw new Falla(400, "El CUIT no es válido. Son 11 números, sin guiones.");
  if (d.acepto !== true) throw new Falla(400, "Tenés que aceptar los términos y condiciones.");
  if (!(await captchaOk(d.captcha, ip))) throw new Falla(400, "Volvé a tildar \"no soy un robot\".", { captcha: true });

  const est = (await sb.rpc("verif_estado", { p_email: email })).data;
  if (est?.espera_seg > 0) {
    throw new Falla(429, `Por seguridad tenés que esperar ${esperaTexto(est.espera_seg)} antes de registrarte de nuevo.`, { espera_seg: est.espera_seg });
  }

  const { data: existente } = await sb.from("perfiles").select("id, estado").eq("email", email).maybeSingle();
  if (existente && existente.estado !== "pendiente_verificacion") {
    throw new Falla(409, "Ese email ya tiene una cuenta. Ingresá desde Login o usá \"Olvidé mi contraseña\".");
  }
  const { data: otroCuit } = await sb.from("perfiles").select("id").eq("cuit", cuit).maybeSingle();
  if (otroCuit && otroCuit.id !== existente?.id) {
    throw new Falla(409, "Ese CUIT ya está registrado. Si es tuyo, comunicate con la cooperativa.");
  }
  // Registro anterior sin verificar: se reemplaza por el nuevo
  if (existente) await sb.auth.admin.deleteUser(existente.id);

  const { data: creado, error } = await sb.auth.admin.createUser({
    email, password: clave, email_confirm: false,
    user_metadata: { nombre, apellido, cuit, acepto_terminos: true },
  });
  if (error || !creado.user) {
    console.error("createUser", error);
    throw new Falla(400, /password/i.test(error?.message ?? "") ? "Elegí una contraseña más segura." : "No se pudo crear la cuenta. Probá de nuevo.");
  }

  const codigo = codigoNuevo();
  const g = (await sb.rpc("verif_guardar", { p_email: email, p_user_id: creado.user.id, p_codigo: codigo, p_reenvio: false })).data;
  if (!g?.ok) {
    await sb.auth.admin.deleteUser(creado.user.id);
    throw new Falla(429, "No se pudo generar el código. Probá más tarde.");
  }
  try {
    await mailCodigo(email, nombre, codigo);
  } catch (e) {
    await sb.auth.admin.deleteUser(creado.user.id);
    await sb.from("verificaciones").delete().eq("email", email);
    throw e;
  }
  return { ok: true, mensaje: "Te enviamos un código de 6 números a tu email." };
}

async function verificar(d: Record<string, unknown>, ip: string | null) {
  const email = String(d.email ?? "").trim().toLowerCase();
  const codigo = String(d.codigo ?? "").replace(/\D/g, "");
  if (!EMAIL_RE.test(email)) throw new Falla(400, "Revisá el email.");

  const est = (await sb.rpc("verif_estado", { p_email: email })).data;
  const conCaptcha = est?.requiere_captcha && est?.espera_seg === 0 ? await captchaOk(d.captcha, ip) : false;
  const { data: r, error } = await sb.rpc("verif_comprobar", { p_email: email, p_codigo: codigo, p_captcha_ok: conCaptcha });
  if (error) throw new Falla(500, "Error al comprobar el código.");

  switch (r.motivo ?? (r.ok ? "ok" : "")) {
    case "ok": {
      await sb.auth.admin.updateUserById(r.user_id, { email_confirm: true });
      const aviso = Deno.env.get("MAIL_AVISOS");
      if (aviso) {
        const { data: p } = await sb.from("perfiles").select("nombre, apellido, cuit, email").eq("id", r.user_id).single();
        await mandarMail(aviso, "Nuevo cliente para activar",
          plantilla("Nuevo cliente para activar", `<p>${esc(p?.nombre)} ${esc(p?.apellido)} (${esc(p?.email)}, CUIT ${esc(p?.cuit)}) verificó su mail.</p>
            <p>Activalo desde el <a href="${SITIO}/admin/#cuentas">panel</a> asignándole usuario y lista de precio.</p>`),
          `Nuevo cliente para activar: ${p?.email}. Panel: ${SITIO}/admin/#cuentas`).catch((e) => console.error("aviso", e));
      }
      return { ok: true, mensaje: "¡Listo! Tu email quedó verificado." };
    }
    case "incorrecto":
      throw new Falla(400, `Código incorrecto. Esperá ${esperaTexto(r.espera_seg)} para volver a intentar. ` +
        (r.intentos_restantes === 1 ? "Te queda 1 intento." : `Te quedan ${r.intentos_restantes} intentos.`) +
        (r.requiere_captcha ? " La próxima vez vas a tener que tildar \"no soy un robot\"." : ""),
        { espera_seg: r.espera_seg, requiere_captcha: r.requiere_captcha, intentos_restantes: r.intentos_restantes });
    case "espera":
      throw new Falla(429, `Tenés que esperar ${esperaTexto(r.espera_seg)} para volver a intentar.`,
        { espera_seg: r.espera_seg, requiere_captcha: r.requiere_captcha });
    case "captcha":
      throw new Falla(400, "Tildá \"no soy un robot\" para seguir.", { requiere_captcha: true });
    case "vencido":
      throw new Falla(400, "El código venció (dura 20 minutos). Pedí uno nuevo.", { vencido: true });
    case "bloqueado_hora":
      if (r.borrar_usuario) {
        const { data: u } = await sb.auth.admin.getUserById(r.borrar_usuario);
        if (u?.user && !u.user.email_confirmed_at) await sb.auth.admin.deleteUser(r.borrar_usuario);
      }
      throw new Falla(429, "Ingresaste mal el código 6 veces. Por seguridad el registro se canceló: esperá 1 hora y registrate de nuevo.",
        { espera_seg: r.espera_seg, reiniciar: true });
    default:
      throw new Falla(400, "No hay un registro pendiente para ese email. Registrate de nuevo.", { reiniciar: true });
  }
}

async function reenviar(d: Record<string, unknown>, ip: string | null) {
  const email = String(d.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Falla(400, "Revisá el email.");
  if (!(await captchaOk(d.captcha, ip))) throw new Falla(400, "Tildá \"no soy un robot\" para pedir otro código.", { captcha: true });
  const codigo = codigoNuevo();
  const r = (await sb.rpc("verif_guardar", { p_email: email, p_user_id: null, p_codigo: codigo, p_reenvio: true })).data;
  if (!r?.ok) {
    if (r?.motivo === "muy_pronto") throw new Falla(429, `Esperá ${r.espera_seg} segundos para pedir otro código.`, { espera_seg: r.espera_seg });
    if (r?.motivo === "espera") throw new Falla(429, `Tenés que esperar ${esperaTexto(r.espera_seg)}.`, { espera_seg: r.espera_seg });
    throw new Falla(400, "No hay un registro pendiente para ese email. Registrate de nuevo.", { reiniciar: true });
  }
  const { data: p } = await sb.from("perfiles").select("nombre").eq("id", r.user_id).maybeSingle();
  await mailCodigo(email, p?.nombre ?? "", codigo);
  return { ok: true, mensaje: "Te enviamos un código nuevo. El anterior ya no sirve." };
}

async function estado(d: Record<string, unknown>) {
  const email = String(d.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Falla(400, "Revisá el email.");
  const e = (await sb.rpc("verif_estado", { p_email: email })).data;
  return { ok: true, pendiente: !!e?.activo, espera_seg: e?.espera_seg ?? 0, requiere_captcha: !!e?.requiere_captcha };
}

// Mail al cliente cuando el administrador activa la cuenta
async function avisarActivacion(d: Record<string, unknown>, jwt: string | null) {
  if (!jwt) throw new Falla(401, "Sin sesión.");
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) throw new Falla(401, "Sesión vencida.");
  const { data: yo } = await sb.from("perfiles").select("rol, estado").eq("id", u.user.id).single();
  if (!yo || yo.estado !== "activa" || !["administrador", "superadmin"].includes(yo.rol)) throw new Falla(403, "No tenés permiso.");

  const { data: c } = await sb.from("perfiles").select("usuario, nombre, email, estado, rol").eq("id", String(d.perfil_id ?? "")).maybeSingle();
  if (!c || c.estado !== "activa") throw new Falla(400, "La cuenta no está activa.");
  const destino = `${SITIO}/admin/`;
  await mandarMail(c.email, "Tu cuenta de Lácteos NC está activa",
    plantilla("¡Tu cuenta está activa!", `<p>Hola${c.nombre ? " " + esc(c.nombre) : ""}:</p>
      <p>La cooperativa activó tu cuenta. Ya podés ver tu lista de precios y hacer pedidos.</p>
      <table role="presentation" style="margin:12px 0;font-size:15px"><tr><td style="padding:4px 12px 4px 0;color:#666">Usuario</td><td><strong>${esc(c.usuario)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td><strong>${esc(c.email)}</strong></td></tr></table>
      <p>Para ingresar usá tu email y la contraseña que elegiste al registrarte.</p>
      <p><a href="${destino}" style="display:inline-block;background:#E1141C;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Ingresar</a></p>`),
    `La cooperativa activó tu cuenta de Lácteos NC. Usuario: ${c.usuario}. Email: ${c.email}. Ingresá en ${destino}`);
  return { ok: true };
}

// "Olvidé mi contraseña": genera el enlace y lo manda con el diseño de Lácteos NC.
// Siempre responde lo mismo, exista o no la cuenta (no revela qué emails están registrados).
async function recuperar(d: Record<string, unknown>) {
  const email = String(d.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Falla(400, "Escribí un email válido.");
  const respuesta = { ok: true, mensaje: "Si el email está registrado, te llegará un mail de Lácteos NC con un enlace para elegir una contraseña nueva. Revisá también la carpeta de spam." };

  const { data: permitido } = await sb.rpc("recup_permitir", { p_email: email });
  if (!permitido) return respuesta;

  const { data: p } = await sb.from("perfiles").select("nombre, estado").eq("email", email).maybeSingle();
  if (!p || !["activa", "pendiente_activacion"].includes(p.estado)) return respuesta;

  const { data: link, error } = await sb.auth.admin.generateLink({ type: "recovery", email });
  const token = link?.properties?.hashed_token;
  if (error || !token) { console.error("generateLink", error); return respuesta; }

  const enlace = `${SITIO}/admin/?recuperar=${encodeURIComponent(token)}`;
  await mandarMail(email, "Elegí una contraseña nueva — Lácteos NC",
    plantilla("Recuperá tu contraseña", `<p>Hola${p.nombre ? " " + esc(p.nombre) : ""}:</p>
      <p>Recibimos un pedido para cambiar la contraseña de tu cuenta en Lácteos NC. Tocá el botón para elegir una nueva:</p>
      <p style="margin:20px 0"><a href="${enlace}" style="display:inline-block;background:#E1141C;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Elegir contraseña nueva</a></p>
      <p style="font-size:13px;color:#666">Por seguridad el enlace vence en 1 hora y se puede usar una sola vez.</p>
      <p style="font-size:13px;color:#666">Si no pediste este cambio, ignorá este mail: tu contraseña sigue siendo la misma.</p>`),
    `Recibimos un pedido para cambiar la contraseña de tu cuenta en Lácteos NC. Elegí una nueva acá (vence en 1 hora): ${enlace} — Si no lo pediste, ignorá este mail.`);
  return respuesta;
}

// ------------------------------------------------------------------ servidor
Deno.serve(async (req) => {
  const h = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const responder = (estado: number, cuerpo: unknown) =>
    new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method !== "POST") return responder(405, { error: "Método no permitido" });

  try {
    const d = await req.json().catch(() => ({})) as Record<string, unknown>;
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    switch (d.accion) {
      case "registrar": return responder(200, await registrar(d, ip));
      case "verificar": return responder(200, await verificar(d, ip));
      case "reenviar": return responder(200, await reenviar(d, ip));
      case "estado": return responder(200, await estado(d));
      case "avisar_activacion": return responder(200, await avisarActivacion(d, jwt));
      case "recuperar": return responder(200, await recuperar(d));
      default: return responder(400, { error: "Acción desconocida" });
    }
  } catch (e) {
    if (e instanceof Falla) return responder(e.estado, { error: e.message, ...e.extra });
    console.error(e);
    return responder(500, { error: "Ocurrió un error inesperado. Probá de nuevo." });
  }
});
