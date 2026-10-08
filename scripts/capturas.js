// Genera capturas de pantalla de AromaMatch para el reporte y la presentación.
// Uso: con el servidor corriendo (npm start), ejecutar  node scripts/capturas.js
// Requiere Google Chrome o Microsoft Edge instalado. Las capturas quedan en docs/capturas/.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const SALIDA = path.join(__dirname, '..', 'docs', 'capturas');
const PUERTO = 9333;
const NAVEGADORES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function conectar() {
  const exe = NAVEGADORES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No se encontró Chrome ni Edge.');
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'aromamatch-capturas-'));
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await esperar(200);
    try { target = (await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* aún arrancando */ }
  }
  if (!target) throw new Error('El navegador no respondió.');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pendientes = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendientes.has(d.id)) { pendientes.get(d.id)(d); pendientes.delete(d.id); }
  };
  const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; pendientes.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const cerrar = async () => {
    ws.close(); proc.kill();
    await esperar(1500); // el navegador tarda en soltar su carpeta temporal
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* se limpiará con los temporales del sistema */ }
  };
  return { cdp, cerrar };
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  const { cdp, cerrar } = await conectar();
  const evaluar = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const tam = (w, h) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  // Carga completa (con parámetro único) para que la app lea la sesión recién guardada.
  const ir = async (hash, ms = 1800) => { await cdp('Page.navigate', { url: `${BASE}/?t=${Date.now()}${hash}` }); await esperar(ms); };
  const foto = async (nombre) => {
    await evaluar("document.querySelector('#toasts') && (document.querySelector('#toasts').innerHTML='')");
    const r = await cdp('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SALIDA, `${nombre}.png`), Buffer.from(r.result.data, 'base64'));
    console.log('✓', nombre);
  };
  const sesion = (correo, pass, rol) => evaluar(`(async () => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: ${JSON.stringify(correo)}, password: ${JSON.stringify(pass)}, rol: ${JSON.stringify(rol)} }) }).then((x) => x.json());
    localStorage.clear(); localStorage.setItem('am_token', JSON.stringify(r.token)); localStorage.setItem('am_user', JSON.stringify(r.usuario));
    return r.usuario.nombre; })()`);

  await cdp('Page.enable');
  await tam(1440, 900);

  // Público
  await cdp('Page.navigate', { url: `${BASE}/#/login` }); await esperar(1500);
  await evaluar('localStorage.clear()'); await ir('#/login');
  await foto('01-login');

  // Cliente
  await sesion('mariana.lopez@correo.com', 'cliente123', 'cliente');
  await ir('#/catalogo'); await foto('02-catalogo');
  const idDe = (n) => evaluar(`fetch('/api/perfumes',{headers:{Authorization:'Bearer '+JSON.parse(localStorage.am_token)}}).then(r=>r.json()).then(a=>a.find(p=>p.nombre===${JSON.stringify(n)}).id)`);
  const br = await idDe('Baccarat Rouge 540');
  await ir(`#/perfume/${br}`); await foto('03-detalle');
  await ir('#/buscador');
  await evaluar(`(async () => {
    for (const [k, v] of [['ocasion','Cita'],['temporada','Otoño'],['familia','Oriental'],['intensidad','Intensa'],['presupuesto','medio']])
      document.querySelector('[data-q="'+k+'"][data-v="'+v+'"]').click();
    await new Promise((r) => setTimeout(r, 600));
    const set = (k, v) => { const i = document.querySelector('[data-w="'+k+'"]'); i.value = v; i.dispatchEvent(new Event('input')); };
    set('presupuesto', 100); set('familia', 5);
    await new Promise((r) => setTimeout(r, 900)); })()`);
  await foto('04-buscador');
  const ids = await Promise.all(['Black Opium', 'La Vie Est Belle', 'Baccarat Rouge 540'].map(idDe));
  await evaluar(`localStorage.setItem('am_cmp', '${JSON.stringify(ids)}')`);
  await ir('#/comparador'); await foto('05-comparador');
  await ir('#/perfil', 2200); await foto('06-perfil');

  // Asesor
  await sesion('jorge.ramirez@aromamatch.mx', 'asesor123', 'asesor');
  await ir('#/atencion/4', 2200); await foto('07-asesor-atencion');
  const bo = await idDe('Black Opium');
  await ir(`#/perfume/${bo}`); await foto('08-asesor-detalle');

  // Administrador
  await sesion('admin@aromamatch.mx', 'admin123', 'admin');
  await tam(1440, 1000);
  await ir('#/dashboard', 2600); await foto('09-dashboard');
  await evaluar("document.querySelector('.dash').scrollIntoView()"); await esperar(300); await foto('10-dashboard-graficas');
  await ir('#/perfumes', 2200); await foto('11-gestion-perfumes');
  await ir('#/categorias'); await foto('12-categorias');
  await ir('#/tendencias', 2200); await foto('13-tendencias');
  await ir('#/pronostico', 2200); await foto('14-pronostico');
  await evaluar("(async()=>{document.querySelector('.fam-tabs [data-pf=\"Oriental\"]').click(); await new Promise(r=>setTimeout(r,400)); document.querySelector('#pr-chart').closest('.card').scrollIntoView(); window.scrollBy(0,-24);})()");
  await esperar(500); await foto('15-pronostico-oriental');
  await ir('#/inventario', 2400); await foto('16-inventario');
  await evaluar("[...document.querySelectorAll('h2')].find(h=>h.textContent.includes('ABC')).closest('.card').scrollIntoView()"); await esperar(400); await foto('17-abc');
  await ir('#/simulador', 2200);
  await evaluar("(async()=>{const i=document.querySelector('#s-precio'); i.value=2900; i.dispatchEvent(new Event('input')); await new Promise(r=>setTimeout(r,1500));})()");
  await foto('18-simulador');
  await ir('#/dashboard', 2600);
  await evaluar("(async()=>{modalAlertas(); await new Promise(r=>setTimeout(r,1500));})()");
  await foto('19-alertas');

  await cerrar();
  console.log(`Listo: ${SALIDA}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
