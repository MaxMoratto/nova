// Vercel Serverless Function — crea una preferencia de Mercado Pago (Checkout Pro)
// Requiere la variable de entorno MP_ACCESS_TOKEN (en Vercel, NO en el repo).
// Devuelve { url } con el init_point al que se redirige al comprador.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'Falta MP_ACCESS_TOKEN en las variables de entorno de Vercel.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { items = [], buyer = {}, seats = [] } = body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Carrito vacío' });

    // Mercado Pago usa el monto en la moneda (pesos), NO en centavos.
    const mpItems = items.map(i => ({
      title: String(i.name || 'Boleto').slice(0, 250),
      quantity: Math.max(1, parseInt(i.qty || 1, 10)),
      unit_price: Math.round(Number(i.price) * 100) / 100,
      currency_id: 'MXN'
    }));

    const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : 'https://nova-kappa-dusky.vercel.app');

    const preference = {
      items: mpItems,
      payer: {
        name: (buyer.name || '').slice(0, 100) || undefined,
        email: buyer.mail || undefined
      },
      back_urls: {
        success: `${origin}/gracias.html`,
        failure: `${origin}/mapa-asientos.html`,
        pending: `${origin}/gracias.html?pending=1`
      },
      auto_return: 'approved',
      statement_descriptor: 'NOVA STRIKE',
      external_reference: (seats || []).join(',') || undefined,
      metadata: {
        evento: 'NOVA Strike Series - 11 SEP 2026',
        seats: (seats || []).join(','),
        nombre: (buyer.name || '').slice(0, 200),
        tel: (buyer.phone || '').slice(0, 40)
      }
    };

    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference)
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: (data && (data.message || data.error)) || 'Error creando el pago en Mercado Pago' });
    }
    return res.status(200).json({ url: data.init_point, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error creando el pago' });
  }
};
