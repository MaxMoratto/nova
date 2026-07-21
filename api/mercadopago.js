// Vercel Serverless Function — Mercado Pago Checkout Pro con RESERVA de asientos.
// 1) Crea una orden en Firestore y reserva los asientos VIP 10 min (anti doble-venta).
// 2) Crea la preferencia de pago con webhook (notification_url) y external_reference = orderId.
// Requiere: MP_ACCESS_TOKEN y FIREBASE_SERVICE_ACCOUNT en Vercel.
const { db } = require('../lib/firebase');

const RESERVA_MIN = 10;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'Falta MP_ACCESS_TOKEN en Vercel.' });

  let firestore;
  try { firestore = db(); }
  catch (e) { return res.status(500).json({ error: 'Firebase: ' + e.message }); }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { items = [], buyer = {}, seats = [] } = body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Carrito vacío' });

    const vipSeats = (seats || []).filter(s => /^VIP-/.test(s));
    const genQty = items.filter(i => /general/i.test(String(i.name)))
      .reduce((a, i) => a + Math.max(1, parseInt(i.qty || 1, 10)), 0);

    const orderRef = firestore.collection('ordenes').doc();
    const orderId = orderRef.id;
    const now = Date.now();
    const expira = now + RESERVA_MIN * 60000;

    // Reserva atómica de asientos VIP + crea la orden
    await firestore.runTransaction(async (tx) => {
      const refs = vipSeats.map(id => firestore.collection('asientos_nova').doc(id));
      const snaps = await Promise.all(refs.map(r => tx.get(r)));
      snaps.forEach((s, i) => {
        const d = s.data();
        if (d && (d.status === 'vendido' || (d.status === 'reservado' && d.expira > now && d.orderId !== orderId)))
          throw new Error('El asiento ' + vipSeats[i] + ' ya no está disponible');
      });
      refs.forEach((r) => tx.set(r, { status: 'reservado', expira, orderId, ts: now }, { merge: true }));
      tx.set(orderRef, {
        estado: 'pendiente', seats: vipSeats, general: genQty,
        comprador: { nombre: buyer.name || '', tel: buyer.phone || '', mail: buyer.mail || '' },
        items, creado: now, expira, evento: 'NOVA-11SEP2026'
      });
    });

    const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : 'https://nova-kappa-dusky.vercel.app');
    const mpItems = items.map(i => ({
      title: String(i.name || 'Boleto').slice(0, 250),
      quantity: Math.max(1, parseInt(i.qty || 1, 10)),
      unit_price: Math.round(Number(i.price) * 100) / 100,
      currency_id: 'MXN'
    }));

    const preference = {
      items: mpItems,
      payer: { name: (buyer.name || '').slice(0, 100) || undefined, email: buyer.mail || undefined },
      back_urls: {
        success: `${origin}/gracias.html?order=${orderId}`,
        failure: `${origin}/mapa-asientos.html`,
        pending: `${origin}/gracias.html?order=${orderId}`
      },
      auto_return: 'approved',
      external_reference: orderId,
      notification_url: `${origin}/api/mp-webhook`,
      statement_descriptor: 'NOVA STRIKE',
      metadata: { orderId }
    };

    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference)
    });
    const data = await r.json();
    if (!r.ok) {
      // libera la reserva si falló crear el pago
      try {
        const batch = firestore.batch();
        vipSeats.forEach(id => batch.delete(firestore.collection('asientos_nova').doc(id)));
        batch.update(orderRef, { estado: 'error' });
        await batch.commit();
      } catch (_) {}
      return res.status(500).json({ error: (data && (data.message || data.error)) || 'Error creando el pago en Mercado Pago' });
    }
    await orderRef.update({ prefId: data.id });
    return res.status(200).json({ url: data.init_point, orderId });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Error creando el pago' });
  }
};
