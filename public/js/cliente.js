// Vistas del cliente (catálogo, detalle y comparador también las usa el asesor).
'use strict';

const catalogoFiltros = { familia: 'Todas', q: '', orden: 'relevancia', min: '', max: '', ocasion: [], temporada: [], intensidad: '', publico: [] };

// ---------- catálogo ----------
async function viewCatalogo() {
  const cats = await categorias();
  const f = catalogoFiltros;
  const esAsesor = state.user.rol === 'asesor';
  const view = renderLayout(`
    <div class="catalog">
      <aside class="card filters">
        <div class="row between"><h3>Filtros</h3><button class="btn-ghost btn btn-sm" id="f-clear">Limpiar</button></div>
        <h4>Presupuesto (MXN)</h4>
        <div class="range">
          <div><label for="f-min">Mínimo</label><input class="input" id="f-min" type="number" min="0" placeholder="$0" value="${esc(f.min)}"></div>
          <div><label for="f-max">Máximo</label><input class="input" id="f-max" type="number" min="0" placeholder="$8,000" value="${esc(f.max)}"></div>
        </div>
        <h4>Ocasión</h4>${cats.ocasion.map((c) => `<label class="check"><input type="checkbox" name="ocasion" value="${esc(c.nombre)}" ${f.ocasion.includes(c.nombre) ? 'checked' : ''}>${esc(c.nombre)}</label>`).join('')}
        <h4>Temporada</h4>${cats.temporada.map((c) => `<label class="check"><input type="checkbox" name="temporada" value="${esc(c.nombre)}" ${f.temporada.includes(c.nombre) ? 'checked' : ''}>${esc(c.nombre)}</label>`).join('')}
        <h4>Intensidad</h4>${INTENSIDADES.map((i) => `<label class="check"><input type="radio" name="intensidad" value="${i}" ${f.intensidad === i ? 'checked' : ''}>${i}</label>`).join('')}
        <h4>Público</h4>${PUBLICOS.map((p) => `<label class="check"><input type="checkbox" name="publico" value="${p}" ${f.publico.includes(p) ? 'checked' : ''}>${p}</label>`).join('')}
        <button class="btn btn-primary btn-block" id="f-apply" style="margin-top:18px">Aplicar filtros</button>
      </aside>
      <section>
        <div class="page-head" style="margin-bottom:0">
          <div><h1>Catálogo de perfumes</h1><p id="cat-count">Cargando…</p></div>
          <div class="toolbar">
            <div class="search">${icon('search')}<input class="input" id="f-q" placeholder="Buscar por nombre, marca o nota…" value="${esc(f.q)}"></div>
            <select class="input" id="f-orden" style="width:auto">
              <option value="relevancia">Más relevantes</option>
              <option value="precio_asc">Precio: menor a mayor</option>
              <option value="precio_desc">Precio: mayor a menor</option>
              <option value="nombre">Nombre (A–Z)</option>
            </select>
          </div>
        </div>
        ${esAsesor ? clienteActivoBar() : ''}
        <div class="fam-tabs">${['Todas', ...cats.familia.map((c) => c.nombre)].map((n) => `<button class="pill ${f.familia === n ? 'active' : ''}" data-fam="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <div class="grid-cards" id="grid">${loading()}</div>
      </section>
    </div>`);
  $('#f-orden').value = f.orden;

  const leer = () => {
    f.min = $('#f-min').value; f.max = $('#f-max').value;
    f.ocasion = $$('input[name=ocasion]:checked').map((i) => i.value);
    f.temporada = $$('input[name=temporada]:checked').map((i) => i.value);
    f.intensidad = $('input[name=intensidad]:checked')?.value || '';
    f.publico = $$('input[name=publico]:checked').map((i) => i.value);
  };

  async function cargar() {
    const qs = new URLSearchParams();
    if (f.familia !== 'Todas') qs.set('familia', f.familia);
    if (f.q) qs.set('q', f.q);
    if (f.min) qs.set('min', f.min);
    if (f.max) qs.set('max', f.max);
    if (f.intensidad) qs.set('intensidad', f.intensidad);
    if (f.ocasion.length) qs.set('ocasion', f.ocasion.join(','));
    if (f.temporada.length) qs.set('temporada', f.temporada.join(','));
    if (f.publico.length) qs.set('publico', f.publico.join(','));
    if (f.orden !== 'relevancia') qs.set('orden', f.orden);
    try {
      const rows = await api(`/perfumes?${qs}`);
      $('#cat-count').textContent = `${rows.length} perfume${rows.length === 1 ? '' : 's'} · Explora por familia, ocasión, temporada y presupuesto.`;
      $('#grid').innerHTML = rows.length ? rows.map((p) => perfumeCard(p)).join('')
        : `<div class="empty card" style="grid-column:1/-1"><h3>Sin resultados</h3><p>Prueba quitando algunos filtros o usa el <a href="#/${esAsesor ? 'recomendar' : 'buscador'}">buscador inteligente</a>.</p></div>`;
      bindCardActions($('#grid'));
    } catch (e) { toast(e.message, true); }
  }

  $$('[data-fam]', view).forEach((b) => (b.onclick = () => {
    f.familia = b.dataset.fam;
    $$('[data-fam]', view).forEach((x) => x.classList.toggle('active', x === b));
    cargar();
  }));
  $('#f-apply').onclick = () => { leer(); cargar(); };
  $('#f-clear').onclick = () => { Object.assign(f, { min: '', max: '', ocasion: [], temporada: [], intensidad: '', publico: [], q: '' }); viewCatalogo(); };
  let t;
  $('#f-q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value.trim(); cargar(); }, 250); };
  $('#f-orden').onchange = (e) => { f.orden = e.target.value; cargar(); };
  bindClienteActivoBar(view, cargar);
  cargar();
}

// ---------- detalle ----------
async function viewPerfume(id) {
  const view = renderLayout(loading());
  const ca = state.user.rol === 'asesor' ? clienteActivo.get() : null;
  let data;
  try { data = await api(`/perfumes/${id}${ca ? `?cliente=${ca.id}` : ''}`); } catch (e) {
    view.innerHTML = `<div class="empty card"><h3>No encontramos este perfume</h3><p><a href="#/catalogo">Volver al catálogo</a></p></div>`;
    return;
  }
  const { perfume: p, match, similares } = data;
  let favorito = data.favorito;
  const esCliente = state.user.rol === 'cliente';
  const inCmp = () => comparador.ids().includes(p.id);
  const temporadas = lista(p.temporadas);

  view.innerHTML = `
    <div class="crumbs"><a href="#/catalogo">Catálogo</a> / <span>${esc(p.familia)}</span> / <b style="color:var(--text)">${esc(p.nombre)}</b></div>
    <div class="detail">
      <div class="gallery">
        <div class="big" style="background:${tint(p.color)}">${perfumeVisual(p, 120)}</div>
        ${p.imagen_credito ? `<p class="credit">${p.imagen_credito_url
          ? `<a href="${esc(p.imagen_credito_url)}" target="_blank" rel="noopener">${esc(p.imagen_credito)}</a>`
          : esc(p.imagen_credito)}</p>` : ''}
      </div>
      <div>
        <div class="chips"><span class="chip plum">${esc(p.familia)}${p.subfamilia ? ` · ${esc(p.subfamilia)}` : ''}</span>
          ${p.existencias > 0
            ? `<span class="chip green">Disponible en tienda${state.user.rol !== 'cliente' ? ` · ${p.existencias} u.` : p.existencias <= 3 ? ' · últimas piezas' : ''}</span>`
            : '<span class="chip red">Agotado · bajo pedido</span>'}</div>
        <div class="eyebrow" style="margin-top:14px">${esc(p.marca)}</div>
        <h1>${esc(p.nombre)}</h1>
        <div class="price-row"><span class="p">${money(p.precio)} MXN</span>
          <span class="muted small">${esc(p.concentracion)} · ${p.ml} ml · ${money2(p.precio / p.ml)} por ml</span></div>
        <p style="line-height:1.65;color:#3E343A">${esc(p.descripcion || '')}</p>
        ${p.anio || p.perfumista ? `<p class="muted small" style="margin-top:8px">${p.anio ? `Lanzamiento: <b>${p.anio}</b>` : ''}${p.anio && p.perfumista ? ' · ' : ''}${p.perfumista ? `Perfumista: <b>${esc(p.perfumista)}</b>` : ''}</p>` : ''}
        <div class="attrs">
          <div class="attr"><div class="eyebrow">Ocasión</div><b>${esc(lista(p.ocasiones).join(' · ') || '—')}</b></div>
          <div class="attr"><div class="eyebrow">Temporada</div><b>${esc(temporadas.length === 4 ? 'Todo el año' : temporadas.join(' · ') || '—')}</b></div>
          <div class="attr"><div class="eyebrow">Público</div><b>${esc(p.publico)}</b></div>
          <div class="attr"><div class="eyebrow">Intensidad</div><div class="meter"><i style="width:${nivelIntensidad(p.intensidad)}%"></i></div><b>${esc(p.intensidad)}</b></div>
          <div class="attr"><div class="eyebrow">Duración</div><div class="meter"><i style="width:${nivelDuracion(p.duracion)}%"></i></div><b>${esc(p.duracion || '—')}</b></div>
          <div class="attr"><div class="eyebrow">Proyección</div><div class="meter"><i style="width:${nivelProyeccion(p.proyeccion)}%"></i></div><b>${esc(p.proyeccion || '—')}</b></div>
        </div>
        <div class="row wrap">
          ${esCliente ? `<button class="btn btn-primary" id="d-fav">${icon('heart')}<span>${favorito ? 'En tus favoritos' : 'Guardar en favoritos'}</span></button>` : ''}
          ${state.user.rol === 'asesor' && ca ? `<button class="btn btn-primary" id="d-rec">${icon('spark')}Recomendar a ${esc(ca.nombre.split(' ')[0])}</button>` : ''}
          ${state.user.rol === 'asesor' ? `<button class="btn btn-outline" id="d-venta" ${p.existencias > 0 ? '' : 'disabled'}>${icon('check')}Registrar venta</button>` : ''}
          <button class="btn btn-outline" id="d-cmp">${icon('scale')}<span>${inCmp() ? 'Quitar del comparador' : 'Agregar al comparador'}</span></button>
          ${esCliente ? `<button class="btn btn-outline" id="d-asesor">Consultar con un asesor</button>` : ''}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1.9fr 1fr;gap:18px;margin-top:28px" class="det-bottom">
      <div class="card card-pad">
        <h2 style="margin-bottom:14px">Pirámide olfativa</h2>
        <div class="pyramid">
          <div><div class="eyebrow">Notas de salida</div><b>${esc(p.notas_salida || '—')}</b><span class="muted small">Primeros 15 minutos</span></div>
          <div><div class="eyebrow">Notas de corazón</div><b>${esc(p.notas_corazon || '—')}</b><span class="muted small">De 30 min a 4 horas</span></div>
          <div><div class="eyebrow">Notas de fondo</div><b>${esc(p.notas_fondo || '—')}</b><span class="muted small">Estela final</span></div>
        </div>
      </div>
      <div class="match-card">
        ${match ? `
          <div class="row between"><h3 style="color:#fff">Coincidencia con ${ca ? esc(ca.nombre.split(' ')[0]) : 'tu perfil'}</h3><span class="big">${match.porcentaje}%</span></div>
          <ul>${match.razones.map((r) => `<li>✓ ${esc(r)}</li>`).join('') || '<li>Pocas coincidencias con tus preferencias.</li>'}</ul>
          <a href="#" id="d-how">Ver cómo se calcula →</a>`
        : `<h3 style="color:#fff">Coincidencia con ${ca ? 'el cliente' : 'tu perfil'}</h3>
          <p style="margin:10px 0 14px;color:#EADCE4;font-size:13px">${ca ? 'Este cliente aún no tiene preferencias registradas.' : state.user.rol === 'cliente' ? 'Aún no tenemos tus preferencias. Responde 5 preguntas y te diremos qué tanto coincide cada perfume contigo.' : 'Selecciona un cliente en Atención a cliente para ver su coincidencia.'}</p>
          ${esCliente ? '<a href="#/buscador">Ir al buscador inteligente →</a>' : ''}`}
      </div>
    </div>

    <h2 style="margin:30px 0 14px">Perfumes similares</h2>
    <div class="similar">${similares.map((s) => `
      <div class="card mini" data-go="${s.id}">
        <div class="th" style="background:${tint(s.color)}">${perfumeVisual(s, 26)}</div>
        <div><b>${esc(s.nombre)}</b><span class="muted small">${esc(s.familia)} · ${money(s.precio)}</span><br><span class="pct-green">${s.porcentaje}% similitud</span></div>
      </div>`).join('')}</div>`;

  $$('[data-go]', view).forEach((c) => (c.onclick = () => (location.hash = `#/perfume/${c.dataset.go}`)));
  $('#d-cmp').onclick = () => {
    comparador.toggle(p.id);
    $('#d-cmp span').textContent = inCmp() ? 'Quitar del comparador' : 'Agregar al comparador';
  };
  if ($('#d-fav')) $('#d-fav').onclick = async () => {
    try {
      await api(`/favoritos/${p.id}`, { method: favorito ? 'DELETE' : 'POST' });
      favorito = !favorito;
      $('#d-fav span').textContent = favorito ? 'En tus favoritos' : 'Guardar en favoritos';
      toast(favorito ? 'Guardado en favoritos' : 'Quitado de favoritos');
    } catch (e) { toast(e.message, true); }
  };
  if ($('#d-venta')) $('#d-venta').onclick = () => modal(`
    <div class="modal-head"><h2>Registrar venta</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
    <form id="vt">
      <p class="muted" style="margin-bottom:14px"><b style="color:var(--text)">${esc(p.nombre)}</b> · ${money(p.precio)} c/u · ${p.existencias} en existencia</p>
      <div class="field"><label>Cantidad</label><input class="input" name="cantidad" type="number" min="1" max="${p.existencias}" value="1" required></div>
      <p class="muted small">${ca ? `Se registrará en el historial de <b>${esc(ca.nombre)}</b> y cuenta como recomendación aceptada.` : 'Venta sin cliente registrado. Selecciona un cliente en Atención a cliente para asociarla.'}
        El inventario se descuenta y alimenta el punto de reorden.</p>
      <div class="modal-foot"><button type="button" class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary">Registrar</button></div>
    </form>`, {
    onMount: (m, close) => {
      $('#vt', m).onsubmit = async (e) => {
        e.preventDefault();
        await withBusy($('#vt .btn-primary', m), async () => {
          const r = await api('/ventas', { method: 'POST', body: { perfume_id: p.id, cantidad: Number(e.target.cantidad.value), cliente_id: ca?.id } });
          toast(`Venta registrada. Quedan ${r.existencias} unidades.`);
          close(); viewPerfume(p.id);
        });
      };
    },
  });
  if ($('#d-rec')) $('#d-rec').onclick = async () => {
    try { await api(`/clientes/${ca.id}/recomendar`, { method: 'POST', body: { perfume_id: p.id } }); toast(`Recomendación registrada para ${ca.nombre}`); } catch (e) { toast(e.message, true); }
  };
  if ($('#d-asesor')) $('#d-asesor').onclick = () => modal(`
    <div class="modal-head"><h2>Consultar con un asesor</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
    <p class="muted" style="line-height:1.6">Visita cualquiera de nuestras sucursales y muestra tu correo <b>${esc(state.user.correo)}</b> al asesor. Tendrá a la mano tu perfil olfativo, tus favoritos y este perfume para darte una prueba en piel.</p>
    <div class="kv" style="margin-top:14px"><span>Sucursal Centro</span><b>Lun–Sáb 10:00–20:00</b></div>
    <div class="kv"><span>Sucursal Norte</span><b>Lun–Dom 11:00–21:00</b></div>
    <div class="modal-foot"><button class="btn btn-primary" data-close>Entendido</button></div>`);
  if ($('#d-how')) $('#d-how').onclick = (e) => { e.preventDefault(); modalComoSeCalcula(); };
}

function modalComoSeCalcula() {
  modal(`<div class="modal-head"><h2>¿Cómo se calcula la coincidencia?</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
    <p class="muted" style="line-height:1.6;margin-bottom:12px">Cada criterio tiene un peso. La coincidencia es la suma de los pesos de los criterios que el perfume cumple, dividida entre los pesos de los criterios que elegiste.</p>
    <table class="t"><thead><tr><th>Criterio</th><th>Peso</th></tr></thead><tbody>
      <tr><td>Familia olfativa</td><td>30%</td></tr><tr><td>Ocasión</td><td>25%</td></tr><tr><td>Temporada</td><td>20%</td></tr>
      <tr><td>Intensidad</td><td>15%</td></tr><tr><td>Presupuesto</td><td>10%</td></tr></tbody></table>
    <p class="muted small" style="margin-top:12px">Si el perfume contiene notas que indicaste evitar, se restan 20 puntos por cada una.</p>
    <div class="modal-foot"><button class="btn btn-primary" data-close>Cerrar</button></div>`);
}

// ---------- buscador inteligente ----------
const buscadorResp = { ocasion: null, temporada: null, familia: null, intensidad: null, presupuesto: null };
const PESOS_BASE = { ocasion: 25, temporada: 20, familia: 30, intensidad: 15, presupuesto: 10 };
let buscadorPesos = null; // null = los que tenga guardados el cliente (o los predeterminados)
let ultimaBusquedaRegistrada = null;

async function viewBuscador({ asesor = false } = {}) {
  const cats = await categorias();
  const r = buscadorResp;
  const ca = asesor ? clienteActivo.get() : null;
  const preguntas = [
    ['ocasion', '¿Para qué ocasión lo buscas?', cats.ocasion.map((c) => [c.nombre, c.nombre])],
    ['temporada', '¿En qué temporada lo usarás?', cats.temporada.map((c) => [c.nombre, c.nombre])],
    ['familia', '¿Qué familia olfativa prefieres?', cats.familia.map((c) => [c.nombre, c.nombre])],
    ['intensidad', '¿Qué intensidad buscas?', INTENSIDADES.map((i) => [i, i])],
    ['presupuesto', '¿Cuál es tu presupuesto?', Object.entries(PRESUPUESTOS)],
  ];
  const etiquetas = { ocasion: 'Ocasión', temporada: 'Temporada', familia: 'Familia olfativa', intensidad: 'Intensidad', presupuesto: 'Presupuesto' };
  const view = renderLayout(`
    <div class="page-head">
      <div><h1>${asesor ? 'Recomendar productos' : 'Buscador inteligente'}</h1>
        <p>${asesor ? 'Responde las preguntas con el cliente y AromaMatch ordena el catálogo por coincidencia.' : 'Responde 5 preguntas y AromaMatch calcula qué tanto coincide cada perfume contigo.'}</p></div>
      <div class="row">
        <button class="btn btn-outline" id="b-clear">Limpiar respuestas</button>
        ${asesor ? (ca ? `<button class="btn btn-primary" id="b-save">Guardar en perfil de ${esc(ca.nombre.split(' ')[0])}</button>` : '') : '<button class="btn btn-primary" id="b-save">Guardar como mis preferencias</button>'}
      </div>
    </div>
    ${asesor ? clienteActivoBar() : ''}
    <div class="finder">
      <div class="stack">
        <div class="card card-pad" style="padding-top:8px">
          ${preguntas.map(([k, t, ops], i) => `
            <div class="q"><div class="qh"><span class="num">${i + 1}</span><b>${t}</b><span class="peso" data-peso-lbl="${k}"></span></div>
              <div class="pills">${ops.map(([v, l]) => `<button class="pill ${r[k] === v ? 'active' : ''}" data-q="${k}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div></div>`).join('')}
        </div>
        <div class="card card-pad">
          <div class="row between"><h3>${icon('sliders')} ¿Qué ${asesor ? 'le' : 'te'} importa más?</h3><button class="btn-ghost btn btn-sm" id="w-reset">Restablecer</button></div>
          <p class="muted small" style="margin:6px 0 4px">Análisis “¿qué pasaría si…?”: mueve los pesos y mira cómo cambia el ranking en tiempo real. Un peso en 0 ignora ese criterio.</p>
          <div class="pesos">${Object.keys(PESOS_BASE).map((k) => `
            <div class="peso-row"><label for="w-${k}">${etiquetas[k]}</label><input type="range" id="w-${k}" min="0" max="100" step="5" data-w="${k}"><b data-w-val="${k}"></b></div>`).join('')}</div>
          <p class="muted small" id="w-estado"></p>
        </div>
      </div>
      <div>
        <div class="row between" style="margin-bottom:12px"><h2>Recomendaciones ${asesor ? '' : 'para ti'}</h2><span class="muted small" id="b-count"></span></div>
        <div id="b-res">${loading()}</div>
        <p class="hint">La coincidencia es la suma de los pesos de cada criterio que el perfume cumple, dividida entre los pesos de los criterios que elegiste. Las flechas indican cuántos lugares subió o bajó cada perfume respecto a los pesos predeterminados.</p>
      </div>
    </div>`);

  const esBase = (w) => Object.keys(PESOS_BASE).every((k) => w[k] === PESOS_BASE[k]);
  function pintarPesos(w) {
    const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    for (const k of Object.keys(PESOS_BASE)) {
      $(`[data-w="${k}"]`).value = w[k];
      $(`[data-w-val="${k}"]`).textContent = w[k];
      $(`[data-peso-lbl="${k}"]`).textContent = `Peso ${Math.round((w[k] / total) * 100)}%`;
    }
    $('#w-estado').textContent = esBase(w) ? 'Usando los pesos predeterminados (30/25/20/15/10).' : 'Pesos personalizados.';
  }
  pintarPesos(buscadorPesos || PESOS_BASE);

  let timer;
  let seq = 0;
  async function calcular(registrar = false) {
    const mio = ++seq;
    try {
      const d = await api('/buscador', { method: 'POST', body: { criterios: { ...r }, registrar, cliente_id: ca?.id, pesos: buscadorPesos ?? undefined } });
      if (mio !== seq || !document.body.contains($('#b-res'))) return; // llegó una respuesta más nueva
      if (!buscadorPesos) pintarPesos(d.pesos); // primera carga: pesos guardados del cliente
      const personalizados = !esBase(d.pesos);
      $('#b-count').textContent = `${d.seleccionados} de 5 criterios seleccionados`;
      if (!d.seleccionados) {
        $('#b-res').innerHTML = `<div class="card empty"><h3>Empieza respondiendo</h3><p>Elige al menos una opción para ver qué perfumes coinciden contigo.</p></div>`;
        return;
      }
      $('#b-res').innerHTML = d.resultados.slice(0, 5).map((x, i) => {
        const p = x.perfume;
        const color = x.porcentaje >= 80 ? 'green' : x.porcentaje >= 50 ? 'amber' : 'gray';
        const txt = { green: 'var(--green)', amber: 'var(--amber)', gray: '#6B5F67' }[color];
        const mov = x.posicionBase - x.posicion;
        const flecha = personalizados && mov ? `<span class="mov ${mov > 0 ? 'up' : 'down'}" title="Posición con pesos predeterminados: ${x.posicionBase}">${mov > 0 ? '▲' : '▼'}${Math.abs(mov)}</span>` : '';
        return `<div class="card result">
          <div class="rank">${i + 1}${flecha}</div>
          <div class="th" style="background:${tint(p.color)}">${perfumeVisual(p, 30)}</div>
          <div><h3>${esc(p.nombre)}</h3><span class="meta">${esc(p.marca)} · ${esc(p.familia)} · ${money(p.precio)}</span>
            ${x.coincide.length ? `<div class="ok">✓ Coincide en: ${esc(x.coincide.join(' · '))}</div>` : ''}
            ${x.noCoincide.length ? `<div class="no">No coincide en: ${esc(x.noCoincide.join(' · '))}</div>` : '<div class="no">Cumple todos tus criterios</div>'}
          </div>
          <div class="pctbox"><div class="pct" style="color:${txt}">${x.porcentaje}%</div><div class="meter lg ${color}"><i style="width:${x.porcentaje}%"></i></div></div>
          <a class="btn btn-outline btn-sm" href="#/perfume/${p.id}">Ver</a>
        </div>`;
      }).join('');
    } catch (e) { toast(e.message, true); }
  }

  let wTimer;
  $$('[data-w]', view).forEach((inp) => (inp.oninput = () => {
    buscadorPesos = Object.fromEntries($$('[data-w]', view).map((x) => [x.dataset.w, Number(x.value)]));
    if (!Object.values(buscadorPesos).some(Boolean)) { buscadorPesos[inp.dataset.w] = 5; } // al menos un criterio cuenta
    pintarPesos(buscadorPesos);
    clearTimeout(wTimer);
    wTimer = setTimeout(() => calcular(), 120);
  }));
  $('#w-reset').onclick = () => { buscadorPesos = { ...PESOS_BASE }; pintarPesos(buscadorPesos); calcular(); };

  $$('[data-q]', view).forEach((b) => (b.onclick = () => {
    const k = b.dataset.q;
    r[k] = r[k] === b.dataset.v ? null : b.dataset.v;
    $$(`[data-q="${k}"]`, view).forEach((x) => x.classList.toggle('active', x.dataset.v === r[k]));
    calcular();
    // Registra la búsqueda en el historial cuando el usuario deja de cambiar respuestas.
    clearTimeout(timer);
    timer = setTimeout(() => {
      const clave = JSON.stringify([ca?.id, r]);
      if (Object.values(r).filter(Boolean).length >= 3 && clave !== ultimaBusquedaRegistrada) {
        ultimaBusquedaRegistrada = clave;
        calcular(true);
      }
    }, 2500);
  }));
  $('#b-clear').onclick = () => { Object.keys(r).forEach((k) => (r[k] = null)); clearTimeout(timer); viewBuscador({ asesor }); };
  if ($('#b-save')) $('#b-save').onclick = async (e) => {
    if (!Object.values(r).some(Boolean)) return toast('Responde al menos una pregunta.', true);
    await withBusy(e.currentTarget, async () => {
      const body = { familia: r.familia, ocasiones: r.ocasion ? [r.ocasion] : [], temporada: r.temporada, intensidad: r.intensidad, presupuesto: r.presupuesto };
      if (asesor) await api(`/clientes/${ca.id}/preferencias`, { method: 'POST', body: { familia: r.familia, ocasion: r.ocasion, temporada: r.temporada, presupuesto: r.presupuesto } });
      else {
        const w = buscadorPesos && !esBase(buscadorPesos) ? buscadorPesos : null;
        await api('/preferencias', { method: 'PUT', body: { ...body, notas_evita: undefined, ...(buscadorPesos ? { pesos: w } : {}) } });
      }
      toast(asesor ? 'Preferencias guardadas' : 'Preferencias y pesos guardados');
    });
  };
  bindClienteActivoBar(view, () => viewBuscador({ asesor }));
  calcular();
}

// ---------- comparador ----------
async function viewComparador() {
  const ca = state.user.rol === 'asesor' ? clienteActivo.get() : null;
  const ids = comparador.ids();
  const view = renderLayout(`
    <div class="page-head">
      <div><h1>Comparador de perfumes</h1><p>Compara hasta 3 perfumes lado a lado para decidir con más claridad.</p></div>
      <button class="btn btn-outline" id="c-add" ${ids.length >= 3 ? 'disabled' : ''}>${icon('plus')}Agregar perfume</button>
    </div>
    ${state.user.rol === 'asesor' ? clienteActivoBar() : ''}
    <div class="card cmp" id="cmp">${loading()}</div>`);
  bindClienteActivoBar(view, viewComparador);
  $('#c-add').onclick = () => modalAgregarComparador();

  const items = ids.length ? await api(`/comparar?ids=${ids.join(',')}${ca ? `&cliente=${ca.id}` : ''}`) : [];
  if (items.length !== ids.length) comparador.set(items.map((i) => i.id));
  if (!items.length) {
    $('#cmp').innerHTML = `<div class="empty"><h3>Tu comparador está vacío</h3><p style="margin-bottom:16px">Agrega perfumes desde el catálogo con el botón ${icon('scale')} o aquí mismo.</p>
      <button class="btn btn-primary" id="c-add2">${icon('plus')}Agregar perfume</button></div>`;
    $('#c-add2').onclick = () => modalAgregarComparador();
    return;
  }
  const conMatch = items.filter((i) => i.match != null);
  const best = conMatch.length > 1 ? conMatch.reduce((a, b) => (b.match > a.match ? b : a)).id : null;
  const cls = (p) => (p.id === best ? 'best' : '');
  const fila = (lab, fn) => `<tr><td class="lab">${lab}</td>${items.map((p) => `<td class="${cls(p)}">${fn(p)}</td>`).join('')}${items.length < 3 ? '<td></td>' : ''}</tr>`;
  const bar = (p, v, t) => `<div class="bar-cell"><div class="meter ${p.id === best ? '' : 'soft'}"><i style="width:${v}%"></i></div><b>${esc(t)}</b></div>`;

  $('#cmp').innerHTML = `<table>
    <tr><td class="lab" style="vertical-align:bottom;padding-bottom:22px"><span class="muted small">Comparando</span><h3 style="margin-top:4px">${items.length} perfume${items.length > 1 ? 's' : ''}</h3></td>
      ${items.map((p) => `<td class="headcell ${cls(p)}">
        <button class="icon-btn plain x" data-rm="${p.id}" aria-label="Quitar">${icon('x')}</button>
        ${p.id === best ? `<span class="best-tag">Mejor opción ${ca ? 'para el cliente' : 'para ti'}</span>` : '<div style="height:21px"></div>'}
        <div class="th" style="background:${tint(p.color)}">${perfumeVisual(p, 40)}</div>
        <div class="eyebrow">${esc(p.marca)}</div><h3>${esc(p.nombre)}</h3><b>${money(p.precio)} MXN</b></td>`).join('')}
      ${items.length < 3 ? `<td style="padding:16px;width:22%"><button class="add-slot" id="c-add3">${icon('plus')} Agregar</button></td>` : ''}</tr>
    ${fila('Familia olfativa', (p) => esc(p.familia))}
    ${fila('Concentración', (p) => `${esc(p.concentracion)} · ${p.ml} ml`)}
    ${fila('Notas de salida', (p) => esc(p.notas_salida || '—'))}
    ${fila('Notas de corazón', (p) => esc(p.notas_corazon || '—'))}
    ${fila('Notas de fondo', (p) => esc(p.notas_fondo || '—'))}
    ${fila('Ocasión ideal', (p) => esc(lista(p.ocasiones).join(' · ')))}
    ${fila('Temporada', (p) => esc(lista(p.temporadas).length === 4 ? 'Todo el año' : lista(p.temporadas).join(' · ')))}
    ${fila('Precio por ml', (p) => money2(p.precio / p.ml))}
    ${fila('Intensidad', (p) => bar(p, nivelIntensidad(p.intensidad), p.intensidad))}
    ${fila('Duración', (p) => bar(p, nivelDuracion(p.duracion), p.duracion || '—'))}
    ${fila('Proyección', (p) => bar(p, nivelProyeccion(p.proyeccion), p.proyeccion || '—'))}
    ${fila(`Coincidencia ${ca ? 'con cliente' : 'contigo'}`, (p) => (p.match != null ? bar(p, p.match, `${p.match}%`) : '<span class="muted small">Sin preferencias</span>'))}
    <tr><td></td>${items.map((p) => `<td class="${cls(p)}" style="padding:14px"><button class="btn ${p.id === best ? 'btn-primary' : 'btn-outline'} btn-block" data-pick="${p.id}">${state.user.rol === 'cliente' ? 'Elegir y ver detalle' : 'Ver detalle'}</button></td>`).join('')}${items.length < 3 ? '<td></td>' : ''}</tr>
  </table>`;
  $$('[data-rm]').forEach((b) => (b.onclick = () => { comparador.toggle(Number(b.dataset.rm)); viewComparador(); }));
  if ($('#c-add3')) $('#c-add3').onclick = () => modalAgregarComparador();
  $$('[data-pick]').forEach((b) => (b.onclick = async () => {
    const elegido = Number(b.dataset.pick);
    if (items.length >= 2 && (state.user.rol === 'cliente' || ca)) {
      await api('/comparar/elegir', { method: 'POST', body: { ids: items.map((i) => i.id), elegido, cliente_id: ca?.id } }).catch(() => {});
    }
    location.hash = `#/perfume/${elegido}`;
  }));
}

