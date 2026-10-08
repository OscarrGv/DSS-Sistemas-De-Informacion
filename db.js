// Capa de datos de AromaMatch: esquema SQLite y datos iniciales.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'aromamatch.db');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL UNIQUE,
  telefono      TEXT,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('cliente','asesor','admin')),
  sucursal      TEXT,
  acepto_terminos TEXT,
  creado        TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS sesiones (
  token      TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo        TEXT NOT NULL CHECK (tipo IN ('familia','ocasion','temporada')),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  color       TEXT NOT NULL DEFAULT '#4A1F3F',
  UNIQUE (tipo, nombre)
);

CREATE TABLE IF NOT EXISTS perfumes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL,
  marca          TEXT NOT NULL,
  familia        TEXT NOT NULL,
  subfamilia     TEXT,
  concentracion  TEXT NOT NULL,
  ml             INTEGER NOT NULL,
  precio         REAL NOT NULL,
  intensidad     TEXT NOT NULL CHECK (intensidad IN ('Suave','Moderada','Intensa')),
  publico        TEXT NOT NULL DEFAULT 'Unisex',
  ocasiones      TEXT NOT NULL DEFAULT '',
  temporadas     TEXT NOT NULL DEFAULT '',
  notas_salida   TEXT,
  notas_corazon  TEXT,
  notas_fondo    TEXT,
  descripcion    TEXT,
  duracion       TEXT,
  proyeccion     TEXT,
  color          TEXT NOT NULL DEFAULT '#8B4A2B',
  imagen         TEXT,
  anio           INTEGER,
  perfumista     TEXT,
  imagen_credito TEXT,
  imagen_credito_url TEXT,
  estado         TEXT NOT NULL DEFAULT 'Publicado' CHECK (estado IN ('Publicado','Borrador')),
  disponible     INTEGER NOT NULL DEFAULT 1,
  existencias    INTEGER NOT NULL DEFAULT 10,   -- unidades en inventario
  tiempo_entrega INTEGER NOT NULL DEFAULT 7,    -- días que tarda el proveedor en surtir
  creado         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ventas registradas en tienda (base para inventario, punto de reorden y análisis ABC)
CREATE TABLE IF NOT EXISTS ventas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  perfume_id      INTEGER REFERENCES perfumes(id) ON DELETE SET NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL NOT NULL,
  cliente_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  asesor_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);

CREATE TABLE IF NOT EXISTS preferencias (
  usuario_id  INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  familia     TEXT,
  ocasiones   TEXT,
  temporada   TEXT,
  intensidad  TEXT,
  presupuesto TEXT,
  notas_evita TEXT,
  pesos       TEXT   -- JSON con pesos personalizados del buscador (null = predeterminados)
);

CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  perfume_id INTEGER NOT NULL REFERENCES perfumes(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL DEFAULT (datetime('now')),
  precio_guardado REAL,   -- precio al guardarlo; si baja se avisa al cliente
  PRIMARY KEY (usuario_id, perfume_id)
);

-- Historial visible para cliente y asesor
CREATE TABLE IF NOT EXISTS actividad (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL DEFAULT (datetime('now')),
  tipo       TEXT NOT NULL,
  detalle    TEXT,
  resultado  TEXT,
  autor      TEXT NOT NULL DEFAULT 'Sistema'
);

-- Eventos de uso para el dashboard y las tendencias
CREATE TABLE IF NOT EXISTS eventos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo       TEXT NOT NULL CHECK (tipo IN ('consulta','busqueda','recomendacion','favorito')),
  perfume_id INTEGER REFERENCES perfumes(id) ON DELETE SET NULL,
  familia    TEXT,
  ocasion    TEXT,
  temporada  TEXT,
  aceptada   INTEGER NOT NULL DEFAULT 0,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha);
