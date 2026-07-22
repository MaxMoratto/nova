// Diagnóstico temporal: revisa el MP_ACCESS_TOKEN actual (tipo + cuenta).
// Llamar con ?k=novadebug . BORRAR después de depurar.
module.exports = async (req, res) => {
  if ((req.query && req.query.k) !== 'novadebug') return res.status(403).json({ error: 'nope' });
  const token = process.env.MP_ACCESS_TOKEN || '';
  const out = {
    hay_token: !!token,
    tipo_token: token.startsWith('TEST-') ? 'PRUEBA (TEST-)' : (token.startsWith('APP_USR-') ? 'PRODUCCION (APP_USR-)' : 'DESCONOCIDO/otro'),
    empieza_con: token.slice(0, 8),
    largo: token.length
  };
  try {
    const r = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: 'Bearer ' + token } });
    const d = await r.json();
    out.users_me_status = r.status;
    if (r.ok) {
      out.cuenta = {
        id: d.id, nickname: d.nickname, site_id: d.site_id, country: d.country_id,
        user_type: d.user_type, status_site: d.status && d.status.site_status,
        tags: d.tags, registration_identifiers: d.registration_identifiers
      };
    } else {
      out.error = d.message || d.error; out.code = d.code;
    }
  } catch (e) { out.fetch_error = e.message; }
  return res.status(200).json(out);
};
