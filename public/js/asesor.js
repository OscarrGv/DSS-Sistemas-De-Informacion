// Vistas del asesor de ventas.
'use strict';

// Barra que muestra/selecciona al cliente que se está atendiendo.
function clienteActivoBar() {
  if (state.user.rol !== 'asesor') return '';
  const ca = clienteActivo.get();
  return `<div class="active-client" style="margin:14px 0 4px">
    ${icon('user')}
    ${ca ? `<span>Atendiendo a <b>${esc(ca.nombre)}</b> — la coincidencia se calcula con su perfil.</span>
      <a href="#/atencion/${ca.id}" class="small" style="margin-left:auto">Ver ficha</a>
      <button class="btn-ghost btn btn-sm" data-ca-clear>Terminar atención</button>`
    : `<span>Sin cliente seleccionado.</span><a href="#/atencion" class="small" style="margin-left:auto">Seleccionar cliente →</a>`}
  </div>`;
}

function bindClienteActivoBar(root, refresh) {
  const b = $('[data-ca-clear]', root);
  if (b) b.onclick = () => { clienteActivo.set(null); toast('Atención finalizada'); refresh?.(); };
}

// ---------- atención a cliente ----------
async function viewAtencion(id) {
  const ca = clienteActivo.get();
  if (!id && ca) { location.hash = `#/atencion/${ca.id}`; return; }
  const view = renderLayout(`
    <div class="page-head">
      <div><h1>Atención a cliente</h1><p>Consulta el perfil, registra preferencias y recomienda en tienda.</p></div>
      <div class="search" style="position:relative;width:340px;max-width:100%">${icon('search')}
        <input class="input" id="a-q" placeholder="Buscar cliente por nombre, teléfono o correo" autocomplete="off" style="width:100%">
        <div class="card search-drop hidden" id="a-drop"></div></div>
    </div>
    <div id="a-body">${id ? loading() : ''}</div>`);

  // Buscador de clientes con resultados desplegables.
  let t;
  const drop = $('#a-drop');
  $('#a-q').oninput = (e) => {
    clearTimeout(t);
    const v = e.target.value.trim();
    if (!v) { drop.classList.add('hidden'); return; }
    t = setTimeout(async () => {
      const rows = await api(`/clientes?q=${encodeURIComponent(v)}`);
      drop.innerHTML = rows.length ? `<div class="client-list">${rows.slice(0, 8).map((c) => `
        <div class="cl" data-cl="${c.id}"><div class="avatar" style="width:30px;height:30px;font-size:11px">${esc(iniciales(c.nombre))}</div>
          <div><b>${esc(c.nombre)}</b><div class="muted small">${esc(c.correo)} · ${esc(c.telefono || 'sin teléfono')}</div></div></div>`).join('')}</div>`
        : '<p class="muted" style="padding:14px">No se encontraron clientes.</p>';
      drop.classList.remove('hidden');
      $$('[data-cl]', drop).forEach((c) => (c.onclick = () => { location.hash = `#/atencion/${c.dataset.cl}`; }));
    }, 200);
  };
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) drop.classList.add('hidden'); }, { once: true });

  if (!id) {
    const recientes = await api('/clientes?q=');
    $('#a-body').innerHTML = `<div class="card"><div class="card-pad" style="padding-bottom:10px"><h2>Clientes recientes</h2>
      <p class="muted small" style="margin-top:4px">Selecciona un cliente o búscalo por nombre, teléfono o correo.</p></div>
      <div class="client-list">${recientes.slice(0, 10).map((c) => `
        <div class="cl" data-cl="${c.id}"><div class="avatar" style="width:34px;height:34px">${esc(iniciales(c.nombre))}</div>
          <div style="flex:1"><b>${esc(c.nombre)}</b><div class="muted small">${esc(c.correo)}</div></div>
          <span class="muted small">Última actividad: ${fecha(c.ultima)}</span></div>`).join('')}</div></div>`;
    $$('[data-cl]', view).forEach((c) => (c.onclick = () => { location.hash = `#/atencion/${c.dataset.cl}`; }));
    return;
  }

  let d;
  try { d = await api(`/clientes/${id}`); } catch (e) { $('#a-body').innerHTML = `<div class="card empty"><h3>${esc(e.message)}</h3></div>`; return; }
  const c = d.cliente;
  clienteActivo.set(c);
  const pr = c.preferencias || {};
  const cats = await categorias();
  const sel = (name, ops, val) => `<select class="input" name="${name}"><option value="">—</option>${ops.map(([v, l]) => `<option value="${esc(v)}" ${val === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const prefChips = [
    pr.familia && `<span class="chip plum">${esc(pr.familia)}</span>`,
    ...lista(pr.ocasiones).map((o) => `<span class="chip amber">${esc(o)}</span>`),
    pr.temporada && `<span class="chip amber">${esc(pr.temporada)}</span>`,
    pr.intensidad && `<span class="chip">${esc(pr.intensidad)}</span>`,
    pr.presupuesto && `<span class="chip">${esc(PRESUPUESTOS[pr.presupuesto])}</span>`,
    pr.notas_evita && `<span class="chip red">Evita: ${esc(pr.notas_evita)}</span>`,
  ].filter(Boolean).join('');

  $('#a-body').innerHTML = `
    <div class="two">
      <div class="stack">
        <div class="card card-pad">
          <div class="row"><div class="avatar lg" style="width:48px;height:48px;font-size:18px">${esc(iniciales(c.nombre))}</div>
            <div><h2>${esc(c.nombre)}</h2><span class="muted small">${esc(c.correo)} · ${esc(c.telefono || 'sin teléfono')}</span></div></div>
          <div class="stats3">
            <div><b>${c.visitas}</b><span>Visitas</span></div>
            <div><b>${c.favoritos}</b><span>Favoritos</span></div>
            <div><b>${esc(fecha(c.creado).slice(3))}</b><span>Cliente desde</span></div>
          </div>
          <div class="label" style="margin-bottom:8px">Preferencias registradas</div>
          <div class="chips">${prefChips || '<span class="muted small">Sin preferencias registradas.</span>'}</div>
        </div>
        <div class="card card-pad">
          <h2 style="margin-bottom:14px">Registrar preferencia</h2>
          <form id="a-pref">
            <div class="grid2">
              <div class="field"><label>Familia olfativa</label>${sel('familia', cats.familia.map((x) => [x.nombre, x.nombre]), pr.familia)}</div>
              <div class="field"><label>Ocasión</label>${sel('ocasion', cats.ocasion.map((x) => [x.nombre, x.nombre]), lista(pr.ocasiones)[0])}</div>
              <div class="field"><label>Temporada</label>${sel('temporada', cats.temporada.map((x) => [x.nombre, x.nombre]), pr.temporada)}</div>
              <div class="field"><label>Presupuesto</label>${sel('presupuesto', Object.entries(PRESUPUESTOS), pr.presupuesto)}</div>
            </div>
            <div class="field"><label>Notas que evita</label><input class="input" name="notas_evita" value="${esc(pr.notas_evita || '')}" placeholder="Ej. Acuáticas, menta"></div>
            <div class="field"><label>Notas del asesor</label><textarea class="input" name="notas" placeholder="Ej. Busca un regalo para aniversario, prefiere aromas cálidos…"></textarea></div>
            <button class="btn btn-primary btn-block">Guardar preferencia</button>
          </form>
        </div>
      </div>
      <div class="stack">
        <div class="card card-pad">
          <div class="card-head"><h2>Recomendaciones sugeridas</h2><span class="muted small">Según el perfil de ${esc(c.nombre.split(' ')[0])}</span></div>
          ${d.recomendaciones.length ? d.recomendaciones.map((r) => `
            <div class="rec"><div class="th" style="background:${tint(r.perfume.color)}">${perfumeVisual(r.perfume, 24)}</div>
              <div><b><a href="#/perfume/${r.perfume.id}" style="color:inherit">${esc(r.perfume.nombre)}</a></b><div class="muted small">${esc(r.perfume.familia)} · ${esc(lista(r.perfume.ocasiones).join(', ').toLowerCase())} · ${money(r.perfume.precio)}</div></div>
              <span class="pct">${r.porcentaje}%</span>
              <button class="btn btn-outline btn-sm" data-rec="${r.perfume.id}">Recomendar</button></div>`).join('')
          : '<p class="muted">Registra al menos una preferencia para generar recomendaciones.</p>'}
          <a href="#/recomendar" class="small">Buscar más opciones con el buscador →</a>
        </div>
        <div class="card card-pad">
          <h2 style="margin-bottom:16px">Historial de atención</h2>
          <div class="timeline">${d.historial.map((h) => `
            <div class="ev"><div class="when">${fecha(h.fecha)} · ${esc(h.autor)}</div><b>${esc(h.tipo)}</b><p>${esc(h.detalle || '')}${h.resultado && h.resultado !== '—' ? ` <span class="muted">(${esc(h.resultado)})</span>` : ''}</p></div>`).join('')}</div>
        </div>
      </div>
    </div>`;

  $('#a-pref').onsubmit = async (e) => {
    e.preventDefault();
    await withBusy($('#a-pref button'), async () => {
      await api(`/clientes/${c.id}/preferencias`, { method: 'POST', body: formData(e.target) });
      toast('Preferencia registrada');
      viewAtencion(c.id);
    });
  };
  $$('[data-rec]').forEach((b) => (b.onclick = async () => {
    try {
      await api(`/clientes/${c.id}/recomendar`, { method: 'POST', body: { perfume_id: Number(b.dataset.rec) } });
      toast('Recomendación registrada'); viewAtencion(c.id);
    } catch (err) { toast(err.message, true); }
  }));
}

