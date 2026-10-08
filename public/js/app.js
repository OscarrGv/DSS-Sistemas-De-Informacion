// Autenticación y enrutador principal.
'use strict';

const ROLES = [
  ['cliente', 'Cliente', 'Busca y guarda perfumes'],
  ['asesor', 'Asesor de ventas', 'Atiende y recomienda'],
  ['admin', 'Administrador', 'Gestiona y analiza'],
];
const INICIO = { cliente: '#/catalogo', asesor: '#/atencion', admin: '#/dashboard' };

function authSide() {
  return `<aside class="auth-side">
    <a class="brand" href="#/login">${logoSvg()}AromaMatch</a>
    <div class="kicker">Sistema de soporte a la decisión</div>
    <h1>Encuentra tu esencia</h1>
    <p class="lead">Encuentra perfumes adecuados según tus preferencias, la ocasión, la temporada y tu presupuesto, con filtros inteligentes y recomendaciones personalizadas.</p>
    <ul>
      <li>${icon('grid')}Catálogo con información detallada de cada perfume</li>
      <li>${icon('spark')}Recomendaciones según tu perfil olfativo</li>
      <li>${icon('chart')}Estadísticas y tendencias para decisiones comerciales</li>
    </ul>
    <div class="quote">“Más que perfumes, mejores decisiones”</div>
  </aside>`;
}

function viewLogin() {
  let rol = store.get('am_last_role', 'cliente');
  $('#app').innerHTML = `<div class="auth">${authSide()}
    <div class="auth-main"><div class="auth-card">
      <h2>Iniciar sesión</h2><p class="muted" style="margin:6px 0 20px">Elige tu tipo de acceso para continuar.</p>
      <div class="label" style="margin-bottom:8px">Tipo de usuario</div>
      <div class="roles">${ROLES.map(([k, t, s]) => `<button type="button" class="role-opt ${k === rol ? 'active' : ''}" data-rol="${k}"><b>${t}</b><span>${s}</span></button>`).join('')}</div>
      <form id="login" novalidate>
        <div id="l-err"></div>
        <div class="field"><label for="l-mail">Correo electrónico</label><input class="input" id="l-mail" name="correo" type="email" placeholder="nombre@correo.com" autocomplete="username" required></div>
        <div class="field"><label for="l-pass">Contraseña</label><input class="input" id="l-pass" name="password" type="password" placeholder="••••••••" autocomplete="current-password" required></div>
        <div class="row between" style="margin:-2px 0 18px"><label class="check"><input type="checkbox" name="recordar">Recordarme</label><a href="#" id="l-forgot" class="small">¿Olvidaste tu contraseña?</a></div>
        <button class="btn btn-primary btn-block" id="l-btn" style="padding:13px">Ingresar como cliente</button>
      </form>
      <p class="small muted" style="text-align:center;margin-top:16px" id="l-reg">¿Eres nuevo? <a href="#/registro">Crear cuenta de cliente</a></p>
      <div class="demo-box"><b>Cuentas de demostración</b><br>
        Cliente: <code>mariana.lopez@correo.com</code> / <code>cliente123</code><br>
        Asesor: <code>jorge.ramirez@aromamatch.mx</code> / <code>asesor123</code><br>
        Admin: <code>admin@aromamatch.mx</code> / <code>admin123</code></div>
    </div></div></div>`;

  const setRol = (k) => {
    rol = k;
    $$('[data-rol]').forEach((b) => b.classList.toggle('active', b.dataset.rol === k));
    $('#l-btn').textContent = `Ingresar como ${ROLES.find((r) => r[0] === k)[1].toLowerCase()}`;
    $('#l-reg').classList.toggle('hidden', k !== 'cliente');
  };
  setRol(rol);
  $$('[data-rol]').forEach((b) => (b.onclick = () => setRol(b.dataset.rol)));
  $('#l-forgot').onclick = (e) => { e.preventDefault(); modalRecuperar(); };
  $('#login').onsubmit = async (e) => {
    e.preventDefault();
    const body = formData(e.target);
    body.recordar = !!body.recordar;
    body.rol = rol;
    if (!body.correo || !body.password) { $('#l-err').innerHTML = '<div class="form-error">Escribe tu correo y contraseña.</div>'; return; }
    $('#l-err').innerHTML = '';
    const btn = $('#l-btn');
    btn.disabled = true;
    try {
      const r = await api('/auth/login', { method: 'POST', body });
      setSession(r.token, r.usuario);
      store.set('am_last_role', rol);
      location.hash = INICIO[r.usuario.rol];
    } catch (err) {
      $('#l-err').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
    } finally { btn.disabled = false; }
  };
}

