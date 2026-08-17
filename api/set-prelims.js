// TEMPORAL: reemplaza las fotos (con fondo) de las peleas PRELIMINARES por sus recortes sin fondo.
// Uso:  /api/set-prelims?key=nova-prelims-2026
// Busca archivos uploads/cutp-<docId>-r.webp y -a.webp; si existen, actualiza esa esquina.
// BORRAR este archivo al terminar.
const { db } = require('../lib/firebase');

async function toDataUrl(origin, path) {
  const r = await fetch(origin + '/' + path);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return 'data:image/webp;base64,' + buf.toString('base64');
}

module.exports = async (req, res) => {
  if ((req.query.key || '') !== 'nova-prelims-2026') { res.status(403).send('no autorizado'); return; }
  let firestore;
  try { firestore = db(); } catch (e) { res.status(500).json({ error: 'Firebase: ' + e.message }); return; }
  const origin = req.headers.host ? `https://${req.headers.host}` : 'https://novastrikeseries.com';
  const done = [];
  try {
    const snap = await firestore.collection('peleas').get();
    for (const doc of snap.docs) {
      const tipo = (doc.data().tipo || '').toLowerCase();
      if (tipo.indexOf('prelim') < 0) continue;
      const upd = {};
      const rr = await toDataUrl(origin, 'uploads/cutp-' + doc.id + '-r.webp');
      const aa = await toDataUrl(origin, 'uploads/cutp-' + doc.id + '-a.webp');
      if (rr) upd['rojo.fotos'] = [rr];
      if (aa) upd['azul.fotos'] = [aa];
      if (Object.keys(upd).length) { await doc.ref.update(upd); done.push({ id: doc.id, rojo: !!rr, azul: !!aa }); }
    }
    res.status(200).json({ ok: true, actualizadas: done });
  } catch (e) { res.status(500).json({ error: e.message || String(e), done }); }
};