async function modalAgregarComparador() {
  const rows = await api('/perfumes?orden=nombre');
  const ids = comparador.ids();
  modal(`<div class="modal-head"><h2>Agregar perfume</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
    <div class="search" style="margin-bottom:12px">${icon('search')}<input class="input" id="m-q" placeholder="Buscar…"></div>
    <div id="m-list" style="max-height:50vh;overflow:auto"></div>`, {
    onMount: (m, close) => {
      const pintar = (t = '') => {
        $('#m-list', m).innerHTML = rows.filter((p) => !ids.includes(p.id) && `${p.nombre} ${p.marca} ${p.familia}`.toLowerCase().includes(t))
          .map((p) => `<div class="card mini" style="margin-bottom:8px" data-add="${p.id}"><div class="th" style="background:${tint(p.color)}">${perfumeVisual(p, 24)}</div>
            <div><b>${esc(p.nombre)}</b><span class="muted small">${esc(p.marca)} · ${esc(p.familia)} · ${money(p.precio)}</span></div></div>`).join('')
          || '<p class="muted">No hay más perfumes para agregar.</p>';
        $$('[data-add]', m).forEach((c) => (c.onclick = () => { comparador.toggle(Number(c.dataset.add)); close(); viewComparador(); }));
      };
      pintar();
      $('#m-q', m).oninput = (e) => pintar(e.target.value.toLowerCase());
      $('#m-q', m).focus();
    },
  });
}

