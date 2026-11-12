// Portada del video: la pelea estelar grande y la co-estelar abajo, armadas
// con las fotos que estan hoy en la cartelera. Si cambia la cartelera, se
// vuelve a correr y se rehace sola.
const sharp = require('sharp');
const fs = require('fs');

const W = 1280, H = 720;
const LOGOS = 'C:/Users/DELL/Documents/nova/uploads/logos/';
const ORO = '#D2AE6D', ROJO = '#FF0033';

// --- medir una silueta para recortarla por la cabeza ---
async function medir(f) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, a = (x, y) => data[(y * w + x) * 4 + 3];
  let y0 = h, y1 = 0, x0 = w, x1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a(x, y) > 40) {
    if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x;
  }
  const ancho = y => { let p = -1, q = -1; for (let x = 0; x < w; x++) if (a(x, y) > 40) { if (p < 0) p = x; q = x; } return p < 0 ? null : [p, q]; };
  const A = y1 - y0 + 1; let cab = Math.round(A * 0.18);
  for (let k = 8; k < 32; k++) {
    const y = y0 + Math.round(A * k / 100), ya = y0 + Math.round(A * (k - 1) / 100);
    const aq = ancho(y), an = ancho(ya);
    if (aq && an && (an[1] - an[0]) && (aq[1] - aq[0]) < (an[1] - an[0]) * 0.8) { cab = Math.round(A * k / 100); break; }
  }
  let c0 = w, c1 = -1;
  for (let y = y0; y < y0 + cab; y++) { const r = ancho(y); if (r) { if (r[0] < c0) c0 = r[0]; if (r[1] > c1) c1 = r[1]; } }
  return { w, h, y0, y1, cab, cx: (c0 + c1) / 2 };
}

// Cuerpo escalado por el alto de la cabeza, no por el de la figura: las fotos
// vienen con encuadres distintos y si se escalan por el cuerpo uno queda con
// la cabeza mas grande que el otro. La barbilla de los dos cae en la misma
// linea, para que se vean parejos.
async function cuerpo(f, altoCabeza, barbillaY, apagaY) {
  const m = await medir(f);
  const s = altoCabeza / m.cab;
  const nw = Math.round(m.w * s), nh = Math.round(m.h * s);
  const top = Math.round(barbillaY - (m.y0 + m.cab) * s);
  const b = await sharp(f).resize(nw, nh).modulate({ brightness: 0.92, saturation: 0.82 }).linear(1.08, -10)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = b;
  for (let y = 0; y < info.height; y++) {
    const yb = top + y;                                  // donde cae esa fila en la portada
    const k = yb > apagaY ? Math.max(0, 1 - 0.95 * (yb - apagaY) / (H - apagaY)) : 1;
    if (k >= 0.999) continue;
    for (let x = 0; x < info.width; x++) { const i = (y * info.width + x) * 4; data[i] *= k; data[i + 1] *= k; data[i + 2] *= k; }
  }
  // lo que se sale de la portada se recorta: sharp no pega algo mas grande
  let png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const cy = Math.max(0, -top), ch = Math.min(info.height - cy, H - Math.max(0, top));
  png = await sharp(png).extract({ left: 0, top: cy, width: info.width, height: ch }).png().toBuffer();
  return { buf: png, w: info.width, top: Math.max(0, top), cx: Math.round(m.cx * s) };
}

// Cara recortada en circulo, para la co-estelar.
async function cara(f, d) {
  const m = await medir(f);
  // La cabeza ocupa poco menos de la mitad del circulo y queda centrada: si se
  // acerca mas, el circulo le corta el pelo y se ve la frente plana.
  const alto = Math.round(m.cab / 0.46), ancho = alto;
  const top = Math.max(0, Math.round(m.y0 - (alto - m.cab) * 0.42));
  const left = Math.max(0, Math.min(Math.round(m.cx - ancho / 2), m.w - ancho));
  const ww = Math.min(ancho, m.w - left), hh = Math.min(alto, m.h - top);
  const rec = await sharp(f).extract({ left, top, width: ww, height: hh }).resize(d, d, { fit: 'cover' })
    .modulate({ brightness: 0.95, saturation: 0.8 }).png().toBuffer();
  const mascara = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + d + '" height="' + d + '"><circle cx="' + d / 2 + '" cy="' + d / 2 + '" r="' + (d / 2) + '" fill="#fff"/></svg>');
  const aro = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + d + '" height="' + d + '"><circle cx="' + d / 2 + '" cy="' + d / 2 + '" r="' + (d / 2 - 1) + '" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2"/></svg>');
  const cortado = await sharp(rec).composite([{ input: mascara, blend: 'dest-in' }]).png().toBuffer();
  return sharp(cortado).composite([{ input: aro }]).png().toBuffer();
}

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const apellido = n => { const p = String(n).trim().split(/\s+/); return (p.length > 1 ? p.slice(1).join(' ') : p[0]).toUpperCase(); };

