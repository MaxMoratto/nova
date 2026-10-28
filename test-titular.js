// Prueba del nombre del boleto: se escribe UNA sola vez, y no sobre
// boletos usados o cancelados. Simula Firestore en memoria; no toca nada real.
const Module = require('module');
const orig = Module._load;
let FAKE = null;                       // la base simulada que ve el endpoint
Module._load = function (req) {
  if (req === 'firebase-admin') return { apps: [], initializeApp(){}, credential:{cert(){}}, firestore(){} };
  if (/lib[\/]firebase/.test(req)) return { db: () => FAKE, admin: {} };
  return orig.apply(this, arguments);
};

const handler = require('./api/titular.js');
const { limpiarNombre } = handler;

function fakeDb(seed) {
  const store = new Map(Object.entries(seed));
  return {
    collection: () => ({ doc: (id) => ({ _id: id }) }),
    runTransaction: async (fn) => {
      const escrituras = [];
      const tx = {
        get: async (r) => ({ exists: store.has(r._id), data: () => store.get(r._id) }),
        update: (r, v) => escrituras.push([r._id, v]),
      };
      const out = await fn(tx);
      for (const [id, v] of escrituras) store.set(id, Object.assign({}, store.get(id), v));
      return out;
    },
    _store: store,
  };
}

async function llamar(db, body) {
  FAKE = db;
  let status = 0, payload = null;
  const res = { setHeader(){}, status(c){ status=c; return this; }, json(j){ payload=j; return this; }, end(){ return this; } };
  await handler({ method:'POST', body }, res);
  return { status, payload };
}

const TOK = 'a'.repeat(32), TOK2 = 'b'.repeat(32), TOK3 = 'c'.repeat(32);
let fallas = 0;
const check = (ok, txt) => { if (!ok) fallas++; console.log((ok ? '  OK   ' : '  MAL  ') + txt); };

(async () => {
  console.log('-- limpieza del nombre --');
  check(limpiarNombre('  Juan   Perez  ') === 'Juan Perez', 'quita espacios de sobra');
  check(limpiarNombre('<b>Juan</b>') === 'b Juan /b', 'quita los signos de etiqueta');
  check(limpiarNombre('x'.repeat(80)).length === 40, 'corta a 40 caracteres');

  console.log('-- reglas --');
  const db = fakeDb({
    [TOK]:  { estado:'valido' },
    [TOK2]: { estado:'usado' },
    [TOK3]: { estado:'cancelado' },
  });

  let r = await llamar(db, { token: TOK, nombre: 'Juan Perez' });
  check(r.status === 200 && r.payload.titular === 'Juan Perez', 'un boleto valido acepta el nombre');

  r = await llamar(db, { token: TOK, nombre: 'Otro Nombre' });
  check(r.status === 409, 'el segundo intento se rechaza: ya tiene nombre');
  check(db._store.get(TOK).titular === 'Juan Perez', 'y el nombre original no se toca');

  r = await llamar(db, { token: TOK2, nombre: 'Ana Lopez' });
  check(r.status === 400, 'un boleto ya usado no acepta nombre');

  r = await llamar(db, { token: TOK3, nombre: 'Ana Lopez' });
  check(r.status === 400, 'un boleto cancelado no acepta nombre');

  r = await llamar(db, { token: 'f'.repeat(32), nombre: 'Ana Lopez' });
  check(r.status === 404, 'un boleto que no existe se rechaza');

  r = await llamar(db, { token: 'no-es-un-token', nombre: 'Ana Lopez' });
  check(r.status === 400, 'un token con mala forma se rechaza');

  r = await llamar(db, { token: 'e'.repeat(32), nombre: 'Jo' });
  check(r.status === 400, 'un nombre demasiado corto se rechaza');

  console.log('\n' + (fallas ? 'HAY FALLAS: ' + fallas : 'El nombre se escribe una sola vez y solo donde debe.'));
  process.exit(fallas ? 1 : 0);
})();
