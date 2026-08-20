// TEMPORAL: borra los boletos en estado "cancelado". No toca los vendidos/validos.
// Uso:  /api/clean-cancelled?key=nova-clean-2026
// BORRAR este archivo al terminar.
const { db } = require('../lib/firebase');

module.exports = async (req, res) => {
  if ((req.query.key || '') !== 'nova-clean-2026') { res.status(403).send('no autorizado'); return; }
  let firestore;
  try { firestore = db(); } catch (e) { res.status(500).json({ error: 'Firebase: ' + e.message }); return; }
  try {
    const snap = await firestore.collection('boletos').where('estado', '==', 'cancelado').get();
    const folios = [];
    let batch = firestore.batch(); let n = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref); folios.push(doc.data().folio || doc.id); n++;
      if (n % 400 === 0) { await batch.commit(); batch = firestore.batch(); }
    }
    if (n % 400 !== 0) await batch.commit();
    res.status(200).json({ ok: true, borrados: folios.length, folios });
  } catch (e) { res.status(500).json({ error: e.message || String(e) }); }
};
