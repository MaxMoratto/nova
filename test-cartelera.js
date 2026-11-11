// Comprueba que, sin pelea co-estelar, el panel se oculta y las dos caras de
// la derecha del banner salen de la pelea que sigue a la estelar.
const assert = require('assert');
const fs = require('fs');

const SIL_R = 'uploads/silueta-n1.webp', SIL_A = 'uploads/silueta-b1.webp';
const corner = (f, def) => ({ img: (f && f.fotos && f.fotos[0]) || def });

function vals(plist, caras) {
  const coest = plist.find(p => p.tipo === 'coestelar');
  const coDisp = coest ? 'flex' : 'none';
  const coBarDisp = coest ? 'block' : 'none';
  const principal = plist.find(p => p.tipo === 'principal');
  const me = { r: corner(principal && principal.rojo, SIL_R), a: corner(principal && principal.azul, SIL_A) };
  const cr_ = caras || {};
  const sigue = coest || plist.filter(p => p.tipo === 'cartelera').sort((a, b) => (b.orden || 0) - (a.orden || 0))[0];
  const sigR = corner(sigue && sigue.rojo, SIL_R), sigA = corner(sigue && sigue.azul, SIL_A);
  const bn = { er: cr_.er || me.r.img, ea: cr_.ea || me.a.img, cr: cr_.cr || sigR.img, ca: cr_.ca || sigA.img };
  return { coDisp, coBarDisp, bn };
}

const foto = n => ({ nombre: n, fotos: ['f/' + n + '.webp'] });
const cartel = [
  { tipo: 'principal', orden: '12', rojo: foto('villa'), azul: foto('dominguez') },
  { tipo: 'cartelera', orden: '11', rojo: foto('canul'), azul: foto('axel') },
  { tipo: 'cartelera', orden: '10', rojo: foto('valdez'), azul: foto('duarte') },
  { tipo: 'preliminar', orden: '1', rojo: foto('sanchez'), azul: foto('gerardo') }
];

// 1. Sin co-estelar: el panel no se dibuja.
let v = vals(cartel);
assert.strictEqual(v.coDisp, 'none');
assert.strictEqual(v.coBarDisp, 'none');

// 2. Las caras de la derecha son las de la pelea 11, no siluetas.
assert.strictEqual(v.bn.cr, 'f/canul.webp');
assert.strictEqual(v.bn.ca, 'f/axel.webp');
assert.strictEqual(v.bn.er, 'f/villa.webp');
assert.strictEqual(v.bn.ea, 'f/dominguez.webp');

// 3. La pelea 11 se elige por orden, aunque venga desordenada.
const revuelto = [cartel[2], cartel[3], cartel[0], cartel[1]];
assert.strictEqual(vals(revuelto).bn.cr, 'f/canul.webp');

// 4. Si vuelve la co-estelar, el panel reaparece y manda sobre la 11.
const conCo = cartel.concat([{ tipo: 'coestelar', orden: '11.5', rojo: foto('a'), azul: foto('b') }]);
let c = vals(conCo);
assert.strictEqual(c.coDisp, 'flex');
assert.strictEqual(c.coBarDisp, 'block');
assert.strictEqual(c.bn.cr, 'f/a.webp');

// 5. Las caras ya recortadas ganan sobre la foto completa.
assert.strictEqual(vals(cartel, { cr: 'recorte.webp' }).bn.cr, 'recorte.webp');

// 6. Sin peleas: siluetas y panel oculto, sin reventar.
let z = vals([]);
assert.strictEqual(z.coDisp, 'none');
assert.strictEqual(z.bn.cr, SIL_R);
assert.strictEqual(z.bn.ca, SIL_A);

// 7. Los contadores de arriba cuentan las peleas de verdad, no un numero fijo.
const cuenta = (plist) => {
  const n = plist.filter(p => p.activo !== false).length || 12;
  return { nPeleas: n, nPeleadores: n * 2 };
};
assert.deepStrictEqual(cuenta(cartel), { nPeleas: 4, nPeleadores: 8 });
assert.deepStrictEqual(cuenta(cartel.concat([{ tipo: 'cartelera', orden: '9' }])), { nPeleas: 5, nPeleadores: 10 });
assert.deepStrictEqual(cuenta(cartel.concat([{ tipo: 'cartelera', activo: false }])), { nPeleas: 4, nPeleadores: 8 });
// Mientras la base responde no debe verse un cero.
assert.strictEqual(cuenta([]).nPeleas, 12);

// 8. El sitio los pide a la plantilla y no los trae escritos a mano.
const sitio = fs.readFileSync('index.html', 'utf8');
assert.ok(sitio.includes('{{ nPeleas }}'), 'el contador de peleas volvio a quedar fijo');
assert.ok(sitio.includes('{{ nPeleadores }}'), 'el contador de peleadores volvio a quedar fijo');
assert.ok(/nPeleas = plist\.filter/.test(sitio), 'el contador no se saca de la cartelera');

// 9. Todo logo de patrocinador que el sitio nombra tiene que existir.
const logos = [...sitio.matchAll(/uploads\/logos\/([\w.-]+)/g)].map(m => 'uploads/logos/' + m[1]);
assert.ok(logos.length > 0, 'no hay logos en el sitio');
[...new Set(logos)].forEach(l => assert.ok(fs.existsSync(l), 'el sitio pide ' + l + ', que no existe'));

console.log('test-cartelera: 9 comprobaciones OK');