// ---------- perfil del cliente ----------
async function viewPerfil() {
  const view = renderLayout(loading());
  const d = await api('/perfil');
  const u = d.usuario;
  const pr = d.preferencias || {};
  const tipoChip = { 'Búsqueda': 'plum', 'Recomendación': 'green', 'Comparación': 'amber', 'Favorito': 'red', 'Atención en tienda': 'blue', 'Recomendación del asesor': 'green', 'Alta de cliente': 'plum', 'Preferencias': 'blue' };
  view.innerHTML = `
    <div class="profile">
      <div class="stack">
        <div class="card card-pad pcenter">
          <div class="avatar lg">${esc(iniciales(u.nombre))}</div>
          <h2 style="font-size:24px">${esc(u.nombre)}</h2>
          <p class="muted small" style="margin:6px 0 8px">${esc(u.correo)}</p>
          <span class="chip plum">Cliente desde ${esc(mesAnio(u.creado))}</span>
          <button class="btn btn-outline btn-block" id="p-edit" style="margin-top:16px">Editar datos personales</button>
        </div>
        <div class="card card-pad">
          <div class="card-head" style="margin-bottom:10px"><h3>Perfil olfativo</h3><a href="#/buscador" class="small">Editar</a></div>
          <div class="bars">${d.perfilOlfativo.length ? d.perfilOlfativo.map((f) => `
            <div class="b"><div class="row"><b>${esc(f.familia)}</b><span class="muted">${f.porcentaje}%</span></div><div class="meter"><i style="width:${f.porcentaje}%"></i></div></div>`).join('')
              : '<p class="muted small">Usa el buscador o guarda favoritos para construir tu perfil olfativo.</p>'}</div>
          <p class="muted small" style="margin-top:6px">Calculado con tu familia preferida, tus favoritos y tus búsquedas.</p>
        </div>
        <div class="card card-pad">
          <div class="card-head" style="margin-bottom:4px"><h3>Mis preferencias</h3><button class="btn-ghost btn btn-sm" id="p-pref">Editar</button></div>
          <div class="kv"><span>Presupuesto habitual</span><b>${esc(PRESUPUESTOS[pr.presupuesto] || '—')}</b></div>
          <div class="kv"><span>Ocasiones frecuentes</span><b>${esc(lista(pr.ocasiones).join(' · ') || '—')}</b></div>
          <div class="kv"><span>Familia favorita</span><b>${esc(pr.familia || '—')}</b></div>
          <div class="kv"><span>Temporada favorita</span><b>${esc(pr.temporada || '—')}</b></div>
          <div class="kv"><span>Intensidad</span><b>${esc(pr.intensidad || '—')}</b></div>
          <div class="kv"><span>Notas que evita</span><b>${esc(pr.notas_evita || '—')}</b></div>
          <div class="kv"><span>Pesos del buscador</span><b>${pr.pesos ? 'Personalizados' : 'Predeterminados'}</b></div>
        </div>
      </div>
      <div class="stack">
        <div>
          <div id="p-alertas" style="margin-bottom:18px"></div>
          <div class="row between" style="margin-bottom:12px"><h2 style="font-size:24px">Mis favoritos</h2><a href="#/catalogo" class="small">Ir al catálogo →</a></div>
          <div class="favs">${d.favoritos.length ? d.favoritos.map((p) => `
            <div class="card fcard" data-go="${p.id}"><div class="ph" style="background:${tint(p.color)}">${perfumeVisual(p, 30)}</div>
              <div class="body"><b>${esc(p.nombre)}</b><span class="muted small">${esc(p.familia)} · ${money(p.precio)}</span></div></div>`).join('')
              : '<div class="card empty" style="grid-column:1/-1;padding:30px"><p>Aún no guardas favoritos. Toca el ♡ en cualquier perfume.</p></div>'}</div>
        </div>
        <div class="card">
          <div class="card-head card-pad" style="margin:0;padding-bottom:14px"><h2>Historial de actividad</h2>
            <select class="input" id="p-filter" style="width:auto"><option value="">Toda la actividad</option>
              ${[...new Set(d.actividad.map((a) => a.tipo))].map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
          <div class="table-wrap"><table class="t"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Resultado</th></tr></thead>
            <tbody id="p-act"></tbody></table></div>
        </div>
        <div class="card card-pad">
          <h3>Privacidad</h3>
          <p class="muted small" style="margin:6px 0 12px;line-height:1.6">Consulta los <a href="/terminos.pdf" target="_blank" rel="noopener">Términos y Condiciones y Aviso de Privacidad</a>. Puedes eliminar tu cuenta y tus datos personales en cualquier momento.</p>
          <button class="btn btn-danger btn-sm" id="p-del">Eliminar mi cuenta</button>
        </div>
      </div>
    </div>`;

  const pintarAct = (tipo) => {
    const rows = d.actividad.filter((a) => !tipo || a.tipo === tipo);
    $('#p-act').innerHTML = rows.map((a) => `<tr><td class="muted" style="white-space:nowrap">${fecha(a.fecha)}</td>
      <td><span class="chip ${tipoChip[a.tipo] || ''}">${esc(a.tipo)}</span></td><td>${esc(a.detalle)}</td><td><b>${esc(a.resultado || '—')}</b></td></tr>`).join('')
      || '<tr><td colspan="4" class="muted">Sin actividad.</td></tr>';
  };
  pintarAct('');
  // Alertas del cliente (bajas de precio y agotados en sus favoritos).
  const pintarAlertasPerfil = () => {
    const al = state.alertas || [];
    const cont = $('#p-alertas');
    if (!cont) return;
    cont.innerHTML = al.length ? `<h3 style="margin-bottom:10px">${icon('bell')} Avisos para ti</h3>${al.map(alertaHtml).join('')}` : '';
    cont.style.display = al.length ? '' : 'none';
    bindAlertas(cont, pintarAlertasPerfil);
  };
  cargarAlertas().then(pintarAlertasPerfil);
  $('#p-filter').onchange = (e) => pintarAct(e.target.value);
  $$('[data-go]', view).forEach((c) => (c.onclick = () => (location.hash = `#/perfume/${c.dataset.go}`)));
  $('#p-edit').onclick = () => modalDatosPersonales(u);
  $('#p-pref').onclick = () => modalPreferencias(pr);
  $('#p-del').onclick = async () => {
    if (!(await confirmar('Eliminar mi cuenta', 'Se borrarán tu perfil, favoritos, preferencias e historial. Esta acción no se puede deshacer.', { ok: 'Eliminar definitivamente', peligro: true }))) return;
    try { await api('/perfil', { method: 'DELETE' }); setSession(null, null); toast('Tu cuenta fue eliminada.'); location.hash = '#/login'; } catch (e) { toast(e.message, true); }
  };
}

