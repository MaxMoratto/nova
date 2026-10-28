// Pone el nombre de quien va a usar el boleto. Lo escribe el propio comprador
// desde la pagina de su boleto, y SOLO UNA VEZ: una vez guardado ya no se puede
// cambiar desde fuera, para que un boleto revendido no se pueda poner a nombre
// del comprador nuevo. Si hay una errata, se corrige desde el admin.
//
// Tener el token ya es tener el boleto, asi que el token es toda la credencial
// que se pide aqui. Lo que si se valida es que el boleto exista, siga valido y
// no tenga nombre todavia.
const { db } = require('../lib/firebase');

const LARGO_MAX = 40;

// Deja solo lo que cabe en un nombre: letras (con acentos), espacios, apostrofes
// y guiones. Fuera etiquetas, saltos de linea y caracteres de control.
function limpiarNombre(v) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LARGO_MAX);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  let firestore;
  try { firestore = db(); }
  catch (e) { return res.status(500).json({ error: 'Firebase: ' + e.message }); }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const token = String(body.token || '').trim();
    const nombre = limpiarNombre(body.nombre);

    if (!/^[0-9a-f]{32}$/.test(token)) return res.status(400).json({ error: 'Boleto no válido.' });
    if (nombre.length < 3) return res.status(400).json({ error: 'Escribe el nombre completo.' });

    const ref = firestore.collection('boletos').doc(token);

    // En transaccion: si entre la lectura y la escritura alguien mas lo nombra,
    // gana el primero y este intento se entera.
    const resultado = await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { error: 'Este boleto no existe.', code: 404 };
      const d = snap.data() || {};
      if (d.estado === 'cancelado') return { error: 'Este boleto está cancelado.', code: 400 };
      if (d.estado === 'usado') return { error: 'Este boleto ya se usó en la entrada.', code: 400 };
      if (d.titular) return { error: 'Este boleto ya está a nombre de ' + d.titular + '.', code: 409, titular: d.titular };
      tx.update(ref, { titular: nombre, titularAt: Date.now() });
      return { titular: nombre };
    });

    if (resultado.error) return res.status(resultado.code).json(resultado);
    return res.status(200).json({ ok: true, titular: resultado.titular });
  } catch (e) {
    console.error('TITULAR_ERR', e && (e.message || e));
    return res.status(500).json({ error: 'No se pudo guardar: ' + (e && (e.message || e)) });
  }
};

module.exports.limpiarNombre = limpiarNombre;
