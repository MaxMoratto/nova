// El mapa manda. Todo lo demas (admin, servidor, sitio) tiene que decir lo mismo.
const assert = require('assert');
const fs = require('fs');

const mapa  = fs.readFileSync('mapa-asientos.html', 'utf8');
const gen   = fs.readFileSync('build_map2.py', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');
const sitio = fs.readFileSync('index.html', 'utf8');
const mp    = fs.readFileSync('api/mercadopago.js', 'utf8');
const hook  = fs.readFileSync('api/mp-webhook.js', 'utf8');

// Lee "const NOMBRE={...}" sin regex, para no depender de escapes.
function objetoDe(txt, nombre) {
  const i = txt.indexOf('const ' + nombre);
  assert.ok(i >= 0, 'no encuentro ' + nombre);
  const a = txt.indexOf('{', i), b = txt.indexOf('}', a);
  return eval('(' + txt.slice(a, b + 1) + ')');
}
// Busca un numero exacto, para que 1500 no se confunda con 15000.
function tieneNumero(txt, antes, n) {
  const aguja = antes + n;
  for (let i = txt.indexOf(aguja); i >= 0; i = txt.indexOf(aguja, i + 1)) {
    const sig = txt[i + aguja.length];
    if (!(sig >= '0' && sig <= '9')) return true;
  }
  return false;
}

// ---- 1. Lo que el mapa vende de verdad ----
const SEATS = JSON.parse(mapa.match(/const SEATS = (\[[\s\S]*?\]);/)[1]);
const porZona = {}, porSec = {}, piso = {};
SEATS.forEach(s => {
  porZona[s.zone] = (porZona[s.zone] || 0) + 1;
  piso[s.zone] = piso[s.zone] || s.floor;
  assert.strictEqual(piso[s.zone], s.floor, 'la zona ' + s.zone + ' tiene asientos en dos pisos');
  if (s.sec) { porSec[s.zone] = porSec[s.zone] || {}; porSec[s.zone][s.sec] = (porSec[s.zone][s.sec] || 0) + 1; }
});
const ids = new Set(SEATS.map(s => s.id));
assert.strictEqual(ids.size, SEATS.length, 'hay asientos repetidos en el mapa');

const mesas = new Set(SEATS.filter(s => s.zone === 'VIP').map(s => s.mesa));
const sillas = new Set(SEATS.filter(s => s.zone === 'VIP').map(s => s.silla));
const maxMesa = Math.max(...mesas), maxSilla = Math.max(...sillas);
assert.strictEqual(mesas.size, maxMesa, 'la numeracion de mesas tiene huecos');
assert.strictEqual(sillas.size, maxSilla, 'la numeracion de sillas tiene huecos');

// ---- 2. El generador y el mapa no se separaron ----
['ZFLOOR', 'ZONES = {', 'function seatLabel', 'function focusZone'].forEach(trozo => {
  assert.ok(gen.includes(trozo), 'falta "' + trozo + '" en build_map2.py');
  assert.ok(mapa.includes(trozo), 'falta "' + trozo + '" en mapa-asientos.html');
});

// ---- 3. Cada zona lleva al piso donde estan sus asientos ----
assert.ok(mapa.includes('const ZFLOOR=(function()'), 'ZFLOOR sigue escrito a mano en el mapa');
assert.ok(gen.includes('const ZFLOOR=(function()'), 'ZFLOOR sigue escrito a mano en el generador');
const ZFLOOR = { GENERAL: 'PB' };
SEATS.forEach(s => { if (!ZFLOOR[s.zone]) ZFLOOR[s.zone] = s.floor; });
Object.keys(porZona).forEach(z => {
  assert.strictEqual(ZFLOOR[z], piso[z], 'la zona ' + z + ' manda al piso equivocado');
  assert.ok(SEATS.some(s => s.zone === z && s.floor === ZFLOOR[z]),
    'la zona ' + z + ' no tiene ni un asiento en el piso al que lleva');
});

// ---- 4. El mismo precio en el mapa, el admin, el servidor y el webhook ----
const precios = {};
mapa.match(/(VIP|VIPA|PREF|GENERAL):\s*\{[^}]*price:(\d+)/g).forEach(m => {
  const p = m.match(/^(\w+):[\s\S]*price:(\d+)/); precios[p[1]] = Number(p[2]);
});
const dAdmin = objetoDe(admin, 'PRECIO=');
const dMp = objetoDe(mp, 'PRECIOS =');
['VIP', 'VIPA', 'PREF', 'GENERAL'].forEach(z => {
  assert.ok(precios[z] > 0, 'el mapa no le pone precio a ' + z);
  assert.strictEqual(dAdmin[z], precios[z], z + ': el admin cobra ' + dAdmin[z] + ' y el mapa ' + precios[z]);
  assert.strictEqual(dMp[z], precios[z], z + ': Mercado Pago cobra ' + dMp[z] + ' y el mapa ' + precios[z]);
  assert.ok(tieneNumero(hook, 'precio: ', precios[z]), 'el webhook no usa ' + precios[z] + ' para ' + z);
});

// ---- 5. El cupo del admin es el del mapa ----
const dec = admin.match(/const VIP_MESAS=(\d+), VIP_SILLAS=(\d+);/);
assert.ok(dec, 'el admin no declara VIP_MESAS/VIP_SILLAS');
assert.strictEqual(Number(dec[1]), maxMesa, 'el admin ofrece ' + dec[1] + ' mesas y el mapa tiene ' + maxMesa);
assert.strictEqual(Number(dec[2]), maxSilla, 'el admin ofrece ' + dec[2] + ' sillas por mesa y el mapa tiene ' + maxSilla);
const capTxt = admin.match(/const CAP=(\{[^}]*\})/)[1].replace('VIP_MESAS*VIP_SILLAS', String(maxMesa * maxSilla));
const cap = eval('(' + capTxt + ')');
['VIP', 'VIPA', 'PREF'].forEach(z => assert.strictEqual(cap[z], porZona[z],
  z + ': el admin cree que hay ' + cap[z] + ' lugares y el mapa tiene ' + porZona[z]));
