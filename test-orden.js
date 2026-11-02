// Prueba del orden de la cartelera.
// La pelea 1 es la primera de la noche y la ultima (la mayor) es la estelar.
// La pagina se lee al reves: estelar arriba, primera pelea hasta abajo.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Se saca el criterio de orden del propio index.html, para que la prueba falle
// si alguien lo cambia ahi.
const linea = html.split(String.fromCharCode(10)).find(l => l.includes("p.tipo === 'preliminar'") && l.includes('.sort('));
if (!linea) { console.log('No encontre el orden de la cartelera en index.html'); process.exit(1); }
const desde = linea.indexOf('.sort(') + '.sort('.length;
const hasta = linea.lastIndexOf(');');
const criterio = eval('(' + linea.slice(desde, hasta) + ')');

const peleas = [
  { tipo:'preliminar', orden:6 }, { tipo:'preliminar', orden:4 }, { tipo:'preliminar', orden:2 },
  { tipo:'preliminar', orden:3 }, { tipo:'preliminar', orden:5 }, { tipo:'preliminar', orden:1 },
  { tipo:'preliminar', orden:7 },
];
const salida = peleas.slice().sort(criterio).map(p => p.orden);
const esperado = [7, 6, 5, 4, 3, 2, 1];

let fallas = 0;
const ok = JSON.stringify(salida) === JSON.stringify(esperado);
if (!ok) fallas++;
console.log((ok ? '  OK   ' : '  MAL  ') + 'Prospects se listan ' + salida.join(', ') +
  (ok ? '  (la ultima arriba, la primera abajo)' : '  — se esperaba ' + esperado.join(', ')));

// Una pelea sin numero no debe colarse arriba de las demas
const conHueco = [{tipo:'preliminar',orden:3},{tipo:'preliminar'},{tipo:'preliminar',orden:1}];
const s2 = conHueco.slice().sort(criterio).map(p => p.orden == null ? 'sin numero' : p.orden);
const ok2 = s2[s2.length - 1] === 'sin numero';
if (!ok2) fallas++;
console.log((ok2 ? '  OK   ' : '  MAL  ') + 'Una pelea sin numero se va al final: ' + s2.join(', '));

console.log('\n' + (fallas ? 'HAY FALLAS: ' + fallas : 'La cartelera se lee de la estelar hacia la primera pelea.'));
process.exit(fallas ? 1 : 0);
