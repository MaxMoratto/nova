// Vercel Serverless Function — crea una sesion de Stripe Checkout
// Requiere la variable de entorno STRIPE_SECRET_KEY (en Vercel, NO en el repo).
const Stripe = require('stripe');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Falta STRIPE_SECRET_KEY en las variables de entorno de Vercel.' });

  const stripe = Stripe(key);
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { items = [], buyer = {}, seats = [] } = body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Carrito vacío' });

    const line_items = items.map(i => ({
      price_data: {
        currency: 'mxn',
        product_data: { name: String(i.name || 'Boleto').slice(0, 250) },
        unit_amount: Math.round(Number(i.price) * 100)
      },
      quantity: Math.max(1, parseInt(i.qty || 1, 10))
    }));

    const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : 'https://nova-kappa-dusky.vercel.app');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      customer_email: buyer.mail || undefined,
      locale: 'es',
      metadata: {
        evento: 'NOVA Strike Series - 11 SEP 2026',
        seats: (seats || []).join(','),
        nombre: (buyer.name || '').slice(0, 200),
        tel: (buyer.phone || '').slice(0, 40)
      },
      success_url: `${origin}/gracias.html?ok=1&s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/mapa-asientos.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error creando el pago' });
  }
};