function modalRecuperar() {
  modal(`<div class="modal-head"><h2>Recuperar contraseña</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
    <form id="rc"><p class="muted" style="margin-bottom:14px">Escribe el correo de tu cuenta y te enviaremos instrucciones.</p>
      <div class="field"><label>Correo electrónico</label><input class="input" name="correo" type="email" required></div>
      <div class="modal-foot"><button type="button" class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary">Enviar</button></div></form>`, {
    onMount: (m, close) => {
      $('#rc', m).onsubmit = async (e) => {
        e.preventDefault();
        const r = await api('/auth/recuperar', { method: 'POST', body: formData(e.target) }).catch((err) => ({ mensaje: err.message }));
        close(); toast(r.mensaje);
      };
    },
  });
}

function viewRegistro() {
  $('#app').innerHTML = `<div class="auth">${authSide()}
    <div class="auth-main"><div class="auth-card">
      <h2>Crear cuenta</h2><p class="muted" style="margin:6px 0 20px">Regístrate como cliente para guardar favoritos y recibir recomendaciones.</p>
      <form id="reg" novalidate>
        <div id="r-err"></div>
        <div class="field"><label>Nombre completo</label><input class="input" name="nombre" autocomplete="name" required></div>
        <div class="field"><label>Correo electrónico</label><input class="input" name="correo" type="email" placeholder="nombre@correo.com" autocomplete="email" required></div>
        <div class="field"><label>Teléfono <span class="muted" style="font-weight:400">(opcional)</span></label><input class="input" name="telefono" autocomplete="tel"></div>
        <div class="grid2">
          <div class="field"><label>Contraseña</label><input class="input" name="password" type="password" minlength="8" autocomplete="new-password" required></div>
          <div class="field"><label>Confirmar</label><input class="input" name="password2" type="password" autocomplete="new-password" required></div>
        </div>
        <label class="check" style="align-items:flex-start;margin-bottom:16px;line-height:1.45"><input type="checkbox" name="acepta_terminos" style="margin-top:3px">
          <span>He leído y acepto los <a href="#" id="r-terms">Términos y Condiciones</a> y el Aviso de Privacidad de AromaMatch.</span></label>
        <button class="btn btn-primary btn-block" style="padding:13px">Crear cuenta</button>
      </form>
      <p class="small muted" style="text-align:center;margin-top:16px">¿Ya tienes cuenta? <a href="#/login">Iniciar sesión</a></p>
    </div></div></div>`;
  $('#r-terms').onclick = (e) => {
    e.preventDefault();
    modal(`<div class="modal-head"><h2>Términos y Condiciones</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>${terminosResumen()}
      <div class="modal-foot"><button class="btn btn-outline" data-close>Cerrar</button><button class="btn btn-primary" id="t-ok">Acepto</button></div>`, {
      wide: true,
      onMount: (m, close) => { $('#t-ok', m).onclick = () => { $('[name=acepta_terminos]').checked = true; close(); }; },
    });
  };
  $('#reg').onsubmit = async (e) => {
    e.preventDefault();
    const b = formData(e.target);
    const err = (m) => { $('#r-err').innerHTML = `<div class="form-error">${esc(m)}</div>`; };
    if (b.password !== b.password2) return err('Las contraseñas no coinciden.');
    b.acepta_terminos = !!b.acepta_terminos;
    try {
      const r = await api('/auth/registro', { method: 'POST', body: b });
      setSession(r.token, r.usuario);
      toast('¡Bienvenido a AromaMatch! Responde el buscador para crear tu perfil.');
      location.hash = '#/buscador';
    } catch (ex) { err(ex.message); }
  };
}

// ---------- enrutador ----------
const RUTAS = {
  cliente: {
    catalogo: viewCatalogo, perfume: viewPerfume, buscador: () => viewBuscador(), comparador: viewComparador, perfil: viewPerfil,
  },
  asesor: {
    atencion: viewAtencion, catalogo: viewCatalogo, perfume: viewPerfume, recomendar: () => viewBuscador({ asesor: true }),
    comparador: viewComparador, clientes: viewClientes,
  },
  admin: {
    dashboard: viewDashboard, perfumes: viewAdminPerfumes, categorias: viewCategorias, tendencias: viewTendencias, perfume: viewPerfume,
    pronostico: viewPronostico, inventario: viewInventario, simulador: viewSimulador,
  },
};

async function route() {
  const [, seccion = '', param] = location.hash.replace(/^#/, '').split('/');
  $('#modal-root').innerHTML = '';
  window.scrollTo(0, 0);
  if (!state.token) {
    if (seccion === 'registro') return viewRegistro();
    return viewLogin();
  }
  if (seccion === 'login' || seccion === 'registro') { location.hash = INICIO[state.user.rol]; return; }
  const fn = RUTAS[state.user.rol][seccion];
  if (!fn) { location.hash = INICIO[state.user.rol]; return; }
  try { await fn(param); } catch (e) {
    console.error(e);
    toast(e.message || 'Ocurrió un error', true);
  }
}

window.addEventListener('hashchange', route);
(async () => {
  // Valida la sesión guardada antes de mostrar la app.
  if (state.token) {
    try { const r = await api('/auth/me'); setSession(state.token, r.usuario); } catch { setSession(null, null); }
  }
  route();
})();
