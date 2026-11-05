// El admin debe ofrecer exactamente las mesas y sillas que existen en el mapa.
const assert = require('assert');
const fs = require('fs');

const mapa = fs.readFileSync('mapa-asientos.html', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');

// 1. Lugares VIP de mesa que el mapa sabe vender.
const ids = [...new Set((mapa.match(/"VIP-M\d+-S\d+"/g) || []).map(x => x.slice(1, -1)))];
const mesas = new Set(), sillas = new Set();
ids.forEach(i => { const m = i.match(/^VIP-M(\d+)-S(\d+)$/); mesas.add(Number(m[1])); sillas.add(Number(m[2])); });
const maxMesa = Math.max(...mesas), maxSilla = Math.max(...sillas);
assert.ok(ids.length > 0, 'el mapa no tiene lugares VIP de mesa');

// 2. Numeracion continua, sin huecos.
for (let i = 1; i <= maxMesa; i++) assert.ok(mesas.has(i), 'falta la mesa ' + i + ' en el mapa');
for (let i = 1; i <= maxSilla; i++) assert.ok(sillas.has(i), 'falta la silla ' + i + ' en el mapa');
assert.strictEqual(ids.length, maxMesa * maxSilla, 'hay mesas con distinto numero de sillas');

// 3. El admin declara los mismos limites.
const dec = admin.match(/const VIP_MESAS=(\d+), VIP_SILLAS=(\d+);/);
assert.ok(dec, 'admin.html no declara VIP_MESAS/VIP_SILLAS');
assert.strictEqual(Number(dec[1]), maxMesa, 'el admin ofrece ' + dec[1] + ' mesas y el mapa tiene ' + maxMesa);
assert.strictEqual(Number(dec[2]), maxSilla, 'el admin ofrece ' + dec[2] + ' sillas y el mapa tiene ' + maxSilla);

// 4. El cupo VIP sale de esos limites, no de un numero escrito a mano.
assert.ok(/CAP=\{VIP:VIP_MESAS\*VIP_SILLAS/.test(admin), 'el cupo VIP no se calcula de las mesas');

// 5. Ningun limite viejo quedo suelto.
assert.ok(!/1 a 6\)/.test(admin), 'quedo un tope de 6 mesas en el admin');
assert.ok(!/1 a 5\)/.test(admin), 'quedo un tope de 5 sillas en el admin');

// 6. Preferente se cuenta en el tablero.
assert.ok(/sold\.VIP\+sold\.VIPA\+sold\.PREF\+sold\.GENERAL/.test(admin), 'Preferente no entra en los boletos vendidos');
assert.ok(/CAP\.PREF-occ\.PREF/.test(admin), 'Preferente no entra en la capacidad disponible');

console.log('test-vipmesa: ' + maxMesa + ' mesas x ' + maxSilla + ' sillas = ' + ids.length + ' lugares; 6 comprobaciones OK');
