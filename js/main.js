/* =====================================================================
   Lácteos NC — interacción del sitio
   Para agregar o editar un producto, modificá la lista PRODUCTOS.
   ===================================================================== */

/* Lista de respaldo: se usa si la base de datos no responde.
   Los datos reales se cargan desde Supabase (ver cargarDesdeBase). */
let PRODUCTOS = [
  {
    id: "reggianito", nombre: "Reggianito", familia: "duros", familiaTxt: "Queso duro",
    foco: "40% 70%",
    desc: "Horma de corteza negra y pasta firme. El clásico para rallar sobre pastas, sopas y gratinados.",
    datos: [["Tipo", "Duro, de rallar"], ["Corteza", "Negra"], ["Ideal para", "Pastas y gratinados"]]
  },
  {
    id: "sbrinz", nombre: "Sbrinz", familia: "duros", familiaTxt: "Queso duro",
    foco: "30% 60%",
    desc: "Estacionado durante 8 meses. Sabor intenso y pasta que se quiebra en lascas. Para rallar o para comer en trozos con un buen vino.",
    datos: [["Maduración", "8 meses"], ["Tipo", "Duro"], ["Ideal para", "Rallar y picadas"]]
  },
  {
    id: "sardo", nombre: "Sardo", familia: "duros", familiaTxt: "Queso duro",
    foco: "50% 55%",
    desc: "Horma negra de sabor pronunciado y levemente picante. Rinde en la picada y rallado sobre cualquier plato.",
    datos: [["Tipo", "Duro"], ["Corteza", "Negra"], ["Ideal para", "Picadas y rallar"]]
  },
  {
    id: "pategras", nombre: "Pategrás", familia: "semiduros", familiaTxt: "Queso semiduro",
    foco: "60% 50%",
    desc: "Horma de corteza roja, pasta amarilla con ojos y sabor suave. Va bien en sándwiches, tablas y para fundir.",
    datos: [["Tipo", "Semiduro"], ["Corteza", "Roja"], ["Ideal para", "Sándwiches y tablas"]]
  },
  {
    id: "gouda-ahumado", nombre: "Gouda ahumado", familia: "semiduros", familiaTxt: "Queso semiduro saborizado",
    foco: "45% 55%",
    desc: "Queso tipo gouda con sabor ahumado. Se presenta en horma entera y en trozos envasados.",
    datos: [["Tipo", "Semiduro saborizado"], ["Presentación", "Horma y trozos"], ["Ideal para", "Picadas y burgers"]]
  },
  {
    id: "gouda-pesto", nombre: "Gouda sabor pesto", familia: "semiduros", familiaTxt: "Queso semiduro saborizado",
    foco: "50% 50%",
    desc: "Gouda con albahaca y especias en toda la pasta. Color verde y aroma a pesto, para sorprender en la tabla.",
    datos: [["Tipo", "Semiduro saborizado"], ["Presentación", "Horma y trozos"], ["Ideal para", "Tablas y tartas"]]
  },
  {
    id: "provoleta", nombre: "Provoleta", familia: "hilados", familiaTxt: "Pasta hilada",
    foco: "42% 60%",
    desc: "Para la parrilla: se dora por fuera y queda cremosa por dentro. Con orégano y ají molido, no falla.",
    datos: [["Tipo", "Pasta hilada"], ["Ideal para", "Parrilla y horno"]]
  },
  {
    id: "mozzarella", nombre: "Mozzarella", familia: "hilados", familiaTxt: "Pasta hilada",
    foco: "38% 55%",
    desc: "Funde parejo y estira. La base de toda buena pizza casera.",
    datos: [["Tipo", "Pasta hilada"], ["Ideal para", "Pizzas y empanadas"]]
  },
  {
    id: "dulce-de-leche", nombre: "Dulce de leche repostero", familia: "cremas", familiaTxt: "Dulces", nuevo: true,
    foco: "50% 45%",
    desc: "Firme, ideal para rellenar tortas, alfajores y facturas sin que se escurra. Libre de gluten.",
    datos: [["Presentación", "Pote de 400 g"], ["Apto", "Sin gluten"], ["Ideal para", "Repostería"]]
  },
  {
    id: "crema-batir", nombre: "Crema para batir", familia: "cremas", familiaTxt: "Cremas", nuevo: true,
    foco: "30% 70%",
    desc: "Pasteurizada, con un mínimo de 35 % de materia grasa para que monte bien.",
    datos: [["Presentación", "200 cc"], ["Tenor graso", "35 % mín."], ["Ideal para", "Batir y cocinar"]]
  },
  {
    id: "crema-de-leche", nombre: "Crema de leche estilo campo", familia: "cremas", familiaTxt: "Cremas", nuevo: true,
    foco: "50% 50%",
    desc: "Pasteurizada, espesa y con sabor a crema de tambo. Para salsas, postres y frutas.",
    datos: [["Presentación", "400 cc"], ["Tipo", "Pasteurizada"], ["Ideal para", "Salsas y postres"]]
  }
];

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Menú móvil ---------- */
  const toggle = document.querySelector(".header__toggle");
  const nav = document.getElementById("menu");
  const cerrarMenu = () => {
    nav.classList.remove("abierto");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú");
  };
  toggle.addEventListener("click", () => {
    const abierto = nav.classList.toggle("abierto");
    toggle.setAttribute("aria-expanded", String(abierto));
    toggle.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
  });
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", cerrarMenu));

  /* ---------- Marca la sección visible en el menú ---------- */
  const enlaces = [...nav.querySelectorAll('a[href^="#"]')];
  const obs = new IntersectionObserver(entradas => {
    entradas.forEach(e => {
      if (!e.isIntersecting) return;
      enlaces.forEach(a => {
        if (a.getAttribute("href") === "#" + e.target.id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main section[id]").forEach(s => obs.observe(s));

  /* ---------- Utilidades ---------- */
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const urlSegura = u => (typeof u === "string" && /^(https:\/\/|\/(?!\/)|img\/)/.test(u)) ? u : "";
  const fotoChica  = p => urlSegura(p.imgSm) || `img/productos/${p.id}-sm.jpg`;
  const fotoGrande = p => urlSegura(p.img)   || `img/productos/${p.id}.jpg`;

  /* ---------- Catálogo de productos ---------- */
  const grilla = document.getElementById("grilla-productos");
  const cajaFiltros = document.querySelector(".filtros");

  const pintarProductos = () => {
    grilla.innerHTML = PRODUCTOS.map(p => `
    <li data-familia="${esc(p.familia)}">
      <button type="button" class="prod" data-abrir="${esc(p.id)}" aria-label="Ver ${esc(p.nombre)}">
        <span class="prod__foto">
          <img src="${esc(fotoChica(p))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='img/sin-foto.jpg'" style="object-position:${esc(p.foco || "50% 50%")}">
        </span>
        <span class="prod__nombre">${esc(p.nombre)}${p.nuevo ? ' <span class="etiqueta">Nuevo</span>' : ""}</span>
        <span class="prod__familia">${esc(p.familiaTxt)}</span>
        <span class="prod__desc">${esc((p.desc || "").split(". ")[0].replace(/\.$/, ""))}.</span>
      </button>
    </li>`).join("");
  };

  /* ---------- Filtros ---------- */
  const activarFiltros = () => {
    const filtros = cajaFiltros.querySelectorAll(".filtro");
    filtros.forEach(btn => btn.addEventListener("click", () => {
      filtros.forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      const f = btn.dataset.filtro;
      grilla.querySelectorAll("li").forEach(li => { li.hidden = f !== "todos" && li.dataset.familia !== f; });
    }));
  };

  const pintarFiltros = categorias => {
    cajaFiltros.innerHTML =
      `<button type="button" class="filtro" aria-pressed="true" data-filtro="todos">Todos</button>` +
      categorias.map(c => `<button type="button" class="filtro" aria-pressed="false" data-filtro="${esc(c.slug)}">${esc(c.nombre)}</button>`).join("");
    activarFiltros();
  };

  pintarProductos();
  activarFiltros();

  /* ---------- Novedades ---------- */
  const grillaNov = document.getElementById("grilla-novedades");

  const idYoutube = url => {
    const m = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const medioNovedad = n => {
    const titulo = esc(n.titulo);
    if (n.tipo_medio === "youtube" && idYoutube(n.medio_url)) {
      return `<div class="nov__img nov__img--video nov__img--yt"><iframe src="https://www.youtube-nocookie.com/embed/${idYoutube(n.medio_url)}"
        title="Video: ${titulo}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    if (n.tipo_medio === "video" && urlSegura(n.medio_url)) {
      return `<div class="nov__img nov__img--video"><video src="${esc(urlSegura(n.medio_url))}" autoplay muted loop playsinline
        aria-label="Video: ${titulo}"></video></div>`;
    }
    const img = `<img src="${esc(urlSegura(n.medio_url))}" alt="${titulo}" loading="lazy">`;
    return n.producto
      ? `<button type="button" class="nov__img" data-abrir="${esc(n.producto)}" aria-label="Ver ${titulo} en grande">${img}</button>`
      : `<div class="nov__img">${img}</div>`;
  };

  const pintarNovedades = lista => {
    grillaNov.innerHTML = lista.map((n, i) => `
      <article class="nov${i === 0 && n.destacada ? " nov--principal" : ""}">
        ${medioNovedad(n)}
        <div class="nov__cuerpo">
          <span class="etiqueta">Nuevo</span>
          <h3>${esc(n.titulo)}</h3>
          ${n.descripcion ? `<p>${esc(n.descripcion)}</p>` : ""}
          ${(n.datos || []).length ? `<dl class="datos">${n.datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
        </div>
      </article>`).join("");
  };

  /* ---------- Carga desde la base de datos (Supabase) ---------- */
  const consultar = async ruta => {
    const r = await fetch(`${window.NC_CONFIG.supabaseUrl}/rest/v1/${ruta}`, {
      headers: { apikey: window.NC_CONFIG.supabaseKey, Accept: "application/json" }
    });
    if (!r.ok) throw new Error(`Supabase respondió ${r.status}`);
    return r.json();
  };

  const cargarDesdeBase = async () => {
    if (!window.NC_CONFIG) return;
    try {
      const [cats, prods, novs] = await Promise.all([
        consultar("categorias?select=slug,nombre&order=orden"),
        consultar("productos?select=slug,nombre,tipo,descripcion,datos,imagen_url,imagen_sm_url,foco,nuevo,categorias(slug)&visible=eq.true&order=orden"),
        consultar("novedades?select=titulo,descripcion,datos,tipo_medio,medio_url,destacada,productos(slug)&visible=eq.true&order=orden")
      ]);
      if (prods.length) {
        PRODUCTOS = prods.map(p => ({
          id: p.slug, nombre: p.nombre, familia: p.categorias?.slug || "", familiaTxt: p.tipo || "",
          foco: p.foco, desc: p.descripcion || "", datos: Array.isArray(p.datos) ? p.datos : [],
          nuevo: p.nuevo, img: p.imagen_url, imgSm: p.imagen_sm_url
        }));
        pintarProductos();
        if (cats.length) pintarFiltros(cats);
      }
      if (novs.length) {
        pintarNovedades(novs.map(n => ({ ...n, producto: n.productos?.slug || null })));
      }
    } catch (err) {
      console.warn("No se pudo leer la base de datos; se muestra la lista de respaldo.", err);
    }
  };
  cargarDesdeBase();

  /* ---------- Detalle (modal) ---------- */
  const dlg = document.getElementById("detalle");
  const img = document.getElementById("detalle-img");
  const abrir = id => {
    const p = PRODUCTOS.find(x => x.id === id);
    if (!p) return;
    img.onerror = () => { img.onerror = null; img.src = "img/sin-foto.jpg"; };
    img.src = fotoGrande(p);
    img.alt = `Foto de ${p.nombre} Lácteos NC`;
    document.getElementById("detalle-familia").textContent = p.familiaTxt;
    document.getElementById("detalle-titulo").textContent = p.nombre;
    document.getElementById("detalle-desc").textContent = p.desc;
    document.getElementById("detalle-datos").innerHTML =
      p.datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    dlg.showModal();
  };
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-abrir]");
    if (b) abrir(b.dataset.abrir);
  });
  dlg.querySelector(".detalle__cerrar").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

  /* ---------- Formulario de contacto (abre el correo del visitante) ---------- */
  const form = document.getElementById("form-contacto");
  const error = document.getElementById("form-error");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const req = [...form.querySelectorAll("[required]")];
    const faltan = req.filter(c => !c.value.trim() || (c.type === "email" && !c.checkValidity()));
    req.forEach(c => c.setAttribute("aria-invalid", String(faltan.includes(c))));
    if (faltan.length) {
      error.textContent = "Completá nombre, un email válido y el mensaje para poder enviarlo.";
      error.hidden = false;
      faltan[0].focus();
      return;
    }
    error.hidden = true;
    const d = Object.fromEntries(new FormData(form));
    const cuerpo = `Nombre: ${d.nombre}\nEmail: ${d.email}\nTeléfono: ${d.telefono || "-"}\n\n${d.mensaje}`;
    window.location.href = `mailto:info@laemancipacion.com.ar?subject=${encodeURIComponent("Lácteos NC: " + d.motivo)}&body=${encodeURIComponent(cuerpo)}`;
  });

  /* ---------- Logo animado: NC emerge de la leche ---------- */
  const leche = document.getElementById("leche");
  if (leche) {
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer;
    const reproducir = () => {
      clearTimeout(timer);
      leche.classList.remove("play", "terminado");
      void leche.offsetWidth; // reinicia las animaciones CSS
      leche.classList.add("play");
      timer = setTimeout(() => leche.classList.add("terminado"), 3000);
    };
    if (quieto) {
      leche.classList.add("terminado");
    } else {
      const obsLeche = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { reproducir(); obsLeche.disconnect(); }
      }, { threshold: 0.45 });
      obsLeche.observe(leche);
      leche.addEventListener("click", reproducir);
      leche.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reproducir(); }
      });
    }
  }

  document.getElementById("anio").textContent = new Date().getFullYear();
});
