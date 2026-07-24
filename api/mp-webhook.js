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
  return await firestore.runTransaction(async (tx) => {
    const orderRef = firestore.collection('ordenes').doc(orderId);
    const foliosRef = firestore.collection('config').doc('folios');
    const genRef = firestore.collection('config').doc('general');
    const [oSnap, fSnap, gSnap] = await Promise.all([tx.get(orderRef), tx.get(foliosRef), tx.get(genRef)]);
    if (!oSnap.exists) throw new Error('orden no existe');
    const o = oSnap.data();
    if (o.estado === 'pagado') return null; // idempotente: no duplica boletos ni reenvia correo
    const seats = o.seats || [];
    const genQty = o.general || 0;
    let n = (fSnap.exists && fSnap.data().n) || 0;
    const vend = (gSnap.exists && gSnap.data().vendidos) || 0;
    if (vend + genQty > 250) throw new Error('General agotado');
    const comprador = o.comprador || {};
    const meta = { comprador, estado: 'valido', canal: 'mp', cortesia: false, emitidoAt: Date.now(), evento: 'NOVA-11SEP2026', orden: orderId, pagoId: String(pay.id) };
    const tokens = []; const emailItems = [];
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
      tokens.push(tok); emailItems.push({ token: tok, folio, label: inf.label });
    }
    for (let i = 0; i < genQty; i++) {
      n++; const folio = fmtFolio(n); const tok = randToken();
      tx.set(firestore.collection('boletos').doc(tok), Object.assign({ tipo: 'GENERAL', folio, precio: 450 }, meta));
      tokens.push(tok); emailItems.push({ token: tok, folio, label: 'General · lugar por llegada' });
    }
    tx.set(foliosRef, { n }, { merge: true });
    if (genQty > 0) tx.set(genRef, { vendidos: vend + genQty }, { merge: true });
    tx.update(orderRef, { estado: 'pagado', boletos: tokens, pagoId: String(pay.id), pagadoAt: Date.now() });
    return { comprador, boletos: emailItems }; // datos para el correo
  });
}

// Envío del correo con los boletos (Resend). Solo si hay RESEND_API_KEY y correo del comprador.
async function sendTicketEmail(data) {
  const key = process.env.RESEND_API_KEY;
  const to = data && data.comprador && data.comprador.mail;
  if (!key || !to) return;
  const base = (process.env.SITE_URL || 'https://novastrikeseries.com').replace(/\/+$/, '');
  const from = process.env.MAIL_FROM || 'NOVA Strike Series <boletos@novastrikeseries.com>';
  const replyTo = process.env.MAIL_REPLY_TO || undefined;
  const rows = data.boletos.map((bl) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #232a38">
        <div style="font-family:Arial,sans-serif;color:#ffffff;font-size:15px;font-weight:bold">${bl.label}</div>
        <div style="font-family:Arial,sans-serif;color:#8a92a6;font-size:12px;margin-top:2px">Folio ${bl.folio}</div>
      </td>
      <td align="right" style="border-bottom:1px solid #232a38">
        <a href="${base}/boleto.html?t=${bl.token}" style="display:inline-block;background:#e11d2a;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;padding:10px 16px;border-radius:8px">Ver boleto y QR</a>
      </td>
    </tr>`).join('');
  const html = `
  <div style="background:#0a0c11;padding:26px 14px">
    <div style="max-width:520px;margin:0 auto;background:#11151d;border:1px solid #232a38;border-radius:16px;padding:28px">
      <div style="font-family:Arial,sans-serif;color:#ff3646;font-weight:bold;letter-spacing:2px;font-size:13px">NOVA STRIKE SERIES</div>
      <h1 style="font-family:Arial,sans-serif;color:#ffffff;font-size:22px;margin:12px 0 4px">¡Tus boletos están listos!</h1>
      <p style="font-family:Arial,sans-serif;color:#8a92a6;font-size:13px;line-height:1.6;margin:0 0 16px">11 de septiembre 2026 · NOVA Show Center, CDMX.<br>Presenta el QR de cada boleto en la entrada (puedes mostrarlo desde el celular o descargarlo).</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
      <p style="font-family:Arial,sans-serif;color:#5f6779;font-size:12px;line-height:1.6;margin-top:20px">Guarda este correo. Cada boleto es válido una sola vez. ¿Dudas? Responde a este mensaje.</p>
    </div>
  </div>`;
  const payload = { from, to, subject: 'Tus boletos · NOVA Strike Series', html };
  if (replyTo) payload.reply_to = replyTo;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) console.error('MAIL_ERR', r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error('MAIL_ERR', e.message || e); }
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
      const result = await generateTickets(firestore, orderId, pay);
      if (result) { try { await sendTicketEmail(result); } catch (_) {} } // recien generados => enviar 1 sola vez
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
