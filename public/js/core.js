// Núcleo del frontend: estado, API, utilidades y componentes compartidos.
'use strict';

const store = {
  get(k, def = null) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
};

const state = {
  token: store.get('am_token'),
  user: store.get('am_user'),
  categorias: null,
};

// ---------- API ----------
async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) {
    if (!res.ok) throw new Error('No se pudo descargar el archivo.');
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) {
    setSession(null, null);
    location.hash = '#/login';
  }
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error.');
  return data;
}

function setSession(token, user) {
  state.token = token; state.user = user;
  if (token) { store.set('am_token', token); store.set('am_user', user); } else { store.del('am_token'); store.del('am_user'); }
}

async function categorias(force = false) {
  if (!state.categorias || force) state.categorias = await api('/categorias');
  return state.categorias;
}

// ---------- utilidades ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
const money2 = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lista = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => s.trim()).filter(Boolean);
const iniciales = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fecha(s) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MESES[m - 1]} ${y}`;
}
function mesAnio(s) {
  if (!s) return '';
  const [y, m] = s.slice(0, 7).split('-').map(Number);
  return `${MESES_L[m - 1]} ${y}`;
}
const PRESUPUESTOS = { bajo: 'Hasta $1,500', medio: '$1,500 – $3,000', alto: 'Más de $3,000' };
const INTENSIDADES = ['Suave', 'Moderada', 'Intensa'];
const PUBLICOS = ['Femenino', 'Masculino', 'Unisex'];
const CONCENTRACIONES = ['Eau de Cologne', 'Eau de Toilette', 'Eau de Parfum', 'Extrait de Parfum'];
const ABREV = { 'Eau de Cologne': 'EDC', 'Eau de Toilette': 'EDT', 'Eau de Parfum': 'EDP', 'Extrait de Parfum': 'Extrait' };

// Niveles para las barras (0–100).
const nivelIntensidad = (i) => ({ Suave: 35, Moderada: 60, Intensa: 88 }[i] || 50);
const nivelProyeccion = (p) => {
  const t = String(p || '').toLowerCase();
  if (t.includes('alta') && t.includes('moderada')) return 72;
  if (t.includes('alta')) return 92;
  if (t.includes('moderada')) return 58;
  return 35;
};
const nivelDuracion = (d) => {
  const nums = String(d || '').match(/\d+/g)?.map(Number) || [];
  const max = nums.length ? Math.max(...nums) : 4;
  return Math.min(100, Math.round((max / 12) * 90) + (String(d).includes('+') ? 8 : 0));
};

// Tono claro de un color para fondos.
function tint(hex, amount = 0.82) {
  const h = String(hex || '#8B4A2B').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const base = [mix(r), mix(g), mix(b)];
  // Calidez del fondo crema del diseño.
  return `rgb(${Math.min(255, base[0] + 2)},${base[1]},${Math.max(0, base[2] - 6)})`;
}

// ---------- iconos ----------
const ICONS = {
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  scale: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0L7 7zm10 0-3 7a3 3 0 0 0 6 0l-3-7zM8 21h8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bottle: '<rect x="9" y="2" width="6" height="4" rx="1"/><rect x="5" y="6" width="14" height="16" rx="4"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.5"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
  chat: '<path d="M4 5h16v11H8l-4 4V5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7zM10 20a2 2 0 0 0 4 0"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  forecast: '<path d="M3 17l5-5 4 3 4-6"/><path d="M16 9l5-4" stroke-dasharray="2 2"/><path d="M3 21h18"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

// Frasco ilustrado (se usa cuando el perfume no tiene foto).
function bottleSvg(color = '#8B4A2B', w = 60) {
  const h = Math.round(w * 1.5);
  return `<svg width="${w}" height="${h}" viewBox="0 0 60 90" aria-hidden="true">
    <rect x="21" y="2" width="18" height="14" rx="2.5" fill="#2A1E26"/>
    <rect x="25" y="16" width="10" height="7" fill="#C9BFB6"/>
    <rect x="6" y="23" width="48" height="64" rx="12" fill="${esc(color)}"/>
    <rect x="11" y="29" width="5" height="46" rx="2.5" fill="#fff" opacity=".18"/>
    <rect x="16" y="44" width="28" height="18" rx="3" fill="#F1EAE3"/>
  </svg>`;
}

function perfumeVisual(p, w = 60) {
  if (p.imagen) return `<img class="pimg" src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy">`;
  return bottleSvg(p.color, w);
}

