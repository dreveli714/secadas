/**
 * Secadas — backend en Google Apps Script
 *
 * Guarda los movimientos en esta hoja de cálculo (pestañas "movimientos" y "config"),
 * las fotos de los tickets en una carpeta de Drive y, si hay clave de la API de Anthropic,
 * lee el importe de los tickets con Claude.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   APP_PIN            PIN para entrar en la app (lo crea setup() si no existe)
 *   ANTHROPIC_API_KEY  opcional: activa la lectura de tickets con foto
 *   CARPETA_ID         carpeta de Drive para las fotos (la crea setup())
 *
 * Primera vez: ejecuta setup() y después importarOctubre(). Luego Implementar → Aplicación web.
 * Para actualizar: Implementar → Gestionar implementaciones → editar → Nueva versión (así la URL no cambia).
 */

const HOJA_MOV = 'movimientos';
const HOJA_CFG = 'config';
const COLS = ['id', 'fecha', 'tipo', 'concepto', 'secadas', 'cent', 'nota', 'ticket', 'por', 'ts', 'origen', 'editadoPor'];
const TIPOS = ['secado', 'compra', 'abono', 'ajuste'];
const MODELO_IA = 'claude-haiku-5-5';

const PROMPT_TICKET = [
  'Eres un lector de tickets de compra de Francia (precios en euros). Mira la foto y responde SOLO con un objeto JSON, sin texto extra, con esta forma:',
  '{"legible": true, "total": 3.00, "concepto": "Papel higiénico", "tienda": "Carrefour City", "fecha": "2026-10-12"}',
  'Reglas:',
  '- "total": el importe TOTAL pagado (TOTAL, À PAYER, MONTANT, CB), como número con punto decimal. Si el ticket trae total, úsalo; no lo recalcules.',
  '- "concepto": qué se compró, en español, de 1 a 4 palabras (ej. "Papel higiénico", "Lejía", "Ambientador de suelo", "Detergente"). Si hay varios artículos, resúmelos en pocas palabras. Si la foto es solo el comprobante del pago con tarjeta (CARTE BANCAIRE, MONTANT, TICKET CLIENT) y no lista artículos, pon null: no lo inventes.',
  '- Las fechas francesas vienen como DD/MM/AA (por ejemplo "LE 20/10/26" es 2026-10-20).',
  '- "tienda": nombre del comercio tal como aparece, o null.',
  '- "fecha": fecha del ticket en formato AAAA-MM-DD, o null si no se ve.',
  '- Si la foto no es un ticket o no se lee el total, responde {"legible": false, "total": null, "concepto": null, "tienda": null, "fecha": null}.'
].join('\n');

/* ───────── Puesta en marcha (ejecutar a mano desde el editor) ───────── */

function setup() {
  hojaMov_();
  const cfg = hojaCfg_();
  if (cfg.getLastRow() < 2) {
    cfg.getRange(1, 1, 3, 2).setValues([['clave', 'valor'], ['precioCent', 140], ['abonoCent', 2000]]);
  }
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CARPETA_ID')) {
    props.setProperty('CARPETA_ID', DriveApp.createFolder('Secadas - tickets').getId());
  }
  if (!props.getProperty('APP_PIN')) {
    props.setProperty('APP_PIN', String(Math.floor(1000 + Math.random() * 9000)));
  }
  Logger.log('Listo. PIN de la app: ' + props.getProperty('APP_PIN'));
  Logger.log('Lectura de tickets con IA: ' + (props.getProperty('ANTHROPIC_API_KEY') ? 'activada' : 'desactivada (falta ANTHROPIC_API_KEY)'));
}

