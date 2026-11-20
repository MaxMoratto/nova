// Revisa que el JavaScript de cada pagina compile, INCLUIDO el bloque
// <script type="text/x-dc"> del sitio. Ese bloque es el que arma la portada,
// la cartelera y el contador: si trae un error de sintaxis, el navegador no
// avisa en pantalla, simplemente deja todos los datos en blanco. Paso justo
// eso el 20-nov-2026 por un corchete de menos, y el sitio estuvo roto en vivo.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const PAGINAS = ['index.html', 'admin.html', 'mapa-asientos.html', 'boleto.html'];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nss-'));

function bloques(html) {
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\ssrc\s*=/.test(attrs)) continue;            // viene de fuera
    if (/type\s*=\s*["'](?!text\/x-dc)/.test(attrs)) continue;  // json, plantillas y demas
    out.push({ attrs: attrs.trim(), code: m[2] });
  }
  return out;
}

let total = 0, conXdc = 0;
for (const pag of PAGINAS) {
  assert.ok(fs.existsSync(pag), 'falta la pagina ' + pag);
  const html = fs.readFileSync(pag, 'utf8');
  const bs = bloques(html);
  assert.ok(bs.length > 0, pag + ' no tiene ni un bloque de codigo');
  bs.forEach((b, i) => {
    const f = path.join(tmp, pag.replace(/\W/g, '_') + '-' + i + '.js');
    fs.writeFileSync(f, b.code);
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (e) {
      const salida = String(e.stderr || e.stdout || e.message);
      const linea = (salida.match(/-\d+\.js:(\d+)/) || [])[1];
      const motivo = (salida.match(/SyntaxError: .*/) || ['SyntaxError'])[0];
      assert.fail(pag + ', bloque ' + (i + 1) + (linea ? ' (linea ' + linea + ' del bloque)' : '') + ': ' + motivo);
    }
    total++;
    if (/text\/x-dc/.test(b.attrs)) conXdc++;
  });
  // Las etiquetas tienen que cerrar: un <div> suelto descuadra media pagina.
  const abre = (html.match(/<div\b/g) || []).length, cierra = (html.match(/<\/div>/g) || []).length;
  assert.strictEqual(abre, cierra, pag + ': hay ' + abre + ' <div> y ' + cierra + ' </div>');
}

// El sitio depende del bloque x-dc: si deja de existir, algo se movio de lugar
// y esta prueba ya no esta revisando lo que cree revisar.
assert.ok(conXdc >= 1, 'no encontre ningun bloque <script type="text/x-dc">; la prueba ya no cubre la logica del sitio');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('test-paginas: ' + total + ' bloques de codigo compilan (' + conXdc + ' de ellos x-dc) y las etiquetas cierran');
