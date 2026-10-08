// Vistas de análisis del DSS para el administrador: pronóstico, inventario/ABC y simulador de precios.
'use strict';

const fmtN = (v) => Number(v ?? 0).toLocaleString('es-MX');
const pctTxt = (v) => (v == null ? '—' : `<span class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : ''}${v} %</span>`);

// Gráfica de histórico + pronóstico (línea punteada) + método alternativo (línea tenue).
function pronosticoChart(labels, historico, pron, alt, color) {
  const W = 620, H = 250, L = 40, R = 12, T = 14, B = 28;
  const n = labels.length;
  const todos = [...historico, ...pron, ...alt];
  const max = Math.max(10, ...todos) * 1.1;
  const x = (i) => L + (i * (W - L - R)) / (n - 1);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const path = (pts) => pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const h = historico.length;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = max * f;
    return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#EEE6DD"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end" font-size="9.5" fill="#8A7E86">${Math.round(v)}</text>`;
  }).join('');
  // En la zona de pronóstico solo el mes (sin año) para que no se encimen.
  const xl = labels.map((l, i) => (i % 2 === 0 || i >= h ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${i >= h ? color : '#8A7E86'}" font-weight="${i >= h ? 700 : 400}">${esc(i >= h ? l.split(' ')[0] : l)}</text>` : '')).join('');
  const zona = `<rect x="${x(h - 0.5)}" y="${T}" width="${x(n - 1) - x(h - 0.5) + 6}" height="${H - T - B}" fill="${color}" opacity=".06"/>
    <text x="${x(h - 0.5) + 4}" y="${T + 11}" font-size="9.5" fill="${color}" font-weight="700">Pronóstico</text>`;
  const puntos = (arr, off) => arr.map((v, i) => `<circle cx="${x(i + off)}" cy="${y(v)}" r="7" fill="transparent"><title>${esc(labels[i + off])}: ${fmtN(v)}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Histórico y pronóstico">
    ${grid}${zona}${xl}
    <path d="${path(historico.map((v, i) => [i, v]))}" fill="none" stroke="${color}" stroke-width="2.2"/>
    <path d="${path([[h - 1, historico[h - 1]], ...alt.map((v, i) => [h + i, v])])}" fill="none" stroke="#A89BA3" stroke-width="1.6" stroke-dasharray="2 4"/>
    <path d="${path([[h - 1, historico[h - 1]], ...pron.map((v, i) => [h + i, v])])}" fill="none" stroke="${color}" stroke-width="2.4" stroke-dasharray="6 4"/>
    ${pron.map((v, i) => `<circle cx="${x(h + i)}" cy="${y(v)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"/>`).join('')}
    ${puntos(historico, 0)}${puntos(pron, h)}
  </svg>`;
}

// ---------- pronóstico ----------
let pronFamilia = 'Total';

async function viewPronostico() {
  const view = renderLayout(`<div class="page-head"><div><h1>Pronóstico de demanda</h1>
    <p>Interés esperado (consultas + búsquedas) por familia olfativa para los próximos 3 meses, a partir de 24 meses de historia.</p></div></div>
    <div id="pr-body">${loading()}</div>`);
  const d = await api('/admin/pronostico');
  const nm = (m) => MESES_L[Number(m.slice(5, 7)) - 1];
  const corto = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
  const sumar = (arrs) => arrs[0].map((_, i) => arrs.reduce((a, s) => a + s[i], 0));
  const total = {
    familia: 'Total', color: '#4A1F3F',
    historico: sumar(d.series.map((s) => s.historico)),
    pronostico: sumar(d.series.map((s) => s.pronostico)),
    alternativo: sumar(d.series.map((s) => s.alternativo)),
  };
  const serie = () => (pronFamilia === 'Total' ? total : d.series.find((s) => s.familia === pronFamilia));
  const metodoTxt = { estacional: 'Estacional con tendencia', movil: 'Media móvil (3 meses)' };

  $('#pr-body', view).innerHTML = `
    <div class="card card-pad" style="margin-bottom:18px">
      <h2 style="margin-bottom:10px">Lo que viene</h2>
      <ul style="margin:0;padding-left:18px;line-height:1.9">${d.conclusiones.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    </div>
    <div class="card card-pad chart" style="margin-bottom:18px">
      <div class="row between wrap" style="align-items:flex-start">
        <div><h2 id="pr-titulo"></h2><p class="muted small" id="pr-sub" style="margin-top:3px"></p></div>
        <div class="legend"><span><i id="pr-lh"></i>Real</span><span><i id="pr-lp" style="height:0;border-top:2px dashed"></i>Pronóstico (método elegido)</span><span><i style="height:0;border-top:2px dotted #A89BA3"></i>Método alternativo</span></div>
      </div>
      <div class="fam-tabs" style="margin:14px 0 6px">${['Total', ...d.series.map((s) => s.familia)].map((f) => `<button class="pill ${f === pronFamilia ? 'active' : ''}" data-pf="${esc(f)}">${esc(f)}</button>`).join('')}</div>
      <div id="pr-chart"></div>
    </div>
    <div class="card" style="margin-bottom:18px">
      <div class="card-pad" style="padding-bottom:12px"><h2>Pronóstico por familia</h2>
        <p class="muted small" style="margin-top:3px">Cambio respecto a ${esc(d.ultimoMes)} (último mes completo). El mes en curso lleva ${d.dia} de ${d.diasMes} días.</p></div>
      <div class="table-wrap"><table class="t"><thead><tr>
        <th>Familia</th><th>${esc(nm(d.meses[23]))} (real)</th><th>${esc(nm(d.horizonte[0]))} a la fecha</th>
        ${d.horizonte.map((m) => `<th>${esc(nm(m))}</th>`).join('')}<th>Interanual</th><th>Método · error (MAPE)</th></tr></thead>
        <tbody>${d.series.map((s) => `<tr class="click" data-pf="${esc(s.familia)}">
          <td><div class="row"><span class="dot" style="background:${esc(s.color)}"></span><b>${esc(s.familia)}</b></div></td>
          <td>${fmtN(s.historico[23])}</td>
          <td class="muted">${fmtN(s.mesEnCurso.real)} <span class="small">(proy. ${fmtN(s.mesEnCurso.proyectado)})</span></td>
          ${s.pronostico.map((v, i) => `<td><b>${fmtN(v)}</b> <span class="small">${pctTxt(s.cambio[i])}</span></td>`).join('')}
          <td>${pctTxt(s.interanual)}</td>
          <td class="small">${metodoTxt[s.metodo]} · ${s.mape[s.metodo]} %<br><span class="muted">alternativo: ${s.mape[s.metodo === 'estacional' ? 'movil' : 'estacional']} %</span></td></tr>`).join('')}
        </tbody></table></div>
    </div>
    <div class="card card-pad">
      <h2 style="margin-bottom:10px">¿Cómo se calcula?</h2>
      <div class="formula">
        Estacional con tendencia:  pronóstico(mes) = real(mismo mes del año anterior) × factor<br>
        factor = suma(últimos 3 meses) ÷ suma(mismos 3 meses del año anterior)<br>
        Media móvil (3):  pronóstico = promedio(últimos 3 meses)<br>
        MAPE = promedio(|real − pronóstico| ÷ real) en una prueba con los últimos 3 meses reales
      </div>
      <p class="muted small" style="margin-top:10px;line-height:1.6">Para cada familia el sistema prueba ambos métodos sobre los 3 meses más recientes (que ya conoce) y usa el de menor error. Como la demanda de perfumes depende mucho de la temporada, normalmente gana el método estacional. El pronóstico también ajusta la demanda diaria en <a href="#/inventario">Inventario</a>.</p>
    </div>`;

  const pintar = () => {
    const s = serie();
    const labels = [...d.meses, ...d.horizonte].map(corto);
    $('#pr-chart').innerHTML = pronosticoChart(labels, s.historico, s.pronostico, s.alternativo, s.color);
    $('#pr-titulo').textContent = pronFamilia === 'Total' ? 'Interés total' : `Interés en ${pronFamilia}`;
    $('#pr-sub').textContent = s.metodo
      ? `Método elegido: ${metodoTxt[s.metodo]} (error ${s.mape[s.metodo]} %). Factor de tendencia ×${s.factorTendencia}.`
      : 'Suma de los pronósticos de todas las familias.';
    $('#pr-lh').style.background = s.color;
    $('#pr-lp').style.borderColor = s.color;
    $$('.fam-tabs [data-pf]').forEach((b) => b.classList.toggle('active', b.dataset.pf === pronFamilia));
  };
  $$('[data-pf]', view).forEach((b) => (b.onclick = () => { pronFamilia = b.dataset.pf; pintar(); $('#pr-chart').scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
  pintar();
}

// ---------- inventario + ABC ----------
function paretoChart(items) {
  const W = 620, H = 230, L = 40, R = 36, T = 12, B = 22;
  const n = items.length;
  const max = Math.max(1, ...items.map((i) => i.ingresos));
  const bw = (W - L - R) / n;
  const colores = { A: '#4A1F3F', B: '#A0839A', C: '#D9CCD4' };
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const yp = (p) => T + (H - T - B) * (1 - p / 100);
  const barras = items.map((it, i) => `<rect x="${L + i * bw + 2}" y="${y(it.ingresos)}" width="${bw - 4}" height="${H - B - y(it.ingresos)}" rx="2" fill="${colores[it.clase]}">
    <title>${esc(it.nombre)} · clase ${it.clase} · $${fmtN(Math.round(it.ingresos))} (${it.porcentaje} %)</title></rect>`).join('');
  const linea = items.map((it, i) => `${i ? 'L' : 'M'}${(L + i * bw + bw / 2).toFixed(1)},${yp(it.acumulado).toFixed(1)}`).join(' ');
  const refs = [80, 95].map((p) => `<line x1="${L}" x2="${W - R}" y1="${yp(p)}" y2="${yp(p)}" stroke="#C9AFC1" stroke-dasharray="3 3"/><text x="${W - R + 4}" y="${yp(p) + 3}" font-size="9.5" fill="#8A7E86">${p} %</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagrama de Pareto">
    <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#E7DED5"/>
    <text x="${L - 6}" y="${y(max) + 3}" text-anchor="end" font-size="9.5" fill="#8A7E86">$${fmtN(Math.round(max / 1000))}k</text>
    ${barras}${refs}<path d="${linea}" fill="none" stroke="#A0561F" stroke-width="2"/>
    ${items.map((it, i) => `<circle cx="${L + i * bw + bw / 2}" cy="${yp(it.acumulado)}" r="2.5" fill="#A0561F"/>`).join('')}
  </svg>`;
}

let invFiltro = '';

async function viewInventario() {
  const view = renderLayout(`<div class="page-head"><div><h1>Inventario y reorden</h1>
    <p>Existencias, punto de reorden con stock de seguridad y pedido sugerido, ajustados con el pronóstico de demanda.</p></div>
    <select class="input" id="inv-f" style="width:auto"><option value="">Todos los estados</option><option>Agotado</option><option>Reordenar</option><option>OK</option></select></div>
    <div id="inv-body">${loading()}</div>`);
  $('#inv-f').value = invFiltro;
  const { inventario: inv, abc } = await api('/admin/inventario');
  const precios = Object.fromEntries((await api('/perfumes?todos=1')).map((p) => [p.id, p.precio]));
  const valor = inv.reduce((a, i) => a + i.existencias * (precios[i.id] || 0), 0);
  const cuenta = (e) => inv.filter((i) => i.estado === e).length;
  const estadoChip = { Agotado: 'red', Reordenar: 'amber', OK: 'green' };
  const claseCount = (c) => abc.items.filter((i) => i.clase === c);
  const pctIngresos = (c) => Math.round(claseCount(c).reduce((a, i) => a + i.porcentaje, 0));

  $('#inv-body', view).innerHTML = `
    <div class="kv-grid" style="margin-bottom:18px">
      <div class="kv-box"><span>Agotados</span><b style="color:var(--red)">${cuenta('Agotado')}</b></div>
      <div class="kv-box"><span>En punto de reorden</span><b style="color:var(--amber)">${cuenta('Reordenar')}</b></div>
      <div class="kv-box"><span>Unidades en inventario</span><b>${fmtN(inv.reduce((a, i) => a + i.existencias, 0))}</b></div>
      <div class="kv-box"><span>Valor del inventario (precio de venta)</span><b>$${fmtN(Math.round(valor))}</b></div>
      <div class="kv-box"><span>Unidades vendidas (30 días)</span><b>${fmtN(inv.reduce((a, i) => a + i.ventas30, 0))}</b></div>
    </div>
    <div class="card" style="margin-bottom:18px">
      <div class="table-wrap"><table class="t"><thead><tr>
        <th>Perfume</th><th>Existencias</th><th>Entrega (días)</th><th title="Promedio de los últimos 30 días × ajuste del pronóstico">Demanda/día</th>
        <th>Stock seg.</th><th>Punto de reorden</th><th>Cobertura</th><th>Estado</th><th>Pedido sugerido</th><th></th></tr></thead>
        <tbody id="inv-rows"></tbody></table></div>
    </div>
    <div class="card card-pad" style="margin-bottom:18px">
      <h2 style="margin-bottom:10px">¿Cómo se calcula?</h2>
      <div class="formula">
        Demanda diaria = ventas de los últimos 30 días ÷ 30 × ajuste del pronóstico (próximo mes ÷ último mes de la familia)<br>
        Stock de seguridad = 1.65 × desviación estándar diaria × √(días de entrega)   ← nivel de servicio del 95 %<br>
        Punto de reorden = demanda diaria × días de entrega + stock de seguridad<br>
        Pedido sugerido = lo necesario para cubrir ${30} días de demanda + stock de seguridad − existencias
      </div>
    </div>
    <div class="card card-pad chart">
      <div class="row between wrap" style="align-items:flex-start">
        <div><h2>Análisis ABC (Pareto)</h2><p class="muted small" style="margin-top:3px">Ingresos por perfume en los últimos 12 meses: $${fmtN(Math.round(abc.total))}</p></div>
        <div class="legend"><span><i style="background:#4A1F3F;height:10px;width:10px"></i>A</span><span><i style="background:#A0839A;height:10px;width:10px"></i>B</span><span><i style="background:#D9CCD4;height:10px;width:10px"></i>C</span><span><i style="background:#A0561F"></i>% acumulado</span></div>
      </div>
      <div class="kv-grid" style="margin:14px 0">
        ${['A', 'B', 'C'].map((c) => `<div class="kv-box"><span>Clase ${c} · ${{ A: 'prioridad alta', B: 'prioridad media', C: 'prioridad baja' }[c]}</span>
          <b>${claseCount(c).length} perfumes</b><div class="d muted">${pctIngresos(c)} % de los ingresos</div></div>`).join('')}
      </div>
      ${paretoChart(abc.items)}
      <p class="muted small" style="margin:10px 0 14px;line-height:1.6">Clase A: el primer 80 % de los ingresos, nunca debe agotarse y conviene revisarla cada semana. Clase B: el siguiente 15 %, revisión quincenal. Clase C: el último 5 %, candidatos a pedidos pequeños o a salir del catálogo.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>Perfume</th><th>Unidades</th><th>Ingresos</th><th>% del total</th><th>% acumulado</th><th>Clase</th></tr></thead>
        <tbody>${abc.items.map((it, i) => `<tr><td class="muted">${i + 1}</td><td><div class="row"><span class="dot" style="background:${esc(it.color)}"></span><b>${esc(it.nombre)}</b> <span class="muted small">${esc(it.marca)}</span></div></td>
          <td>${fmtN(it.unidades)}</td><td>$${fmtN(Math.round(it.ingresos))}</td><td>${it.porcentaje} %</td><td>${it.acumulado} %</td>
          <td><span class="chip ${{ A: 'plum', B: 'amber', C: '' }[it.clase]}">${it.clase}</span></td></tr>`).join('')}</tbody></table></div>
    </div>`;

  const pintar = () => {
    const prioridad = { Agotado: 0, Reordenar: 1, OK: 2 };
    const rows = inv.filter((i) => !invFiltro || i.estado === invFiltro)
      .sort((a, b) => prioridad[a.estado] - prioridad[b.estado] || a.nombre.localeCompare(b.nombre, 'es'));
    $('#inv-rows').innerHTML = rows.map((i) => `<tr data-id="${i.id}" class="${i.estado !== 'OK' ? 'sel' : ''}">
      <td><div class="row"><div class="thumb-cell" style="width:30px;height:38px;border-radius:6px;background:${tint(i.color)};flex:none">${perfumeVisual(i, 16)}</div>
        <div><b>${esc(i.nombre)}</b><div class="muted small">${esc(i.familia)}${i.estado_publicacion === 'Borrador' ? ' · borrador' : ''}</div></div></div></td>
      <td><input class="input inv-input" type="number" min="0" value="${i.existencias}" data-f="existencias"></td>
      <td><input class="input inv-input" type="number" min="1" max="120" value="${i.tiempo_entrega}" data-f="tiempo_entrega"></td>
      <td title="Promedio 30 días: ${i.demanda_diaria} × ajuste ${i.factor_pronostico}">${i.demanda_ajustada} <span class="muted small">(×${i.factor_pronostico})</span></td>
      <td>${i.stock_seguridad}</td><td><b>${i.punto_reorden}</b></td>
      <td>${i.cobertura_dias == null ? '<span class="muted">sin ventas</span>' : `${fmtN(i.cobertura_dias)} días`}</td>
      <td><span class="chip ${estadoChip[i.estado]}">${i.estado}</span></td>
      <td>${i.pedido_sugerido ? `<b>${i.pedido_sugerido} u.</b>` : '<span class="muted">—</span>'}</td>
      <td><div class="row" style="gap:4px;flex-wrap:nowrap">
        <button class="btn btn-outline btn-sm" data-guardar title="Guardar existencias y días de entrega">Guardar</button>
        <button class="btn ${i.pedido_sugerido ? 'btn-primary' : 'btn-outline'} btn-sm" data-entrada="${i.pedido_sugerido || ''}">+ Entrada</button></div></td></tr>`).join('')
      || '<tr><td colspan="10" class="muted">Sin perfumes en este estado.</td></tr>';

    $$('#inv-rows [data-guardar]').forEach((b) => (b.onclick = async () => {
      const tr = b.closest('tr');
      const body = Object.fromEntries($$('[data-f]', tr).map((x) => [x.dataset.f, Number(x.value)]));
      await withBusy(b, async () => { await api(`/admin/inventario/${tr.dataset.id}`, { method: 'PUT', body }); toast('Inventario actualizado'); viewInventario(); });
    }));
    $$('#inv-rows [data-entrada]').forEach((b) => (b.onclick = () => {
      const tr = b.closest('tr');
      const item = inv.find((x) => x.id === Number(tr.dataset.id));
      modal(`<div class="modal-head"><h2>Registrar entrada</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
        <form id="ent"><p class="muted" style="margin-bottom:14px"><b style="color:var(--text)">${esc(item.nombre)}</b> · existencias actuales: ${item.existencias} · punto de reorden: ${item.punto_reorden}</p>
          <div class="field"><label>Unidades recibidas</label><input class="input" name="cantidad" type="number" min="1" value="${b.dataset.entrada || 10}" required></div>
          ${item.pedido_sugerido ? `<p class="muted small">El sistema sugiere ${item.pedido_sugerido} unidades para cubrir ${30} días de demanda más el stock de seguridad.</p>` : ''}
          <div class="modal-foot"><button type="button" class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary">Registrar</button></div></form>`, {
        onMount: (m, close) => {
          $('#ent', m).onsubmit = async (e) => {
            e.preventDefault();
            await withBusy($('#ent .btn-primary', m), async () => {
              await api(`/admin/inventario/${item.id}/entrada`, { method: 'POST', body: { cantidad: Number(e.target.cantidad.value) } });
              toast('Entrada registrada'); close(); viewInventario();
            });
          };
        },
      });
    }));
  };
  $('#inv-f').onchange = (e) => { invFiltro = e.target.value; pintar(); };
  pintar();
}

// ---------- simulador de precios ----------
let simPerfumeId = null;

async function viewSimulador() {
  const view = renderLayout(`<div class="page-head"><div><h1>Simulador de precios</h1>
    <p>¿Qué pasaría si cambias el precio de un perfume? Mide el impacto en los clientes con perfil guardado antes de decidir.</p></div></div>
    <div class="sim-grid">
      <div class="card card-pad">
        <div class="field"><label>Perfume</label><select class="input" id="s-perf"></select></div>
        <div id="s-actual" class="muted small" style="margin:-4px 0 14px"></div>
        <div class="field"><label>Nuevo precio (MXN)</label><input class="input" id="s-precio" type="number" min="1" step="10"></div>
        <input type="range" id="s-rango" step="10">
        <div class="row between muted small" style="margin-top:2px"><span>−40 %</span><span id="s-var"></span><span>+40 %</span></div>
        <button class="btn btn-primary btn-block" id="s-aplicar" style="margin-top:18px" disabled>Aplicar nuevo precio</button>
        <p class="muted small" style="margin-top:8px;line-height:1.5">Al aplicar, los clientes que tengan el perfume en favoritos recibirán una alerta si el precio baja.</p>
      </div>
      <div id="s-res">${loading()}</div>
    </div>`);
  const perfumes = (await api('/perfumes?orden=nombre'));
  if (!simPerfumeId || !perfumes.some((p) => p.id === simPerfumeId)) simPerfumeId = perfumes.find((p) => p.nombre === 'Sauvage')?.id ?? perfumes[0]?.id;
  $('#s-perf').innerHTML = perfumes.map((p) => `<option value="${p.id}" ${p.id === simPerfumeId ? 'selected' : ''}>${esc(p.nombre)} · ${esc(p.marca)}</option>`).join('');

  let actual;
  let seq = 0;
  const flecha = (a, b, invertir = false, prefijo = '') => {
    const dif = b - a;
    if (!dif) return '<span class="muted">sin cambio</span>';
    const bueno = invertir ? dif < 0 : dif > 0;
    return `<span class="${bueno ? 'pos' : 'neg'}">${dif > 0 ? '+' : '−'}${prefijo}${fmtN(Math.abs(dif))}</span>`;
  };
  const caja = (titulo, a, b, sufijo = '') => `<div class="kv-box"><span>${titulo}</span>
    <b>${fmtN(a)}${sufijo}<span class="cmp-arrow">→</span>${fmtN(b)}${sufijo}</b><div class="d">${flecha(a, b)}</div></div>`;

  async function simular() {
    const precio = Number($('#s-precio').value);
    if (!(precio > 0)) return;
    $('#s-var').textContent = `${precio >= actual.precio ? '+' : ''}${Math.round(((precio - actual.precio) / actual.precio) * 100)} %`;
    $('#s-aplicar').disabled = precio === actual.precio;
    const mio = ++seq;
    let r;
    try { r = await api('/admin/simular', { method: 'POST', body: { perfume_id: actual.id, precio } }); } catch (e) { return toast(e.message, true); }
    if (mio !== seq) return;
    const ing = r.ingresos;
    $('#s-res').innerHTML = `
      <div class="card card-pad" style="margin-bottom:18px">
        <div class="row" style="gap:14px"><div class="thumb-cell" style="width:56px;height:70px;border-radius:10px;background:${tint(r.perfume.color)};flex:none">${perfumeVisual(r.perfume, 30)}</div>
          <div><h2>${esc(r.perfume.nombre)}</h2><p class="muted">${money(r.perfume.precio)} → <b style="color:var(--text)">${money(r.nuevoPrecio)}</b> ·
            rango ${esc(r.rangoAntes)}${r.rangoAntes !== r.rangoDespues ? ` → <b style="color:var(--plum)">${esc(r.rangoDespues)}</b>` : ''}</p></div></div>
      </div>
      <div class="card card-pad" style="margin-bottom:18px">
        <h3 style="margin-bottom:12px">Impacto en clientes <span class="muted small" style="font-weight:400">(${r.clientesConPerfil} clientes con perfil guardado)</span></h3>
        <div class="kv-grid">
          ${caja('Lo tienen dentro de su presupuesto', r.antes.enPresupuesto, r.despues.enPresupuesto)}
          ${caja('Coincidencia ≥ 70 % con su perfil', r.antes.afines, r.despues.afines)}
          ${caja('Lo tienen en su top 3 de recomendaciones', r.antes.top3, r.despues.top3)}
          <div class="kv-box"><span>Movimiento en el top 3</span><b><span class="pos">+${r.ganados}</span> / <span class="neg">−${r.perdidos}</span></b><div class="d muted">clientes que entran / salen</div></div>
        </div>
      </div>
      <div class="card card-pad">
        <h3 style="margin-bottom:12px">Ingresos estimados (siguientes 90 días)</h3>
        <div class="kv-grid">
          <div class="kv-box"><span>Si se venden las mismas ${ing.unidades90} unidades</span><b>$${fmtN(ing.mismasUnidades.despues)}</b>
            <div class="d">${flecha(ing.mismasUnidades.antes, ing.mismasUnidades.despues, false, '$')} vs $${fmtN(ing.mismasUnidades.antes)}</div></div>
          <div class="kv-box"><span>Ajustando la demanda (${ing.unidades90} → ${ing.ajustado.unidades} u.)</span><b>$${fmtN(ing.ajustado.despues)}</b>
            <div class="d">${flecha(ing.ajustado.antes, ing.ajustado.despues, false, '$')} vs $${fmtN(ing.ajustado.antes)}</div></div>
        </div>
        <p class="muted small" style="margin-top:12px;line-height:1.6"><b>Supuestos:</b> se toman las unidades vendidas en los últimos 90 días. En el escenario ajustado,
          la demanda cambia en la misma proporción que el número de clientes que tienen el perfume en su top 3 de recomendaciones.
          Es una estimación para comparar escenarios, no una predicción exacta.</p>
      </div>`;
  }

  const cargarPerfume = () => {
    actual = perfumes.find((p) => p.id === simPerfumeId);
    $('#s-actual').textContent = `Precio actual: ${money(actual.precio)} MXN · ${actual.familia}`;
    const rango = $('#s-rango');
    rango.min = Math.round(actual.precio * 0.6 / 10) * 10;
    rango.max = Math.round(actual.precio * 1.4 / 10) * 10;
    rango.value = actual.precio;
    $('#s-precio').value = actual.precio;
    simular();
  };
  let t;
  const programar = () => { clearTimeout(t); t = setTimeout(simular, 150); };
  $('#s-perf').onchange = (e) => { simPerfumeId = Number(e.target.value); cargarPerfume(); };
  $('#s-rango').oninput = (e) => { $('#s-precio').value = e.target.value; programar(); };
  $('#s-precio').oninput = (e) => { $('#s-rango').value = e.target.value; programar(); };
  $('#s-aplicar').onclick = async () => {
    const precio = Number($('#s-precio').value);
    if (!(await confirmar('Aplicar nuevo precio', `${actual.nombre} pasará de ${money(actual.precio)} a ${money(precio)} MXN en todo el sistema.`, { ok: 'Aplicar precio' }))) return;
    try {
      await api(`/admin/perfumes/${actual.id}/precio`, { method: 'POST', body: { precio } });
      toast('Precio actualizado');
      viewSimulador();
    } catch (e) { toast(e.message, true); }
  };
  cargarPerfume();
}