/** Carga los movimientos de octubre 2026 (saldo final 14,52 €). Solo funciona con la hoja vacía. */
function importarOctubre() {
  const OCTUBRE = [
    ["m20261004-n1", "2026-10-04", "abono", "Abono", 0, 2000, "En efectivo", "", "", 1791100800000, "notas"],
    ["m20261004-n2", "2026-10-04", "secado", "Secado", 2, -280, "", "", "", 1791100860000, "notas"],
    ["m20261005-a1", "2026-10-05", "abono", "Abono", 0, 2000, "", "", "", 1791100890000, "notas"],
    ["m20261005-n1", "2026-10-05", "secado", "Secado", 2, -280, "", "", "", 1791100920000, "notas"],
    ["m20261006-n1", "2026-10-06", "secado", "Secado", 2, -280, "", "", "", 1791100980000, "notas"],
    ["m20261007-n1", "2026-10-07", "secado", "Secado", 2, -280, "", "", "", 1791101040000, "notas"],
    ["m20261008-n1", "2026-10-08", "secado", "Secado", 2, -288, "", "", "", 1791101100000, "notas"],
    ["m20261009-n1", "2026-10-09", "secado", "Secado", 3, -428, "", "", "", 1791101160000, "notas"],
    ["m20261010-n1", "2026-10-10", "abono", "Abono", 0, 2000, "Me enviaron 20 € para secado", "", "", 1791101220000, "notas"],
    ["m20261010-n2", "2026-10-10", "secado", "Secado", 2, -288, "", "", "", 1791101280000, "notas"],
    ["m20261012-n1", "2026-10-12", "secado", "Secado", 2, -288, "", "", "", 1791101340000, "notas"],
    ["m20261012-n2", "2026-10-12", "compra", "Papel higiénico", 0, -300, "", "", "", 1791101400000, "notas"],
    ["m20261013-n1", "2026-10-13", "secado", "Secado", 1, -140, "", "", "", 1791101460000, "notas"],
    ["m20261014-n1", "2026-10-14", "secado", "Secado", 2, -288, "", "", "", 1791101520000, "notas"],
    ["m20261015-n1", "2026-10-15", "secado", "Secado", 2, -288, "", "", "", 1791101580000, "notas"],
    ["m20261016-n1", "2026-10-16", "secado", "Secado", 2, -288, "", "", "", 1791101640000, "notas"],
    ["m20261017-n1", "2026-10-17", "secado", "Secado", 2, -288, "", "", "", 1791101700000, "notas"],
    ["m20261018-n1", "2026-10-18", "secado", "Secado", 3, -420, "30 minutos en una máquina", "", "", 1791101760000, "notas"],
    ["m20261019-aj1", "2026-10-19", "ajuste", "Ajuste de saldo", 0, -572, "Dinero contado: 10,04 €. Con lo anotado debían quedar 15,76 €: faltan 5,72 € (2,22 € ya desde el sábado 10).", "", "", 1791101820000, "notas"],
    ["m20261020-a1", "2026-10-20", "abono", "Abono", 0, 2000, "", "", "", 1791101850000, "notas"],
    ["m20261020-aj1", "2026-10-20", "ajuste", "Ajuste de saldo", 0, -2000, "El abono de 20 € de este día no aparece en sus cuentas: falta ese dinero.", "", "", 1791101860000, "notas"],
    ["m20261020-n1", "2026-10-20", "compra", "Olor de piso", 0, -250, "Beyaz, pagado con tarjeta", "", "", 1791101880000, "notas"],
    ["m20261020-n2", "2026-10-20", "secado", "Secado", 2, -288, "", "", "", 1791101940000, "notas"],
    ["m20261021-n1", "2026-10-21", "abono", "Abono", 0, 2000, "", "", "", 1791102000000, "notas"],
    ["m20261022-n1", "2026-10-22", "secado", "Secado", 2, -288, "", "", "", 1791102060000, "notas"],
    ["m20261022-n2", "2026-10-22", "compra", "Javel", 0, -150, "Beyaz, pagado con tarjeta", "", "", 1791102120000, "notas"],
    ["m20261023-n1", "2026-10-23", "secado", "Secado", 2, -288, "", "", "", 1791102180000, "notas"],
    ["m20261024-n1", "2026-10-24", "secado", "Secado", 2, -288, "", "", "", 1791102240000, "notas"]
  ];
  const sh = hojaMov_();
  if (sh.getLastRow() > 1) {
    Logger.log('La hoja ya tiene movimientos: no importo nada para no duplicar.');
    return;
  }
  const filas = OCTUBRE.map(function (r) { return r.concat(['']); }); // + editadoPor
  sh.getRange(2, 1, filas.length, COLS.length).setValues(filas);
  const saldo = OCTUBRE.reduce(function (s, r) { return s + r[5]; }, 0);
  Logger.log('Importados ' + filas.length + ' movimientos. Saldo: ' + (saldo / 100).toFixed(2) + ' €');
}

