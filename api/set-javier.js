// TEMPORAL: aplica el recorte limpio (sin fondo) de la esquina azul del main (Javier).
// Uso:  /api/set-javier?key=nova-javier-2026
// BORRAR este archivo al terminar.
const { db } = require('../lib/firebase');

module.exports = async (req, res) => {
  if ((req.query.key || '') !== 'nova-javier-2026') { res.status(403).send('no autorizado'); return; }
  let firestore;
  try { firestore = db(); } catch (e) { res.status(500).json({ error: 'Firebase: ' + e.message }); return; }
  const origin = req.headers.host ? `https://${req.headers.host}` : 'https://novastrikeseries.com';
  try {
    const r = await fetch(origin + '/uploads/cut-main-azul-javier.webp?v=3');
    if (!r.ok) throw new Error('No pude leer la imagen (' + r.status + ')');
    const buf = Buffer.from(await r.arrayBuffer());
    const dataUrl = 'data:image/webp;base64,' + buf.toString('base64');
    const snap = await firestore.collection('peleas').where('tipo', '==', 'principal').get();
    const ids = [];
    for (const doc of snap.docs) { await doc.ref.update({ 'azul.fotos': [dataUrl] }); ids.push(doc.id); }
    res.status(200).json({ ok: true, actualizadas: ids });
  } catch (e) { res.status(500).json({ error: e.message || String(e) }); }
};