function modalDatosPersonales(u) {
  modal(`<div class="modal-head"><h2>Datos personales</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
    <form id="dp">
      <div class="field"><label>Nombre completo</label><input class="input" name="nombre" value="${esc(u.nombre)}" required></div>
      <div class="grid2">
        <div class="field"><label>Correo electrónico</label><input class="input" name="correo" type="email" value="${esc(u.correo)}" required></div>
        <div class="field"><label>Teléfono</label><input class="input" name="telefono" value="${esc(u.telefono || '')}"></div>
      </div>
      <p class="label" style="margin:6px 0 10px">Cambiar contraseña <span class="muted" style="font-weight:400">(opcional)</span></p>
      <div class="grid2">
        <div class="field"><label>Contraseña actual</label><input class="input" name="password_actual" type="password" autocomplete="current-password"></div>
        <div class="field"><label>Nueva contraseña</label><input class="input" name="password_nueva" type="password" minlength="8" autocomplete="new-password"></div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary">Guardar</button></div>
    </form>`, {
    onMount: (m, close) => {
      $('#dp', m).onsubmit = async (e) => {
        e.preventDefault();
        await withBusy($('button.btn-primary', m), async () => {
          const r = await api('/perfil', { method: 'PUT', body: formData(e.target) });
          setSession(state.token, r.usuario);
          toast('Datos actualizados'); close(); route();
        });
      };
    },
  });
}

