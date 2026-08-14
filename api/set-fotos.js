// TEMPORAL: reemplaza las fotos (con fondo) de las peleas por las versiones sin fondo (webp transparente).
// Uso:  /api/set-fotos?key=nova-fotos-2026
// Firebase Admin ignora las reglas, por eso puede escribir sin login.
// BORRAR este archivo al terminar.
const { db } = require('../lib/firebase');

const MAP = {
  principal: {
    rojo: 'uploads/cut-main-rojo-fabian.webp',
    azul: 'uploads/cut-main-azul-javier.webp'
  },
  coestelar: {
    rojo: 'uploads/cut-coest-rojo-saul.webp',
    azul: 'uploads/cut-coest-azul-oscar.webp'
  }
};

async function toDataUrl(origin, path) {
  const r = await fetch(origin + '/' + path);
  if (!r.ok) throw new Error('No pude leer ' + path + ' (' + r.status + ')');
  const buf = Buffer.from(await r.arrayBuffer());
  return 'data:image/webp;base64,' + buf.toString('base64');
}

module.exports = async (req, res) => {
  if ((req.query.key || '') !== 'nova-fotos-2026') { res.status(403).send('no autorizado'); return; }
  let firestore;
  try { firestore = db(); } catch (e) { res.status(500).json({ error: 'Firebase: ' + e.message }); return; }

  const origin = req.headers.host ? `https://${req.headers.host}` : 'https://novastrikeseries.com';
  const done = [];
  try {
    const snap = await firestore.collection('peleas').get();
    for (const doc of snap.docs) {
      const tipo = (doc.data().tipo || '').toLowerCase();
      const m = MAP[tipo];
      if (!m) continue;
      const upd = {};
      upd['rojo.fotos'] = [await toDataUrl(origin, m.rojo)];
      upd['azul.fotos'] = [await toDataUrl(origin, m.azul)];
      await doc.ref.update(upd);
      done.push({ id: doc.id, tipo });
    }
    res.status(200).json({ ok: true, actualizadas: done });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e), done });
  }
};
