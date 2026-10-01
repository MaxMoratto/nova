const Module=require('module'); const orig=Module._load;
Module._load=function(r){ if(r==='../lib/firebase') return {db:()=>({})};
  if(r==='firebase-admin') return {apps:[],initializeApp(){},credential:{cert(){}},firestore(){}};
  return orig.apply(this,arguments); };
const { generateTickets } = require('./api/mp-webhook.js');
function fs0(seed){ const st=new Map(Object.entries(seed));
  return { collection:n=>({doc:i=>({_p:n+'/'+i})}), _store:st,
    runTransaction: async fn=>{ const w=[];
      const tx={ get:async r=>({exists:st.has(r._p),data:()=>st.get(r._p)}),
                 set:(r,v,o)=>w.push(['s',r._p,v,o]), update:(r,v)=>w.push(['u',r._p,v]) };
      const out=await fn(tx);
      for(const [k,p,v,o] of w){ if(k==='s'&&!(o&&o.merge)) st.set(p,v); else st.set(p,Object.assign({},st.get(p)||{},v)); }
      return out; } }; }
(async () => {
  const f = fs0({ 'ordenes/O1': { estado:'pendiente', seats:['PREF-B-18','VIPA-B-04','VIP-M13-S4'], general:0, vipa:0, comprador:{mail:'x@y.com'} } });
  const r = await generateTickets(f, 'O1', { id: 1 });
  console.log('boletos emitidos: ' + r.boletos.length);
  for (const b of r.boletos) console.log('  ' + b.folio + '  ' + b.label);
  console.log('');
  let ok = 0;
  for (const [id, tipo, precio] of [['PREF-B-18','PREF',750], ['VIPA-B-04','VIPA',950], ['VIP-M13-S4','VIP',1500]]) {
    const t = [...f._store.entries()].find(([k,v]) => k.startsWith('boletos/') && v.asientoId === id);
    const d = t && t[1];
    const bien = d && d.tipo === tipo && d.precio === precio;
    console.log('  ' + id.padEnd(12) + (bien ? 'tipo ' + d.tipo + ', precio $' + d.precio : 'MAL: ' + JSON.stringify(d)));
    if (bien) ok++;
  }
  console.log('');
  console.log(ok === 3 ? 'Las tres zonas emiten con su tipo y precio correctos.' : 'HAY FALLAS');
  process.exit(ok === 3 ? 0 : 1);
})();
