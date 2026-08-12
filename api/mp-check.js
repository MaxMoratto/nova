// TEMPORAL: diagnóstico del token de Mercado Pago (prueba vs producción).
// Uso:  /api/mp-check?key=nova-mp-check-2026   — NO expone el token completo.
// Borrar este archivo al terminar.
module.exports = async (req, res) => {
  if ((req.query.key || '') !== 'nova-mp-check-2026') { res.status(403).send('no autorizado'); return; }
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) { res.status(500).json({ error: 'No hay MP_ACCESS_TOKEN en Vercel' }); return; }
  const out = { tokenPrefix: token.slice(0, 8) + '…', tokenLen: token.length };
  try {
    const r = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: 'Bearer ' + token } });
    const d = await r.json();
    out.httpStatus = r.status;
    if (r.ok) {
      out.userId = d.id;
      out.nickname = d.nickname;
      out.email = d.email;
      out.site = d.site_id;
      out.tags = d.tags;
      out.esUsuarioDePrueba = Array.isArray(d.tags) && d.tags.includes('test_user');
      out.modo = out.esUsuarioDePrueba ? 'PRUEBA (sandbox)' : 'PRODUCCION (cobros reales)';
    } else {
      out.error = (d && (d.message || d.error)) || 'error';
    }
  } catch (e) { out.error = e.message || String(e); }
  res.status(200).json(out);
};
