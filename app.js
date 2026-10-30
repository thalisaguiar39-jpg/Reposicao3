import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,collection,doc,onSnapshot,addDoc,setDoc,updateDoc,deleteDoc,getDocs,query,where,writeBatch} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
import {PRODUTOS} from "./produtos.js";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=n=>(+n||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const fmt=d=>d.split('-').reverse().join('/');
const hoje=()=>new Date().toLocaleDateString('sv');
const addDias=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toLocaleDateString('sv')};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);

// ===== MERCADOS =====
// Barigui usa as cole\u00e7\u00f5es que j\u00e1 existiam (nenhum dado precisa ser migrado).
const LOJAS={
  barigui:{nome:'\u00cdtalo Barigui',prod:'produtos',rep:'reposicoes'},
  portao:{nome:'\u00cdtalo Port\u00e3o',prod:'produtos_portao',rep:'reposicoes_portao'}
};
let loja=localStorage.getItem('loja');if(!LOJAS[loja])loja='barigui';
const colP=()=>LOJAS[loja].prod,colR=()=>LOJAS[loja].rep;
function lojaUI(){$$('#lojas button').forEach(b=>b.classList.toggle('on',b.dataset.loja===loja))}

let produtos=[],regs=[],unsubs=[],unsubR=null,relRows=[];
$('#fData').value=hoje();$('#rAte').value=hoje();$('#rDe').value=addDias(hoje(),-6);lojaUI();

const doLogin=()=>signInWithEmailAndPassword(auth,$('#em').value,$('#pw').value).catch(()=>$('#err').textContent='E-mail ou senha incorretos.');
$('#go').addEventListener('click',doLogin);
$('#pw').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
$('#out').addEventListener('click',()=>signOut(auth));

function parar(){unsubs.forEach(f=>f());unsubs=[];if(unsubR)unsubR();unsubR=null}
function iniciar(){
  unsubs.push(onSnapshot(collection(db,colP()),s=>{produtos=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.ordem||0)-(b.ordem||0));render()}));
  assinar();
}
onAuthStateChanged(auth,u=>{
  $('#login').hidden=!!u;$('#app').hidden=!u;parar();
  if(u)iniciar();
});
function assinar(){
  if(unsubR)unsubR();const d=$('#fData').value||hoje();
  unsubR=onSnapshot(query(collection(db,colR()),where('data','>=',addDias(d,-14)),where('data','<=',d)),s=>{regs=s.docs.map(x=>({id:x.id,...x.data()}));render()});
}

// Troca de mercado
$$('#lojas button').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.loja===loja)return;
  loja=b.dataset.loja;localStorage.setItem('loja',loja);lojaUI();
  produtos=[];regs=[];relRows=[];
  ['fEst','fRep','fDes'].forEach(k=>$('#'+k).value='');
  ['fProd','pinfo','dia','prod-box','seedBox','plist','rOut'].forEach(k=>$('#'+k).innerHTML='');
  parar();iniciar();
}));

$$('nav button').forEach(b=>b.addEventListener('click',()=>{$$('nav button').forEach(x=>x.classList.toggle('on',x===b));[['repo','repo'],['rel','rel'],['prod','prodTab']].forEach(([t,s])=>$('#'+s).hidden=t!==b.dataset.tab)}));