(async () => {
  const datos = JSON.parse(fs.readFileSync('portada-datos.json', 'utf8'));

  // ---- fondo ----
  const fondo = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
    '<defs>' +
    '<radialGradient id="g" cx="50%" cy="118%" r="95%">' +
    '<stop offset="0%" stop-color="#2a0409"/><stop offset="42%" stop-color="#140309"/><stop offset="100%" stop-color="#050306"/>' +
    '</radialGradient>' +
    '<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity=".55"/><stop offset="35%" stop-color="#000" stop-opacity="0"/></linearGradient>' +
    '</defs>' +
    '<rect width="100%" height="100%" fill="url(#g)"/>' +
    '<g opacity=".07" stroke="#fff" stroke-width="2">' +
    Array.from({ length: 9 }, (_, i) => { const x = -300 + i * 210; return '<line x1="' + x + '" y1="' + H + '" x2="' + (x + H) + '" y2="0"/>'; }).join('') +
    '</g>' +
    '<rect width="100%" height="100%" fill="url(#v)"/>' +
    '</svg>');

  // ---- peleadores de la estelar ----
  const CABEZA = 120, BARBILLA = 222, APAGA = 470;
  const izq = await cuerpo(datos.estelar.rojoFoto, CABEZA, BARBILLA, APAGA);
  const der = await cuerpo(datos.estelar.azulFoto, CABEZA, BARBILLA, APAGA);
  const yIzq = izq.top, yDer = der.top;
  const xIzq = Math.round(150 - izq.cx), xDer = Math.round(W - 150 - der.cx);

  // ---- caras de la co-estelar ----
  const D = 104;
  const cIzq = await cara(datos.coestelar.rojoFoto, D);
  const cDer = await cara(datos.coestelar.azulFoto, D);

  // ---- logos ----
  const marca = await sharp(LOGOS + 'nssblanco.webp').resize({ height: 92 }).png().toBuffer();
  const mW = (await sharp(marca).metadata()).width;
  const patro = [];
  for (const n of datos.patrocinadores) {
    const b = await sharp(LOGOS + n).resize({ height: 38 }).png().toBuffer();
    patro.push({ buf: b, w: (await sharp(b).metadata()).width });
  }
  const sep = 46, anchoP = patro.reduce((s, p) => s + p.w, 0) + sep * (patro.length - 1);
  let px = Math.round((W - anchoP) / 2);
  const capaPatro = patro.map(p => { const o = { input: p.buf, left: px, top: H - 74 }; px += p.w + sep; return o; });

  // ---- esquinas rojas ----
  const cuna = (mx) => {
    const X = v => mx ? W - v : v;                      // mx = espejo a la derecha
    return '<polygon points="' + X(0) + ',0 ' + X(196) + ',0 ' + X(0) + ',196" fill="' + ROJO + '"/>' +
      '<polygon points="' + X(116) + ',0 ' + X(150) + ',0 ' + X(0) + ',150 ' + X(0) + ',116" fill="#07060a"/>';
  };
  const esquinas = cuna(false) + cuna(true);

  // ---- textos ----
  const A = apellido(datos.estelar.rojo), B = apellido(datos.estelar.azul);
  const anchoNom = t => Math.min(66, Math.floor(640 / (t.length * 0.62)));
  const fA = anchoNom(A), fB = anchoNom(B);
  const texto =
    esquinas +
    '<g font-family="Arial, Helvetica, sans-serif" text-anchor="middle">' +
    '<text x="' + (W / 2) + '" y="268" font-size="' + fA + '" font-weight="bold" letter-spacing="5" fill="#fff">' + esc(A) + '</text>' +
    '<text x="' + (W / 2) + '" y="312" font-size="26" font-weight="bold" letter-spacing="7" fill="' + ROJO + '">VS</text>' +
    '<text x="' + (W / 2) + '" y="374" font-size="' + fB + '" font-weight="bold" letter-spacing="5" fill="#fff">' + esc(B) + '</text>' +
    '<text x="' + (W / 2) + '" y="408" font-size="17" font-weight="bold" letter-spacing="6" fill="' + ORO + '">' + esc(datos.fecha) + '</text>' +
    '<line x1="' + (W / 2 - 215) + '" y1="432" x2="' + (W / 2 - 150) + '" y2="432" stroke="rgba(255,255,255,.22)" stroke-width="1"/>' +
    '<line x1="' + (W / 2 + 150) + '" y1="432" x2="' + (W / 2 + 215) + '" y2="432" stroke="rgba(255,255,255,.22)" stroke-width="1"/>' +
    '<text x="' + (W / 2) + '" y="437" font-size="12" font-weight="bold" letter-spacing="5" fill="rgba(255,255,255,.55)">CO-ESTELAR</text>' +
    '<text x="' + (W / 2) + '" y="590" font-size="22" font-weight="bold" letter-spacing="3" fill="#fff">' +
    esc(apellido(datos.coestelar.rojo)) + '<tspan fill="' + ROJO + '" dx="12" dy="0">VS</tspan><tspan fill="#fff" dx="12">' + esc(apellido(datos.coestelar.azul)) + '</tspan></text>' +
    '</g>';

  const salida = await sharp(fondo)
    .composite([
      { input: izq.buf, left: xIzq, top: yIzq },
      { input: der.buf, left: xDer, top: yDer },
      { input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' + texto + '</svg>') },
      { input: marca, left: Math.round((W - mW) / 2), top: 78 },
      { input: cIzq, left: Math.round(W / 2 - D - 26), top: 458 },
      { input: cDer, left: Math.round(W / 2 + 26), top: 458 },
      ...capaPatro
    ]).png().toBuffer();

  await sharp(salida).webp({ quality: 90 }).toFile('portada-nueva.webp');
  await sharp(salida).png().toFile('portada-nueva.png');
  console.log('portada lista:', A, 'vs', B, '| co-estelar', apellido(datos.coestelar.rojo), 'vs', apellido(datos.coestelar.azul));
})();