// ---------- historial de clientes ----------
async function viewClientes() {
  const view = renderLayout(`
    <div class="page-head">
      <div><h1>Historial de clientes</h1><p>Clientes registrados, su última actividad y sus preferencias.</p></div>
      <div class="search">${icon('search')}<input class="input" id="h-q" placeholder="Buscar cliente…"></div>
    </div>
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Cliente</th><th>Contacto</th><th>Familia</th><th>Presupuesto</th><th>Favoritos</th><th>Última actividad</th></tr></thead>
      <tbody id="h-rows"><tr><td colspan="6">${loading()}</td></tr></tbody></table></div></div>`);
  async function cargar(v = '') {
    const rows = await api(`/clientes?q=${encodeURIComponent(v)}`);
    $('#h-rows').innerHTML = rows.map((c) => `<tr class="click" data-cl="${c.id}">
      <td><div class="row"><div class="avatar" style="width:30px;height:30px;font-size:11px">${esc(iniciales(c.nombre))}</div><b>${esc(c.nombre)}</b></div></td>
      <td class="muted">${esc(c.correo)}<br>${esc(c.telefono || '')}</td>
      <td>${c.preferencias?.familia ? `<span class="chip plum">${esc(c.preferencias.familia)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${esc(PRESUPUESTOS[c.preferencias?.presupuesto] || '—')}</td>
      <td>${c.favoritos}</td><td class="muted">${fecha(c.ultima)}</td></tr>`).join('')
      || '<tr><td colspan="6" class="muted">Sin resultados.</td></tr>';
    $$('[data-cl]', view).forEach((r) => (r.onclick = () => { location.hash = `#/atencion/${r.dataset.cl}`; }));
  }
  let t;
  $('#h-q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => cargar(e.target.value.trim()), 250); };
  cargar();
}
