// Vercel Serverless Function — Webhook de Mercado Pago.
// MP la llama cuando cambia un pago. Verificamos el pago contra la API de MP
// y, si está aprobado, generamos los boletos (folio+token+QR) e idempotentemente
// marcamos asientos vendidos / descontamos General.
// Requiere: MP_ACCESS_TOKEN y FIREBASE_SERVICE_ACCOUNT en Vercel.
const crypto = require('crypto');
const { db } = require('../lib/firebase');

const randToken = () => crypto.randomBytes(16).toString('hex');
const fmtFolio = (n) => 'NSS-' + String(n).padStart(5, '0');
const safeJson = (s) => { try { return JSON.parse(s); } catch (_) { return {}; } };

async function releaseOrder(firestore, orderId) {
  const orderRef = firestore.collection('ordenes').doc(orderId);
  const oSnap = await orderRef.get();
  if (!oSnap.exists) return;
  const o = oSnap.data();
  if (o.estado === 'pagado') return;
  const batch = firestore.batch();
  for (const seatId of (o.seats || [])) {
    const sRef = firestore.collection('asientos_nova').doc(seatId);
    const sSnap = await sRef.get(); const sd = sSnap.data();
    if (sd && sd.status === 'reservado' && sd.orderId === orderId) batch.delete(sRef);
  }
  batch.update(orderRef, { estado: 'cancelado' });
  await batch.commit();
}

async function generateTickets(firestore, orderId, pay) {
  await firestore.runTransaction(async (tx) => {
    const orderRef = firestore.collection('ordenes').doc(orderId);
    const foliosRef = firestore.collection('config').doc('folios');
    const genRef = firestore.collection('config').doc('general');
    const [oSnap, fSnap, gSnap] = await Promise.all([tx.get(orderRef), tx.get(foliosRef), tx.get(genRef)]);
    if (!oSnap.exists) throw new Error('orden no existe');
    const o = oSnap.data();
    if (o.estado === 'pagado') return; // idempotente: no duplica boletos
    const vipSeats = o.seats || [];
    const genQty = o.general || 0;
    let n = (fSnap.exists && fSnap.data().n) || 0;
    const vend = (gSnap.exists && gSnap.data().vendidos) || 0;
    if (vend + genQty > 250) throw new Error('General agotado');
    const comprador = o.comprador || {};
    const meta = { comprador, estado: 'valido', canal: 'mp', cortesia: false, emitidoAt: Date.now(), evento: 'NOVA-11SEP2026', orden: orderId, pagoId: String(pay.id) };
    const tokens = [];
    for (const seatId of vipSeats) {
      const m = seatId.match(/VIP-M(\d+)-S(\d+)/);
      const mesa = m ? parseInt(m[1], 10) : null;
      const asiento = m ? parseInt(m[2], 10) : null;
      n++; const folio = fmtFolio(n); const tok = randToken();
      tx.set(firestore.collection('boletos').doc(tok), Object.assign({ tipo: 'VIP', mesa, asiento, folio, precio: 850 }, meta));
      tx.set(firestore.collection('asientos_nova').doc(seatId), { status: 'vendido', ts: Date.now(), orderId, folio }, { merge: true });
      tokens.push(tok);
    }
    for (let i = 0; i < genQty; i++) {
      n++; const folio = fmtFolio(n); const tok = randToken();
      tx.set(firestore.collection('boletos').doc(tok), Object.assign({ tipo: 'GENERAL', folio, precio: 450 }, meta));
      tokens.push(tok);
    }
    tx.set(foliosRef, { n }, { merge: true });
    if (genQty > 0) tx.set(genRef, { vendidos: vend + genQty }, { merge: true });
    tx.update(orderRef, { estado: 'pagado', boletos: tokens, pagoId: String(pay.id), pagadoAt: Date.now() });
  });
}

module.exports = async (req, res) => {
  const token = process.env.MP_ACCESS_TOKEN;
  try {
    if (!token) { res.status(200).send('sin token'); return; }
    const q = req.query || {};
    const b = (typeof req.body === 'string' ? safeJson(req.body) : req.body) || {};
    const type = q.type || q.topic || b.type || b.topic;
    const paymentId = q['data.id'] || q.id || (b.data && b.data.id) || b.id;
    if (type && String(type) !== 'payment') { res.status(200).send('ignorado'); return; }
    if (!paymentId) { res.status(200).send('sin id'); return; }

    const pr = await fetch('https://api.mercadopago.com/v1/payments/' + paymentId, { headers: { Authorization: 'Bearer ' + token } });
    const pay = await pr.json();
    if (!pr.ok) { res.status(200).send('pago no encontrado'); return; }
    const orderId = pay.external_reference;
    if (!orderId) { res.status(200).send('sin orden'); return; }

    const firestore = db();
    if (pay.status === 'approved') {
      await generateTickets(firestore, orderId, pay);
      res.status(200).send('ok');
    } else if (pay.status === 'rejected' || pay.status === 'cancelled') {
      await releaseOrder(firestore, orderId);
      res.status(200).send('liberado');
    } else {
      res.status(200).send('pendiente');
    }
  } catch (e) {
    res.status(500).send('error: ' + (e.message || e)); // 500 => MP reintenta
  }
};
