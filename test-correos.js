// Prueba del filtro de dedazos en el correo.
// Nacio del 30-sep-2026: un boleto se perdio por 'adeangel268@gmail.con'.
const fs=require('fs');
const html=fs.readFileSync('mapa-asientos.html','utf8');
const ini=html.indexOf('const DOMINIOS=');
const fin=html.indexOf('let _correoAvisado');
if(ini<0||fin<0){ console.log('no encontre el filtro en el mapa'); process.exit(1); }
const sugerirCorreo=new Function(html.slice(ini,fin)+'\nreturn sugerirCorreo;')();

const malos = [
  ['adeangel268@gmail.con',   'adeangel268@gmail.com'],   // el caso real
  ['max@gmail.cm',           'max@gmail.com'],
  ['max@gmial.com',          'max@gmail.com'],
  ['max@hotmial.com',        'max@hotmail.com'],
  ['max@hotmai.com',         'max@hotmail.com'],
  ['max@outlok.com',         'max@outlook.com'],
  ['max@yaho.com',           'max@yahoo.com'],
  ['max@icloud.con',         'max@icloud.com'],
];
const buenos = [
  'max@gmail.com','ana@hotmail.com','jose@yahoo.com.mx','x@icloud.com',
  'contacto@novastrikeseries.com','ventas@consultoresafc.com','a@live.com.mx',
];

let fallas=0;
console.log('-- dedazos que debe cachar --');
for(const [mal,esperado] of malos){
  const s=sugerirCorreo(mal);
  const ok=s===esperado;
  if(!ok) fallas++;
  console.log((ok?'  OK   ':'  MAL  ')+mal.padEnd(26)+'-> '+(s||'(no sugirio nada)')+(ok?'':'   se esperaba '+esperado));
}
console.log('-- correos buenos que NO debe molestar --');
for(const b of buenos){
  const s=sugerirCorreo(b);
  const ok=s==='';
  if(!ok) fallas++;
  console.log((ok?'  OK   ':'  MAL  ')+b.padEnd(32)+(ok?'pasa sin aviso':'sugirio '+s+' sin razon'));
}
console.log('\n'+(fallas?'HAY FALLAS: '+fallas:'El filtro cacha los dedazos y no molesta a los correos buenos.'));
process.exit(fallas?1:0);
