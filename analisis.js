// Modelos de análisis del DSS: pronóstico de demanda, inventario (punto de reorden y ABC),
// simulación de precios ("¿qué pasaría si…?") y alertas por excepción.
const motor = require('./recomendador');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const Z_SERVICIO = 1.65; // nivel de servicio del 95 % para el stock de seguridad
const DIAS_COBERTURA = 30; // el pedido sugerido cubre 30 días de demanda

const ym = (d) => d.toISOString().slice(0, 7);
const nombreMes = (m) => MESES[Number(m.slice(5, 7)) - 1];
const suma = (a) => a.reduce((x, y) => x + y, 0);
const redondear = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// Últimos n meses completos (sin el mes en curso), del más antiguo al más reciente.
function mesesCompletos(n) {
  const hoy = new Date();
  const out = [];
  for (let i = n; i >= 1; i--) out.push(ym(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1))));
  return out;
}

function mesesSiguientes(n) {
  const hoy = new Date();
  const out = [];
  for (let i = 0; i < n; i++) out.push(ym(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + i, 1))));
  return out;
}

// ---------------------------------------------------------------------------
// Pronóstico de demanda (interés = consultas + búsquedas) por familia olfativa
// ---------------------------------------------------------------------------
// Métodos:
//  • Estacional con tendencia: valor del mismo mes del año anterior × (últimos 3 meses ÷ mismos 3 meses del año anterior).
//  • Media móvil de 3 meses.
// Se elige el de menor MAPE en una prueba retrospectiva sobre los últimos 3 meses reales.
function pronosticarSerie(y) {
  const n = y.length; // 24 meses
  const factor = (fin) => {
    const reciente = suma(y.slice(fin - 3, fin));
    const anterior = suma(y.slice(fin - 15, fin - 12));
    return anterior ? reciente / anterior : 1;
  };
  const estacional = (fin, h) => y[fin - 12 + h] * factor(fin);
  const movil = (fin) => suma(y.slice(fin - 3, fin)) / 3;

  // Prueba retrospectiva: pronosticar los 3 últimos meses con datos hasta n-3.
  const reales = y.slice(n - 3);
  const mape = (pred) => redondear((suma(reales.map((a, i) => (a ? Math.abs(a - pred[i]) / a : 0))) / 3) * 100);
  const mapeEst = mape([0, 1, 2].map((h) => estacional(n - 3, h)));
  const mapeMov = mape([0, 1, 2].map(() => movil(n - 3)));
  const metodo = mapeEst <= mapeMov ? 'estacional' : 'movil';

  const pron = [0, 1, 2].map((h) => Math.round(metodo === 'estacional' ? estacional(n, h) : movil(n)));
  return {
    pronostico: pron,
    metodo,
    mape: { estacional: mapeEst, movil: mapeMov },
    factorTendencia: redondear(factor(n), 3),
    alternativo: [0, 1, 2].map((h) => Math.round(metodo === 'estacional' ? movil(n) : estacional(n, h))),
  };
}

function pronostico(db) {
  const meses = mesesCompletos(24);
  const horizonte = mesesSiguientes(3);
  const rows = db.prepare(`SELECT substr(fecha,1,7) mes, familia, count(*) n FROM eventos
    WHERE tipo IN ('consulta','busqueda') AND familia IS NOT NULL AND fecha >= ? GROUP BY mes, familia`).all(`${meses[0]}-01`);
  const colores = Object.fromEntries(db.prepare("SELECT nombre, color FROM categorias WHERE tipo='familia'").all().map((c) => [c.nombre, c.color]));
  const familias = Object.keys(colores);

  // Mes en curso: valor real a la fecha y proyección lineal a mes completo.
  const hoy = new Date();
  const diasMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)).getUTCDate();
  const diaActual = Math.max(1, hoy.getUTCDate() - 1); // datos completos hasta ayer

  const series = familias.map((f) => {
    const y = meses.map((m) => rows.find((r) => r.mes === m && r.familia === f)?.n || 0);
    const r = pronosticarSerie(y);
    const actual = rows.find((x) => x.mes === horizonte[0] && x.familia === f)?.n || 0;
    const ultimo = y[y.length - 1];
    return {
      familia: f, color: colores[f], historico: y, ...r,
      mesEnCurso: { real: actual, proyectado: Math.round((actual / diaActual) * diasMes) },
      cambio: r.pronostico.map((v) => (ultimo ? Math.round(((v - ultimo) / ultimo) * 100) : null)),
      // Últimos 3 meses vs los mismos 3 meses del año anterior (elimina el efecto de la temporada).
      interanual: suma(y.slice(9, 12)) ? Math.round(((suma(y.slice(21)) - suma(y.slice(9, 12))) / suma(y.slice(9, 12))) * 100) : null,
    };
  });

  // Conclusiones en lenguaje natural para el mes más lejano del horizonte.
  const ultimoMes = nombreMes(meses[meses.length - 1]);
  const h = 2;
  const ordenadas = [...series].sort((a, b) => (b.cambio[h] ?? 0) - (a.cambio[h] ?? 0));
  const conclusiones = [
    ...ordenadas.slice(0, 2).filter((s) => s.cambio[h] > 0),
    ...ordenadas.slice(-2).filter((s) => s.cambio[h] < 0),
  ].map((s) => `En ${nombreMes(horizonte[h])} la búsqueda de ${s.familia} ${s.cambio[h] >= 0 ? 'subirá' : 'bajará'} un ${Math.abs(s.cambio[h])} % respecto a ${ultimoMes}.`);

  return { meses, horizonte, ultimoMes, series, conclusiones, dia: diaActual, diasMes };
}