CREATE INDEX IF NOT EXISTS idx_actividad_usuario ON actividad(usuario_id, fecha);
`;

const CATEGORIAS = [
  ['familia', 'Oriental', 'Ámbar, especias, resinas', '#8B4A2B'],
  ['familia', 'Amaderado', 'Cedro, vetiver, sándalo', '#5C4A38'],
  ['familia', 'Floral', 'Rosa, iris, jazmín', '#8E6BB5'],
  ['familia', 'Cítrico', 'Limón, bergamota, neroli', '#D4A032'],
  ['familia', 'Gourmand', 'Vainilla, tonka, caramelo', '#B87A4B'],
  ['familia', 'Acuático', 'Notas marinas y frescas', '#3E7596'],
  ['ocasion', 'Día a día', 'Uso cotidiano', '#A0561F'],
  ['ocasion', 'Cita', 'Encuentros y cenas', '#A0561F'],
  ['ocasion', 'Oficina', 'Ambientes de trabajo', '#A0561F'],
  ['ocasion', 'Evento formal', 'Bodas, galas, ceremonias', '#A0561F'],
  ['ocasion', 'Deporte', 'Actividad al aire libre', '#A0561F'],
  ['temporada', 'Primavera', 'Florales y verdes', '#5E7A45'],
  ['temporada', 'Verano', 'Frescos y ligeros', '#D4A032'],
  ['temporada', 'Otoño', 'Cálidos y especiados', '#A0561F'],
  ['temporada', 'Invierno', 'Intensos y envolventes', '#4A1F3F'],
];

const PERFUMES = require('./seed/perfumes');

// Generador pseudoaleatorio determinista para que los datos de ejemplo sean reproducibles.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand, items) {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) { if ((r -= w) <= 0) return v; }
  return items[items.length - 1][0];
}

function seed(db) {
  const insCat = db.prepare('INSERT INTO categorias (tipo, nombre, descripcion, color) VALUES (?,?,?,?)');
  for (const c of CATEGORIAS) insCat.run(...c);

  const insPerf = db.prepare(`INSERT INTO perfumes
    (nombre, marca, familia, subfamilia, concentracion, ml, precio, intensidad, publico, ocasiones, temporadas,
     notas_salida, notas_corazon, notas_fondo, descripcion, duracion, proyeccion, color, estado, anio, perfumista, disponible, imagen, imagen_credito, imagen_credito_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const p of PERFUMES) {
    insPerf.run(p.nombre, p.marca, p.familia, p.subfamilia, p.concentracion, p.ml, p.precio, p.intensidad,
      p.publico, p.ocasiones, p.temporadas, p.notas_salida, p.notas_corazon, p.notas_fondo, p.descripcion,
      p.duracion, p.proyeccion, p.color, p.estado || 'Publicado', p.anio ?? null, p.perfumista ?? null, p.disponible ?? 1,
      p.imagen ?? null, p.imagen_credito ?? null, p.imagen_credito_url ?? null);
  }
  const perfumes = db.prepare('SELECT * FROM perfumes').all();
  const byName = Object.fromEntries(perfumes.map((p) => [p.nombre, p.id]));

  const insUser = db.prepare(`INSERT INTO usuarios (nombre, correo, telefono, password_hash, rol, sucursal, acepto_terminos, creado)
    VALUES (?,?,?,?,?,?,?,?)`);
  const admin = insUser.run('Administración', 'admin@aromamatch.mx', null, hashPassword('admin123'), 'admin', 'Perfumería', '2026-01-10', '2026-01-10').lastInsertRowid;
  const jorge = insUser.run('Jorge Ramírez', 'jorge.ramirez@aromamatch.mx', '229 111 2233', hashPassword('asesor123'), 'asesor', 'Sucursal Centro', '2026-01-15', '2026-01-15').lastInsertRowid;
  insUser.run('Ana Torres', 'ana.torres@aromamatch.mx', '229 444 5566', hashPassword('asesor123'), 'asesor', 'Sucursal Norte', '2026-02-01', '2026-02-01');
  const mariana = insUser.run('Mariana López', 'mariana.lopez@correo.com', '229 000 0000', hashPassword('cliente123'), 'cliente', null, '2026-03-15', '2026-03-15').lastInsertRowid;
  void admin; void jorge;

  db.prepare(`INSERT INTO preferencias (usuario_id, familia, ocasiones, temporada, intensidad, presupuesto, notas_evita)
    VALUES (?,?,?,?,?,?,?)`).run(mariana, 'Oriental', 'Cita,Oficina', 'Otoño', 'Intensa', 'alto', 'Acuáticas, menta');

  const precioDe = (n) => perfumes.find((p) => p.nombre === n).precio;
  const insFav = db.prepare('INSERT INTO favoritos (usuario_id, perfume_id, fecha, precio_guardado) VALUES (?,?,?,?)');
  insFav.run(mariana, byName['Black Opium'], '2026-09-18 12:10:00', precioDe('Black Opium'));
  // La Vie Est Belle costaba $3,650 cuando lo guardó: genera la alerta "bajó de precio".
  insFav.run(mariana, byName['La Vie Est Belle'], '2026-09-12 18:30:00', 3650);
  insFav.run(mariana, byName['Baccarat Rouge 540'], '2026-08-30 10:00:00', precioDe('Baccarat Rouge 540'));
  insFav.run(mariana, byName['Oud Wood'], '2026-08-21 17:45:00', precioDe('Oud Wood'));

  const insAct = db.prepare('INSERT INTO actividad (usuario_id, fecha, tipo, detalle, resultado, autor) VALUES (?,?,?,?,?,?)');
  const actMariana = [
    ['2026-03-15 11:00:00', 'Alta de cliente', 'Creó su cuenta y completó el perfil olfativo.', 'Perfil creado', 'Sistema'],
    ['2026-08-21 17:40:00', 'Recomendación del asesor', 'Se recomendó Oud Wood para evento formal.', 'Aceptada', 'Ana Torres'],
    ['2026-08-28 13:20:00', 'Búsqueda', 'Oficina · Primavera · Floral', '4 resultados', 'Sistema'],
    ['2026-09-05 16:00:00', 'Atención en tienda', 'Asesor registró preferencia: evita notas acuáticas. Probó La Vie Est Belle.', 'Perfil actualizado', 'Jorge Ramírez'],
    ['2026-09-12 18:30:00', 'Favorito', 'Agregó La Vie Est Belle a favoritos', '—', 'Sistema'],
    ['2026-09-18 12:00:00', 'Búsqueda', 'Cita · Otoño · Oriental · Intensa · Más de $3,000', '5 resultados', 'Sistema'],
    ['2026-09-18 12:05:00', 'Recomendación', 'Black Opium sugerido por el sistema', '100% coincidencia', 'Sistema'],
    ['2026-09-18 12:15:00', 'Comparación', 'Black Opium vs La Vie Est Belle vs Baccarat Rouge 540', 'Eligió Black Opium', 'Sistema'],
  ];
  for (const a of actMariana) insAct.run(mariana, ...a);

  // Clientes de ejemplo para que el dashboard tenga volumen.
  const rand = rng(2026);
  const nombres = ['Sofía', 'Valeria', 'Camila', 'Daniela', 'Lucía', 'Regina', 'Fernanda', 'Andrea', 'Paula', 'Renata',
    'Diego', 'Santiago', 'Emiliano', 'Mateo', 'Luis', 'Carlos', 'Andrés', 'Rodrigo', 'Javier', 'Héctor'];
  const apellidos = ['García', 'Hernández', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Morales',
    'Reyes', 'Jiménez', 'Ruiz', 'Vargas', 'Castillo', 'Ortiz', 'Mendoza', 'Silva', 'Rojas', 'Navarro'];
  const familias = ['Oriental', 'Floral', 'Amaderado', 'Cítrico', 'Gourmand', 'Acuático'];
  const ocasiones = ['Día a día', 'Cita', 'Oficina', 'Evento formal', 'Deporte'];
  const temporadas = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
  const intensidades = ['Suave', 'Moderada', 'Intensa'];
  const presupuestos = ['bajo', 'medio', 'alto'];
  const demoPass = hashPassword('cliente123');
  const insPref = db.prepare(`INSERT INTO preferencias (usuario_id, familia, ocasiones, temporada, intensidad, presupuesto, notas_evita)
    VALUES (?,?,?,?,?,?,?)`);
  const clientes = [];
  for (let i = 0; i < 80; i++) {
    const n = nombres[Math.floor(rand() * nombres.length)];
    const a = apellidos[Math.floor(rand() * apellidos.length)];
    const mes = 1 + Math.floor(rand() * 9);
    const dia = 1 + Math.floor(rand() * 27);
    const fecha = `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const correo = `${n}.${a}.${i}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@correo.com';
    const tel = `229 ${100 + Math.floor(rand() * 900)} ${1000 + Math.floor(rand() * 9000)}`;
    const id = insUser.run(`${n} ${a}`, correo, tel, demoPass, 'cliente', null, fecha, fecha).lastInsertRowid;
    clientes.push(id);
    if (rand() < 0.8) {
      insPref.run(id, familias[Math.floor(rand() * 6)], ocasiones[Math.floor(rand() * 5)],
        temporadas[Math.floor(rand() * 4)], intensidades[Math.floor(rand() * 3)], presupuestos[Math.floor(rand() * 3)], null);
    }
    insAct.run(id, `${fecha} 10:00:00`, 'Alta de cliente', 'Creó su cuenta.', 'Perfil creado', 'Sistema');
  }

  // Eventos de uso y ventas: 24 meses completos + mes en curso, con estacionalidad y crecimiento.
  const insEv = db.prepare('INSERT INTO eventos (tipo, perfume_id, familia, ocasion, temporada, aceptada, usuario_id, fecha) VALUES (?,?,?,?,?,?,?,?)');
  const insVenta = db.prepare('INSERT INTO ventas (perfume_id, cantidad, precio_unitario, cliente_id, asesor_id, fecha) VALUES (?,?,?,?,?,?)');
  const asesores = db.prepare("SELECT id FROM usuarios WHERE rol='asesor'").all().map((r) => r.id);
  const publicados = perfumes.filter((p) => p.estado === 'Publicado');
  const famBase = { Oriental: 32, Floral: 28, Amaderado: 23, 'Cítrico': 19, Gourmand: 14, 'Acuático': 10 };
  const famFria = new Set(['Oriental', 'Amaderado', 'Gourmand']); // suben en otoño/invierno
  const ocW = [['Día a día', 31], ['Cita', 24], ['Oficina', 19], ['Evento formal', 16], ['Deporte', 10]];
  // Popularidad relativa dentro de su familia (los superventas reales pesan más); el resto, 0.5–1.
  const popularidad = {
    Sauvage: 3.2, 'Black Opium': 2.8, "J'adore": 2.4, 'Baccarat Rouge 540': 2.2, 'Bleu de Chanel': 2.2,
    'La Vie Est Belle': 2.2, 'Acqua di Giò': 2.4, 'Good Girl': 1.6, '1 Million': 1.4, 'Light Blue': 1.8,
  };
  for (const p of publicados) if (!(p.nombre in popularidad)) popularidad[p.nombre] = 0.5 + rand() * 0.5;
  const hoy = new Date();
  const start = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 24, 1));
  const end = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - 1));
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const m = d.getUTCMonth(); // 0 = enero
    // Otoño/Invierno pico en dic-ene, Primavera/Verano pico en jun-jul.
    const cold = 0.5 + 0.5 * Math.cos((m / 12) * 2 * Math.PI);
    const anios = (d - start) / (365 * 864e5);
    // Acuático pierde interés año con año (≈ −25 %): tendencia real que detectan las alertas.
    const famW = Object.entries(famBase).map(([f, w]) => [f,
      w * (1 + (famFria.has(f) ? 0.6 : -0.6) * (cold - 0.5)) * (f === 'Acuático' ? 1 - 0.25 * anios : 1)]);
    const crecimiento = 1 + 0.12 * anios; // +12 % anual en el total
    const perDay = Math.round((45 + Math.floor(rand() * 25)) * crecimiento);
    for (let k = 0; k < perDay; k++) {
      const temporada = rand() < cold
        ? (rand() < 0.5 ? 'Otoño' : 'Invierno')
        : (rand() < 0.5 ? 'Primavera' : 'Verano');
      const familia = pickWeighted(rand, famW);
      const ocasion = pickWeighted(rand, ocW);
      const cand = publicados.filter((p) => p.familia === familia).map((p) => [p, popularidad[p.nombre] ?? 1]);
      const perf = cand.length ? pickWeighted(rand, cand) : publicados[Math.floor(rand() * publicados.length)];
      const user = clientes[Math.floor(rand() * clientes.length)];
      const hh = String(9 + Math.floor(rand() * 12)).padStart(2, '0');
      const fecha = `${d.toISOString().slice(0, 10)} ${hh}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00`;
      const tipo = pickWeighted(rand, [['consulta', 55], ['busqueda', 20], ['recomendacion', 18], ['favorito', 7]]);
      const aceptada = tipo === 'recomendacion' && rand() < 0.64 ? 1 : 0;
      insEv.run(tipo, perf.id, familia, ocasion, temporada, aceptada, user, fecha);
      // Una parte de las consultas termina en compra en tienda.
      if (tipo === 'consulta' && rand() < 0.15) {
        insVenta.run(perf.id, rand() < 0.06 ? 2 : 1, perf.precio, user, asesores[Math.floor(rand() * asesores.length)], fecha);
      }
    }
  }

  // Inventario inicial; algunos casos fijos para mostrar alertas de reorden y agotado.
  const setStock = db.prepare('UPDATE perfumes SET existencias=?, tiempo_entrega=? WHERE id=?');
  const fijos = { Daisy: 0, 'Baccarat Rouge 540': 2, Sauvage: 3, 'Black Opium': 4 };
  for (const p of perfumes) {
    const stock = p.nombre in fijos ? fijos[p.nombre] : 8 + Math.floor(rand() * 22);
    const entrega = /Kurkdjian|Le Labo|Tom Ford|Acqua di Parma|Jo Malone/.test(p.marca) ? 14 : 7; // nicho tarda más
    setStock.run(stock, entrega, p.id);
  }
}

function openDatabase({ reset = false } = {}) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (reset && fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);
  const isNew = !fs.existsSync(DB_FILE);
  const db = new DatabaseSync(DB_FILE);
  db.exec(SCHEMA);
  if (isNew) {
    db.exec('BEGIN');
    try { seed(db); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    console.log('Base de datos creada con datos iniciales.');
  }
  return db;
}

module.exports = { openDatabase, hashPassword, verifyPassword };
