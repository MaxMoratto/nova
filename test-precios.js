// Prueba del cobro: el servidor debe cotizar TODAS las zonas.
// Nacio del error del 30-sep-2026: el mapa no armaba renglon para Preferente
// y Mercado Pago cobraba solo la comision.
const Module = require('module');
const orig = Module._load;
Module._load = function (req) {
  if (req === 'firebase-admin') return { apps: [], initializeApp() {}, credential: { cert() {} }, firestore() {} };
  return orig.apply(this, arguments);
};
const { cotizar } = require('./api/mercadopago.js');

const casos = [
  { que: '1 Preferente',              seats: ['PREF-B-18'],                  gen: 0, total: 782  },
  { que: '1 VIP asiento',             seats: ['VIPA-07'],                    gen: 0, total: 990  },
  { que: '1 VIP mesa',                seats: ['VIP-M13-S4'],                 gen: 0, total: 1563 },
  { que: '2 General',                 seats: [],                             gen: 2, total: 938  },
  { que: '1 Preferente + 1 General',  seats: ['PREF-A-01'],                  gen: 1, total: 1250 },
  { que: '3 Preferente',              seats: ['PREF-A-01','PREF-A-02','PREF-C-09'], gen: 0, total: 2345 },
];

let fallas = 0;
for (const c of casos) {
  const q = cotizar(c.seats, c.gen);
  const ok = q.total === c.total;
  if (!ok) fallas++;
  console.log((ok ? '  OK   ' : '  MAL  ') + c.que.padEnd(26) +
    'boletos $' + q.subtotal + ' + comision $' + q.comision + ' = $' + q.total +
    (ok ? '' : '   (se esperaba $' + c.total + ')'));
  // ninguna compra puede irse solo con la comision
  const soloComision = q.mpItems.length === 1 && /comisi/i.test(q.mpItems[0].title);
  if (soloComision) { console.log('       MAL: el cobro lleva solo la comision'); fallas++; }
}

const vacio = cotizar([], 0);
if (vacio.mpItems.length !== 0) { console.log('  MAL  carrito vacio deberia no cotizar nada'); fallas++; }
else console.log('  OK   carrito vacio no cotiza nada');

console.log('\n' + (fallas ? 'HAY FALLAS: ' + fallas : 'Todas las zonas cotizan completo.'));
process.exit(fallas ? 1 : 0);
