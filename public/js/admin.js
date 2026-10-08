// Vistas del administrador.
'use strict';

let adminDias = 30;

// Gráfica de líneas SVG sencilla.
function lineChart(labels, series, { h = 220 } = {}) {
  const W = 560, H = h, L = 36, R = 10, T = 12, B = 26;
  const max = Math.max(10, ...series.flatMap((s) => s.valores));
  const nice = Math.ceil(max / 3 / 10) * 10 * 3;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, labels.length - 1);
  const y = (v) => T + (H - T - B) * (1 - v / nice);
  const grid = [0, 1, 2, 3].map((k) => {
    const v = (nice / 3) * k;
    return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#EEE6DD"/><text x="${L - 8}" y="${y(v) + 3}" text-anchor="end" font-size="9.5" fill="#8A7E86">${Math.round(v)}</text>`;
  }).join('');
  const xl = labels.map((l, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="9.5" fill="#8A7E86">${esc(l)}</text>`).join('');
  const paths = series.map((s) => {
    const pts = s.valores.map((v, i) => [x(i), y(v)]);
    // Curva suavizada (Catmull-Rom a Bézier).
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    const dots = pts.map(([px, py], i) => `<circle cx="${px}" cy="${py}" r="7" fill="transparent"><title>${esc(s.nombre)} · ${esc(labels[i])}: ${s.valores[i]}</title></circle>`).join('');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linecap="round"/>${dots}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de tendencia">${grid}${xl}${paths}</svg>`;
}

const mesCorto = (ym) => { const m = Number(ym.slice(5, 7)); return MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1); };
const deltaTxt = (v, suf = '%') => (v == null ? '<span class="muted">sin periodo previo</span>'
  : `<span class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : ''}${v}${suf}</span> <span class="muted">vs periodo anterior</span>`);