// vendido = (estoque anterior - desperd\u00edcio anterior + reposi\u00e7\u00e3o anterior) - estoque atual
function calc(list){
  const por={};list.forEach(r=>(por[r.pid]??=[]).push(r));
  Object.values(por).forEach(a=>{a.sort((x,y)=>x.data<y.data?-1:1);a.forEach((r,i)=>{r.apos=r.est-r.desp+r.rep;const p=a[i-1];r.vend=p?p.apos-r.est:null;r.dias=p?Math.round((new Date(r.data)-new Date(p.data))/864e5):null})});
  return list;
}
const prodDe=id=>produtos.find(p=>p.id===id);
function render(){
  const d=$('#fData').value,sel=$('#fProd').value;
  calc(regs);const dia=regs.filter(r=>r.data===d);
  $('#fProd').innerHTML=produtos.map(p=>`<option value="${p.id}">${esc(p.cod)} \u00b7 ${esc(p.nome)}${dia.some(r=>r.pid===p.id)?'  \u2713':''}</option>`).join('');
  if(sel)$('#fProd').value=sel;info();
  $('#dia').innerHTML=dia.length?`<table><tr><th>C\u00f3d.</th><th>Produto</th><th class="n">Estoque</th><th class="n">Desperd.</th><th class="n">Reposto</th><th class="n">Na prateleira</th><th class="n">Vendido*</th><th></th></tr>`+dia.map(r=>`<tr><td>${esc(r.cod)}</td><td>${esc(r.nome)}</td><td class="n">${num(r.est)}</td><td class="n">${num(r.desp)}</td><td class="n">${num(r.rep)}</td><td class="n">${num(r.apos)}</td><td class="n ${r.vend<0?'bad':''}">${r.vend==null?'\u2014':num(r.vend)}</td><td><button class="x sm" data-del="${r.id}">\u2715</button></td></tr>`).join('')+'</table><p class="hint">*Vendido desde o registro anterior deste produto. Negativo = confira as contagens.</p>':'<p class="hint">Nenhuma reposi\u00e7\u00e3o registrada nesta data.</p>';
  const need=dia.map(r=>({r,f:Math.max(0,(prodDe(r.pid)?.des||0)-r.apos)})).filter(x=>x.f>0);
  $('#prod-box').innerHTML=`<h3>O que produzir \u2014 ${esc(LOJAS[loja].nome)} (${fmt(d)})</h3>`+(dia.length?(need.length?`<ul>${need.map(x=>`<li><span>${esc(x.r.cod)} \u00b7 ${esc(x.r.nome)} <small>(prateleira ${num(x.r.apos)} / desejado ${prodDe(x.r.pid).des})</small></span><b>${num(x.f)}</b></li>`).join('')}</ul>`:'<p>\u2705 Todos os produtos repostos est\u00e3o na quantidade desejada.</p>'):'<p class="hint">Registre as reposi\u00e7\u00f5es para ver o que produzir.</p>')+(need.length?'<button id="pdfBtn" class="gold">Gerar PDF de produ\u00e7\u00e3o</button>':'');
  const pb=$('#pdfBtn');if(pb)pb.addEventListener('click',()=>pdf(d,need));
  $('#seedBox').innerHTML=produtos.length?'':'<br><button id="seed">Carregar lista inicial de produtos</button>';
  const sb=$('#seed');if(sb)sb.addEventListener('click',seed);
  if(!document.activeElement.closest('#plist'))$('#plist').innerHTML=produtos.map(p=>`<div class="row" data-id="${p.id}"><label>C\u00f3digo<input data-f="cod" value="${esc(p.cod)}"></label><label>Nome<input data-f="nome" value="${esc(p.nome)}"></label><label>Validade<input data-f="val" value="${esc(p.val)}"></label><label>Estoque desejado<input type="number" min="0" data-f="des" value="${p.des}"></label><button class="x" data-delp="${p.id}">\u2715</button></div>`).join('');
}
function info(){
  const p=prodDe($('#fProd').value);
  $('#pinfo').innerHTML=p?`<b>${esc(p.cod)}</b><span>Validade: ${esc(p.val)}</span><span>Desejado: ${p.des}</span>`:'';
}
$('#fProd').addEventListener('change',()=>{
  info();const r=regs.find(x=>x.id===`${$('#fData').value}_${$('#fProd').value}`);
  $('#fEst').value=r?r.est:'';$('#fRep').value=r?r.rep:'';$('#fDes').value=r?r.desp:'';
});
$('#fData').addEventListener('change',()=>{assinar()});
$('#fAdd').addEventListener('click',async()=>{
  const p=prodDe($('#fProd').value),data=$('#fData').value;
  if(!p||!data||$('#fEst').value==='')return alert('Escolha o produto e informe o estoque atual.');
  const id=`${data}_${p.id}`;
  if(regs.some(r=>r.id===id)&&!confirm('Este produto j\u00e1 tem registro nesta data. Substituir?'))return;
  await setDoc(doc(db,colR(),id),{data,pid:p.id,cod:p.cod,nome:p.nome,est:+$('#fEst').value||0,rep:+$('#fRep').value||0,desp:+$('#fDes').value||0,criado:Date.now()});
  ['fEst','fRep','fDes'].forEach(k=>$('#'+k).value='');
  const i=$('#fProd').selectedIndex;if(i<produtos.length-1)$('#fProd').selectedIndex=i+1;info();
});
document.addEventListener('click',async e=>{
  if(e.target.dataset.del&&confirm('Excluir este registro?'))await deleteDoc(doc(db,colR(),e.target.dataset.del));
  if(e.target.dataset.delp&&confirm('Excluir este produto da lista? (o hist\u00f3rico \u00e9 mantido)'))await deleteDoc(doc(db,colP(),e.target.dataset.delp));
});
document.addEventListener('change',e=>{
  const f=e.target.dataset.f,id=e.target.closest('[data-id]')?.dataset.id;if(!f||!id)return;
  updateDoc(doc(db,colP(),id),{[f]:e.target.type==='number'?+e.target.value||0:e.target.value});
});
$('#nAdd').addEventListener('click',async()=>{
  if(!$('#nCod').value||!$('#nNome').value)return alert('Informe c\u00f3digo e nome.');
  await addDoc(collection(db,colP()),{cod:$('#nCod').value.trim(),nome:$('#nNome').value.trim(),val:$('#nVal').value,des:+$('#nDes').value||0,ordem:Math.max(0,...produtos.map(p=>p.ordem||0))+10});
  ['nCod','nNome','nVal','nDes'].forEach(k=>$('#'+k).value='');
});
async function seed(){const b=writeBatch(db);PRODUTOS.forEach((p,i)=>b.set(doc(collection(db,colP())),{...p,ordem:i*10}));await b.commit()}

