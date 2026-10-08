// Motor de recomendación de AromaMatch.
// La coincidencia es la suma de los pesos de cada criterio que el perfume cumple,
// dividida entre los pesos de los criterios que el usuario eligió.
// Los pesos pueden personalizarse (análisis "¿qué pasaría si…?"); si no, se usan los predeterminados.

const PESOS = { ocasion: 25, temporada: 20, familia: 30, intensidad: 15, presupuesto: 10 };

const PRESUPUESTOS = {
  bajo: { etiqueta: 'Hasta $1,500', min: 0, max: 1500 },
  medio: { etiqueta: '$1,500 – $3,000', min: 1500, max: 3000 },
  alto: { etiqueta: 'Más de $3,000', min: 3000.01, max: Infinity },
};

// Valida pesos personalizados: enteros 0–100 por criterio; los que falten toman el valor predeterminado.
function normalizarPesos(p) {
  let obj = p;
  if (typeof p === 'string') { try { obj = JSON.parse(p); } catch { obj = null; } }
  if (!obj || typeof obj !== 'object') return { ...PESOS };
  const out = {};
  for (const k of Object.keys(PESOS)) {
    const n = Number(obj[k]);
    out[k] = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : PESOS[k];
  }
  return out;
}

const lista = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => s.trim()).filter(Boolean);

function enPresupuesto(precio, clave) {
  const r = PRESUPUESTOS[clave];
  return !!r && precio >= r.min && precio <= r.max;
}

function presupuestoDePrecio(precio) {
  if (precio <= 1500) return 'bajo';
  if (precio <= 3000) return 'medio';
  return 'alto';
}

// Normaliza criterios: cada uno puede ser un valor o una lista de valores aceptados.
function normalizar(c = {}) {
  return {
    ocasion: lista(c.ocasion),
    temporada: lista(c.temporada),
    familia: lista(c.familia),
    intensidad: lista(c.intensidad),
    presupuesto: lista(c.presupuesto),
  };
}

// Evalúa un perfume contra los criterios; devuelve porcentaje y detalle de coincidencias.
function evaluar(perfume, criterios, pesos = PESOS) {
  const c = normalizar(criterios);
  const W = pesos === PESOS ? PESOS : normalizarPesos(pesos);
  const ocasiones = lista(perfume.ocasiones);
  const temporadas = lista(perfume.temporadas);
  const coincide = [];
  const noCoincide = [];
  let total = 0;
  let obtenido = 0;

  const revisar = (clave, ok, etiqueta) => {
    if (!W[clave]) return; // un criterio con peso 0 no influye
    total += W[clave];
    if (ok) { obtenido += W[clave]; coincide.push(etiqueta); } else noCoincide.push(etiqueta);
  };

  if (c.ocasion.length) revisar('ocasion', c.ocasion.some((o) => ocasiones.includes(o)), c.ocasion.join(' / '));
  if (c.temporada.length) revisar('temporada', c.temporada.some((t) => temporadas.includes(t)), c.temporada.join(' / '));
  if (c.familia.length) revisar('familia', c.familia.includes(perfume.familia), c.familia.join(' / '));
  if (c.intensidad.length) revisar('intensidad', c.intensidad.includes(perfume.intensidad), c.intensidad.join(' / '));
  if (c.presupuesto.length) {
    revisar('presupuesto', c.presupuesto.some((p) => enPresupuesto(perfume.precio, p)),
      c.presupuesto.map((p) => PRESUPUESTOS[p]?.etiqueta || p).join(' / '));
  }

  const porcentaje = total ? Math.round((obtenido / total) * 100) : 0;
  return { porcentaje, coincide, noCoincide, criterios: total ? Object.values(c).filter((v) => v.length).length : 0 };
}

function ranking(perfumes, criterios, pesos = PESOS) {
  return perfumes
    .map((p) => ({ perfume: p, ...evaluar(p, criterios, pesos) }))
    .sort((a, b) => b.porcentaje - a.porcentaje || a.perfume.precio - b.perfume.precio);
}

// Coincidencia con el perfil guardado del cliente (preferencias + notas que evita).
function coincidenciaPerfil(perfume, pref) {
  if (!pref) return null;
  const criterios = {
    ocasion: pref.ocasiones, temporada: pref.temporada, familia: pref.familia,
    intensidad: pref.intensidad, presupuesto: pref.presupuesto,
  };
  const r = evaluar(perfume, criterios, pref.pesos ? normalizarPesos(pref.pesos) : PESOS);
  if (!r.criterios) return null;

  const razones = [];
  const nf = (s) => String(s || '').toLowerCase();
  if (pref.familia && pref.familia === perfume.familia) razones.push(`Familia ${nf(perfume.familia)}, tu favorita`);
  const ocs = lista(pref.ocasiones).filter((o) => lista(perfume.ocasiones).includes(o));
  const temp = pref.temporada && lista(perfume.temporadas).includes(pref.temporada) ? pref.temporada : null;
  if (ocs.length || temp) {
    razones.push(`Ideal para ${[...ocs.map(nf), temp && nf(temp)].filter(Boolean).join(' y ')}`);
  }
  if (pref.intensidad && pref.intensidad === perfume.intensidad) razones.push(`Intensidad ${nf(perfume.intensidad)}, como te gusta`);
  if (pref.presupuesto && enPresupuesto(perfume.precio, pref.presupuesto)) razones.push('Dentro de tu presupuesto habitual');

  // Penalización si el perfume contiene notas que el cliente evita.
  let porcentaje = r.porcentaje;
  const evita = lista(pref.notas_evita).map((n) => nf(n).replace(/s$/, '').replace(/a$/, ''));
  const notas = nf([perfume.notas_salida, perfume.notas_corazon, perfume.notas_fondo, perfume.familia].join(' '));
  const evitadas = evita.filter((n) => n.length > 2 && notas.includes(n));
  if (evitadas.length) {
    porcentaje = Math.max(0, porcentaje - 20 * evitadas.length);
    razones.push('Contiene notas que prefieres evitar');
  }
  return { porcentaje, razones, coincide: r.coincide, noCoincide: r.noCoincide };
}

// Similitud entre perfumes usando los atributos del perfume base como criterios.
function similares(base, perfumes, limite = 4) {
  const criterios = {
    familia: base.familia,
    ocasion: base.ocasiones,
    temporada: base.temporadas,
    intensidad: base.intensidad,
    presupuesto: presupuestoDePrecio(base.precio),
  };
  return ranking(perfumes.filter((p) => p.id !== base.id), criterios).slice(0, limite);
}

module.exports = { PESOS, PRESUPUESTOS, normalizarPesos, enPresupuesto, evaluar, ranking, coincidenciaPerfil, similares, presupuestoDePrecio, lista };