/* ───────── API web ───────── */

function doGet() {
  return ContentService.createTextOutput('Secadas: el servidor funciona. Abre la app desde su página.');
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'formato' }); }
  const pin = PropertiesService.getScriptProperties().getProperty('APP_PIN');
  if (!pin || String(body.pin || '') !== pin) return json_({ ok: false, error: 'pin' });
  try {
    switch (body.action) {
      case 'datos': return json_(Object.assign({ ok: true }, datos_()));
      case 'guardar': return json_({ ok: true, mov: guardar_(body.mov) });
      case 'borrar': borrar_(String(body.id || '')); return json_({ ok: true });
      case 'config': return json_({ ok: true, config: guardarConfig_(body) });
      case 'subirFoto': return json_({ ok: true, id: subirFoto_(body.base64, body.mime) });
      case 'borrarFoto': borrarFoto_(String(body.id || '')); return json_({ ok: true });
      case 'leerTicket': return json_({ ok: true, ticket: leerTicket_(body.base64, body.mime) });
      default: return json_({ ok: false, error: 'accion' });
    }
  } catch (err) {
    return json_({ ok: false, error: err.code || 'servidor', mensaje: String(err.message || err) });
  }
}

/* ───────── Movimientos ───────── */

function datos_() {
  const sh = hojaMov_();
  const tz = Session.getScriptTimeZone();
  const n = sh.getLastRow();
  const vals = n > 1 ? sh.getRange(2, 1, n - 1, COLS.length).getValues() : [];
  const movimientos = vals.filter(function (r) { return String(r[0]) !== ''; }).map(function (r) { return fila_(r, tz); });
  return {
    movimientos: movimientos,
    config: config_(),
    ia: !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY')
  };
}

function fila_(r, tz) {
  const o = {};
  COLS.forEach(function (k, i) { o[k] = r[i]; });
  if (o.fecha instanceof Date) o.fecha = Utilities.formatDate(o.fecha, tz, 'yyyy-MM-dd');
  return {
    id: String(o.id), fecha: String(o.fecha), tipo: String(o.tipo), concepto: String(o.concepto || ''),
    secadas: Number(o.secadas) || 0, cent: Math.round(Number(o.cent) || 0), nota: String(o.nota || ''),
    ticket: String(o.ticket || ''), por: String(o.por || ''), ts: Number(o.ts) || 0,
    origen: String(o.origen || ''), editadoPor: String(o.editadoPor || '')
  };
}

function limpiarMov_(m) {
  if (!m || typeof m !== 'object') throw err_('dato', 'Movimiento vacío');
  const id = String(m.id || '');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw err_('dato', 'id no válido');
  const fecha = String(m.fecha || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw err_('dato', 'fecha no válida');
  const tipo = String(m.tipo || '');
  if (TIPOS.indexOf(tipo) < 0) throw err_('dato', 'tipo no válido');
  const cent = Math.round(Number(m.cent));
  if (!isFinite(cent) || Math.abs(cent) > 100000) throw err_('dato', 'importe no válido');
  if ((tipo === 'secado' || tipo === 'compra') && cent >= 0) throw err_('dato', 'un gasto debe ser negativo');
  if (tipo === 'abono' && cent <= 0) throw err_('dato', 'un abono debe ser positivo');
  const txt = function (v, n) { return String(v == null ? '' : v).slice(0, n); };
  return {
    id: id, fecha: fecha, tipo: tipo, concepto: txt(m.concepto, 60),
    secadas: tipo === 'secado' ? Math.max(0, Math.min(50, Math.round(Number(m.secadas) || 0))) : 0,
    cent: cent, nota: txt(m.nota, 300), ticket: tipo === 'compra' ? txt(m.ticket, 100) : '',
    por: txt(m.por, 40), ts: Number(m.ts) || Date.now(), origen: txt(m.origen, 20), editadoPor: txt(m.editadoPor, 40)
  };
}

function guardar_(m) {
  const mov = limpiarMov_(m);
  const fila = COLS.map(function (k) { return mov[k]; });
  return conBloqueo_(function () {
    const sh = hojaMov_();
    const n = buscarFila_(sh, mov.id);
    if (n > 0) sh.getRange(n, 1, 1, COLS.length).setValues([fila]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, COLS.length).setValues([fila]);
    return mov;
  });
}

function borrar_(id) {
  conBloqueo_(function () {
    const sh = hojaMov_();
    const n = buscarFila_(sh, id);
    if (n < 0) return;
    const ticket = String(sh.getRange(n, COLS.indexOf('ticket') + 1).getValue() || '');
    sh.deleteRow(n);
    if (ticket) borrarFoto_(ticket);
  });
}

function buscarFila_(sh, id) {
  const n = sh.getLastRow();
  if (n < 2) return -1;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return -1;
}

/* ───────── Configuración ───────── */

function config_() {
  const sh = hojaCfg_();
  const out = { precioCent: 140, abonoCent: 2000 };
  const n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, 2).getValues().forEach(function (r) {
    if (r[0] === 'precioCent' || r[0] === 'abonoCent') out[r[0]] = Math.round(Number(r[1])) || out[r[0]];
  });
  return out;
}

