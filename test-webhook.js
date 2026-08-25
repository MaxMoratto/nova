// Prueba local del anti doble-venta. Simula Firestore en memoria; no toca nada real.
const Module = require('module');
const orig = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase-admin') return { apps: [], initializeApp() {}, credential: { cert() {} }, firestore() {} };
  return orig.apply(this, arguments);
};

const { generateTickets } = require('./api/mp-webhook.js');

function makeFirestore(seed) {
  const store = new Map(Object.entries(seed));
  const collection = (name) => ({ doc: (id) => ({ _p: name + '/' + id }) });
  return {
    collection,
    _store: store,
    runTransaction: async (fn) => {
      const writes = [];
      let reading = true;
      const tx = {
        get: async (r) => { if (!reading) throw new Error('LECTURA DESPUES DE ESCRITURA (Firestore lo rechaza)'); return { exists: store.has(r._p), data: () => store.get(r._p) }; },
        set: (r, v, o) => { reading = false; writes.push(['set', r._p, v, o]); },
        update: (r, v) => { reading = false; writes.push(['upd', r._p, v]); }
      };
      const out = await fn(tx);
      for (const [kind, p, v, o] of writes) {
        if (kind === 'set' && !(o && o.merge)) store.set(p, v);
        else store.set(p, Object.assign({}, store.get(p) || {}, v));
      }
      return out;
    }
  };
}

const pay = { id: 999001 };
let fails = 0;
const check = (name, cond, extra) => { console.log((cond ? '  OK   ' : '  FALLA') + '  ' + name + (cond ? '' : '  <<< ' + JSON.stringify(extra))); if (!cond) fails++; };

(async () => {
  // --- Caso 1: la silla sigue libre -> se emite el boleto normal
  console.log('\nCASO 1  silla libre (comportamiento normal)');
  let fs = makeFirestore({
    'ordenes/O1': { estado: 'pendiente', seats: ['VIP-M01-S1'], general: 0, vipa: 0, comprador: { mail: 'ana@x.com' } },
    'asientos_nova/VIP-M01-S1': { status: 'reservado', orderId: 'O1' }
  });
  let r = await generateTickets(fs, 'O1', pay);
  check('emite 1 boleto', r.boletos.length === 1, r);
  check('sin conflictos', r.conflictos.length === 0, r.conflictos);
  check('la silla queda vendida a O1', fs._store.get('asientos_nova/VIP-M01-S1').status === 'vendido', fs._store.get('asientos_nova/VIP-M01-S1'));

  // --- Caso 2: EL BUG. La reserva expiro y otra orden ya pago esa silla
  console.log('\nCASO 2  la silla ya se vendio a otra orden (el pago de OXXO llega tarde)');
  fs = makeFirestore({
    'ordenes/O2': { estado: 'pendiente', seats: ['VIP-M03-S2'], general: 0, vipa: 0, comprador: { mail: 'beto@x.com' } },
    'asientos_nova/VIP-M03-S2': { status: 'vendido', orderId: 'OTRA', folio: 'NSS-00007' }
  });
  r = await generateTickets(fs, 'O2', pay);
  check('NO emite boleto duplicado', r.boletos.length === 0, r.boletos);
  check('reporta el conflicto', r.conflictos.join() === 'VIP-M03-S2', r.conflictos);
  check('la silla sigue siendo del primero', fs._store.get('asientos_nova/VIP-M03-S2').orderId === 'OTRA', fs._store.get('asientos_nova/VIP-M03-S2'));
  check('la orden queda marcada para atender', fs._store.get('ordenes/O2').requiereAtencion === true, fs._store.get('ordenes/O2'));

  // --- Caso 3: compra mixta, una silla en conflicto y otra libre + generales
  console.log('\nCASO 3  compra mixta: 1 silla ocupada, 1 libre y 2 generales');
  fs = makeFirestore({
    'ordenes/O3': { estado: 'pendiente', seats: ['VIP-M01-S1', 'VIP-M02-S3'], general: 2, vipa: 0, comprador: { mail: 'cyn@x.com' } },
    'asientos_nova/VIP-M01-S1': { status: 'vendido', orderId: 'OTRA' },
    'asientos_nova/VIP-M02-S3': { status: 'reservado', orderId: 'O3' },
    'config/general': { vendidos: 10 }
  });
  r = await generateTickets(fs, 'O3', pay);
  check('emite 3 boletos (1 VIP + 2 general)', r.boletos.length === 3, r.boletos.map(b => b.label));
  check('solo 1 conflicto', r.conflictos.join() === 'VIP-M01-S1', r.conflictos);
  check('descuenta generales', fs._store.get('config/general').vendidos === 12, fs._store.get('config/general'));

  // --- Caso 4: el webhook llega dos veces (MP reintenta) -> no duplica
  console.log('\nCASO 4  webhook repetido sobre una orden ya pagada');
  fs = makeFirestore({ 'ordenes/O4': { estado: 'pagado', seats: ['VIP-M01-S1'], boletos: ['tok1'] } });
  r = await generateTickets(fs, 'O4', pay);
  check('no emite de nuevo', r === null, r);

  // --- Caso 5: cupo de General agotado
  console.log('\nCASO 5  General agotado');
  fs = makeFirestore({
    'ordenes/O5': { estado: 'pendiente', seats: [], general: 5, vipa: 0, comprador: {} },
    'config/general': { vendidos: 248 }
  });
  try { await generateTickets(fs, 'O5', pay); check('deberia rechazar', false, 'no lanzo error'); }
  catch (e) { check('rechaza por agotado', /agotado/.test(e.message), e.message); }

  console.log('\n' + (fails ? 'RESULTADO: ' + fails + ' FALLA(S)' : 'RESULTADO: todas las pruebas pasaron'));
  process.exit(fails ? 1 : 0);
})();
