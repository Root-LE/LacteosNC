/* =====================================================================
   Lácteos NC — configuración pública de Supabase
   Esta clave es PÚBLICA (publishable): solo permite lo que dejan las reglas
   de seguridad (RLS) de la base. Nunca poner acá la clave service_role.
   ===================================================================== */
window.NC_CONFIG = {
  supabaseUrl: "https://clztzhkjjulnmdaiobgl.supabase.co",
  supabaseKey: "sb_publishable_je9wdPGOtnUodse0fAR7aA_cYV-TvCX",
  // Clave PÚBLICA del widget de Cloudflare Turnstile ("no soy un robot").
  // La clave secreta va solo en Supabase → Edge Functions → Secrets (TURNSTILE_SECRET).
  turnstileSiteKey: ""
};
