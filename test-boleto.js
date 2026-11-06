// El arte del boleto no reserva lugar para el QR ni para los datos: las
// posiciones estan medidas a mano sobre las plantillas. Si alguien cambia una
// medida o el arte, esto avisa antes de que salga un boleto con el QR encima
// de un peleador o un numero fuera de su columna.
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('boleto.html', 'utf8');

// --- Medidas de las plantillas de noviembre 2026, en fraccion del boleto ---
const W = 1400, H = 2488;
const SEP_IZQ = 555 / W, SEP_DER = 869 / W;   // separadores de las tres columnas
const CAJA_IZQ = 287 / W, CAJA_DER = 1179 / W; // orillas del recuadro de datos
const LIMPIO_IZQ = 577 / W, LIMPIO_DER = 896 / W; // franja despejada entre los peleadores
const CAJA_ARRIBA = 1218 / H, CAJA_ABAJO = 1452 / H;
const PATROCINA = 2318 / H;                    // arriba de la barra de patrocinadores

const num = n => { const m = html.match(new RegExp(n + '\\s*=\\s*(\\.\\d+)')); assert.ok(m, 'no encuentro ' + n); return Number(m[1]); };
const QR = (() => {
  const m = html.match(/const QR3 = \{([^}]*)\}/); assert.ok(m, 'no encuentro QR3');
  const g = k => Number(m[1].match(new RegExp(k + ':(\\.?\\d+(\\.\\d+)?)'))[1]);
  return { x: g('x'), y: g('y'), w: g('w'), h: g('h') };
})();
const FOLIO = (() => {
  const m = html.match(/const FOLIO3 = \{([^}]*)\}/); assert.ok(m, 'no encuentro FOLIO3');
  const g = k => Number(m[1].match(new RegExp(k + ':(\\.?\\d+(\\.\\d+)?)'))[1]);
  return { x: g('x'), y: g('y'), f: g('f') };
})();
const COL_MEDIO = num('COL_MEDIO'), COL_DER = num('COL_DER');
const FILA = num('FILA_DATOS'), TAM = num('TAM_DATO');

// ---- 1. El recuadro del QR cae en la franja despejada ----
assert.ok(QR.x >= LIMPIO_IZQ, 'el QR se mete en el peleador de la izquierda');
assert.ok(QR.x + QR.w <= LIMPIO_DER, 'el QR se mete en el peleador de la derecha');
assert.ok(QR.y > CAJA_ABAJO, 'el QR se encima con el recuadro de PISO/MESA/ASIENTO');
assert.ok(QR.y + QR.h < PATROCINA, 'el QR se encima con los patrocinadores');
assert.ok(QR.w * W >= 260, 'el QR quedaria muy chico para escanearse: ' + Math.round(QR.w * W) + ' px');

// ---- 2. El folio y el nombre van debajo del QR y antes de los patrocinadores ----
assert.ok(FOLIO.y > QR.y + QR.h, 'el folio se encima con el QR');
assert.ok(FOLIO.y < PATROCINA, 'el folio cae sobre los patrocinadores');
assert.ok(Math.abs(FOLIO.x - (QR.x + QR.w / 2)) < 0.01, 'el folio no esta centrado bajo el QR');
const titular = html.match(/fillText\(String\(d\.titular\)/);
assert.ok(titular, 'ya no se dibuja el nombre del titular');
assert.ok(/const cx = FOLIO3\.x\*W/.test(html), 'el titular no sigue la columna despejada');

// ---- 3. Cada dato cae dentro de su columna ----
assert.ok(COL_MEDIO > SEP_IZQ && COL_MEDIO < SEP_DER, 'el valor de MESA se sale de su columna');
assert.ok(COL_DER > SEP_DER && COL_DER < CAJA_DER, 'el valor de ASIENTO se sale de su columna');
assert.ok(FILA > CAJA_ARRIBA && FILA < CAJA_ABAJO, 'la fila de valores cae fuera del recuadro');
// el texto no debe desbordar su columna: media palabra a cada lado del centro
const anchoCol = (SEP_DER - SEP_IZQ) * W;
assert.ok(TAM * H < anchoCol * 0.6, 'la letra del dato es demasiado grande para la columna');

// ---- 4. Cada zona dibuja lo que le toca ----
const bloque = t => { const m = html.match(new RegExp(t + ':\\s*\\{[\\s\\S]*?fields:\\[([\\s\\S]*?)\\]')); return m ? m[1] : (html.match(new RegExp(t + ':\\s*\\{[^}]*fields:\\[\\]')) ? '' : null); };
const campos = t => { const b = bloque(t); assert.notStrictEqual(b, null, 'no encuentro la zona ' + t); return (b.match(/t:'(\w+)'/g) || []).map(s => s.slice(3, -1)); };
assert.deepStrictEqual(campos('VIP'), ['mesa', 'asiento'], 'VIP mesa debe imprimir mesa y asiento');
// VIP asiento y Preferente tienen mesa, pero sin numerar: el lugar va completo
// bajo ASIENTO y la columna MESA se queda vacia.
assert.deepStrictEqual(campos('VIPA'), ['lugar'], 'VIP asiento debe imprimir solo el lugar');
assert.deepStrictEqual(campos('PREF'), ['lugar'], 'Preferente debe imprimir solo el lugar');
assert.deepStrictEqual(campos('GENERAL'), [], 'General no lleva lugar asignado');
assert.ok(/f\.t==='lugar'[\s\S]{0,120}d\.sec/.test(html), "el campo 'lugar' no arma seccion y numero");

// ---- 5. Las cuatro plantillas existen y miden lo mismo ----
const artes = [...html.matchAll(/img:'(uploads\/[^']+)'/g)].map(m => m[1]);
assert.strictEqual(artes.length, 4, 'esperaba cuatro plantillas, hay ' + artes.length);
assert.strictEqual(new Set(artes).size, 4, 'hay plantillas repetidas entre las zonas');
for (const a of artes) {
  assert.ok(fs.existsSync(a), 'falta la plantilla ' + a);
  assert.ok(fs.statSync(a).size > 80000, 'la plantilla ' + a + ' se ve demasiado chica');
}

console.log('test-boleto: QR ' + Math.round(QR.w * W) + 'px en la franja limpia, datos dentro de sus columnas, 4 plantillas OK');