async function modalPreferencias(pr) {
  const cats = await categorias();
  const sel = (name, ops, val) => `<select class="input" name="${name}"><option value="">—</option>${ops.map(([v, l]) => `<option value="${esc(v)}" ${val === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const ocs = lista(pr.ocasiones);
  modal(`<div class="modal-head"><h2>Mis preferencias</h2><button class="icon-btn plain" data-close>${icon('x')}</button></div>
    <form id="pf">
      <div class="grid2">
        <div class="field"><label>Familia favorita</label>${sel('familia', cats.familia.map((c) => [c.nombre, c.nombre]), pr.familia)}</div>
        <div class="field"><label>Temporada favorita</label>${sel('temporada', cats.temporada.map((c) => [c.nombre, c.nombre]), pr.temporada)}</div>
        <div class="field"><label>Intensidad</label>${sel('intensidad', INTENSIDADES.map((i) => [i, i]), pr.intensidad)}</div>
        <div class="field"><label>Presupuesto habitual</label>${sel('presupuesto', Object.entries(PRESUPUESTOS), pr.presupuesto)}</div>
      </div>
      <div class="field"><label>Ocasiones frecuentes</label><div class="checks-inline">${cats.ocasion.map((c) => `<label class="check"><input type="checkbox" name="oc" value="${esc(c.nombre)}" ${ocs.includes(c.nombre) ? 'checked' : ''}>${esc(c.nombre)}</label>`).join('')}</div></div>
      <div class="field"><label>Notas que evitas</label><input class="input" name="notas_evita" value="${esc(pr.notas_evita || '')}" placeholder="Ej. Acuáticas, menta"></div>
      <div class="modal-foot"><button type="button" class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary">Guardar</button></div>
    </form>`, {
    onMount: (m, close) => {
      $('#pf', m).onsubmit = async (e) => {
        e.preventDefault();
        const body = formData(e.target);
        delete body.oc;
        body.ocasiones = $$('input[name=oc]:checked', m).map((i) => i.value);
        await withBusy($('button.btn-primary', m), async () => {
          await api('/preferencias', { method: 'PUT', body });
          toast('Preferencias guardadas'); close(); viewPerfil();
        });
      };
    },
  });
}