function guardarConfig_(b) {
  const p = Math.round(Number(b.precioCent)), a = Math.round(Number(b.abonoCent));
  if (!(p > 0 && p < 10000 && a > 0 && a < 100000)) throw err_('dato', 'importes no válidos');
  return conBloqueo_(function () {
    const sh = hojaCfg_();
    sh.clearContents();
    sh.getRange(1, 1, 3, 2).setValues([['clave', 'valor'], ['precioCent', p], ['abonoCent', a]]);
    return { precioCent: p, abonoCent: a };
  });
}

/* ───────── Fotos de tickets (Drive) ───────── */

function carpeta_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* se borró: se crea otra */ } }
  const f = DriveApp.createFolder('Secadas - tickets');
  props.setProperty('CARPETA_ID', f.getId());
  return f;
}

function subirFoto_(base64, mime) {
  mime = String(mime || 'image/jpeg');
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) < 0) throw err_('foto', 'tipo de imagen no admitido');
  const bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw err_('foto', 'foto vacía o demasiado grande');
  const nombre = 'ticket-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmmss') + (mime === 'image/png' ? '.png' : '.jpg');
  const file = carpeta_().createFile(Utilities.newBlob(bytes, mime, nombre));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // para poder verla en la app
  return file.getId();
}

/** Solo borra fotos que estén en la carpeta de la app. */
function borrarFoto_(id) {
  if (!id) return;
  try {
    const file = DriveApp.getFileById(id);
    const carpetaId = carpeta_().getId();
    const padres = file.getParents();
    while (padres.hasNext()) {
      if (padres.next().getId() === carpetaId) { file.setTrashed(true); return; }
    }
  } catch (e) { /* ya no existe */ }
}

/* ───────── Lectura de tickets con Claude ───────── */

function leerTicket_(base64, mime) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw err_('sin_ia', 'Falta ANTHROPIC_API_KEY');
  mime = String(mime || 'image/jpeg');
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].indexOf(mime) < 0) throw err_('foto', 'tipo de imagen no admitido');
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: MODELO_IA,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: String(base64 || '') } },
          { type: 'text', text: PROMPT_TICKET }
        ]
      }]
    })
  });
  const code = res.getResponseCode();
  if (code === 429 || code === 529) throw err_('ia_limite', 'La API está ocupada (' + code + ')');
  if (code !== 200) throw err_('ia_error', 'API ' + code + ': ' + res.getContentText().slice(0, 300));
  const data = JSON.parse(res.getContentText());
  const texto = (data.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
  return leerJson_(texto);
}

function leerJson_(t) {
  try { return JSON.parse(t); } catch (e) { /* sigue */ }
  const m = String(t).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) { /* sigue */ } }
  throw err_('ia_formato', 'La respuesta no es JSON');
}

/* ───────── Utilidades ───────── */

function hojaMov_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(HOJA_MOV);
  if (!sh) sh = ss.insertSheet(HOJA_MOV);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // Columnas de texto: así Sheets no convierte la fecha ni los ids
    ['A:D', 'G:I', 'K:L'].forEach(function (a) { sh.getRange(a).setNumberFormat('@'); });
  }
  return sh;
}

function hojaCfg_() {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(HOJA_CFG) || ss.insertSheet(HOJA_CFG);
}

function conBloqueo_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function err_(code, msg) { const e = new Error(msg); e.code = code; return e; }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