function logoSvg() {
  return `<svg viewBox="0 0 18 22" aria-hidden="true"><rect x="5.5" y="1" width="7" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="2" y="6" width="14" height="15" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
}

// ---------- toasts y modales ----------
function toast(msg, err = false) {
  const el = document.createElement('div');
  el.className = `toast${err ? ' err' : ''}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function modal(html, { wide = false, onMount } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const bg = $('.modal-bg', root);
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  $$('[data-close]', root).forEach((b) => b.addEventListener('click', close));
  onMount?.($('.modal', root), close);
  return close;
}

function confirmar(titulo, texto, { ok = 'Confirmar', peligro = false } = {}) {
  return new Promise((resolve) => {
    modal(`<div class="modal-head"><h2>${esc(titulo)}</h2></div><p class="muted">${esc(texto)}</p>
      <div class="modal-foot"><button class="btn btn-outline" data-close>Cancelar</button>
      <button class="btn ${peligro ? 'btn-danger' : 'btn-primary'}" id="cf-ok">${esc(ok)}</button></div>`, {
      onMount: (m, close) => {
        $('#cf-ok', m).onclick = () => { close(); resolve(true); };
        $$('[data-close]', m).forEach((b) => b.addEventListener('click', () => resolve(false)));
      },
    });
  });
}

// Maneja envíos de formularios con estado de carga y errores.
async function withBusy(btn, fn) {
  const txt = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Guardando…';
  try { return await fn(); } catch (e) { toast(e.message, true); return undefined; } finally { btn.disabled = false; btn.innerHTML = txt; }
}

const formData = (form) => Object.fromEntries(new FormData(form).entries());

// ---------- comparador (compartido) ----------
const comparador = {
  ids() { return store.get('am_cmp', []); },
  set(ids) { store.set('am_cmp', ids.slice(0, 3)); updateCmpBadge(); },
  toggle(id) {
    const ids = this.ids();
    if (ids.includes(id)) { this.set(ids.filter((x) => x !== id)); toast('Quitado del comparador'); return false; }
    if (ids.length >= 3) { toast('El comparador admite hasta 3 perfumes. Quita uno primero.', true); return null; }
    this.set([...ids, id]); toast('Agregado al comparador'); return true;
  },
};
function updateCmpBadge() {
  const n = comparador.ids().length;
  $$('[data-cmp-badge]').forEach((b) => { b.textContent = n; b.classList.toggle('hidden', !n); });
}

// Cliente activo del asesor (para calcular coincidencias con su perfil).
const clienteActivo = {
  get() { return store.get('am_cliente_activo'); },
  set(c) { if (c) store.set('am_cliente_activo', { id: c.id, nombre: c.nombre }); else store.del('am_cliente_activo'); },
};

// ---------- layouts ----------
const NAV = {
  cliente: [
    ['#/catalogo', 'Catálogo', 'grid'],
    ['#/buscador', 'Buscador inteligente', 'spark'],
    ['#/comparador', 'Comparador', 'scale'],
    ['#/perfil', 'Mi perfil', 'user'],
  ],
  asesor: [
    ['#/atencion', 'Atención a cliente', 'chat'],
    ['#/catalogo', 'Consultar catálogo', 'grid'],
    ['#/recomendar', 'Recomendar productos', 'spark'],
    ['#/comparador', 'Comparador', 'scale'],
    ['#/clientes', 'Historial de clientes', 'clock'],
  ],
  admin: [
    ['#/dashboard', 'Dashboard', 'chart'],
    ['#/perfumes', 'Gestión de perfumes', 'bottle'],
    ['#/categorias', 'Categorías', 'tag'],
    ['#/tendencias', 'Tendencias', 'trend'],
    ['#/pronostico', 'Pronóstico', 'forecast'],
    ['#/inventario', 'Inventario', 'box'],
    ['#/simulador', 'Simulador de precios', 'sliders'],
  ],
};

function navActive(href) {
  const cur = location.hash.split('/')[1] || '';
  const h = href.split('/')[1];
  if (cur === 'perfume') return h === 'catalogo';
  return cur === h;
}

function renderLayout(content) {
  const u = state.user;
  const app = $('#app');
  if (u.rol === 'cliente') {
    app.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#/catalogo">${logoSvg()}AromaMatch</a>
        <nav class="topnav" id="topnav">
          ${NAV.cliente.map(([h, t]) => `<a href="${h}" class="${navActive(h) ? 'active' : ''}">${t}${h === '#/comparador' ? ' <span class="cmp-badge hidden" data-cmp-badge></span>' : ''}</a>`).join('')}
        </nav>
        <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Menú">${icon('menu')}</button>
        <div class="user-mini">
          <button class="icon-btn bell" data-alertas aria-label="Alertas">${icon('bell')}<span class="bell-badge hidden" data-alertas-badge></span></button>
          <a href="#/perfil" class="avatar" title="${esc(u.nombre)}" style="text-decoration:none">${esc(iniciales(u.nombre))}</a>
          <button class="logout" data-logout>Cerrar sesión</button>
        </div>
      </header>
      <main class="main" id="view">${content}</main>`;
    $('#menu-toggle').onclick = () => $('#topnav').classList.toggle('open');
  } else {
    const rol = u.rol === 'admin' ? 'Administrador' : 'Asesor de ventas';
    app.innerHTML = `
      <div class="shell">
        <aside class="sidebar">
          <a class="brand" href="#/">${logoSvg()}AromaMatch</a>
          <div class="role row between">${rol}${u.rol === 'admin' ? `<button class="bell-side" data-alertas aria-label="Alertas">${icon('bell')}<span class="bell-badge hidden" data-alertas-badge></span></button>` : ''}</div>
          <nav>${NAV[u.rol].map(([h, t, ic]) => `<a href="${h}" class="${navActive(h) ? 'active' : ''}">${icon(ic)}${t}${h === '#/comparador' ? ' <span class="cmp-badge hidden" data-cmp-badge></span>' : ''}</a>`).join('')}</nav>
          <div class="me">
            <div class="row"><div class="avatar gold">${esc(iniciales(u.nombre))}</div>
              <div><div class="n">${esc(u.nombre)}</div><div class="s">${esc(u.sucursal || '')}</div></div></div>
            <button class="logout" data-logout>Cerrar sesión</button>
          </div>
        </aside>
        <main class="shell-main" id="view">${content}</main>
      </div>`;
  }
  $$('[data-logout]').forEach((b) => (b.onclick = logout));
  $$('[data-alertas]').forEach((b) => (b.onclick = () => modalAlertas()));
  updateCmpBadge();
  cargarAlertas();
  return $('#view');
}

// ---------- alertas por excepción ----------
const NIVEL_ALERTA = { alta: ['red', 'Urgente'], media: ['amber', 'Atención'], info: ['blue', 'Aviso'] };

async function cargarAlertas() {
  if (!['cliente', 'admin'].includes(state.user?.rol)) return [];
  try { state.alertas = await api('/alertas'); } catch { state.alertas = []; }
  const n = state.alertas.filter((a) => a.nivel !== 'info').length || state.alertas.length;
  $$('[data-alertas-badge]').forEach((b) => { b.textContent = n; b.classList.toggle('hidden', !state.alertas.length); });
  return state.alertas;
}

function alertaHtml(a) {
  const [color, etiqueta] = NIVEL_ALERTA[a.nivel] || NIVEL_ALERTA.info;
  return `<div class="alerta ${a.nivel}">
    <div class="row between" style="align-items:flex-start"><div><span class="chip ${color}">${etiqueta}</span> <span class="muted small">${esc(a.categoria)}</span></div>
      ${a.descartable ? `<button class="icon-btn plain" data-descartar="${a.perfume_id}" title="Descartar">${icon('x')}</button>` : ''}</div>
    <b>${esc(a.titulo)}</b><p>${esc(a.detalle)}</p>
    ${a.href ? `<a href="${a.href}" class="small" data-close>Ver →</a>` : ''}</div>`;
}

function bindAlertas(root, alRecargar) {
  $$('[data-descartar]', root).forEach((b) => (b.onclick = async () => {
    await api(`/alertas/precio/${b.dataset.descartar}/visto`, { method: 'POST' }).catch(() => {});
    await cargarAlertas();
    alRecargar?.();
  }));
}

async function modalAlertas() {
  const pintar = (m) => {
    const al = state.alertas || [];
    $('#al-list', m).innerHTML = al.length ? al.map(alertaHtml).join('') : '<p class="muted">No hay alertas por ahora. 🎉</p>';
    bindAlertas(m, () => pintar(m));
    $$('[data-close]', m).forEach((x) => x.addEventListener('click', () => { $('#modal-root').innerHTML = ''; }));
  };
  modal(`<div class="modal-head"><h2>Alertas</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
    <p class="muted small" style="margin:-8px 0 14px">El sistema te avisa de situaciones que requieren una decisión.</p>
    <div id="al-list">${loading()}</div>`, { wide: true, onMount: async (m) => { await cargarAlertas(); pintar(m); } });
}

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* ya expirada */ }
  setSession(null, null);
  clienteActivo.set(null);
  state.categorias = null;
  location.hash = '#/login';
}

const loading = () => '<div class="spinner" role="status" aria-label="Cargando"></div>';

// ---------- componentes compartidos ----------
function perfumeCard(p, { onFav = true, match = true } = {}) {
  const inCmp = comparador.ids().includes(p.id);
  return `<article class="card pcard" data-id="${p.id}">
    <div class="ph" style="background:${tint(p.color)}">
      <span class="chip white">${esc(p.familia)}</span>
      ${onFav && state.user.rol === 'cliente' ? `<button class="fav ${p.favorito ? 'on' : ''}" data-fav="${p.id}" aria-label="Favorito">${icon('heart')}</button>` : ''}
      <div style="width:100%;height:100%;display:grid;place-items:center">${perfumeVisual(p, 46)}</div>
      ${match && p.match != null ? `<span class="match-tag">${p.match}% para ti</span>` : ''}
      ${p.existencias === 0 ? '<span class="chip red" style="position:absolute;bottom:10px;left:10px;z-index:1">Agotado</span>' : ''}
    </div>
    <div class="body">
      <div class="brandname">${esc(p.marca)}</div>
      <h3>${esc(p.nombre)}</h3>
      <div class="conc">${esc(p.concentracion)} · ${p.ml} ml</div>
      <div class="chips">${lista(p.ocasiones).slice(0, 1).map((o) => `<span class="chip">${esc(o)}</span>`).join('')}
        <span class="chip">${esc(lista(p.temporadas).length === 4 ? 'Todo el año' : lista(p.temporadas).join(' / '))}</span></div>
      <div class="price">${money(p.precio)} MXN</div>
      <div class="actions">
        <a class="btn btn-primary btn-sm" href="#/perfume/${p.id}">Ver detalle</a>
        <button class="icon-btn" data-cmp="${p.id}" title="${inCmp ? 'Quitar del comparador' : 'Agregar al comparador'}" style="${inCmp ? 'background:var(--plum-soft)' : ''}">${icon('scale')}</button>
      </div>
    </div>
  </article>`;
}

function bindCardActions(root, refresh) {
  $$('[data-fav]', root).forEach((b) => (b.onclick = async (e) => {
    e.preventDefault();
    const id = b.dataset.fav;
    const on = b.classList.contains('on');
    try {
      await api(`/favoritos/${id}`, { method: on ? 'DELETE' : 'POST' });
      b.classList.toggle('on', !on);
      toast(on ? 'Quitado de favoritos' : 'Guardado en favoritos');
    } catch (err) { toast(err.message, true); }
  }));
  $$('[data-cmp]', root).forEach((b) => (b.onclick = () => {
    const r = comparador.toggle(Number(b.dataset.cmp));
    if (r !== null) b.style.background = r ? 'var(--plum-soft)' : '';
    refresh?.();
  }));
}

// Texto de términos resumido para el modal de registro.
function terminosResumen() {
  return `<div class="terms-text">
    <p>Al crear tu cuenta aceptas los Términos y Condiciones de uso de AromaMatch. Puntos principales:</p>
    <h4>1. Naturaleza del servicio</h4><p>AromaMatch es un sistema de soporte a la decisión. Las recomendaciones y porcentajes de coincidencia son orientativos y se calculan con base en tus respuestas; no garantizan que un perfume sea de tu agrado.</p>
    <h4>2. Tu cuenta</h4><p>Eres responsable de la confidencialidad de tu contraseña y de la veracidad de tus datos.</p>
    <h4>3. Datos personales</h4><p>Tratamos tu nombre, correo, teléfono, preferencias olfativas e historial de uso para personalizar recomendaciones y generar estadísticas agregadas y anónimas. Puedes ejercer tus derechos ARCO y eliminar tu cuenta desde Mi perfil.</p>
    <h4>4. Precios y disponibilidad</h4><p>Los precios se muestran en MXN, incluyen IVA y pueden cambiar sin previo aviso. La compra se realiza en tienda.</p>
    <h4>5. Salud</h4><p>Consulta la lista de notas de cada fragancia y realiza una prueba en piel si tienes alergias o sensibilidad.</p>
    <p style="margin-top:14px"><a href="/terminos.pdf" target="_blank" rel="noopener">${icon('download')} Descargar documento completo (PDF)</a></p>
  </div>`;
}
