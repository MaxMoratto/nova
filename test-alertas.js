// Prueba del webhook completo con Mercado Pago y Firestore simulados.
const Module = require('module'); const orig = Module._load;
let FS = null;
Module._load = function (r) {
  if (r === '../lib/firebase') return { db: () => FS };
  if (r === 'firebase-admin') return { apps: [], initializeApp(){}, credential:{cert(){}}, firestore(){} };
  return orig.apply(this, arguments);
};
process.env.MP_ACCESS_TOKEN = 'token-falso';
delete process.env.RESEND_API_KEY; delete process.env.ALERTA_EMAIL; delete process.env.MAIL_REPLY_TO;

const handler = require('./api/mp-webhook.js');

function makeFirestore(seed) {
  const store = new Map(Object.entries(seed));
  const mk = (n) => ({ doc: (i) => ({ _p: n + '/' + i,
      update: async (v) => store.set(n + '/' + i, Object.assign({}, store.get(n + '/' + i) || {}, v)) }) });
  return { collection: mk, _store: store,
    runTransaction: async (fn) => { const w = [];
      const tx = { get: async (r) => ({ exists: store.has(r._p), data: () => store.get(r._p) }),
                   set: (r,v,o) => w.push(['s',r._p,v,o]), update: (r,v) => w.push(['u',r._p,v]) };
      const out = await fn(tx);
      for (const [k,pp,v,o] of w) { if (k==='s' && !(o&&o.merge)) store.set(pp,v); else store.set(pp, Object.assign({}, store.get(pp)||{}, v)); }
      return out; } };
}
const fakeRes = () => { const o = { code: 0, body: '' };
  o.status = (c) => { o.code = c; return o; }; o.send = (b) => { o.body = String(b); return o; }; return o; };

let fails = 0;
const check = (n, c, x) => { console.log((c ? '  OK   ' : '  FALLA') + '  ' + n + (c ? '' : '  <<< ' + JSON.stringify(x))); if (!c) fails++; };
const logs = [];
const realErr = console.error; console.error = (...a) => logs.push(a.join(' '));

global.fetch = async (url) => {
  if (String(url).includes('mercadopago')) return { ok: true, json: async () => ({ id: 5551, status: 'approved', external_reference: 'ORD1' }) };
  return { ok: true, text: async () => 'ok' }; // resend
};
const req = { query: { type: 'payment', 'data.id': '5551' }, body: {} };

(async () => {
  // CASO A: el cupo de General se agoto entre la compra y el pago -> cobrado sin boletos
  logs.length = 0;
  FS = makeFirestore({ 'ordenes/ORD1': { estado:'pendiente', seats:[], general:5, vipa:0, comprador:{ mail:'ana@x.com', tel:'55...' } },
                       'config/general': { vendidos: 248 } });
  let res = fakeRes();
  try { await handler(req, res); } catch (_) {}
  console.log('\nCASO A  pago aprobado pero el cupo se agoto');
  check('responde 500 para que MP reintente', res.code === 500, res);
  check('marca la orden para atender', FS._store.get('ordenes/ORD1').requiereAtencion === true, FS._store.get('ordenes/ORD1'));
  check('guarda el motivo', /agotado/.test(FS._store.get('ordenes/ORD1').emisionError || ''), FS._store.get('ordenes/ORD1').emisionError);
  check('registra EMISION_FALLIDA', logs.some(l => l.includes('EMISION_FALLIDA')), logs);
  check('intenta avisar (sin destino configurado lo deja en el log)', logs.some(l => l.includes('ALERTA_SIN_DESTINO')), logs);

  // CASO B: asiento ya vendido a otra orden -> conflicto, avisa, responde 200
  logs.length = 0;
  FS = makeFirestore({ 'ordenes/ORD1': { estado:'pendiente', seats:['VIP-M03-S2'], general:0, vipa:0, comprador:{ mail:'beto@x.com', tel:'56...' } },
                       'asientos_nova/VIP-M03-S2': { status:'vendido', orderId:'OTRA' } });
  res = fakeRes();
  await handler(req, res);
  console.log('\nCASO B  el asiento ya era de otra orden');
  check('responde 200', res.code === 200, res);
  check('avisa del conflicto', logs.some(l => l.includes('ALERTA_SIN_DESTINO') && l.includes('pagado dos veces')), logs);
  check('el aviso trae el correo del comprador', logs.some(l => l.includes('beto@x.com')), logs);

  console.error = realErr;
  console.log('\n' + (fails ? 'RESULTADO: ' + fails + ' FALLA(S)' : 'RESULTADO: todas pasaron'));
  process.exit(fails ? 1 : 0);
})();