// ---------------------------------------------------------------------------
// Inventario: demanda diaria, stock de seguridad, punto de reorden y pedido sugerido
// ---------------------------------------------------------------------------
function inventario(db, pron = pronostico(db)) {
  const perfumes = db.prepare('SELECT * FROM perfumes ORDER BY nombre').all();
  const desde30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const diarias = db.prepare(`SELECT perfume_id, substr(fecha,1,10) dia, sum(cantidad) u FROM ventas
    WHERE fecha >= ? GROUP BY perfume_id, dia`).all(desde30);
  // Ajuste por pronóstico: cuánto cambiará la demanda de la familia el próximo mes vs el último mes real.
  const ajuste = Object.fromEntries(pron.series.map((s) => {
    const ultimo = s.historico[s.historico.length - 1];
    const f = ultimo ? s.pronostico[1] / ultimo : 1;
    return [s.familia, Math.min(2, Math.max(0.5, f))];
  }));

  return perfumes.map((p) => {
    const dias = Array(30).fill(0);
    diarias.filter((d) => d.perfume_id === p.id).forEach((d) => {
      const idx = Math.floor((new Date(`${d.dia}T00:00:00Z`) - new Date(`${desde30}T00:00:00Z`)) / 864e5);
      if (idx >= 0 && idx < 30) dias[idx] += d.u;
    });
    const media = suma(dias) / 30;
    const desv = Math.sqrt(suma(dias.map((x) => (x - media) ** 2)) / 29);
    const factor = ajuste[p.familia] ?? 1;
    const demanda = media * factor;
    const L = p.tiempo_entrega;
    const seguridad = Z_SERVICIO * desv * Math.sqrt(L);
    const reorden = Math.ceil(demanda * L + seguridad);
    const cobertura = demanda > 0 ? Math.floor(p.existencias / demanda) : null;
    const estado = p.existencias <= 0 ? 'Agotado' : p.existencias <= reorden ? 'Reordenar' : 'OK';
    const pedido = estado === 'OK' ? 0 : Math.max(reorden + 1 - p.existencias, Math.ceil(demanda * DIAS_COBERTURA + seguridad - p.existencias));
    return {
      id: p.id, nombre: p.nombre, marca: p.marca, familia: p.familia, color: p.color, imagen: p.imagen, estado_publicacion: p.estado,
      existencias: p.existencias, tiempo_entrega: L, ventas30: suma(dias),
      demanda_diaria: redondear(media, 2), factor_pronostico: redondear(factor, 2), demanda_ajustada: redondear(demanda, 2),
      stock_seguridad: Math.ceil(seguridad), punto_reorden: reorden, cobertura_dias: cobertura, estado, pedido_sugerido: pedido,
    };
  });
}

