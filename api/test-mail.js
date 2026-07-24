// TEMPORAL: prueba de envío de correo (Resend) sin necesidad de una compra.
// Uso:  /api/test-mail?key=nova-mail-check-2026&to=tucorreo@gmail.com
// Borrar este archivo cuando termine la prueba.
module.exports = async (req, res) => {
  const q = req.query || {};
  if ((q.key || '') !== 'nova-mail-check-2026') { res.status(403).send('no autorizado'); return; }
  const key = process.env.RESEND_API_KEY;
  const to = q.to;
  if (!key) { res.status(500).send('Falta RESEND_API_KEY en Vercel.'); return; }
  if (!to) { res.status(400).send('Falta ?to=correo'); return; }

  const from = process.env.MAIL_FROM || 'NOVA Strike Series <boletos@novastrikeseries.com>';
  const replyTo = process.env.MAIL_REPLY_TO;
  const base = (process.env.SITE_URL || 'https://nova-kappa-dusky.vercel.app').replace(/\/+$/, '');
  const html = `
  <div style="background:#0a0c11;padding:26px 14px">
    <div style="max-width:520px;margin:0 auto;background:#11151d;border:1px solid #232a38;border-radius:16px;padding:28px">
      <div style="font-family:Arial,sans-serif;color:#ff3646;font-weight:bold;letter-spacing:2px;font-size:13px">NOVA STRIKE SERIES</div>
      <h1 style="font-family:Arial,sans-serif;color:#ffffff;font-size:22px;margin:12px 0 4px">Correo de prueba ✅</h1>
      <p style="font-family:Arial,sans-serif;color:#8a92a6;font-size:13px;line-height:1.6;margin:0 0 16px">Si estás leyendo esto, el envío automático de boletos funciona: dominio verificado, remitente y API key correctos.</p>
      <a href="${base}/boleto.html?demo=vip" style="display:inline-block;background:#e11d2a;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;padding:10px 16px;border-radius:8px">Ver un boleto de ejemplo</a>
      <p style="font-family:Arial,sans-serif;color:#5f6779;font-size:12px;margin-top:20px">Este es un correo de prueba. Responde para verificar que las respuestas llegan a ${replyTo || 'tu bandeja'}.</p>
    </div>
  </div>`;
  const payload = { from, to, subject: 'Prueba de correo · NOVA Strike Series', html };
  if (replyTo) payload.reply_to = replyTo;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const txt = await r.text();
    if (r.ok) res.status(200).send('OK — correo enviado a ' + to + '. Revisa bandeja y spam.\n\n' + txt);
    else res.status(500).send('Resend respondió ' + r.status + ':\n' + txt);
  } catch (e) { res.status(500).send('Error: ' + (e.message || e)); }
};
