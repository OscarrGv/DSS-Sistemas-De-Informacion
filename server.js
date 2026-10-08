// Servidor de AromaMatch: API REST + archivos estáticos.
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { openDatabase, hashPassword, verifyPassword } = require('./db');
const motor = require('./recomendador');
const analisis = require('./analisis');

const PORT = process.env.PORT || 3000;
const db = openDatabase({ reset: process.argv.includes('--reset') });
const app = express();

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/terminos.pdf', (req, res) =>
  res.sendFile(path.join(__dirname, 'docs', 'Terminos_y_Condiciones_AromaMatch.pdf')));

// ---------- utilidades ----------
const q = (sql) => db.prepare(sql);
const ahora = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const fail = (res, status, error) => res.status(status).json({ error });
const csv = (v) => (Array.isArray(v) ? v.join(',') : String(v || ''));

function registrarActividad(usuarioId, tipo, detalle, resultado = '—', autor = 'Sistema') {
  q('INSERT INTO actividad (usuario_id, fecha, tipo, detalle, resultado, autor) VALUES (?,?,?,?,?,?)')
    .run(usuarioId, ahora(), tipo, detalle, resultado, autor);
}

function registrarEvento(tipo, perfume, usuarioId, extra = {}) {
  return q(`INSERT INTO eventos (tipo, perfume_id, familia, ocasion, temporada, aceptada, usuario_id, fecha)
    VALUES (?,?,?,?,?,?,?,?)`).run(tipo, perfume?.id ?? null, extra.familia ?? perfume?.familia ?? null,
    extra.ocasion ?? null, extra.temporada ?? null, extra.aceptada ? 1 : 0, usuarioId ?? null, ahora());
}

function marcarRecomendacionAceptada(usuarioId, perfumeId) {
  q(`UPDATE eventos SET aceptada = 1 WHERE id = (
      SELECT id FROM eventos WHERE tipo='recomendacion' AND usuario_id=? AND perfume_id=? AND aceptada=0
      ORDER BY fecha DESC LIMIT 1)`).run(usuarioId, perfumeId);
}

const perfumesPublicados = () => q("SELECT * FROM perfumes WHERE estado='Publicado' ORDER BY id").all();
const preferenciasDe = (id) => q('SELECT * FROM preferencias WHERE usuario_id=?').get(id) || null;

function perfumeResumen(p) {
  if (!p) return p;
  const { imagen, ...rest } = p;
  return { ...rest, tieneImagen: !!imagen, imagen: imagen || null };
}

function usuarioPublico(u) {
  if (!u) return null;
  return { id: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono, rol: u.rol, sucursal: u.sucursal, creado: u.creado };
}

// ---------- autenticación ----------
function auth(...roles) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return fail(res, 401, 'Inicia sesión para continuar.');
    const row = q(`SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token=? AND s.expira > ?`).get(token, ahora());
    if (!row) return fail(res, 401, 'Tu sesión expiró. Inicia sesión de nuevo.');
    if (roles.length && !roles.includes(row.rol)) return fail(res, 403, 'No tienes permiso para esta acción.');
    req.user = row;
    req.token = token;
    next();
  };
}

