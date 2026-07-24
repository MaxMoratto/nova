# -*- coding: utf-8 -*-
# Generador del mapa de boletaje de 2 pisos (PB + 1er Piso) con 4 zonas.
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, "seatmap.json"), encoding="utf-8"))

SEATS = []
for s in d["PB"]["vip"]:
    SEATS.append({"id": s["id"], "zone": "VIP", "floor": "PB", "mesa": s["mesa"], "silla": s["silla"], "x": s["x"], "y": s["y"]})
for s in d["1PISO"]["vipa"]:
    SEATS.append({"id": s["id"], "zone": "VIPA", "floor": "1P", "n": s["n"], "x": s["x"], "y": s["y"]})
for s in d["1PISO"]["pref"]:
    SEATS.append({"id": s["id"], "zone": "PREF", "floor": "1P", "sec": s["sec"], "n": s["n"], "x": s["x"], "y": s["y"]})

SEATS_JSON = json.dumps(SEATS, ensure_ascii=False)
PB_VB = d["PB"]["vb"]; P1_VB = d["1PISO"]["vb"]
FLOORS = {
    "PB": {"bg": "uploads/pb.webp", "vb": f"0 0 {PB_VB[0]} {PB_VB[1]}", "label": "Planta Baja", "r": 1150},
    "1P": {"bg": "uploads/1piso.webp", "vb": f"0 0 {P1_VB[0]} {P1_VB[1]}", "label": "1er Piso", "r": 760},
}
FLOORS_JSON = json.dumps(FLOORS, ensure_ascii=False)