function pdf(d,need){
  const {jsPDF}=window.jspdf,doc_=new jsPDF();
  doc_.setFillColor(50,74,35);doc_.rect(0,0,210,28,'F');doc_.setTextColor(176,143,50);doc_.setFontSize(22);doc_.text('TATS',14,18);
  doc_.setFontSize(11);doc_.setTextColor(255,255,255);doc_.text('Produ\u00e7\u00e3o necess\u00e1ria \u2014 '+fmt(d),196,13,{align:'right'});
  doc_.setFontSize(13);doc_.setTextColor(176,143,50);doc_.text(LOJAS[loja].nome,196,22,{align:'right'});
  doc_.autoTable({startY:36,head:[['C\u00f3digo','Produto','Na prateleira','Desejado','PRODUZIR']],
    body:need.map(x=>[x.r.cod,x.r.nome,num(x.r.apos),prodDe(x.r.pid).des,num(x.f)]),
    foot:[['','TOTAL de unidades','','',num(need.reduce((s,x)=>s+x.f,0))]],
    headStyles:{fillColor:[50,74,35],textColor:[176,143,50]},footStyles:{fillColor:[240,236,220],textColor:[50,74,35]},
    columnStyles:{2:{halign:'right'},3:{halign:'right'},4:{halign:'right',fontStyle:'bold'}}});
  doc_.save(`producao_${loja}_${d}.pdf`);
}

// Relat\u00f3rio
$('#rGo').addEventListener('click',async()=>{
  const de=$('#rDe').value,ate=$('#rAte').value;if(!de||!ate||de>ate)return alert('Confira o per\u00edodo.');
  const lj=loja;
  const s=await getDocs(query(collection(db,colR()),where('data','>=',addDias(de,-14)),where('data','<=',ate)));
  if(lj!==loja)return; // trocou de mercado enquanto carregava
  const all=calc(s.docs.map(x=>({id:x.id,...x.data()})));
  const per=all.filter(r=>r.data>=de);
  const res={};per.forEach(r=>{const o=res[r.pid]??={cod:r.cod,nome:r.nome,rep:0,desp:0,vend:0,regs:0};o.rep+=r.rep;o.desp+=r.desp;o.vend+=r.vend||0;o.regs++});
  relRows={loja:lj,de,ate,resumo:Object.values(res).sort((a,b)=>a.nome.localeCompare(b.nome)),diario:per.sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:a.nome.localeCompare(b.nome))};
  $('#rOut').innerHTML=relRows.resumo.length?`<h3>${esc(LOJAS[lj].nome)} \u00b7 ${fmt(de)} a ${fmt(ate)}</h3><table><tr><th>C\u00f3d.</th><th>Produto</th><th class="n">Reposto</th><th class="n">Desperd\u00edcio</th><th class="n">Vendido</th><th class="n">Registros</th></tr>`+relRows.resumo.map(o=>`<tr><td>${esc(o.cod)}</td><td>${esc(o.nome)}</td><td class="n">${num(o.rep)}</td><td class="n">${num(o.desp)}</td><td class="n">${num(o.vend)}</td><td class="n">${o.regs}</td></tr>`).join('')+'</table><p class="hint">O vendido do 1\u00ba registro de um produto s\u00f3 \u00e9 calculado se houver registro anterior (at\u00e9 14 dias antes do per\u00edodo).</p>':'<p class="hint">Sem registros nesse per\u00edodo.</p>';
});
$('#rXls').addEventListener('click',()=>{
  if(!relRows.resumo?.length)return alert('Gere o relat\u00f3rio primeiro.');
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(relRows.resumo.map(o=>({'C\u00f3digo':o.cod,'Produto':o.nome,'Total reposto':o.rep,'Total desperd\u00edcio':o.desp,'Total vendido':o.vend,'Estoque desejado':prodDe(produtos.find(p=>p.cod===o.cod)?.id)?.des??''}))),'Resumo');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(relRows.diario.map(r=>({'Data':fmt(r.data),'C\u00f3digo':r.cod,'Produto':r.nome,'Estoque na chegada':r.est,'Desperd\u00edcio':r.desp,'Reposi\u00e7\u00e3o':r.rep,'Na prateleira ap\u00f3s':r.apos,'Vendido desde registro anterior':r.vend??'','Dias desde registro anterior':r.dias??''}))),'Di\u00e1rio');
  XLSX.writeFile(wb,`reposicao_${relRows.loja}_${relRows.de}_a_${relRows.ate}.xlsx`);
});