function crearSesion(usuarioId, recordar) {
  const token = crypto.randomBytes(24).toString('hex');
  const dias = recordar ? 30 : 1;
  const expira = new Date(Date.now() + dias * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  q('INSERT INTO sesiones (token, usuario_id, expira) VALUES (?,?,?)').run(token, usuarioId, expira);
  return token;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

app.post('/api/auth/login', (req, res) => {
  const { correo, password, rol, recordar } = req.body || {};
  if (!correo || !password) return fail(res, 400, 'Escribe tu correo y contraseña.');
  const u = q('SELECT * FROM usuarios WHERE lower(correo)=lower(?)').get(String(correo).trim());
  if (!u || !verifyPassword(password, u.password_hash)) return fail(res, 401, 'Correo o contraseña incorrectos.');
  if (rol && u.rol !== rol) {
    const nombres = { cliente: 'cliente', asesor: 'asesor de ventas', admin: 'administrador' };
    return fail(res, 403, `Esta cuenta no tiene acceso como ${nombres[rol]}. Selecciona el tipo de usuario correcto.`);
  }
  res.json({ token: crearSesion(u.id, recordar), usuario: usuarioPublico(u) });
});

app.post('/api/auth/registro', (req, res) => {
  const { nombre, correo, telefono, password, acepta_terminos } = req.body || {};
  if (!nombre || String(nombre).trim().length < 3) return fail(res, 400, 'Escribe tu nombre completo.');
  if (!EMAIL_RE.test(String(correo || ''))) return fail(res, 400, 'Escribe un correo electrónico válido.');
  if (!password || String(password).length < 8) return fail(res, 400, 'La contraseña debe tener al menos 8 caracteres.');
  if (!acepta_terminos) return fail(res, 400, 'Debes aceptar los Términos y Condiciones y el Aviso de Privacidad.');
  if (q('SELECT 1 FROM usuarios WHERE lower(correo)=lower(?)').get(correo)) return fail(res, 409, 'Ya existe una cuenta con ese correo.');
  const hoy = ahora().slice(0, 10);
  const id = q(`INSERT INTO usuarios (nombre, correo, telefono, password_hash, rol, acepto_terminos, creado)
    VALUES (?,?,?,?, 'cliente', ?, ?)`).run(String(nombre).trim(), String(correo).trim(), telefono || null,
    hashPassword(String(password)), ahora(), hoy).lastInsertRowid;
  registrarActividad(id, 'Alta de cliente', 'Creó su cuenta y aceptó los Términos y Condiciones.', 'Perfil creado');
  const u = q('SELECT * FROM usuarios WHERE id=?').get(id);
  res.status(201).json({ token: crearSesion(id, false), usuario: usuarioPublico(u) });
});

app.post('/api/auth/recuperar', (req, res) => {
  // No revela si el correo existe. En producción se enviaría un enlace de restablecimiento.
  res.json({ mensaje: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña. También puedes acudir a cualquier sucursal.' });
});

app.post('/api/auth/logout', auth(), (req, res) => {
  q('DELETE FROM sesiones WHERE token=?').run(req.token);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth(), (req, res) => res.json({ usuario: usuarioPublico(req.user) }));

// ---------- catálogo ----------
app.get('/api/categorias', auth(), (req, res) => {
  const rows = q(`SELECT c.*, (
      SELECT count(*) FROM perfumes p WHERE
        (c.tipo='familia' AND p.familia=c.nombre) OR
        (c.tipo='ocasion' AND (','||p.ocasiones||',') LIKE '%,'||c.nombre||',%') OR
        (c.tipo='temporada' AND (','||p.temporadas||',') LIKE '%,'||c.nombre||',%')
    ) AS perfumes FROM categorias c ORDER BY c.tipo, c.id`).all();
  res.json({
    familia: rows.filter((r) => r.tipo === 'familia'),
    ocasion: rows.filter((r) => r.tipo === 'ocasion'),
    temporada: rows.filter((r) => r.tipo === 'temporada'),
  });
});

app.get('/api/perfumes', auth(), (req, res) => {
  const { q: texto, familia, intensidad, min, max, orden, todos, estado } = req.query;
  const multi = (k) => motor.lista(req.query[k]);
  let rows = todos && req.user.rol === 'admin'
    ? q('SELECT * FROM perfumes ORDER BY id').all()
    : perfumesPublicados();

  if (estado) rows = rows.filter((p) => p.estado === estado);
  if (texto) {
    const t = String(texto).toLowerCase();
    rows = rows.filter((p) => [p.nombre, p.marca, p.familia, p.notas_salida, p.notas_corazon, p.notas_fondo]
      .join(' ').toLowerCase().includes(t));
  }
  if (familia && familia !== 'Todas') rows = rows.filter((p) => p.familia === familia);
  if (min) rows = rows.filter((p) => p.precio >= Number(min));
  if (max) rows = rows.filter((p) => p.precio <= Number(max));
  if (intensidad) rows = rows.filter((p) => p.intensidad === intensidad);
  const oc = multi('ocasion'); if (oc.length) rows = rows.filter((p) => oc.some((o) => motor.lista(p.ocasiones).includes(o)));
  const te = multi('temporada'); if (te.length) rows = rows.filter((p) => te.some((t) => motor.lista(p.temporadas).includes(t)));
  const pu = multi('publico'); if (pu.length) rows = rows.filter((p) => pu.includes(p.publico));

  const pref = req.user.rol === 'cliente' ? preferenciasDe(req.user.id) : null;
  let out = rows.map((p) => ({ ...perfumeResumen(p), match: motor.coincidenciaPerfil(p, pref)?.porcentaje ?? null }));
  if (orden === 'precio_asc') out.sort((a, b) => a.precio - b.precio);
  else if (orden === 'precio_desc') out.sort((a, b) => b.precio - a.precio);
  else if (orden === 'nombre') out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  else if (pref) out.sort((a, b) => (b.match ?? 0) - (a.match ?? 0));

  const favs = new Set(q('SELECT perfume_id FROM favoritos WHERE usuario_id=?').all(req.user.id).map((r) => r.perfume_id));
  out = out.map((p) => ({ ...p, favorito: favs.has(p.id) }));
  res.json(out);
});

app.get('/api/perfumes/:id', auth(), (req, res) => {
  const p = q('SELECT * FROM perfumes WHERE id=?').get(req.params.id);
  if (!p || (p.estado !== 'Publicado' && req.user.rol !== 'admin')) return fail(res, 404, 'Perfume no encontrado.');
  // El asesor puede ver la coincidencia con un cliente concreto.
  const clienteId = req.user.rol === 'cliente' ? req.user.id : Number(req.query.cliente) || null;
  const pref = clienteId ? preferenciasDe(clienteId) : null;
  const favorito = !!q('SELECT 1 FROM favoritos WHERE usuario_id=? AND perfume_id=?').get(req.user.id, p.id);
  if (req.user.rol === 'cliente') registrarEvento('consulta', p, req.user.id);
  const publicados = perfumesPublicados();
  res.json({
    perfume: perfumeResumen(p),
    favorito,
    match: motor.coincidenciaPerfil(p, pref),
    similares: motor.similares(p, publicados).map((s) => ({ ...perfumeResumen(s.perfume), porcentaje: s.porcentaje })),
  });
});

// ---------- buscador inteligente ----------
function etiquetaCriterios(c) {
  return [c.ocasion, c.temporada, c.familia, c.intensidad, c.presupuesto && motor.PRESUPUESTOS[c.presupuesto]?.etiqueta]
    .filter(Boolean).join(' · ');
}

app.post('/api/buscador', auth(), (req, res) => {
  const c = req.body?.criterios || {};
  const clienteId = req.user.rol === 'cliente' ? req.user.id : Number(req.body?.cliente_id) || null;
  const pref = clienteId ? preferenciasDe(clienteId) : null;
  // Si no llegan pesos, se usan los que el cliente guardó (o los predeterminados).
  const pesos = motor.normalizarPesos(req.body?.pesos ?? pref?.pesos);
  const catalogo = perfumesPublicados();
  // Posición con los pesos predeterminados, para mostrar cómo cambia el ranking al ajustar los pesos.
  const posBase = Object.fromEntries(motor.ranking(catalogo, c).map((r, i) => [r.perfume.id, i + 1]));
  const resultados = motor.ranking(catalogo, c, pesos).map((r, i) => ({
    perfume: perfumeResumen(r.perfume), porcentaje: r.porcentaje, coincide: r.coincide, noCoincide: r.noCoincide,
    perfil: motor.coincidenciaPerfil(r.perfume, pref)?.porcentaje ?? null,
    posicion: i + 1, posicionBase: posBase[r.perfume.id],
  }));
  const seleccionados = Object.values(c).filter((v) => v && (!Array.isArray(v) || v.length)).length;

  // Solo se registra cuando el usuario lo pide (al terminar de responder), no en cada clic.
  if (req.body?.registrar && seleccionados && clienteId) {
    const utiles = resultados.filter((r) => r.porcentaje > 0);
    const autor = req.user.rol === 'cliente' ? 'Sistema' : req.user.nombre;
    registrarActividad(clienteId, 'Búsqueda', etiquetaCriterios(c), `${utiles.length} resultados`, autor);
    registrarEvento('busqueda', null, clienteId, { familia: c.familia, ocasion: c.ocasion, temporada: c.temporada });
    if (utiles[0]) {
      registrarActividad(clienteId, 'Recomendación', `${utiles[0].perfume.nombre} sugerido por el sistema`, `${utiles[0].porcentaje}% coincidencia`, autor);
      registrarEvento('recomendacion', utiles[0].perfume, clienteId, { ocasion: c.ocasion, temporada: c.temporada });
    }
  }
  res.json({ seleccionados, resultados, pesos, pesosBase: motor.PESOS });
});

// ---------- preferencias / perfil del cliente ----------
function guardarPreferencias(usuarioId, body) {
  const actual = preferenciasDe(usuarioId) || {};
  const v = (k, alt) => (body[k] !== undefined ? (Array.isArray(body[k]) ? body[k].join(',') : body[k]) || null : actual[alt ?? k] ?? null);
  // Pesos: objeto → se guardan validados; null → vuelven a los predeterminados; ausente → se conservan.
  const pesos = body.pesos === undefined ? actual.pesos ?? null
    : body.pesos === null ? null : JSON.stringify(motor.normalizarPesos(body.pesos));
  q(`INSERT INTO preferencias (usuario_id, familia, ocasiones, temporada, intensidad, presupuesto, notas_evita, pesos)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(usuario_id) DO UPDATE SET familia=excluded.familia, ocasiones=excluded.ocasiones,
       temporada=excluded.temporada, intensidad=excluded.intensidad, presupuesto=excluded.presupuesto,
       notas_evita=excluded.notas_evita, pesos=excluded.pesos`)
    .run(usuarioId, v('familia'), v('ocasiones'), v('temporada'), v('intensidad'), v('presupuesto'), v('notas_evita'), pesos);
  return preferenciasDe(usuarioId);
}

app.put('/api/preferencias', auth('cliente'), (req, res) => {
  const pref = guardarPreferencias(req.user.id, req.body || {});
  registrarActividad(req.user.id, 'Preferencias', 'Actualizó sus preferencias', 'Perfil actualizado');
  res.json(pref);
});

function perfilOlfativo(usuarioId) {
  const pref = preferenciasDe(usuarioId);
  const puntos = {};
  const sumar = (f, n) => { if (f) puntos[f] = (puntos[f] || 0) + n; };
  sumar(pref?.familia, 4);
  for (const r of q('SELECT p.familia FROM favoritos f JOIN perfumes p ON p.id=f.perfume_id WHERE f.usuario_id=?').all(usuarioId)) sumar(r.familia, 2);
  for (const r of q("SELECT familia FROM eventos WHERE usuario_id=? AND tipo IN ('busqueda','consulta') AND familia IS NOT NULL").all(usuarioId)) sumar(r.familia, 0.5);
  // Porcentaje = participación de cada familia en la afinidad total del cliente.
  const total = Object.values(puntos).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(puntos)
    .map(([familia, p]) => ({ familia, porcentaje: Math.round((p / total) * 100) }))
    .sort((a, b) => b.porcentaje - a.porcentaje)
    .slice(0, 5);
}

function favoritosDe(usuarioId) {
  return q(`SELECT p.* FROM favoritos f JOIN perfumes p ON p.id=f.perfume_id
    WHERE f.usuario_id=? ORDER BY f.fecha DESC`).all(usuarioId).map(perfumeResumen);
}

app.get('/api/perfil', auth('cliente'), (req, res) => {
  res.json({
    usuario: usuarioPublico(req.user),
    preferencias: preferenciasDe(req.user.id),
    perfilOlfativo: perfilOlfativo(req.user.id),
    favoritos: favoritosDe(req.user.id),
    actividad: q('SELECT * FROM actividad WHERE usuario_id=? ORDER BY fecha DESC, id DESC LIMIT 100').all(req.user.id),
  });
});

app.put('/api/perfil', auth(), (req, res) => {
  const { nombre, telefono, correo, password_actual, password_nueva } = req.body || {};
  if (!nombre || String(nombre).trim().length < 3) return fail(res, 400, 'Escribe tu nombre completo.');
  if (!EMAIL_RE.test(String(correo || ''))) return fail(res, 400, 'Escribe un correo electrónico válido.');
  const otro = q('SELECT id FROM usuarios WHERE lower(correo)=lower(?) AND id<>?').get(correo, req.user.id);
  if (otro) return fail(res, 409, 'Ese correo ya está en uso.');
  if (password_nueva) {
    if (!verifyPassword(String(password_actual || ''), req.user.password_hash)) return fail(res, 400, 'La contraseña actual no es correcta.');
    if (String(password_nueva).length < 8) return fail(res, 400, 'La nueva contraseña debe tener al menos 8 caracteres.');
    q('UPDATE usuarios SET password_hash=? WHERE id=?').run(hashPassword(String(password_nueva)), req.user.id);
  }
  q('UPDATE usuarios SET nombre=?, telefono=?, correo=? WHERE id=?').run(String(nombre).trim(), telefono || null, String(correo).trim(), req.user.id);
  res.json({ usuario: usuarioPublico(q('SELECT * FROM usuarios WHERE id=?').get(req.user.id)) });
});

// Derecho de cancelación (ARCO): el cliente puede eliminar su cuenta.
app.delete('/api/perfil', auth('cliente'), (req, res) => {
  q('UPDATE eventos SET usuario_id=NULL WHERE usuario_id=?').run(req.user.id);
  q('DELETE FROM usuarios WHERE id=?').run(req.user.id);
  res.json({ ok: true });
});

// ---------- favoritos y comparador ----------
app.post('/api/favoritos/:id', auth('cliente'), (req, res) => {
  const p = q("SELECT * FROM perfumes WHERE id=? AND estado='Publicado'").get(req.params.id);
  if (!p) return fail(res, 404, 'Perfume no encontrado.');
  const r = q('INSERT OR IGNORE INTO favoritos (usuario_id, perfume_id, fecha, precio_guardado) VALUES (?,?,?,?)')
    .run(req.user.id, p.id, ahora(), p.precio);
  if (r.changes) {
    registrarActividad(req.user.id, 'Favorito', `Agregó ${p.nombre} a favoritos`);
    registrarEvento('favorito', p, req.user.id);
    marcarRecomendacionAceptada(req.user.id, p.id);
  }
  res.json({ favorito: true });
});

app.delete('/api/favoritos/:id', auth('cliente'), (req, res) => {
  q('DELETE FROM favoritos WHERE usuario_id=? AND perfume_id=?').run(req.user.id, req.params.id);
  res.json({ favorito: false });
});

app.get('/api/comparar', auth(), (req, res) => {
  const ids = motor.lista(req.query.ids).map(Number).filter(Boolean).slice(0, 3);
  const clienteId = req.user.rol === 'cliente' ? req.user.id : Number(req.query.cliente) || null;
  const pref = clienteId ? preferenciasDe(clienteId) : null;
  const items = ids.map((id) => q("SELECT * FROM perfumes WHERE id=? AND estado='Publicado'").get(id)).filter(Boolean)
    .map((p) => ({ ...perfumeResumen(p), match: motor.coincidenciaPerfil(p, pref)?.porcentaje ?? null }));
  res.json(items);
});

app.post('/api/comparar/elegir', auth(), (req, res) => {
  const { ids = [], elegido, cliente_id } = req.body || {};
  const usuarioId = req.user.rol === 'cliente' ? req.user.id : Number(cliente_id) || null;
  const nombres = ids.map((id) => q('SELECT nombre FROM perfumes WHERE id=?').get(id)?.nombre).filter(Boolean);
  const eleg = q('SELECT * FROM perfumes WHERE id=?').get(elegido);
  if (usuarioId && eleg && nombres.length >= 2) {
    registrarActividad(usuarioId, 'Comparación', nombres.join(' vs '), `Eligió ${eleg.nombre}`,
      req.user.rol === 'cliente' ? 'Sistema' : req.user.nombre);
    marcarRecomendacionAceptada(usuarioId, eleg.id);
  }
  res.json({ ok: true });
});

// ---------- asesor de ventas ----------
function resumenCliente(u) {
  return {
    ...usuarioPublico(u),
    preferencias: preferenciasDe(u.id),
    visitas: q("SELECT count(*) n FROM actividad WHERE usuario_id=? AND tipo IN ('Atención en tienda','Visita en tienda','Recomendación del asesor','Búsqueda')").get(u.id).n,
    favoritos: q('SELECT count(*) n FROM favoritos WHERE usuario_id=?').get(u.id).n,
    ultima: q('SELECT max(fecha) f FROM actividad WHERE usuario_id=?').get(u.id).f,
  };
}

app.get('/api/clientes', auth('asesor', 'admin'), (req, res) => {
  const t = `%${String(req.query.q || '').trim().toLowerCase()}%`;
  const rows = q(`SELECT * FROM usuarios WHERE rol='cliente' AND (lower(nombre) LIKE ? OR lower(correo) LIKE ? OR replace(ifnull(telefono,''),' ','') LIKE replace(?,' ',''))
    ORDER BY (SELECT max(fecha) FROM actividad a WHERE a.usuario_id=usuarios.id) DESC LIMIT 50`).all(t, t, t);
  res.json(rows.map(resumenCliente));
});

app.get('/api/clientes/:id', auth('asesor', 'admin'), (req, res) => {
  const u = q("SELECT * FROM usuarios WHERE id=? AND rol='cliente'").get(req.params.id);
  if (!u) return fail(res, 404, 'Cliente no encontrado.');
  const pref = preferenciasDe(u.id);
  const recomendaciones = pref
    ? perfumesPublicados().map((p) => ({ perfume: perfumeResumen(p), ...motor.coincidenciaPerfil(p, pref) }))
      .sort((a, b) => b.porcentaje - a.porcentaje).slice(0, 3)
    : [];
  res.json({
    cliente: resumenCliente(u),
    recomendaciones,
    favoritos: favoritosDe(u.id),
    historial: q('SELECT * FROM actividad WHERE usuario_id=? ORDER BY fecha DESC, id DESC LIMIT 50').all(u.id),
  });
});

app.post('/api/clientes/:id/preferencias', auth('asesor'), (req, res) => {
  const u = q("SELECT * FROM usuarios WHERE id=? AND rol='cliente'").get(req.params.id);
  if (!u) return fail(res, 404, 'Cliente no encontrado.');
  const { familia, ocasion, temporada, presupuesto, notas_evita, notas } = req.body || {};
  const actual = preferenciasDe(u.id) || {};
  const ocasiones = [...new Set([ocasion, ...motor.lista(actual.ocasiones)].filter(Boolean))].slice(0, 3);
  guardarPreferencias(u.id, {
    familia: familia || actual.familia, ocasiones, temporada: temporada || actual.temporada,
    presupuesto: presupuesto || actual.presupuesto, notas_evita: notas_evita ?? actual.notas_evita,
  });
  const detalle = [`Registró preferencia: ${[familia, ocasion, temporada, presupuesto && motor.PRESUPUESTOS[presupuesto]?.etiqueta].filter(Boolean).join(' · ')}`,
    notas_evita ? `Evita: ${notas_evita}` : '', notas || ''].filter(Boolean).join('. ');
  registrarActividad(u.id, 'Atención en tienda', detalle, 'Perfil actualizado', req.user.nombre);
  res.json({ ok: true });
});

app.post('/api/clientes/:id/recomendar', auth('asesor'), (req, res) => {
  const u = q("SELECT * FROM usuarios WHERE id=? AND rol='cliente'").get(req.params.id);
  const p = q("SELECT * FROM perfumes WHERE id=? AND estado='Publicado'").get(req.body?.perfume_id);
  if (!u || !p) return fail(res, 404, 'Cliente o perfume no encontrado.');
  const m = motor.coincidenciaPerfil(p, preferenciasDe(u.id));
  registrarActividad(u.id, 'Recomendación del asesor', `Se recomendó ${p.nombre}${req.body?.nota ? '. ' + req.body.nota : ''}`,
    m ? `${m.porcentaje}% coincidencia` : 'Registrada', req.user.nombre);
  registrarEvento('recomendacion', p, u.id);
  res.json({ ok: true });
});

// ---------- administración ----------
const CONCENTRACIONES = ['Eau de Cologne', 'Eau de Toilette', 'Eau de Parfum', 'Extrait de Parfum'];

function validarPerfume(b) {
  const errores = [];
  if (!b.nombre?.trim()) errores.push('nombre');
  if (!b.marca?.trim()) errores.push('marca');
  if (!b.familia) errores.push('familia olfativa');
  if (!CONCENTRACIONES.includes(b.concentracion)) errores.push('concentración');
  if (!(Number(b.precio) > 0)) errores.push('precio');
  if (!(Number(b.ml) > 0)) errores.push('mililitros');
  if (b.anio && !(Number(b.anio) >= 1700 && Number(b.anio) <= new Date().getFullYear() + 1)) errores.push('año de lanzamiento');
  if (!['Suave', 'Moderada', 'Intensa'].includes(b.intensidad)) errores.push('intensidad');
  const fotoLocal = /^\/img\/perfumes\/[\w.-]+\.(jpe?g|png)$/.test(b.imagen || '');
  if (b.imagen && !fotoLocal && (!/^data:image\/(png|jpe?g);base64,/.test(b.imagen) || b.imagen.length > 2.8e6)) errores.push('imagen (PNG o JPG, máximo 2 MB)');
  return errores;
}

function datosPerfume(b) {
  return [b.nombre.trim(), b.marca.trim(), b.familia, b.subfamilia || null, b.concentracion, Number(b.ml), Number(b.precio),
    b.intensidad, b.publico || 'Unisex', csv(b.ocasiones), csv(b.temporadas), b.notas_salida || null, b.notas_corazon || null,
    b.notas_fondo || null, b.descripcion || null, b.duracion || null, b.proyeccion || null, b.color || '#8B4A2B',
    b.imagen || null, b.estado === 'Borrador' ? 'Borrador' : 'Publicado',
    b.anio ? Number(b.anio) : null, b.perfumista?.trim() || null, b.imagen_credito || null, b.imagen_credito_url || null];
}

app.post('/api/admin/perfumes', auth('admin'), (req, res) => {
  const errores = validarPerfume(req.body || {});
  if (errores.length) return fail(res, 400, `Revisa: ${errores.join(', ')}.`);
  const id = q(`INSERT INTO perfumes (nombre, marca, familia, subfamilia, concentracion, ml, precio, intensidad, publico,
    ocasiones, temporadas, notas_salida, notas_corazon, notas_fondo, descripcion, duracion, proyeccion, color, imagen, estado,
    anio, perfumista, imagen_credito, imagen_credito_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(...datosPerfume({ ...req.body, imagen_credito: null, imagen_credito_url: null })).lastInsertRowid;
  res.status(201).json(perfumeResumen(q('SELECT * FROM perfumes WHERE id=?').get(id)));
});

app.put('/api/admin/perfumes/:id', auth('admin'), (req, res) => {
  const actual = q('SELECT imagen, imagen_credito, imagen_credito_url FROM perfumes WHERE id=?').get(req.params.id);
  if (!actual) return fail(res, 404, 'Perfume no encontrado.');
  // El crédito de la foto solo se conserva si la imagen no cambió.
  const mismaFoto = (req.body?.imagen || null) === actual.imagen;
  const credito = mismaFoto
    ? { imagen_credito: actual.imagen_credito, imagen_credito_url: actual.imagen_credito_url }
    : { imagen_credito: null, imagen_credito_url: null };
  const errores = validarPerfume(req.body || {});
  if (errores.length) return fail(res, 400, `Revisa: ${errores.join(', ')}.`);
  q(`UPDATE perfumes SET nombre=?, marca=?, familia=?, subfamilia=?, concentracion=?, ml=?, precio=?, intensidad=?, publico=?,
    ocasiones=?, temporadas=?, notas_salida=?, notas_corazon=?, notas_fondo=?, descripcion=?, duracion=?, proyeccion=?, color=?,
    imagen=?, estado=?, anio=?, perfumista=?, imagen_credito=?, imagen_credito_url=? WHERE id=?`)
    .run(...datosPerfume({ ...req.body, ...credito }), req.params.id);
  res.json(perfumeResumen(q('SELECT * FROM perfumes WHERE id=?').get(req.params.id)));
});

app.delete('/api/admin/perfumes/:id', auth('admin'), (req, res) => {
  const r = q('DELETE FROM perfumes WHERE id=?').run(req.params.id);
  if (!r.changes) return fail(res, 404, 'Perfume no encontrado.');
  res.json({ ok: true });
});

app.post('/api/admin/categorias', auth('admin'), (req, res) => {
  const { tipo, nombre, descripcion, color } = req.body || {};
  if (!['familia', 'ocasion', 'temporada'].includes(tipo)) return fail(res, 400, 'Tipo de categoría no válido.');
  if (!nombre?.trim()) return fail(res, 400, 'Escribe el nombre de la categoría.');
  try {
    q('INSERT INTO categorias (tipo, nombre, descripcion, color) VALUES (?,?,?,?)').run(tipo, nombre.trim(), descripcion || null, color || '#4A1F3F');
  } catch { return fail(res, 409, 'Ya existe una categoría con ese nombre.'); }
  res.status(201).json({ ok: true });
});

app.put('/api/admin/categorias/:id', auth('admin'), (req, res) => {
  const c = q('SELECT * FROM categorias WHERE id=?').get(req.params.id);
  if (!c) return fail(res, 404, 'Categoría no encontrada.');
  const { nombre, descripcion, color } = req.body || {};
  if (!nombre?.trim()) return fail(res, 400, 'Escribe el nombre de la categoría.');
  const nuevo = nombre.trim();
  db.exec('BEGIN');
  try {
    q('UPDATE categorias SET nombre=?, descripcion=?, color=? WHERE id=?').run(nuevo, descripcion || null, color || c.color, c.id);
    // Mantiene coherentes los perfumes si se renombra la categoría.
    if (nuevo !== c.nombre) {
      if (c.tipo === 'familia') q('UPDATE perfumes SET familia=? WHERE familia=?').run(nuevo, c.nombre);
      const col = c.tipo === 'ocasion' ? 'ocasiones' : c.tipo === 'temporada' ? 'temporadas' : null;
      if (col) {
        for (const p of q(`SELECT id, ${col} v FROM perfumes`).all()) {
          const l = motor.lista(p.v).map((x) => (x === c.nombre ? nuevo : x));
          q(`UPDATE perfumes SET ${col}=? WHERE id=?`).run(l.join(','), p.id);
        }
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); return fail(res, 409, 'Ya existe una categoría con ese nombre.'); }
  res.json({ ok: true });
});

app.delete('/api/admin/categorias/:id', auth('admin'), (req, res) => {
  const c = q('SELECT * FROM categorias WHERE id=?').get(req.params.id);
  if (!c) return fail(res, 404, 'Categoría no encontrada.');
  const usados = c.tipo === 'familia'
    ? q('SELECT count(*) n FROM perfumes WHERE familia=?').get(c.nombre).n
    : q(`SELECT count(*) n FROM perfumes WHERE (','||${c.tipo === 'ocasion' ? 'ocasiones' : 'temporadas'}||',') LIKE ?`).get(`%,${c.nombre},%`).n;
  if (usados) return fail(res, 409, `No se puede eliminar: ${usados} perfume(s) usan esta categoría.`);
  q('DELETE FROM categorias WHERE id=?').run(c.id);
  res.json({ ok: true });
});

// Rango del periodo seleccionado y del periodo anterior equivalente.
function periodo(dias) {
  const d = Math.min(Math.max(Number(dias) || 30, 7), 365);
  const fin = new Date();
  const ini = new Date(fin.getTime() - d * 864e5);
  const iniPrev = new Date(ini.getTime() - d * 864e5);
  const f = (x) => x.toISOString().slice(0, 19).replace('T', ' ');
  return { d, ini: f(ini), fin: f(fin), iniPrev: f(iniPrev) };
}

function dashboard(dias) {
  const p = periodo(dias);
  const contar = (tipo, a, b) => q('SELECT count(*) n FROM eventos WHERE tipo=? AND fecha>=? AND fecha<?').get(tipo, a, b).n;
  const aceptacion = (a, b) => {
    const r = q("SELECT count(*) t, sum(aceptada) a FROM eventos WHERE tipo='recomendacion' AND fecha>=? AND fecha<?").get(a, b);
    return r.t ? Math.round((r.a / r.t) * 100) : 0;
  };
  const delta = (act, prev) => (prev ? Math.round(((act - prev) / prev) * 1000) / 10 : null);

  const consultas = contar('consulta', p.ini, p.fin);
  const consultasPrev = contar('consulta', p.iniPrev, p.ini);
  const recs = contar('recomendacion', p.ini, p.fin);
  const recsPrev = contar('recomendacion', p.iniPrev, p.ini);
  const clientes = q("SELECT count(*) n FROM preferencias pr JOIN usuarios u ON u.id=pr.usuario_id WHERE u.rol='cliente'").get().n;
  const clientesPrev = q("SELECT count(*) n FROM preferencias pr JOIN usuarios u ON u.id=pr.usuario_id WHERE u.rol='cliente' AND u.creado < ?").get(p.ini.slice(0, 10)).n;
  const acep = aceptacion(p.ini, p.fin);
  const acepPrev = aceptacion(p.iniPrev, p.ini);

  const familias = q(`SELECT familia, count(*) n FROM eventos WHERE tipo IN ('consulta','busqueda') AND familia IS NOT NULL
    AND fecha>=? AND fecha<? GROUP BY familia ORDER BY n DESC`).all(p.ini, p.fin);

  const ocasionesRows = q(`SELECT ocasion, count(*) n FROM eventos WHERE ocasion IS NOT NULL AND fecha>=? AND fecha<?
    GROUP BY ocasion ORDER BY n DESC`).all(p.ini, p.fin);
  const totalOc = ocasionesRows.reduce((a, r) => a + r.n, 0) || 1;

  // Tendencia de búsquedas por temporada: últimos 12 meses.
  const meses = [];
  const hoy = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    meses.push(d.toISOString().slice(0, 7));
  }
  const tRows = q(`SELECT substr(fecha,1,7) mes,
      sum(temporada IN ('Otoño','Invierno')) frio, sum(temporada IN ('Primavera','Verano')) calido
    FROM eventos WHERE fecha >= ? GROUP BY mes`).all(`${meses[0]}-01`);
  const tMap = Object.fromEntries(tRows.map((r) => [r.mes, r]));
  const tendencia = meses.map((m) => ({ mes: m, frio: tMap[m]?.frio || 0, calido: tMap[m]?.calido || 0 }));

  const top = q(`SELECT p.id, p.nombre, p.familia, p.color,
      sum(e.tipo='recomendacion' AND e.fecha>=? AND e.fecha<?) recomendaciones,
      sum(e.tipo='recomendacion' AND e.fecha>=? AND e.fecha<?) prev,
      (SELECT count(*) FROM favoritos f WHERE f.perfume_id=p.id) +
        sum(e.tipo='favorito' AND e.fecha>=? AND e.fecha<?) favoritos
    FROM perfumes p LEFT JOIN eventos e ON e.perfume_id=p.id
    WHERE p.estado='Publicado' GROUP BY p.id ORDER BY recomendaciones DESC`).all(p.ini, p.fin, p.iniPrev, p.ini, p.ini, p.fin)
    .map((r) => ({ ...r, tendencia: delta(r.recomendaciones, r.prev) }));

  return {
    periodo: p,
    kpis: {
      consultas: { valor: consultas, delta: delta(consultas, consultasPrev) },
      recomendaciones: { valor: recs, delta: delta(recs, recsPrev) },
      clientes: { valor: clientes, delta: delta(clientes, clientesPrev) },
      aceptacion: { valor: acep, puntos: acep - acepPrev },
    },
    familias,
    ocasiones: ocasionesRows.map((r) => ({ ocasion: r.ocasion, n: r.n, porcentaje: Math.round((r.n / totalOc) * 100) })),
    tendencia,
    top,
  };
}

app.get('/api/admin/dashboard', auth('admin'), (req, res) => res.json(dashboard(req.query.dias)));

app.get('/api/admin/familia/:familia', auth('admin'), (req, res) => {
  const p = periodo(req.query.dias);
  const f = req.params.familia;
  res.json({
    familia: f,
    perfumes: q(`SELECT p.nombre, p.color, count(e.id) consultas FROM perfumes p LEFT JOIN eventos e
      ON e.perfume_id=p.id AND e.tipo='consulta' AND e.fecha>=? AND e.fecha<? WHERE p.familia=? GROUP BY p.id ORDER BY consultas DESC`).all(p.ini, p.fin, f),
    ocasiones: q(`SELECT ocasion, count(*) n FROM eventos WHERE familia=? AND ocasion IS NOT NULL AND fecha>=? AND fecha<?
      GROUP BY ocasion ORDER BY n DESC`).all(f, p.ini, p.fin),
  });
});

app.get('/api/admin/tendencias', auth('admin'), (req, res) => {
  const hoy = new Date();
  const meses = [];
  for (let i = 11; i >= 0; i--) meses.push(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  const rows = q(`SELECT substr(fecha,1,7) mes, familia, count(*) n FROM eventos WHERE familia IS NOT NULL AND fecha >= ?
    GROUP BY mes, familia`).all(`${meses[0]}-01`);
  const familias = [...new Set(rows.map((r) => r.familia))];
  const series = familias.map((f) => ({
    familia: f,
    color: q("SELECT color FROM categorias WHERE tipo='familia' AND nombre=?").get(f)?.color || '#888',
    valores: meses.map((m) => rows.find((r) => r.mes === m && r.familia === f)?.n || 0),
  }));
  // Crecimiento: últimos 3 meses completos vs 3 anteriores.
  const crecimiento = series.map((s) => {
    const a = s.valores.slice(8, 11).reduce((x, y) => x + y, 0);
    const b = s.valores.slice(5, 8).reduce((x, y) => x + y, 0);
    return { familia: s.familia, color: s.color, reciente: a, anterior: b, cambio: b ? Math.round(((a - b) / b) * 100) : null };
  }).sort((x, y) => (y.cambio ?? 0) - (x.cambio ?? 0));
  const intensidad = q(`SELECT p.intensidad, count(*) n FROM eventos e JOIN perfumes p ON p.id=e.perfume_id
    WHERE e.fecha >= ? GROUP BY p.intensidad`).all(`${meses[9]}-01`);
  const presupuesto = q(`SELECT CASE WHEN p.precio<=1500 THEN 'Hasta $1,500' WHEN p.precio<=3000 THEN '$1,500 – $3,000' ELSE 'Más de $3,000' END rango,
    count(*) n FROM eventos e JOIN perfumes p ON p.id=e.perfume_id WHERE e.fecha >= ? GROUP BY rango`).all(`${meses[9]}-01`);
  res.json({ meses, series, crecimiento, intensidad, presupuesto });
});

app.get('/api/admin/reporte.csv', auth('admin'), (req, res) => {
  const d = dashboard(req.query.dias);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [
    ['Reporte AromaMatch', `Últimos ${d.periodo.d} días`, `Generado ${ahora()}`],
    [],
    ['Indicador', 'Valor', 'Cambio vs periodo anterior'],
    ['Consultas al catálogo', d.kpis.consultas.valor, d.kpis.consultas.delta != null ? `${d.kpis.consultas.delta}%` : ''],
    ['Recomendaciones generadas', d.kpis.recomendaciones.valor, d.kpis.recomendaciones.delta != null ? `${d.kpis.recomendaciones.delta}%` : ''],
    ['Clientes con perfil', d.kpis.clientes.valor, d.kpis.clientes.delta != null ? `${d.kpis.clientes.delta}%` : ''],
    ['Aceptación de recomendaciones', `${d.kpis.aceptacion.valor}%`, `${d.kpis.aceptacion.puntos} pts`],
    [],
    ['Familia olfativa', 'Consultas'], ...d.familias.map((f) => [f.familia, f.n]),
    [],
    ['Ocasión', 'Búsquedas', '%'], ...d.ocasiones.map((o) => [o.ocasion, o.n, `${o.porcentaje}%`]),
    [],
    ['Mes', 'Otoño / Invierno', 'Primavera / Verano'], ...d.tendencia.map((t) => [t.mes, t.frio, t.calido]),
    [],
    ['#', 'Perfume', 'Familia', 'Recomendaciones', 'Favoritos', 'Tendencia'],
    ...d.top.map((t, i) => [i + 1, t.nombre, t.familia, t.recomendaciones, t.favoritos, t.tendencia != null ? `${t.tendencia}%` : '']),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_aromamatch_${ahora().slice(0, 10)}.csv"`);
  res.send('﻿' + lineas.map((l) => l.map(esc).join(',')).join('\r\n'));
});

// ---------- alertas por excepción ----------
app.get('/api/alertas', auth('cliente', 'admin'), (req, res) => {
  res.json(req.user.rol === 'admin' ? analisis.alertasAdmin(db) : analisis.alertasCliente(db, req.user.id));
});

// El cliente descarta el aviso de baja de precio: el precio actual pasa a ser su nueva referencia.
app.post('/api/alertas/precio/:id/visto', auth('cliente'), (req, res) => {
  q(`UPDATE favoritos SET precio_guardado=(SELECT precio FROM perfumes WHERE id=?)
    WHERE usuario_id=? AND perfume_id=?`).run(req.params.id, req.user.id, req.params.id);
  res.json({ ok: true });
});

// ---------- ventas en tienda (asesor) ----------
app.post('/api/ventas', auth('asesor'), (req, res) => {
  const { perfume_id, cliente_id } = req.body || {};
  const cantidad = Math.floor(Number(req.body?.cantidad) || 0);
  const p = q("SELECT * FROM perfumes WHERE id=? AND estado='Publicado'").get(perfume_id);
  if (!p) return fail(res, 404, 'Perfume no encontrado.');
  if (cantidad < 1) return fail(res, 400, 'La cantidad debe ser al menos 1.');
  if (cantidad > p.existencias) return fail(res, 409, `Solo hay ${p.existencias} unidad(es) en existencia.`);
  const cliente = cliente_id ? q("SELECT * FROM usuarios WHERE id=? AND rol='cliente'").get(cliente_id) : null;
  db.exec('BEGIN');
  try {
    q('INSERT INTO ventas (perfume_id, cantidad, precio_unitario, cliente_id, asesor_id, fecha) VALUES (?,?,?,?,?,?)')
      .run(p.id, cantidad, p.precio, cliente?.id ?? null, req.user.id, ahora());
    q('UPDATE perfumes SET existencias = existencias - ? WHERE id=?').run(cantidad, p.id);
    if (cliente) {
      registrarActividad(cliente.id, 'Compra', `Compró ${cantidad} × ${p.nombre}`, `$${(cantidad * p.precio).toLocaleString('es-MX')}`, req.user.nombre);
      marcarRecomendacionAceptada(cliente.id, p.id);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  res.status(201).json({ existencias: p.existencias - cantidad });
});

// ---------- análisis para el administrador ----------
app.get('/api/admin/pronostico', auth('admin'), (req, res) => res.json(analisis.pronostico(db)));

app.get('/api/admin/inventario', auth('admin'), (req, res) => {
  const pron = analisis.pronostico(db);
  res.json({ inventario: analisis.inventario(db, pron), abc: analisis.abc(db) });
});

app.put('/api/admin/inventario/:id', auth('admin'), (req, res) => {
  const existencias = Math.floor(Number(req.body?.existencias));
  const entrega = Math.floor(Number(req.body?.tiempo_entrega));
  if (!(existencias >= 0) || !(entrega >= 1 && entrega <= 120)) return fail(res, 400, 'Revisa existencias (≥ 0) y tiempo de entrega (1 a 120 días).');
  const r = q('UPDATE perfumes SET existencias=?, tiempo_entrega=? WHERE id=?').run(existencias, entrega, req.params.id);
  if (!r.changes) return fail(res, 404, 'Perfume no encontrado.');
  res.json({ ok: true });
});

app.post('/api/admin/inventario/:id/entrada', auth('admin'), (req, res) => {
  const cantidad = Math.floor(Number(req.body?.cantidad));
  if (!(cantidad >= 1 && cantidad <= 10000)) return fail(res, 400, 'La cantidad debe ser entre 1 y 10,000.');
  const r = q('UPDATE perfumes SET existencias = existencias + ? WHERE id=?').run(cantidad, req.params.id);
  if (!r.changes) return fail(res, 404, 'Perfume no encontrado.');
  res.json({ ok: true });
});

app.post('/api/admin/simular', auth('admin'), (req, res) => {
  const precio = Number(req.body?.precio);
  if (!(precio > 0 && precio < 1e6)) return fail(res, 400, 'Escribe un precio válido.');
  const r = analisis.simularPrecio(db, Number(req.body?.perfume_id), precio);
  if (!r) return fail(res, 404, 'Perfume no encontrado.');
  res.json(r);
});

// Aplica el precio simulado. Los clientes que lo tienen en favoritos verán la alerta si bajó.
app.post('/api/admin/perfumes/:id/precio', auth('admin'), (req, res) => {
  const precio = Math.round(Number(req.body?.precio) * 100) / 100;
  if (!(precio > 0 && precio < 1e6)) return fail(res, 400, 'Escribe un precio válido.');
  const r = q('UPDATE perfumes SET precio=? WHERE id=?').run(precio, req.params.id);
  if (!r.changes) return fail(res, 404, 'Perfume no encontrado.');
  res.json({ ok: true, precio });
});

app.use('/api', (req, res) => fail(res, 404, 'Ruta no encontrada.'));
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.too.large') return fail(res, 413, 'El archivo es demasiado grande (máximo 2 MB).');
  fail(res, 500, 'Ocurrió un error inesperado.');
});

// Limpieza de sesiones vencidas al iniciar.
q('DELETE FROM sesiones WHERE expira <= ?').run(ahora());

app.listen(PORT, () => {
  console.log(`AromaMatch listo en http://localhost:${PORT}`);
});