// ---------- dashboard ----------
async function viewDashboard() {
  const view = renderLayout(`
    <div class="page-head">
      <div><div class="row"><h1>Dashboard administrativo</h1><span class="chip amber">Datos de ejemplo</span></div>
        <p>Estadísticas de uso y tendencias de preferencias para decisiones comerciales.</p></div>
      <div class="row">
        <select class="input" id="d-dias" style="width:auto">
          <option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option><option value="365">Últimos 12 meses</option></select>
        <button class="btn btn-primary" id="d-exp">${icon('download')}Exportar reporte</button>
      </div>
    </div>
    <div id="d-body">${loading()}</div>`);
  $('#d-dias').value = String(adminDias);
  $('#d-dias').onchange = (e) => { adminDias = Number(e.target.value); viewDashboard(); };
  $('#d-exp').onclick = async () => {
    try {
      const res = await api(`/admin/reporte.csv?dias=${adminDias}`, { raw: true });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `reporte_aromamatch_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Reporte descargado');
    } catch (e) { toast(e.message, true); }
  };

  const d = await api(`/admin/dashboard?dias=${adminDias}`);
  const k = d.kpis;
  const maxFam = Math.max(1, ...d.familias.map((f) => f.n));
  const maxOc = Math.max(1, ...d.ocasiones.map((o) => o.porcentaje));
  const n = (v) => Number(v).toLocaleString('es-MX');
  $('#d-body').innerHTML = `
    <div id="d-alertas"></div>
    <div class="kpis">
      <div class="card kpi"><span class="small">Consultas al catálogo</span><div class="v">${n(k.consultas.valor)}</div><div class="d">${deltaTxt(k.consultas.delta)}</div></div>
      <div class="card kpi"><span class="small">Recomendaciones generadas</span><div class="v">${n(k.recomendaciones.valor)}</div><div class="d">${deltaTxt(k.recomendaciones.delta)}</div></div>
      <div class="card kpi"><span class="small">Clientes con perfil</span><div class="v">${n(k.clientes.valor)}</div><div class="d">${deltaTxt(k.clientes.delta)}</div></div>
      <div class="card kpi"><span class="small">Aceptación de recomendaciones</span><div class="v">${k.aceptacion.valor}%</div><div class="d">${deltaTxt(k.aceptacion.puntos, ' pts')}</div></div>
    </div>
    <div class="dash">
      <div class="card card-pad">
        <h2>Consultas por familia olfativa</h2><p class="muted small" style="margin:3px 0 18px">Haz clic en una familia para ver su detalle</p>
        ${d.familias.map((f) => `<div class="hbar" data-fam="${esc(f.familia)}"><div class="row"><b>${esc(f.familia)}</b><span class="muted">${n(f.n)} consultas</span></div>
          <div class="meter"><i style="width:${(f.n / maxFam) * 100}%"></i></div></div>`).join('') || '<p class="muted">Sin datos en el periodo.</p>'}
      </div>
      <div class="card card-pad chart">
        <div class="row between wrap" style="align-items:flex-start"><div><h2>Tendencia de búsquedas por temporada</h2><p class="muted small" style="margin-top:3px">Búsquedas mensuales, últimos 12 meses (el mes actual está en curso)</p></div>
          <div class="legend"><span><i style="background:#4A1F3F"></i>Otoño / Invierno</span><span><i style="background:#D19A2E"></i>Primavera / Verano</span></div></div>
        <div style="margin-top:14px">${lineChart(d.tendencia.map((t) => mesCorto(t.mes)), [
          { nombre: 'Otoño / Invierno', color: '#4A1F3F', valores: d.tendencia.map((t) => t.frio) },
          { nombre: 'Primavera / Verano', color: '#D19A2E', valores: d.tendencia.map((t) => t.calido) },
        ])}</div>
      </div>
      <div class="card card-pad">
        <h2 style="margin-bottom:18px">Ocasiones más buscadas</h2>
        ${d.ocasiones.map((o) => `<div class="oc-row"><span>${esc(o.ocasion)}</span><div class="meter"><i style="width:${(o.porcentaje / maxOc) * 100}%"></i></div><b>${o.porcentaje}%</b></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-pad" style="padding-bottom:12px"><h2 id="top-title">Top perfumes recomendados · Todas las familias</h2></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>Perfume</th><th>Familia</th><th>Recomend.</th><th>Favoritos</th><th>Tendencia</th></tr></thead>
          <tbody id="top-rows"></tbody></table></div>
      </div>
    </div>`;

  const pintarTop = (fam) => {
    const rows = d.top.filter((t) => !fam || t.familia === fam);
    $('#top-title').innerHTML = `Top perfumes recomendados · ${esc(fam || 'Todas las familias')}${fam ? ' <button class="btn-ghost btn btn-sm" id="top-all">Ver todas</button>' : ''}`;
    $('#top-rows').innerHTML = rows.map((t, i) => `<tr><td class="muted">${i + 1}</td>
      <td><div class="row"><span class="dot" style="background:${esc(t.color)}"></span><b>${esc(t.nombre)}</b></div></td>
      <td class="muted">${esc(t.familia)}</td><td>${t.recomendaciones}</td><td>${t.favoritos}</td>
      <td>${t.tendencia == null ? '<span class="muted">—</span>' : `<span class="${t.tendencia >= 0 ? 'pos' : 'neg'}">${t.tendencia >= 0 ? '+' : ''}${t.tendencia}%</span>`}</td></tr>`).join('')
      || '<tr><td colspan="6" class="muted">Sin perfumes en esta familia.</td></tr>';
    if ($('#top-all')) $('#top-all').onclick = () => pintarTop(null);
  };
  pintarTop(null);
  // Alertas por excepción: lo que requiere una decisión aparece primero.
  cargarAlertas().then((al) => {
    const cont = $('#d-alertas');
    if (!cont || !al.length) return;
    cont.innerHTML = `<div class="card card-pad" style="margin-bottom:18px">
      <div class="card-head"><h2>${icon('bell')} Alertas que requieren decisión</h2>
        ${al.length > 4 ? `<button class="btn-ghost btn btn-sm" id="d-al-todas">Ver las ${al.length}</button>` : ''}</div>
      <div class="alertas-grid">${al.slice(0, 4).map(alertaHtml).join('')}</div></div>`;
    if ($('#d-al-todas')) $('#d-al-todas').onclick = () => modalAlertas();
  });
  $$('[data-fam]', view).forEach((b) => (b.onclick = () => {
    pintarTop(b.dataset.fam);
    $$('[data-fam] .meter i', view).forEach((i) => (i.style.background = ''));
    $('.meter i', b).style.background = 'var(--plum)';
  }));
}

// ---------- gestión de perfumes ----------
let adminPerfSel = null;

async function viewAdminPerfumes() {
  const cats = await categorias(true);
  const view = renderLayout(`
    <div class="page-head">
      <div><h1>Gestión de perfumes</h1><p>Alta, edición y baja de productos del catálogo.</p></div>
      <button class="btn btn-primary" id="ap-new">${icon('plus')}Nuevo perfume</button>
    </div>
    <div class="admin-perf">
      <div class="card">
        <div class="row wrap" style="padding:14px">
          <input class="input" id="ap-q" placeholder="Buscar perfume o marca" style="flex:1;min-width:160px">
          <select class="input" id="ap-fam" style="width:auto"><option value="">Todas las familias</option>${cats.familia.map((c) => `<option>${esc(c.nombre)}</option>`).join('')}</select>
          <select class="input" id="ap-est" style="width:auto"><option value="">Todos los estados</option><option>Publicado</option><option>Borrador</option></select>
        </div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Perfume</th><th>Familia</th><th>Temporada</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="ap-rows"></tbody></table></div>
        <div class="row between" style="padding:12px 14px;border-top:1px solid var(--line)"><span class="muted small" id="ap-count"></span>
          <div class="row"><button class="btn btn-outline btn-sm" id="ap-prev">Anterior</button><button class="btn btn-outline btn-sm" id="ap-next">Siguiente</button></div></div>
      </div>
      <div class="card card-pad editor" id="ap-editor"></div>
    </div>`);

  let rows = [];
  let page = 0;
  const PER = 8;
  const filtrados = () => {
    const t = $('#ap-q').value.trim().toLowerCase();
    const f = $('#ap-fam').value;
    const e = $('#ap-est').value;
    return rows.filter((p) => (!t || `${p.nombre} ${p.marca}`.toLowerCase().includes(t)) && (!f || p.familia === f) && (!e || p.estado === e));
  };
  const temporadaTxt = (p) => {
    const t = lista(p.temporadas);
    if (t.length === 4) return 'Todo el año';
    return t.map((x) => (t.length > 1 && x === 'Primavera' ? 'Prim.' : x)).join('/');
  };
  function pintar() {
    const f = filtrados();
    const pages = Math.max(1, Math.ceil(f.length / PER));
    page = Math.min(page, pages - 1);
    const vis = f.slice(page * PER, page * PER + PER);
    $('#ap-rows').innerHTML = vis.map((p) => `<tr class="${adminPerfSel === p.id ? 'sel' : ''}">
      <td><div class="row"><div class="thumb-cell" style="width:34px;height:42px;border-radius:7px;background:${tint(p.color)};display:grid;place-items:center;flex:none">${perfumeVisual(p, 18)}</div>
        <div><b>${esc(p.nombre)}</b><div class="muted small">${esc(p.marca)} · ${ABREV[p.concentracion] || ''} ${p.ml} ml</div></div></div></td>
      <td>${esc(p.familia)}</td><td class="muted">${esc(temporadaTxt(p))}</td><td><b>${money(p.precio)}</b></td>
      <td><span class="chip ${p.estado === 'Publicado' ? 'green' : 'amber'}">${p.estado}</span></td>
      <td><div class="row" style="gap:4px"><button class="icon-btn plain" data-edit="${p.id}" title="Editar">${icon('edit')}</button>
        <button class="icon-btn plain danger" data-del="${p.id}" title="Eliminar">${icon('trash')}</button></div></td></tr>`).join('')
      || '<tr><td colspan="6" class="muted">Sin resultados.</td></tr>';
    $('#ap-count').textContent = `Mostrando ${vis.length} de ${f.length} perfumes`;
    $('#ap-prev').disabled = page === 0;
    $('#ap-next').disabled = page >= pages - 1;
    $$('[data-edit]').forEach((b) => (b.onclick = () => editar(rows.find((r) => r.id === Number(b.dataset.edit)))));
    $$('[data-del]').forEach((b) => (b.onclick = () => eliminar(rows.find((r) => r.id === Number(b.dataset.del)))));
  }
  async function cargar() { rows = await api('/perfumes?todos=1'); pintar(); }

  async function eliminar(p) {
    if (!(await confirmar('Eliminar perfume', `¿Eliminar "${p.nombre}" del catálogo? También se quitará de favoritos de los clientes.`, { ok: 'Eliminar', peligro: true }))) return;
    try {
      await api(`/admin/perfumes/${p.id}`, { method: 'DELETE' });
      toast('Perfume eliminado');
      if (adminPerfSel === p.id) editar(null);
      cargar();
    } catch (e) { toast(e.message, true); }
  }

  function editar(p) {
    adminPerfSel = p?.id ?? null;
    const v = p || { concentracion: 'Eau de Parfum', intensidad: 'Moderada', publico: 'Unisex', ml: 100, color: '#8B4A2B', estado: 'Borrador' };
    let imagen = v.imagen || null;
    const opt = (ops, val) => ops.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('');
    const checks = (name, ops, vals) => ops.map((o) => `<label class="check"><input type="checkbox" name="${name}" value="${esc(o)}" ${lista(vals).includes(o) ? 'checked' : ''}>${esc(o)}</label>`).join('');
    $('#ap-editor').innerHTML = `
      <div class="eyebrow" style="color:var(--amber);font-weight:600">${p ? 'Editando' : 'Nuevo perfume'}</div>
      <h2 style="margin:2px 0 16px">${esc(p ? p.nombre : 'Sin nombre')}</h2>
      <form id="ap-form">
        <label class="upload" id="ap-up">
          <span id="ap-prev-img">${imagen ? `<img src="${esc(imagen)}" alt="">` : bottleSvg(v.color, 26)}</span>
          <span><b style="color:var(--plum)">Subir imagen del producto</b><br><span class="muted small">PNG o JPG, máximo 2 MB</span></span>
          <input type="file" accept="image/png,image/jpeg" class="sr-only" id="ap-file">
        </label>
        ${imagen ? '<button type="button" class="btn-ghost btn btn-sm" id="ap-rmimg" style="margin:-8px 0 10px">Quitar imagen</button>' : ''}
        <div class="grid2">
          <div class="field"><label>Nombre</label><input class="input" name="nombre" value="${esc(v.nombre || '')}" placeholder="Nombre del perfume" required></div>
          <div class="field"><label>Marca</label><input class="input" name="marca" value="${esc(v.marca || '')}" placeholder="Marca" required></div>
          <div class="field"><label>Familia olfativa</label><select class="input" name="familia" required>${opt(cats.familia.map((c) => c.nombre), v.familia)}</select></div>
          <div class="field"><label>Concentración</label><select class="input" name="concentracion">${opt(CONCENTRACIONES, v.concentracion)}</select></div>
          <div class="field"><label>Precio (MXN)</label><input class="input" name="precio" type="number" min="1" step="0.01" value="${esc(v.precio ?? '')}" placeholder="0.00" required></div>
          <div class="field"><label>Contenido (ml)</label><input class="input" name="ml" type="number" min="1" value="${esc(v.ml ?? '')}" required></div>
          <div class="field"><label>Intensidad</label><select class="input" name="intensidad">${opt(INTENSIDADES, v.intensidad)}</select></div>
          <div class="field"><label>Público</label><select class="input" name="publico">${opt(PUBLICOS, v.publico)}</select></div>
          <div class="field"><label>Año de lanzamiento</label><input class="input" name="anio" type="number" min="1700" max="2100" value="${esc(v.anio ?? '')}" placeholder="Ej. 2015"></div>
          <div class="field"><label>Subfamilia</label><input class="input" name="subfamilia" value="${esc(v.subfamilia || '')}" placeholder="Ej. Amaderado aromático"></div>
          <div class="field" style="grid-column:1/-1"><label>Perfumista</label><input class="input" name="perfumista" value="${esc(v.perfumista || '')}" placeholder="Ej. François Demachy"></div>
          <div class="field"><label>Duración</label><input class="input" name="duracion" value="${esc(v.duracion || '')}" placeholder="Ej. 6 – 8 horas"></div>
          <div class="field"><label>Proyección</label><select class="input" name="proyeccion">${opt(['Suave', 'Moderada', 'Moderada – alta', 'Alta'], v.proyeccion)}</select></div>
        </div>
        <div class="field"><label>Ocasiones</label><div class="checks-inline">${checks('ocasiones', cats.ocasion.map((c) => c.nombre), v.ocasiones)}</div></div>
        <div class="field"><label>Temporadas</label><div class="checks-inline">${checks('temporadas', cats.temporada.map((c) => c.nombre), v.temporadas)}</div></div>
        <div class="field"><label>Notas de salida</label><input class="input" name="notas_salida" value="${esc(v.notas_salida || '')}" placeholder="Ej. Bergamota, cardamomo"></div>
        <div class="field"><label>Notas de corazón</label><input class="input" name="notas_corazon" value="${esc(v.notas_corazon || '')}" placeholder="Ej. Ámbar, canela"></div>
        <div class="field"><label>Notas de fondo</label><input class="input" name="notas_fondo" value="${esc(v.notas_fondo || '')}" placeholder="Ej. Vainilla, pachulí"></div>
        <div class="field"><label>Descripción</label><textarea class="input" name="descripcion" placeholder="Descripción para el catálogo">${esc(v.descripcion || '')}</textarea></div>
        <div class="grid2">
          <div class="field"><label>Color del frasco</label><input class="input" type="color" name="color" value="${esc(v.color)}"></div>
          <div class="field"><label>Estado</label><select class="input" name="estado">${opt(['Publicado', 'Borrador'], v.estado)}</select></div>
        </div>
        <div class="row"><button class="btn btn-primary" style="flex:1">${p ? 'Guardar cambios' : 'Crear perfume'}</button><button type="button" class="btn btn-outline" id="ap-cancel">Cancelar</button></div>
      </form>`;
    pintar();
    $('#ap-file').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!/image\/(png|jpeg)/.test(file.type)) return toast('Solo PNG o JPG.', true);
      if (file.size > 2 * 1024 * 1024) return toast('La imagen supera 2 MB.', true);
      const r = new FileReader();
      r.onload = () => { imagen = r.result; $('#ap-prev-img').innerHTML = `<img src="${imagen}" alt="">`; };
      r.readAsDataURL(file);
    };
    if ($('#ap-rmimg')) $('#ap-rmimg').onclick = (e) => { imagen = null; e.target.remove(); $('#ap-prev-img').innerHTML = bottleSvg(v.color, 26); };
    $('#ap-cancel').onclick = () => editar(null);
    $('#ap-form').onsubmit = async (e) => {
      e.preventDefault();
      const body = formData(e.target);
      body.ocasiones = $$('input[name=ocasiones]:checked', e.target).map((i) => i.value);
      body.temporadas = $$('input[name=temporadas]:checked', e.target).map((i) => i.value);
      body.imagen = imagen;
      if (!body.ocasiones.length || !body.temporadas.length) return toast('Selecciona al menos una ocasión y una temporada.', true);
      await withBusy($('#ap-form .btn-primary'), async () => {
        const saved = await api(p ? `/admin/perfumes/${p.id}` : '/admin/perfumes', { method: p ? 'PUT' : 'POST', body });
        toast(p ? 'Cambios guardados' : 'Perfume creado');
        await cargar();
        editar(rows.find((r) => r.id === saved.id));
      });
    };
  }

  $('#ap-new').onclick = () => { editar(null); $('#ap-editor').scrollIntoView({ behavior: 'smooth' }); $('#ap-form [name=nombre]').focus(); };
  $('#ap-q').oninput = () => { page = 0; pintar(); };
  $('#ap-fam').onchange = () => { page = 0; pintar(); };
  $('#ap-est').onchange = () => { page = 0; pintar(); };
  $('#ap-prev').onclick = () => { page--; pintar(); };
  $('#ap-next').onclick = () => { page++; pintar(); };
  await cargar();
  editar(rows.find((r) => r.id === adminPerfSel) || rows[0] || null);
}

// ---------- categorías ----------
async function viewCategorias() {
  const cats = await categorias(true);
  const TIPOS = { familia: ['Familias olfativas', 'Familia olfativa'], ocasion: ['Ocasiones', 'Ocasión'], temporada: ['Temporadas', 'Temporada'] };
  const view = renderLayout(`
    <div class="page-head"><div><h1>Gestión de categorías</h1><p>Familias olfativas, ocasiones y temporadas que alimentan los filtros y el motor de recomendación.</p></div></div>
    <div class="cats">${Object.entries(TIPOS).map(([tipo, [titulo]]) => `
      <div class="card">
        <div class="card-head card-pad" style="margin:0;padding-bottom:14px"><div><h2>${titulo}</h2><span class="muted small">${cats[tipo].length} categorías</span></div>
          <button class="icon-btn" data-new="${tipo}" title="Nueva">${icon('plus')}</button></div>
        ${cats[tipo].map((c) => `<div class="cat-item"><span class="dot" style="background:${esc(c.color)}"></span>
          <div class="n"><b>${esc(c.nombre)}</b><span class="muted small">${esc(c.descripcion || '')}</span></div>
          <span class="count">${c.perfumes} perfume${c.perfumes === 1 ? '' : 's'}</span>
          <button class="icon-btn plain" data-edit="${c.id}" title="Editar">${icon('edit')}</button></div>`).join('')}
      </div>`).join('')}</div>
    <div class="card card-pad">
      <h2 style="margin-bottom:14px">Nueva categoría</h2>
      <form class="newcat" id="nc">
        <div class="field"><label>Tipo</label><select class="input" name="tipo">${Object.entries(TIPOS).map(([k, [, s]]) => `<option value="${k}">${s}</option>`).join('')}</select></div>
        <div class="field"><label>Nombre</label><input class="input" name="nombre" placeholder="Ej. Chipre" required></div>
        <div class="field"><label>Descripción</label><input class="input" name="descripcion" placeholder="Descripción breve para clientes y asesores"></div>
        <div class="field"><label>Color</label><input class="input" type="color" name="color" value="#4A1F3F"></div>
        <button class="btn btn-primary" style="height:42px">Guardar categoría</button>
      </form>
    </div>`);
  $('#nc').onsubmit = async (e) => {
    e.preventDefault();
    await withBusy($('#nc button'), async () => {
      await api('/admin/categorias', { method: 'POST', body: formData(e.target) });
      toast('Categoría creada'); viewCategorias();
    });
  };
  $$('[data-new]', view).forEach((b) => (b.onclick = () => {
    $('#nc [name=tipo]').value = b.dataset.new;
    $('#nc [name=nombre]').focus();
    $('#nc').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  const all = [...cats.familia, ...cats.ocasion, ...cats.temporada];
  $$('[data-edit]', view).forEach((b) => (b.onclick = () => {
    const c = all.find((x) => x.id === Number(b.dataset.edit));
    modal(`<div class="modal-head"><h2>Editar ${esc(TIPOS[c.tipo][1].toLowerCase())}</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
      <form id="ec">
        <div class="field"><label>Nombre</label><input class="input" name="nombre" value="${esc(c.nombre)}" required></div>
        <div class="field"><label>Descripción</label><input class="input" name="descripcion" value="${esc(c.descripcion || '')}"></div>
        <div class="field"><label>Color</label><input class="input" type="color" name="color" value="${esc(c.color)}"></div>
        <p class="muted small">Si cambias el nombre, se actualizarán los ${c.perfumes} perfume(s) que la usan.</p>
        <div class="modal-foot" style="justify-content:space-between">
          <button type="button" class="btn btn-danger" id="ec-del">Eliminar</button>
          <div class="row"><button type="button" class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary">Guardar</button></div></div>
      </form>`, {
      onMount: (m, close) => {
        $('#ec', m).onsubmit = async (e) => {
          e.preventDefault();
          await withBusy($('#ec .btn-primary', m), async () => {
            await api(`/admin/categorias/${c.id}`, { method: 'PUT', body: formData(e.target) });
            toast('Categoría actualizada'); close(); viewCategorias();
          });
        };
        $('#ec-del', m).onclick = async () => {
          try { await api(`/admin/categorias/${c.id}`, { method: 'DELETE' }); toast('Categoría eliminada'); close(); viewCategorias(); } catch (err) { toast(err.message, true); }
        };
      },
    });
  }));
}

// ---------- tendencias ----------
async function viewTendencias() {
  const view = renderLayout(`<div class="page-head"><div><h1>Tendencias</h1><p>Evolución del interés por familia olfativa y patrones de búsqueda para planear compras y campañas.</p></div></div><div id="t-body">${loading()}</div>`);
  const d = await api('/admin/tendencias');
  const pct = (rows, key) => { const t = rows.reduce((a, r) => a + r.n, 0) || 1; return rows.map((r) => ({ ...r, p: Math.round((r.n / t) * 100), k: r[key] })); };
  const inten = pct(d.intensidad, 'intensidad').sort((a, b) => INTENSIDADES.indexOf(a.k) - INTENSIDADES.indexOf(b.k));
  const pres = pct(d.presupuesto, 'rango').sort((a, b) => Object.values(PRESUPUESTOS).indexOf(a.k) - Object.values(PRESUPUESTOS).indexOf(b.k));
  const sube = d.crecimiento.filter((c) => (c.cambio ?? 0) > 0);
  $('#t-body', view).innerHTML = `
    <div class="card card-pad chart" style="margin-bottom:18px">
      <div class="row between wrap" style="align-items:flex-start"><div><h2>Interés por familia olfativa</h2><p class="muted small" style="margin-top:3px">Consultas y búsquedas mensuales, últimos 12 meses (el mes actual está en curso)</p></div>
        <div class="legend">${d.series.map((s) => `<span><i style="background:${esc(s.color)}"></i>${esc(s.familia)}</span>`).join('')}</div></div>
      <div style="margin-top:14px">${lineChart(d.meses.map(mesCorto), d.series.map((s) => ({ nombre: s.familia, color: s.color, valores: s.valores })), { h: 250 })}</div>
    </div>
    <div class="dash" style="grid-template-columns:1.2fr 1fr 1fr">
      <div class="card">
        <div class="card-pad" style="padding-bottom:12px"><h2>Crecimiento trimestral</h2><p class="muted small" style="margin-top:3px">Últimos 3 meses completos vs los 3 anteriores</p></div>
        <table class="t"><thead><tr><th>Familia</th><th>Reciente</th><th>Anterior</th><th>Cambio</th></tr></thead><tbody>
          ${d.crecimiento.map((c) => `<tr><td><div class="row"><span class="dot" style="background:${esc(c.color)}"></span><b>${esc(c.familia)}</b></div></td><td>${c.reciente}</td><td class="muted">${c.anterior}</td>
            <td>${c.cambio == null ? '—' : `<span class="${c.cambio >= 0 ? 'pos' : 'neg'}">${c.cambio >= 0 ? '+' : ''}${c.cambio}%</span>`}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <div class="card card-pad"><h2 style="margin-bottom:16px">Intensidad preferida</h2><p class="muted small" style="margin:-10px 0 16px">Últimos 3 meses</p>
        ${inten.map((r) => `<div class="oc-row" style="grid-template-columns:80px 1fr 40px"><span>${esc(r.k)}</span><div class="meter"><i style="width:${r.p}%;background:var(--plum)"></i></div><b>${r.p}%</b></div>`).join('')}</div>
      <div class="card card-pad"><h2 style="margin-bottom:16px">Rango de precio</h2><p class="muted small" style="margin:-10px 0 16px">Últimos 3 meses</p>
        ${pres.map((r) => `<div class="oc-row" style="grid-template-columns:110px 1fr 40px"><span>${esc(r.k)}</span><div class="meter"><i style="width:${r.p}%"></i></div><b>${r.p}%</b></div>`).join('')}</div>
    </div>
    <div class="card card-pad" style="margin-top:18px">
      <h2 style="margin-bottom:8px">Lectura para decisiones comerciales</h2>
      <ul style="margin:0;padding-left:18px;line-height:1.8;color:#3E343A">
        ${sube.length ? `<li>Familias en crecimiento: <b>${sube.map((c) => esc(c.familia)).join(', ')}</b>. Conviene asegurar inventario y exhibición.</li>` : '<li>Ninguna familia creció en el último trimestre; considerar campañas de activación.</li>'}
        ${d.crecimiento.length ? `<li>Mayor caída: <b>${esc(d.crecimiento[d.crecimiento.length - 1].familia)}</b> (${d.crecimiento[d.crecimiento.length - 1].cambio ?? 0}%). Evaluar promociones o rotación.</li>` : ''}
        ${inten.length ? `<li>La intensidad más consultada es <b>${esc(inten.reduce((a, b) => (b.p > a.p ? b : a)).k.toLowerCase())}</b>.</li>` : ''}
        ${pres.length ? `<li>El rango de precio con más interés es <b>${esc(pres.reduce((a, b) => (b.p > a.p ? b : a)).k)}</b>.</li>` : ''}
      </ul>
    </div>`;
}
