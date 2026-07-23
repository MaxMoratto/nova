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

// Precio y datos del boleto derivados del id del asiento (autoridad del servidor).
function seatInfo(seatId) {
  let m;
  if ((m = seatId.match(/^VIP-M(\d+)-S(\d+)$/)))
    return { tipo: 'VIP', mesa: +m[1], asiento: +m[2], precio: 850, label: 'VIP Mesa ' + (+m[1]) + ' · Silla ' + (+m[2]) };
  if ((m = seatId.match(/^VIPA-(\d+)$/)))
    return { tipo: 'VIPA', asiento: +m[1], precio: 850, label: 'VIP Asiento ' + (+m[1]) };
  if ((m = seatId.match(/^PREF-([ABC])-(\d+)$/)))
    return { tipo: 'PREF', sec: m[1], num: +m[2], precio: 650, label: 'Preferente ' + m[1] + '-' + String(+m[2]).padStart(2, '0') };
  return { tipo: 'OTRO', precio: 0, label: seatId };
}

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
    const seats = o.seats || [];
    const genQty = o.general || 0;
    let n = (fSnap.exists && fSnap.data().n) || 0;
    const vend = (gSnap.exists && gSnap.data().vendidos) || 0;
    if (vend + genQty > 250) throw new Error('General agotado');
    const comprador = o.comprador || {};
    const meta = { comprador, estado: 'valido', canal: 'mp', cortesia: false, emitidoAt: Date.now(), evento: 'NOVA-11SEP2026', orden: orderId, pagoId: String(pay.id) };
    const tokens = [];
    for (const seatId of seats) {
      const inf = seatInfo(seatId);
      n++; const folio = fmtFolio(n); const tok = randToken();
      const boleto = { tipo: inf.tipo, folio, precio: inf.precio, asientoId: seatId, label: inf.label };
      if (inf.mesa != null) boleto.mesa = inf.mesa;
      if (inf.asiento != null) boleto.asiento = inf.asiento;
      if (inf.sec != null) boleto.sec = inf.sec;
      if (inf.num != null) boleto.num = inf.num;
      tx.set(firestore.collection('boletos').doc(tok), Object.assign(boleto, meta));
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