HTML = r"""<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>NOVA Strike Series</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  :root{--bg:#080a0e;--panel:#11151d;--panel2:#161b26;--border:#212836;--border2:#2d3547;--txt:#e8eaf0;--muted:#8a92a6;--muted2:#5f6779;--red:#e11d2a;--red2:#ff3646;--gold:#D2AE6D;--general:#3b82f6;--ok:#25d366;--shadow:0 10px 40px rgba(0,0,0,.55)}
  *{box-sizing:border-box}html,body{height:100%}
  body{margin:0;background:var(--bg);color:var(--txt);font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
  .app{display:grid;grid-template-columns:1fr 380px;height:100vh}
  .stage{position:relative;min-width:0;display:flex;flex-direction:column;border-right:1px solid var(--border)}
  .topbar{display:flex;align-items:center;gap:14px;padding:15px 22px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(20,24,33,.95),rgba(10,13,18,.6));z-index:5}
  .brand .logo{font-family:'Oswald',sans-serif;font-weight:700;font-style:italic;font-size:24px;letter-spacing:.5px;line-height:1;display:flex;gap:5px;align-items:baseline}
  .brand .sub{font-size:11px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-top:4px}
  .topbar .spacer{flex:1}
  .floorsw{display:flex;gap:6px;background:var(--panel2);border:1px solid var(--border);border-radius:11px;padding:4px}
  .floorsw button{border:none;background:transparent;color:var(--muted);font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:.5px;text-transform:uppercase;padding:8px 16px;border-radius:8px;cursor:pointer;transition:.15s}
  .floorsw button.on{background:linear-gradient(180deg,var(--red2),var(--red));color:#fff}
  .hint{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:7px}
  .hint kbd{background:var(--panel2);border:1px solid var(--border2);border-radius:5px;padding:2px 6px;font-size:11px;font-family:inherit;color:var(--txt)}
  a.back{color:var(--muted);text-decoration:none;font-size:12px;border:1px solid var(--border2);padding:7px 12px;border-radius:8px}
  a.back:hover{border-color:var(--red);color:var(--red2)}
  .canvas-wrap{position:relative;flex:1;min-height:0;overflow:hidden;cursor:grab;background:radial-gradient(1200px 900px at 50% 45%,#0e1219,#05070b)}
  .canvas-wrap.grabbing{cursor:grabbing}
  svg#map{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
  .seat{fill:rgba(255,255,255,0.001);stroke:transparent;stroke-width:300;cursor:pointer;transition:fill .1s,stroke .1s}
  .seat:hover{fill:rgba(242,210,30,0.30);stroke:rgba(242,210,30,0.95)}
  .seat.sel{fill:rgba(37,211,102,0.42);stroke:#25d366;stroke-width:520}
  .seat.vendido{fill:rgba(12,13,18,0.55);stroke:#e11d2a;stroke-width:300;cursor:not-allowed}
  .seats.dimmed .seat:not(.hl){opacity:.18}
  .seat.hl:not(.sel):not(.vendido){fill:rgba(255,255,255,.14);stroke:#fff;stroke-width:420;stroke-opacity:.95;animation:hlpulse 1s ease-in-out infinite}
  @keyframes hlpulse{0%,100%{stroke-opacity:.35}50%{stroke-opacity:1}}
  .zoombar{position:absolute;left:18px;bottom:18px;display:flex;flex-direction:column;gap:6px;z-index:6}
  .zoombar button{width:40px;height:40px;border-radius:11px;border:1px solid var(--border2);background:rgba(17,21,29,.92);color:var(--txt);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)}
  .zoombar button:hover{border-color:var(--red);color:var(--red2)}
  .tip{position:fixed;z-index:50;pointer-events:none;background:#0c0f16;border:1px solid var(--border2);border-radius:11px;padding:10px 13px;font-size:12.5px;box-shadow:var(--shadow);opacity:0;transform:translateY(4px);transition:opacity .12s,transform .12s;min-width:150px}
  .tip.on{opacity:1;transform:translateY(0)}
  .tip .t-z{font-family:'Oswald',sans-serif;font-weight:600;font-size:13.5px;letter-spacing:.5px;text-transform:uppercase;display:flex;align-items:center;gap:7px}
  .tip .t-z i{width:11px;height:11px;border-radius:3px;display:inline-block}
  .tip .t-row{color:var(--muted);margin-top:4px}.tip .t-row b{color:var(--txt)}
  .tip .t-price{margin-top:6px;padding-top:6px;border-top:1px solid var(--border);font-family:'Oswald',sans-serif;font-size:16px}
  .side{background:var(--panel);display:flex;flex-direction:column;height:100vh;min-height:0}
  .side-head{padding:20px 22px 14px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(225,29,42,.06),transparent)}
  .side-head h1{font-family:'Oswald',sans-serif;font-weight:700;font-size:20px;margin:0;letter-spacing:.4px;text-transform:uppercase}
  .side-head .meta{font-size:12px;color:var(--muted);margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .side-head .meta .dotr{width:5px;height:5px;border-radius:50%;background:var(--red2)}
  .side-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:16px 22px 8px}
  .side-scroll::-webkit-scrollbar{width:8px}.side-scroll::-webkit-scrollbar-thumb{background:var(--border2);border-radius:8px}
  .sec-t{font-size:11px;text-transform:uppercase;letter-spacing:1.6px;color:var(--muted2);margin:4px 0 10px;font-weight:600}
  .zones{display:flex;flex-direction:column;gap:8px;margin-bottom:22px}
  .zrow{display:flex;align-items:center;gap:12px;padding:11px 12px;border:1px solid var(--border);border-radius:12px;background:var(--panel2);cursor:pointer}
  .zrow .sw{width:16px;height:16px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
  .zrow .zn{flex:1;min-width:0}
  .zrow .zn b{font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:.3px;display:block}
  .zrow .zn small{color:var(--muted);font-size:11px}
  .zrow .zp{text-align:right;font-family:'Oswald',sans-serif}
  .zrow .zp b{font-size:15px;display:block}
  .zrow .zp small{color:var(--muted);font-size:10.5px}
  .gqty{display:flex;align-items:center;gap:8px}
  .qb{width:27px;height:27px;border-radius:7px;border:1px solid var(--border2);background:var(--panel2);color:var(--txt);font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .qb:hover{border-color:var(--red);color:var(--red2)}
  .gqty b{font-family:'Oswald',sans-serif;font-size:16px;min-width:20px;text-align:center}
  .empty{color:var(--muted);font-size:13px;text-align:center;padding:22px 10px;border:1px dashed var(--border2);border-radius:12px;line-height:1.5}
  .empty span{font-size:26px;display:block;margin-bottom:8px;opacity:.7}
  .picks{display:flex;flex-direction:column;gap:7px}
  .pick{display:flex;align-items:center;gap:10px;padding:9px 11px;background:var(--panel2);border:1px solid var(--border);border-radius:10px;animation:pop .18s ease}
  @keyframes pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
  .pick .pw{width:11px;height:11px;border-radius:50%;flex:none}
  .pick .pi{flex:1;min-width:0}.pick .pi b{font-size:13px;font-family:'Oswald',sans-serif;letter-spacing:.3px}
  .pick .pi small{display:block;color:var(--muted);font-size:11px}
  .pick .pp{font-family:'Oswald',sans-serif;font-size:13.5px}
  .pick .rm{width:22px;height:22px;border:none;background:transparent;color:var(--muted2);cursor:pointer;font-size:16px;border-radius:6px;flex:none}
  .pick .rm:hover{background:#2a1116;color:var(--red2)}
  .side-foot{border-top:1px solid var(--border);padding:16px 22px 18px;flex-shrink:0;background:var(--panel)}
  .sumline{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:7px}
  .sumline b{color:var(--txt);font-weight:600}
  .sumline.total{margin-top:10px;padding-top:12px;border-top:1px solid var(--border);font-size:15px;color:var(--txt)}
  .sumline.total b{font-family:'Oswald',sans-serif;font-size:22px;color:#fff}
  .cta{width:100%;margin-top:14px;padding:15px;border:none;border-radius:13px;cursor:pointer;font-family:'Oswald',sans-serif;font-weight:600;font-size:15px;letter-spacing:1px;text-transform:uppercase;color:#fff;background:linear-gradient(180deg,var(--red2),var(--red));box-shadow:0 8px 26px rgba(225,29,42,.38);transition:.15s}
  .cta:hover{filter:brightness(1.08);transform:translateY(-1px)}
  .cta:disabled{background:#242a36;color:var(--muted2);box-shadow:none;cursor:not-allowed;transform:none;filter:none}
  .foot-note{font-size:10.5px;color:var(--muted2);text-align:center;margin-top:9px}
  .clearbtn{background:none;border:none;color:var(--muted2);font-size:11.5px;cursor:pointer;text-decoration:underline;padding:0}.clearbtn:hover{color:var(--red2)}
  .maplegend{position:absolute;right:18px;bottom:18px;z-index:6;display:flex;gap:12px;flex-wrap:wrap;background:rgba(12,15,22,.86);border:1px solid var(--border);border-radius:12px;padding:10px 14px;font-size:11px;color:var(--muted);backdrop-filter:blur(8px)}
  .maplegend .it{display:flex;align-items:center;gap:6px}.maplegend .dot{width:11px;height:11px;border-radius:50%}
  #genpanel{position:absolute;left:50%;bottom:74px;transform:translateX(-50%);z-index:6;width:min(560px,86%);background:rgba(12,15,22,.92);border:1px solid #2d3547;border-radius:15px;padding:14px 20px;backdrop-filter:blur(10px);box-shadow:0 14px 44px rgba(0,0,0,.55);display:none}
  #genpanel.show{display:block}
  #genpanel .gp-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
  #genpanel .gp-t{font-family:'Oswald',sans-serif;font-size:15px;letter-spacing:.6px;text-transform:uppercase;color:#fff;display:flex;align-items:center;gap:8px}
  #genpanel .gp-t .gdot{width:10px;height:10px;border-radius:50%;background:#4f8df5}
  #genpanel .gp-price{font-family:'Oswald',sans-serif;font-size:18px;color:#4f8df5}
  #genpanel .gp-bar{height:9px;border-radius:6px;background:#1b2230;overflow:hidden;margin-bottom:10px;border:1px solid #232a38}
  #genpanel .gp-fill{height:100%;background:linear-gradient(90deg,#3b82f6,#60a5fa);transition:width .35s}
  #genpanel .gp-row{display:flex;justify-content:space-between;align-items:center}
  #genpanel .gp-avail{font-size:12.5px;color:var(--muted)}#genpanel .gp-avail b{color:#fff;font-family:'Oswald',sans-serif;font-size:17px}
  #genpanel .gp-step{display:flex;align-items:center;gap:11px}#genpanel .gp-step .qb{width:30px;height:30px}#genpanel .gp-step b{font-family:'Oswald',sans-serif;font-size:17px;min-width:22px;text-align:center;color:#fff}
  .modal-bg{position:fixed;inset:0;background:rgba(5,7,11,.74);z-index:80;display:none;align-items:center;justify-content:center;padding:20px}
  .modal-bg.on{display:flex}
  .modal{position:relative;background:var(--panel);border:1px solid var(--border2);border-radius:16px;max-width:450px;width:100%;box-shadow:var(--shadow);overflow:hidden}
  .modal h2{font-family:'Oswald',sans-serif;margin:0;padding:20px 22px 6px;font-size:20px;text-transform:uppercase;letter-spacing:.5px}
  .modal p{margin:0;padding:0 22px;color:var(--muted);font-size:13px}
  .modal .mlist{padding:14px 22px;max-height:230px;overflow:auto;display:flex;flex-direction:column;gap:6px}
  .modal .mrow{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--border)}.modal .mrow b{font-family:'Oswald',sans-serif}
  .form-wrap{padding:6px 22px 4px;display:flex;flex-direction:column;gap:8px}
  .finp{width:100%;background:var(--panel2);border:1px solid var(--border2);border-radius:9px;padding:11px 12px;color:var(--txt);font-family:inherit;font-size:13px;outline:none}.finp:focus{border-color:var(--red)}.finp::placeholder{color:var(--muted2)}
  .modal .mfoot{padding:16px 22px 20px;border-top:1px solid var(--border)}
  .modal .close{background:none;border:none;color:var(--muted);font-size:23px;cursor:pointer;position:absolute;top:12px;right:15px;line-height:1}
  @media (max-width:940px){body{overflow:auto}.app{grid-template-columns:1fr;height:auto}.stage{height:64vh;border-right:none;border-bottom:1px solid var(--border)}.side{height:auto}}
</style></head>
<body>
<div class="app">
  <section class="stage">
    <div class="topbar">
      <div class="brand"><div class="logo"><span style="color:#FF0033">NOVA</span><span style="color:#fff">STRIKE</span><span style="color:#00F0FF">SERIES</span></div><div class="sub">Mapa de asientos</div></div>
      <div class="spacer"></div>
      <div class="floorsw" id="floorsw"><button data-f="PB" class="on">Planta Baja</button><button data-f="1P">1er Piso</button></div>
      <a class="back" href="index.html">&#8592; Volver</a>
    </div>
    <div class="canvas-wrap" id="wrap">
      <svg id="map" viewBox="__PBVB__" preserveAspectRatio="xMidYMid meet">
        <g id="viewport"><image id="base" href="__PBBG__" x="0" y="0" width="__PBW__" height="__PBH__" preserveAspectRatio="xMidYMid meet"></image><g id="seats" class="seats"></g></g>
      </svg>
      <div class="zoombar"><button id="zin">+</button><button id="zout">-</button><button id="zfit" style="font-size:14px">&#10530;</button></div>
      <div class="maplegend" id="maplegend"></div>
    </div>
  </section>
  <aside class="side">
    <div class="side-head"><h1>Elige tus lugares</h1><div class="meta"><span><span class="dotr"></span>11 SEP 2026</span><span>NOVA Show Center</span></div></div>
    <div class="side-scroll">
      <div class="sec-t">Zonas y precios</div><div class="zones" id="zones"></div>
      <div class="sec-t">Tus lugares <span id="pickcount" style="color:var(--red2)"></span></div><div id="pickbox"></div>
    </div>
    <div class="side-foot">
      <div class="sumline"><span>Lugares <span id="nq">(0)</span></span><b id="subt">$0</b></div>
      <div class="sumline"><span>Comisión de compra en línea (4.2%)</span><b id="fee">$0</b></div>
      <div class="sumline total"><span>Total</span><b id="tot">$0 MXN</b></div>
      <button class="cta" id="buy" disabled>Continuar al pago</button>
      <div class="foot-note">Max. 12 boletos por compra - <button class="clearbtn" id="clear">Quitar todo</button></div>
    </div>
  </aside>
</div>
<div class="tip" id="tip"></div>
<div class="modal-bg" id="modalbg"><div class="modal"><button class="close" id="mclose">&times;</button>
  <h2>Completa tu compra</h2><p>Pon tus datos y elige c&oacute;mo pagar tus lugares.</p>
  <div class="mlist" id="mlist"></div>
  <div class="form-wrap"><input id="bname" class="finp" placeholder="Nombre completo" autocomplete="name"/><input id="bphone" class="finp" placeholder="WhatsApp / telefono" autocomplete="tel" inputmode="tel"/><input id="bmail" class="finp" placeholder="Email (te enviamos aquí los boletos)" autocomplete="email"/></div>
  <div class="mfoot"><div class="sumline total" style="margin-top:0;border:none;padding-top:0"><span>Total</span><b id="mtot"></b></div>
  <button class="cta" id="mcard" style="background:linear-gradient(180deg,#00b1ea,#009ee3);box-shadow:0 8px 24px rgba(0,158,227,.4)">Pagar con Mercado Pago</button>
  <div style="text-align:center;font-size:10.5px;color:var(--muted2);margin-top:8px">Tarjeta &#183; OXXO &#183; SPEI &#183; meses sin intereses</div>
  <button class="cta" id="mpay" style="background:transparent;border:1px solid var(--border2);color:var(--muted);box-shadow:none;margin-top:10px;font-size:13px">o apartar por WhatsApp</button><div id="speibox" style="font-size:11.5px;color:var(--muted);margin-top:12px;line-height:1.6;background:var(--panel2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;display:none"></div></div></div></div>
<script>
const SEATS = __SEATS__;
const FLOORS = __FLOORS__;
const ZONES = {
  VIP:  { label:'VIP (mesa)', color:'#e11d2a', bright:'#ff6b76', price:850 },
  VIPA: { label:'VIP (asiento)', color:'#e11d2a', bright:'#ff8f98', price:850 },
  PREF: { label:'Preferente', color:'#D2AE6D', bright:'#e6c789', price:650 },
  GENERAL: { label:'General', color:'#3b82f6', bright:'#4f8df5', price:450, general:true, total:250 }
};
const COMISION=0.042;                       // 4.2% comision de compra en linea (cubre el costo real de Mercado Pago)
const feeOf=sub=>Math.round(sub*COMISION);  // sobre el subtotal, redondeada al peso
const CONFIG = {
  whatsapp:"5215633353642", evento:"NOVA - 11 SEP 2026 - NOVA Show Center", spei:{beneficiario:"",banco:"",clabe:""},
  firebaseConfig:{ apiKey:"AIzaSyAXxTUFo0CHFZnAs0wGrYHLTwwVzZ_ArZA", authDomain:"nova-dd664.firebaseapp.com", projectId:"nova-dd664", storageBucket:"nova-dd664.firebasestorage.app", messagingSenderId:"967862553249", appId:"1:967862553249:web:3524af97999ce667bafee0" },
  reservaAutomatica:false
};
const FS_COLLECTION="asientos_nova", RESERVA_MIN=10;
const money=v=>'$'+v.toLocaleString('es-MX');
const NS='http://www.w3.org/2000/svg';
const el=(t,a={})=>{const n=document.createElementNS(NS,t);for(const k in a)n.setAttribute(k,a[k]);return n;};
const SEAT_MAP=new Map(SEATS.map(s=>[s.id,s]));
const svg=document.getElementById('map'),viewport=document.getElementById('viewport'),seatsG=document.getElementById('seats'),base=document.getElementById('base'),tip=document.getElementById('tip');
let curFloor='PB';
const state={selected:new Set(),generalQty:0,scale:1,tx:0,ty:0}; const MAX=12;

function seatLabel(s){ if(s.zone==='VIP') return 'Mesa '+s.mesa+' &#183; Silla '+s.silla; if(s.zone==='VIPA') return 'VIP Asiento '+s.n; if(s.zone==='PREF') return 'Preferente '+s.sec+'-'+String(s.n).padStart(2,'0'); return s.id; }
function seatShort(s){ if(s.zone==='VIP') return 'M'+s.mesa+' S'+s.silla; if(s.zone==='VIPA') return 'Asiento '+s.n; if(s.zone==='PREF') return s.sec+String(s.n).padStart(2,'0'); return s.id; }

function renderFloor(){
  const f=FLOORS[curFloor];
  svg.setAttribute('viewBox',f.vb);
  base.setAttribute('href',f.bg); base.setAttributeNS('http://www.w3.org/1999/xlink','href',f.bg); const wh=f.vb.split(' '); base.setAttribute('width',wh[2]); base.setAttribute('height',wh[3]);
  seatsG.innerHTML='';
  for(const s of SEATS){ if(s.floor!==curFloor) continue;
    const c=el('circle',{cx:s.x,cy:s.y,r:f.r,class:'seat','data-id':s.id}); if(taken.has(s.id))c.classList.add('vendido'); if(state.selected.has(s.id))c.classList.add('sel'); seatsG.appendChild(c); }
  state.scale=1;state.tx=0;state.ty=0;apply();
}
function nodeOf(id){return seatsG.querySelector('[data-id="'+CSS.escape(id)+'"]');}

const taken=new Set();
function markTaken(id){taken.add(id);const n=nodeOf(id);if(n)n.classList.add('vendido');if(state.selected.has(id)){state.selected.delete(id);const n2=nodeOf(id);if(n2)n2.classList.remove('sel');renderCart();}}
function unTake(id){if(!taken.has(id))return;taken.delete(id);const n=nodeOf(id);if(n)n.classList.remove('vendido');}
let db=null,generalSold=0;
function loadScript(src){return new Promise((ok,err)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=err;document.head.appendChild(s);});}
async function initFirebase(){ try{
    await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
    firebase.initializeApp(CONFIG.firebaseConfig); db=firebase.firestore();
    db.collection(FS_COLLECTION).onSnapshot(s=>{const now=Date.now(); s.docChanges().forEach(c=>{const d=c.doc.data(); if(c.type==='removed'){unTake(c.doc.id);return;} if(d&&(d.status==='vendido'||(d.status==='reservado'&&d.expira>now)))markTaken(c.doc.id); else unTake(c.doc.id);}); refreshAvail();});
    db.collection('config').doc('general').onSnapshot(d=>{ generalSold=(d&&d.exists&&(d.data().vendidos||0))||0; updateGenPanel(); },()=>{});
  }catch(e){console.warn('Firebase:',e);} }
initFirebase();

function toggle(id){const s=SEAT_MAP.get(id); if(!s||taken.has(id))return; const n=nodeOf(id);
  if(state.selected.has(id)){state.selected.delete(id);n.classList.remove('sel');}
  else{ if(state.selected.size>=MAX){flash('Maximo '+MAX+' lugares');return;} state.selected.add(id);n.classList.add('sel');seatsG.appendChild(n);} renderCart();}
seatsG.addEventListener('click',e=>{const r=e.target.closest('.seat');if(r)toggle(r.getAttribute('data-id'));});
seatsG.addEventListener('mousemove',e=>{const r=e.target.closest('.seat');if(!r){tip.classList.remove('on');return;}
  const s=SEAT_MAP.get(r.getAttribute('data-id')),z=ZONES[s.zone];
  tip.innerHTML='<div class="t-z"><i style="background:'+z.color+'"></i>'+z.label+'</div><div class="t-row">'+seatLabel(s)+'</div><div class="t-price" style="color:'+z.bright+'">'+money(z.price)+'</div><div style="font-size:11px;margin-top:4px;color:'+(taken.has(s.id)?'#ff6b76':'#25d366')+'">'+(taken.has(s.id)?'Vendido':(state.selected.has(s.id)?'Seleccionado':'Disponible'))+'</div>';
  tip.classList.add('on'); let x=e.clientX+16,y=e.clientY+16; if(x+220>innerWidth)x=e.clientX-220; if(y+120>innerHeight)y=e.clientY-120; tip.style.left=x+'px';tip.style.top=y+'px';});
seatsG.addEventListener('mouseleave',()=>tip.classList.remove('on'));

function avail(zone){let a=0;for(const s of SEATS)if(s.zone===zone&&!state.selected.has(s.id)&&!taken.has(s.id))a++;return a;}
function zoneTotal(zone){return SEATS.filter(s=>s.zone===zone).length;}
const zonesBox=document.getElementById('zones');
const ZFLOOR={VIP:'PB',VIPA:'1P',PREF:'1P',GENERAL:'PB'};
function goFloor(fl){ if(curFloor===fl)return; curFloor=fl;
  document.querySelectorAll('.floorsw button').forEach(x=>x.classList.toggle('on',x.dataset.f===fl)); renderFloor(); }
function focusZone(z){                                   // llevar el mapa a la seccion de la zona
  const fl=ZFLOOR[z]||'PB'; goFloor(fl);
  const pts=SEATS.filter(s=>s.floor===fl&&s.zone===z);
  if(pts.length){ const r=FLOORS[fl].r; let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    pts.forEach(s=>{x0=Math.min(x0,s.x-r);y0=Math.min(y0,s.y-r);x1=Math.max(x1,s.x+r);y1=Math.max(y1,s.y+r);});
    const [W,H]=vbDims(),bw=x1-x0,bh=y1-y0,pad=1.22;
    const s=Math.min(6,Math.max(1,Math.min(W/(bw*pad),H/(bh*pad))));
    state.scale=s; state.tx=W/2-s*(x0+x1)/2; state.ty=H/2-s*(y0+y1)/2; apply();
    hl(z); clearTimeout(focusZone._t); focusZone._t=setTimeout(()=>hl(null),1800);
  } else { state.scale=1;state.tx=0;state.ty=0;apply(); }
  if(innerWidth<=940){const st=document.querySelector('.stage'); if(st)st.scrollIntoView({behavior:'smooth',block:'start'});}
}
function buildZones(){ zonesBox.innerHTML='';
  [['VIP','Planta baja'],['VIPA','1er piso'],['PREF','1er piso']].forEach(([z,fl])=>{ const Z=ZONES[z];
    const row=document.createElement('div');row.className='zrow';row.dataset.zone=z;
    row.innerHTML='<span class="sw" style="background:'+Z.bright+'"></span><div class="zn"><b>'+Z.label+'</b><small>'+fl+' &#183; <span class="av">'+zoneTotal(z)+'</span> disp.</small></div><div class="zp"><b style="color:'+Z.bright+'">'+money(Z.price)+'</b><small>c/u</small></div>';
    row.addEventListener('mouseenter',()=>hl(z));row.addEventListener('mouseleave',()=>hl(null));
    row.addEventListener('click',()=>focusZone(z)); zonesBox.appendChild(row); });
  const g=ZONES.GENERAL; const row=document.createElement('div');row.className='zrow';row.dataset.zone='GENERAL';
  row.innerHTML='<span class="sw" style="background:'+g.bright+'"></span><div class="zn"><b>General</b><small>planta baja &#183; lugar por llegada</small></div><div class="gqty"><button class="qb" id="gminus">&#8722;</button><b id="gqty">0</b><button class="qb" id="gplus">+</button></div><div class="zp"><b style="color:'+g.bright+'">'+money(g.price)+'</b><small>c/u</small></div>';
  row.addEventListener('click',e=>{if(e.target.closest('.qb'))return; focusZone('GENERAL');}); zonesBox.appendChild(row);
}
function updateGenPanel(){ const total=ZONES.GENERAL.total; const used=Math.min(total,generalSold+state.generalQty); const av=total-used;
  const w=document.getElementById('gpavailwrap'); if(w)w.innerHTML='<b>'+av+'</b> de '+total+' disponibles';
  const f=document.getElementById('gpfill'); if(f)f.style.width=(total?used/total*100:0)+'%';
  ['gqty','gqty2'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=state.generalQty;}); }
function genInc(){ if(generalSold+state.generalQty<ZONES.GENERAL.total){state.generalQty++;updateGenPanel();renderCart();} else flash('No quedan m&aacute;s boletos General'); }
function genDec(){ if(state.generalQty>0){state.generalQty--;updateGenPanel();renderCart();} }
function bindGen(){ ['gplus','gplus2'].forEach(id=>{const e=document.getElementById(id);if(e)e.onclick=genInc;}); ['gminus','gminus2'].forEach(id=>{const e=document.getElementById(id);if(e)e.onclick=genDec;}); }
function hl(z){seatsG.classList.toggle('dimmed',!!z); if(z){for(const s of SEATS){if(s.floor!==curFloor)continue;const n=nodeOf(s.id);if(n)n.classList.toggle('hl',s.zone===z);}}else seatsG.querySelectorAll('.hl').forEach(n=>n.classList.remove('hl')); }
function refreshAvail(){zonesBox.querySelectorAll('.zrow').forEach(r=>{const av=r.querySelector('.av');if(av&&r.dataset.zone!=='GENERAL')av.textContent=avail(r.dataset.zone);});}
document.getElementById('maplegend').innerHTML='<div class="it"><span class="dot" style="background:#D2AE6D"></span>Preferente</div><div class="it"><span class="dot" style="background:#e11d2a"></span>VIP</div><div class="it"><span class="dot" style="background:#25d366"></span>Elegido</div><div class="it"><span class="dot" style="background:#2a2f3a"></span>Vendido</div>';

const pickbox=document.getElementById('pickbox');
function selectedSeats(){ return [...state.selected].map(id=>SEAT_MAP.get(id)); }
function renderCart(){ const sel=selectedSeats(); const gq=state.generalQty, count=sel.length+gq;
  document.getElementById('pickcount').textContent=count?'('+count+')':'';
  if(!count){pickbox.innerHTML='<div class="empty"><span>&#127915;</span>Toca asientos en el mapa (VIP / Preferente) o suma boletos General.</div>';}
  else{const w=document.createElement('div');w.className='picks';
    for(const s of sel){const z=ZONES[s.zone];const d=document.createElement('div');d.className='pick';
      d.innerHTML='<span class="pw" style="background:'+z.bright+'"></span><div class="pi"><b>'+seatLabel(s)+'</b><small>'+z.label+'</small></div><span class="pp">'+money(z.price)+'</span><button class="rm" data-id="'+s.id+'">&times;</button>';w.appendChild(d);}
    if(gq>0){const z=ZONES.GENERAL;const d=document.createElement('div');d.className='pick';
      d.innerHTML='<span class="pw" style="background:'+z.bright+'"></span><div class="pi"><b>General &#215; '+gq+'</b><small>silla &#183; por orden de llegada</small></div><span class="pp">'+money(z.price*gq)+'</span><button class="rm" data-gen="1">&times;</button>';w.appendChild(d);}
    pickbox.innerHTML='';pickbox.appendChild(w);}
  const sub=sel.reduce((t,s)=>t+ZONES[s.zone].price,0)+gq*ZONES.GENERAL.price, fee=feeOf(sub);
  document.getElementById('nq').textContent='('+count+')';document.getElementById('subt').textContent=money(sub);
  document.getElementById('fee').textContent=money(fee);
  document.getElementById('tot').textContent=money(sub+fee)+' MXN';
  document.getElementById('buy').disabled=count===0;refreshAvail();updateGenPanel();}
pickbox.addEventListener('click',e=>{const b=e.target.closest('.rm');if(!b)return; if(b.dataset.gen){state.generalQty=0;renderCart();} else toggle(b.dataset.id);});
document.getElementById('clear').addEventListener('click',()=>{state.selected.forEach(id=>{const n=nodeOf(id);if(n)n.classList.remove('sel');});state.selected.clear();state.generalQty=0;renderCart();});
let flashT;function flash(m){let f=document.getElementById('flashmsg');if(!f){f=document.createElement('div');f.id='flashmsg';f.style.cssText='position:fixed;left:50%;top:20px;transform:translateX(-50%);background:#2a1116;border:1px solid #e11d2a;color:#ff8f98;padding:10px 18px;border-radius:10px;z-index:90;font-size:13px';document.body.appendChild(f);}f.innerHTML=m;f.style.opacity='1';clearTimeout(flashT);flashT=setTimeout(()=>f.style.opacity='0',1800);}

// floor switch
document.getElementById('floorsw').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return; goFloor(b.dataset.f);});

// checkout modal
const modalbg=document.getElementById('modalbg');
document.getElementById('buy').addEventListener('click',()=>{const sel=selectedSeats();if(!sel.length&&!state.generalQty)return;
  const ml=document.getElementById('mlist');ml.innerHTML='';let sub=0;
  for(const s of sel){sub+=ZONES[s.zone].price;const r=document.createElement('div');r.className='mrow';r.innerHTML='<span>'+seatLabel(s)+'</span><b>'+money(ZONES[s.zone].price)+'</b>';ml.appendChild(r);}
  if(state.generalQty>0){sub+=state.generalQty*ZONES.GENERAL.price;const r=document.createElement('div');r.className='mrow';r.innerHTML='<span>General &#215; '+state.generalQty+'</span><b>'+money(state.generalQty*ZONES.GENERAL.price)+'</b>';ml.appendChild(r);}
  const fee=feeOf(sub);
  if(fee>0){const r=document.createElement('div');r.className='mrow';r.innerHTML='<span>Comisión de compra en línea (4.2%)</span><b>'+money(fee)+'</b>';ml.appendChild(r);}
  document.getElementById('mtot').textContent=money(sub+fee)+' MXN';
  modalbg.classList.add('on');});
document.getElementById('mclose').addEventListener('click',()=>modalbg.classList.remove('on'));
modalbg.addEventListener('click',e=>{if(e.target===modalbg)modalbg.classList.remove('on');});

function buildItems(sel){ const items=[]; const byZone={};
  for(const s of sel){ byZone[s.zone]=(byZone[s.zone]||0)+1; }
  if(byZone.VIP) items.push({name:'VIP Mesa', price:ZONES.VIP.price, qty:byZone.VIP});
  if(byZone.VIPA) items.push({name:'VIP Asiento', price:ZONES.VIPA.price, qty:byZone.VIPA});
  if(byZone.PREF) items.push({name:'Preferente', price:ZONES.PREF.price, qty:byZone.PREF});
  if(state.generalQty>0) items.push({name:'General (lugar por llegada)', price:ZONES.GENERAL.price, qty:state.generalQty});
  const sub=sel.reduce((t,s)=>t+ZONES[s.zone].price,0)+state.generalQty*ZONES.GENERAL.price;
  const fee=feeOf(sub); if(fee>0) items.push({name:'Comisión de compra en línea (4.2%)', price:fee, qty:1});
  return items;
}
document.getElementById('mcard').addEventListener('click',async()=>{
  const name=document.getElementById('bname').value.trim(),phone=document.getElementById('bphone').value.trim(),mail=document.getElementById('bmail').value.trim();
  if(!name||!phone||!/^\S+@\S+\.\S+$/.test(mail)){flash('Pon nombre, WhatsApp y un correo válido (ahí te enviamos los boletos)');return;}
  const sel=selectedSeats(); if(!sel.length&&!state.generalQty)return;
  const items=buildItems(sel);
  const b=document.getElementById('mcard'); b.disabled=true; const old=b.textContent; b.textContent='Redirigiendo a Mercado Pago...';
  try{ const r=await fetch('/api/mercadopago',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,buyer:{name,phone,mail},seats:sel.map(s=>s.id)})});
    const d=await r.json(); if(d.url){window.location.href=d.url;return;} flash('Pago: '+(d.error||'no se pudo iniciar')); b.disabled=false;b.textContent=old;
  }catch(e){ flash('Error de conexi&oacute;n con el pago'); b.disabled=false;b.textContent=old; }
});
document.getElementById('mpay').addEventListener('click',()=>{
  const name=document.getElementById('bname').value.trim(),phone=document.getElementById('bphone').value.trim(),mail=document.getElementById('bmail').value.trim();
  if(!name||!phone){flash('Pon tu nombre y WhatsApp/telefono');return;}
  const sel=selectedSeats(); if(!sel.length&&!state.generalQty)return;
  const sub=sel.reduce((t,s)=>t+ZONES[s.zone].price,0)+state.generalQty*ZONES.GENERAL.price, fee=feeOf(sub);
  let msg='Hola! Quiero apartar para '+CONFIG.evento+':\n';
  for(const s of sel){msg+='&#8226; '+ZONES[s.zone].label+' '+seatShort(s)+' - '+money(ZONES[s.zone].price)+'\n';}
  if(state.generalQty>0){msg+='&#8226; General &#215; '+state.generalQty+' - '+money(state.generalQty*ZONES.GENERAL.price)+'\n';}
  msg+='\nComisión de compra en línea (4.2%): '+money(fee)+'\nTotal: '+money(sub+fee)+' MXN\n\nNombre: '+name+'\nTel: '+phone+(mail?'\nEmail: '+mail:'');
  window.open('https://wa.me/'+CONFIG.whatsapp+'?text='+encodeURIComponent(msg.replace(/&#8226;/g,'\u2022').replace(/&#215;/g,'x')),'_blank');
  modalbg.classList.remove('on');flash('Te mandamos a WhatsApp para confirmar');
});

// pan / zoom  -> al abrir se ve completo (fit) y NO se desplaza; solo zoom.
//               web: scroll o botones +/- ; movil: pellizco. Arrastre solo con zoom activo.
function vbDims(){const p=svg.getAttribute('viewBox').split(/\s+/);return [parseFloat(p[2]),parseFloat(p[3])];}
function clampPan(){const [W,H]=vbDims(),s=state.scale;
  if(s<=1){state.tx=0;state.ty=0;return;}
  state.tx=Math.min(0,Math.max(W*(1-s),state.tx));
  state.ty=Math.min(0,Math.max(H*(1-s),state.ty));}
function apply(){clampPan();viewport.setAttribute('transform','translate('+state.tx+' '+state.ty+') scale('+state.scale+')');}
function sp(cx,cy){const p=svg.createSVGPoint();p.x=cx;p.y=cy;return p.matrixTransform(svg.getScreenCTM().inverse());}
function zoomAt(cx,cy,f){const p=sp(cx,cy);const ns=Math.min(6,Math.max(1,state.scale*f));
  state.tx=p.x-(p.x-state.tx)*(ns/state.scale);state.ty=p.y-(p.y-state.ty)*(ns/state.scale);state.scale=ns;apply();}
const wrap=document.getElementById('wrap');
wrap.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,e.deltaY<0?1.12:1/1.12);},{passive:false});
document.getElementById('zin').onclick=()=>zoomAt(innerWidth*.42,innerHeight*.45,1.25);
document.getElementById('zout').onclick=()=>zoomAt(innerWidth*.42,innerHeight*.45,1/1.25);
document.getElementById('zfit').onclick=()=>{state.scale=1;state.tx=0;state.ty=0;apply();};
const ptrs=new Map(); let drag=null, pinch=null;
wrap.addEventListener('pointerdown',e=>{ ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};drag=null;return;}
  if(e.target.closest('.seat'))return; if(state.scale<=1.002)return;
  drag={x:e.clientX,y:e.clientY,tx:state.tx,ty:state.ty};wrap.classList.add('grabbing');});
wrap.addEventListener('pointermove',e=>{ if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptrs.size>=2){const[a,b]=[...ptrs.values()];const nd=Math.hypot(a.x-b.x,a.y-b.y);
    if(pinch.d>0)zoomAt(pinch.cx,pinch.cy,nd/pinch.d); pinch.d=nd;pinch.cx=(a.x+b.x)/2;pinch.cy=(a.y+b.y)/2;return;}
  if(!drag)return;const k=svg.getScreenCTM().a;state.tx=drag.tx+(e.clientX-drag.x)/k;state.ty=drag.ty+(e.clientY-drag.y)/k;apply();});
function endPtr(e){ptrs.delete(e.pointerId); if(ptrs.size<2)pinch=null; if(ptrs.size===0){drag=null;wrap.classList.remove('grabbing');}}
wrap.addEventListener('pointerup',endPtr);
wrap.addEventListener('pointercancel',endPtr);
wrap.addEventListener('pointerleave',e=>{if(drag){drag=null;wrap.classList.remove('grabbing');}});

buildZones(); bindGen(); renderFloor(); renderCart();
</script>
</body></html>"""

HTML = HTML.replace("__SEATS__", SEATS_JSON).replace("__FLOORS__", FLOORS_JSON)
HTML = HTML.replace("__PBVB__", FLOORS["PB"]["vb"]).replace("__PBBG__", FLOORS["PB"]["bg"])
HTML = HTML.replace("__PBW__", str(PB_VB[0])).replace("__PBH__", str(PB_VB[1]))

out = r"C:/Users/Lenovo/3D Objects/nova/mapa-asientos.html"
open(out, "w", encoding="utf-8").write(HTML)
print("mapa-asientos.html generado |", len(SEATS), "asientos |", len(HTML), "bytes")
