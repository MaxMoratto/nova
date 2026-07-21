// Inicializa Firebase Admin en las funciones serverless.
// Requiere la variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON del service account, o su base64).
const admin = require('firebase-admin');

function loadSvc() {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT en Vercel');
  let txt = raw.trim();
  if (!txt.startsWith('{')) txt = Buffer.from(txt, 'base64').toString('utf8'); // admite base64
  const svc = JSON.parse(txt);
  if (svc.private_key && svc.private_key.indexOf('\\n') >= 0) svc.private_key = svc.private_key.replace(/\\n/g, '\n');
  return svc;
}

function db() {
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(loadSvc()) });
  return admin.firestore();
}

module.exports = { admin, db };
