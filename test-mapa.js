// Prueba del tamano de los asientos en el mapa.
// Nacio del 30-sep-2026: las sillas VIP de planta baja se dibujaban de 0.7 px
// y no se podian seleccionar. Cada planta tiene su propia escala, asi que el
// radio hay que juzgarlo contra la separacion entre asientos de ESA planta.
const fs = require('fs');
const html = fs.readFileSync('mapa-asientos.html', 'utf8');
const SEATS = JSON.parse(html.match(/const SEATS\s*=\s*(\[[\s\S]*?\]);/)[1]);
const FLOORS = JSON.parse(html.match(/const FLOORS = (\{[\s\S]*?\});/)[1]);

const MAPA_PX = 1000;   // ancho tipico del mapa en pantalla
const MIN_PX  = 5;      // un objetivo mas chico que esto no se puede picar

let fallas = 0;
for (const piso of Object.keys(FLOORS)) {
  const f = FLOORS[piso];
  const ancho = parseFloat(f.vb.split(' ')[2]);
  const pts = SEATS.filter(s => s.floor === piso);
  if (!pts.length) { console.log('  --   ' + piso + ' sin asientos'); continue; }

  let sep = Infinity;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      sep = Math.min(sep, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));

  const px = f.r / ancho * MAPA_PX;
  const chico = px < MIN_PX;
  const encimados = f.r > sep * 0.55;   // se tocarian entre si
  if (chico || encimados) fallas++;

  console.log((chico || encimados ? '  MAL  ' : '  OK   ') +
    (f.label + ':').padEnd(14) + pts.length + ' asientos, r=' + f.r +
    ' -> ' + px.toFixed(1) + ' px en pantalla' +
    (chico ? '   DEMASIADO CHICO, no se puede seleccionar' : '') +
    (encimados ? '   DEMASIADO GRANDE, los asientos se encimarian' : ''));
}
console.log('\n' + (fallas ? 'HAY FALLAS: ' + fallas : 'Los asientos de las dos plantas se pueden seleccionar.'));
process.exit(fallas ? 1 : 0);