// Análisis ABC por ingresos de los últimos 12 meses (Pareto 80/15/5).
function abc(db) {
  const desde = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT p.id, p.nombre, p.marca, p.familia, p.color,
      coalesce(sum(v.cantidad),0) unidades, coalesce(sum(v.cantidad*v.precio_unitario),0) ingresos
    FROM perfumes p LEFT JOIN ventas v ON v.perfume_id=p.id AND v.fecha >= ?
    GROUP BY p.id ORDER BY ingresos DESC`).all(desde);
  const total = suma(rows.map((r) => r.ingresos)) || 1;
  let acum = 0;
  return {
    total,
    items: rows.map((r) => {
      const antes = acum;
      acum += r.ingresos;
      const clase = antes / total < 0.8 ? 'A' : antes / total < 0.95 ? 'B' : 'C';
      return { ...r, porcentaje: redondear((r.ingresos / total) * 100), acumulado: redondear((acum / total) * 100), clase };
    }),
  };
}

// ---------------------------------------------------------------------------
// Simulador de precio: impacto en los clientes con perfil guardado
// ---------------------------------------------------------------------------
function simularPrecio(db, perfumeId, nuevoPrecio) {
  const p = db.prepare('SELECT * FROM perfumes WHERE id=?').get(perfumeId);
  if (!p) return null;
  const publicados = db.prepare("SELECT * FROM perfumes WHERE estado='Publicado'").all();
  const prefs = db.prepare(`SELECT pr.* FROM preferencias pr JOIN usuarios u ON u.id=pr.usuario_id WHERE u.rol='cliente'`).all();
  const conPrecio = (precio) => ({ ...p, precio });

  const evaluarEscenario = (precio) => {
    const catalogo = publicados.map((x) => (x.id === p.id ? conPrecio(precio) : x));
    if (!catalogo.some((x) => x.id === p.id)) catalogo.push(conPrecio(precio));
    let enPresupuesto = 0, afines = 0, top3 = 0;
    const porCliente = {};
    for (const pref of prefs) {
      const puntajes = catalogo.map((x) => ({ id: x.id, precio: x.precio, pct: motor.coincidenciaPerfil(x, pref)?.porcentaje ?? 0 }))
        .sort((a, b) => b.pct - a.pct || a.precio - b.precio);
      const pos = puntajes.findIndex((x) => x.id === p.id) + 1;
      const pct = puntajes.find((x) => x.id === p.id).pct;
      const dentro = pref.presupuesto ? motor.enPresupuesto(precio, pref.presupuesto) : false;
      if (dentro) enPresupuesto++;
      if (pct >= 70) afines++;
      if (pos <= 3 && pct > 0) top3++;
      porCliente[pref.usuario_id] = { top3: pos <= 3 && pct > 0 };
    }
    return { enPresupuesto, afines, top3, porCliente };
  };

  const antes = evaluarEscenario(p.precio);
  const despues = evaluarEscenario(nuevoPrecio);
  const ganados = Object.keys(despues.porCliente).filter((id) => despues.porCliente[id].top3 && !antes.porCliente[id].top3).length;
  const perdidos = Object.keys(despues.porCliente).filter((id) => !despues.porCliente[id].top3 && antes.porCliente[id].top3).length;

  // Ingresos estimados con las unidades de los últimos 90 días.
  const desde90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const unidades = db.prepare('SELECT coalesce(sum(cantidad),0) u FROM ventas WHERE perfume_id=? AND fecha >= ?').get(p.id, desde90).u;
  // Supuesto: la demanda es proporcional al número de clientes que tienen el perfume en su top 3.
  const unidadesAjustadas = antes.top3 ? Math.round(unidades * (despues.top3 / antes.top3)) : unidades;
  const sin = (o) => ({ enPresupuesto: o.enPresupuesto, afines: o.afines, top3: o.top3 });

  return {
    perfume: { id: p.id, nombre: p.nombre, marca: p.marca, precio: p.precio, color: p.color, imagen: p.imagen, familia: p.familia },
    nuevoPrecio,
    clientesConPerfil: prefs.length,
    rangoAntes: motor.PRESUPUESTOS[motor.presupuestoDePrecio(p.precio)].etiqueta,
    rangoDespues: motor.PRESUPUESTOS[motor.presupuestoDePrecio(nuevoPrecio)].etiqueta,
    antes: sin(antes), despues: sin(despues), ganados, perdidos,
    ingresos: {
      unidades90: unidades,
      mismasUnidades: { antes: unidades * p.precio, despues: unidades * nuevoPrecio },
      ajustado: { unidades: unidadesAjustadas, antes: unidades * p.precio, despues: unidadesAjustadas * nuevoPrecio },
    },
  };
}

// ---------------------------------------------------------------------------
// Alertas por excepción
// ---------------------------------------------------------------------------
function alertasAdmin(db) {
  const pron = pronostico(db);
  const inv = inventario(db, pron).filter((i) => i.estado_publicacion === 'Publicado');
  const alertas = [];
  const lista = (arr) => arr.map((i) => i.nombre).join(', ');

  const agotados = inv.filter((i) => i.estado === 'Agotado');
  if (agotados.length) {
    alertas.push({ id: 'stock-agotado', nivel: 'alta', categoria: 'Inventario', titulo: `${agotados.length} perfume${agotados.length > 1 ? 's' : ''} agotado${agotados.length > 1 ? 's' : ''}`,
      detalle: `${lista(agotados)}. Pide ya: ${agotados.map((i) => `${i.pedido_sugerido} u. de ${i.nombre}`).join(', ')}.`, href: '#/inventario' });
  }
  const reordenar = inv.filter((i) => i.estado === 'Reordenar');
  if (reordenar.length) {
    alertas.push({ id: 'stock-reorden', nivel: 'media', categoria: 'Inventario', titulo: `${reordenar.length} perfume${reordenar.length > 1 ? 's' : ''} en punto de reorden`,
      detalle: reordenar.map((i) => `${i.nombre} (${i.existencias} u., reorden en ${i.punto_reorden})`).join(' · '), href: '#/inventario' });
  }

  // Caídas reales de demanda (interanual, sin efecto de temporada) y alzas pronosticadas.
  for (const s of pron.series) {
    if (s.interanual != null && s.interanual <= -15) {
      alertas.push({ id: `demanda-baja-${s.familia}`, nivel: 'media', categoria: 'Demanda',
        titulo: `La consulta de ${s.familia} cayó ${Math.abs(s.interanual)} % este trimestre`,
        detalle: 'Comparado con el mismo trimestre del año pasado, así que no se debe a la temporada. Considera promociones, reubicar la exhibición o reducir compras.', href: '#/pronostico' });
    }
    const sube = s.cambio[1];
    if (sube != null && sube >= 20) {
      const bajos = inv.filter((i) => i.familia === s.familia && i.estado !== 'OK');
      alertas.push({ id: `demanda-alza-${s.familia}`, nivel: bajos.length ? 'media' : 'info', categoria: 'Pronóstico',
        titulo: `Se espera que la búsqueda de ${s.familia} suba ${sube} % en ${nombreMes(pron.horizonte[1])} respecto a ${pron.ultimoMes}`,
        detalle: bajos.length ? `Revisa inventario: ${lista(bajos)} ya está${bajos.length > 1 ? 'n' : ''} bajo el punto de reorden.` : 'El inventario de la familia está en nivel adecuado.',
        href: '#/pronostico' });
    }
  }

  // Brecha oferta-demanda: muchos clientes con un perfil y pocas opciones en su presupuesto.
  const prefs = db.prepare(`SELECT familia, presupuesto, count(*) n FROM preferencias pr JOIN usuarios u ON u.id=pr.usuario_id
    WHERE u.rol='cliente' AND familia IS NOT NULL AND presupuesto IS NOT NULL GROUP BY familia, presupuesto`).all();
  const publicados = db.prepare("SELECT familia, precio FROM perfumes WHERE estado='Publicado'").all();
  const brechas = prefs.map((r) => ({ ...r, oferta: publicados.filter((p) => p.familia === r.familia && motor.enPresupuesto(p.precio, r.presupuesto)).length }))
    .filter((r) => r.n >= 3 && r.oferta <= 1).sort((a, b) => b.n - a.n).slice(0, 3);
  for (const b of brechas) {
    alertas.push({ id: `brecha-${b.familia}-${b.presupuesto}`, nivel: 'info', categoria: 'Oportunidad',
      titulo: `Hay ${b.n} clientes con perfil ${b.familia} y presupuesto ${motor.PRESUPUESTOS[b.presupuesto].etiqueta.toLowerCase()}, y ${b.oferta === 0 ? 'ningún perfume' : 'solo 1 perfume'} que les quede`,
      detalle: 'Oportunidad de surtido: agregar opciones de esa familia en ese rango de precio.', href: '#/perfumes' });
  }

  const orden = { alta: 0, media: 1, info: 2 };
  return alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

function alertasCliente(db, usuarioId) {
  const favs = db.prepare(`SELECT p.id, p.nombre, p.precio, p.existencias, f.precio_guardado FROM favoritos f
    JOIN perfumes p ON p.id=f.perfume_id WHERE f.usuario_id=? AND p.estado='Publicado'`).all(usuarioId);
  const alertas = [];
  for (const f of favs) {
    if (f.precio_guardado && f.precio < f.precio_guardado) {
      const pct = Math.round(((f.precio_guardado - f.precio) / f.precio_guardado) * 100);
      alertas.push({ id: `precio-${f.id}`, nivel: 'alta', categoria: 'Precio', perfume_id: f.id, descartable: true,
        titulo: `Bajó de precio ${f.nombre}`,
        detalle: `Uno de tus favoritos pasó de $${f.precio_guardado.toLocaleString('es-MX')} a $${f.precio.toLocaleString('es-MX')} (−${pct} %).`,
        href: `#/perfume/${f.id}` });
    }
    if (f.existencias <= 0) {
      alertas.push({ id: `agotado-${f.id}`, nivel: 'info', categoria: 'Disponibilidad', perfume_id: f.id,
        titulo: `${f.nombre} está agotado`, detalle: 'Pregunta a un asesor en tienda por la fecha de resurtido.', href: `#/perfume/${f.id}` });
    }
  }
  return alertas;
}

module.exports = { pronostico, inventario, abc, simularPrecio, alertasAdmin, alertasCliente, nombreMes };