const totalGen = Number(mapa.match(/GENERAL:[^}]*total:(\d+)/)[1]);
assert.strictEqual(cap.GENERAL, totalGen, 'General: el admin dice ' + cap.GENERAL + ' y el mapa ' + totalGen);

// ---- 6. Las secciones del admin son las del mapa ----
[['VIPA_MAX=', 'VIPA'], ['PREF_MAX=', 'PREF']].forEach(([cte, zona]) => {
  const m = objetoDe(admin, cte);
  assert.deepStrictEqual(Object.keys(m).sort(), Object.keys(porSec[zona]).sort(),
    'las secciones de ' + zona + ' no coinciden');
  Object.keys(m).forEach(sec => assert.strictEqual(m[sec], porSec[zona][sec],
    zona + ' seccion ' + sec + ': el admin ofrece ' + m[sec] + ' y el mapa tiene ' + porSec[zona][sec]));
});

// ---- 7. Todo lugar que el admin puede emitir existe en el mapa ----
const pad2 = n => String(n).padStart(2, '0');
for (let m = 1; m <= maxMesa; m++) for (let s = 1; s <= maxSilla; s++)
  assert.ok(ids.has('VIP-M' + pad2(m) + '-S' + s),
    'el admin puede vender VIP-M' + pad2(m) + '-S' + s + ', que no existe en el mapa');
[['VIPA_MAX=', 'VIPA'], ['PREF_MAX=', 'PREF']].forEach(([cte, zona]) => {
  const lim = objetoDe(admin, cte);
  Object.keys(lim).forEach(sec => { for (let n = 1; n <= lim[sec]; n++)
    assert.ok(ids.has(zona + '-' + sec + '-' + pad2(n)),
      'el admin puede vender ' + zona + '-' + sec + '-' + pad2(n) + ', que no existe en el mapa'); });
});

// ---- 8. El punto de venta ofrece las cuatro zonas ----
['VIP', 'VIPA', 'PREF', 'GENERAL'].forEach(z =>
  assert.ok(admin.includes('<option value="' + z + '"'), 'falta ' + z + ' en el selector del punto de venta'));

// ---- 9. El webhook entiende los ids que el mapa produce ----
['VIP-M', 'VIPA-', 'PREF-'].forEach(p => assert.ok(hook.includes(p), 'el webhook no reconoce los lugares ' + p));
assert.ok(mp.includes('PREF') && mp.includes('VIPA'), 'el servidor de pagos no cotiza todas las zonas');

// ---- 10. Los precios que ve el comprador en el sitio ----
const money = n => '$' + n.toLocaleString('en-US');
[['GENERAL', true], ['PREF', true], ['VIP', true], ['VIPA', false]].forEach(([z, enTarjeta]) => {
  const txt = enTarjeta ? ("price: '" + money(precios[z]) + "'") : money(precios[z]);
  assert.ok(sitio.includes(txt), 'el sitio no anuncia ' + z + ' a ' + money(precios[z]));
});

const resumen = Object.keys(porZona).sort().map(z => z + ' ' + porZona[z] + ' (' + piso[z] + ')').join(' | ');
console.log('test-coincide: ' + resumen + ' | GENERAL ' + totalGen + ' (sin lugar) -- 10 bloques OK');
