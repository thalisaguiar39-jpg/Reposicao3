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
let produtos=[],regs=[],unsubs=[],unsubR=null,relRows=[];
$('#fData').value=hoje();$('#rAte').value=hoje();$('#rDe').value=addDias(hoje(),-6);

const doLogin=()=>signInWithEmailAndPassword(auth,$('#em').value,$('#pw').value).catch(()=>$('#err').textContent='E-mail ou senha incorretos.');
$('#go').addEventListener('click',doLogin);
$('#pw').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
$('#out').addEventListener('click',()=>signOut(auth));
onAuthStateChanged(auth,u=>{
  $('#login').hidden=!!u;$('#app').hidden=!u;unsubs.forEach(f=>f());unsubs=[];if(unsubR)unsubR();
  if(u){
    unsubs.push(onSnapshot(collection(db,'produtos'),s=>{produtos=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.ordem||0)-(b.ordem||0));render()}));
    assinar();
  }
});
function assinar(){
  if(unsubR)unsubR();const d=$('#fData').value||hoje();
  unsubR=onSnapshot(query(collection(db,'reposicoes'),where('data','>=',addDias(d,-14)),where('data','<=',d)),s=>{regs=s.docs.map(x=>({id:x.id,...x.data()}));render()});
}
$$('nav button').forEach(b=>b.addEventListener('click',()=>{$$('nav button').forEach(x=>x.classList.toggle('on',x===b));[['repo','repo'],['rel','rel'],['prod','prodTab']].forEach(([t,s])=>$('#'+s).hidden=t!==b.dataset.tab)}));

// vendido = (estoque anterior - desperdício anterior + reposição anterior) - estoque atual
function calc(list){
  const por={};list.forEach(r=>(por[r.pid]??=[]).push(r));
  Object.values(por).forEach(a=>{a.sort((x,y)=>x.data<y.data?-1:1);a.forEach((r,i)=>{r.apos=r.est+r.rep;const p=a[i-1];r.vend=p?p.apos-r.est-r.desp:null;r.dias=p?Math.round((new Date(r.data)-new Date(p.data))/864e5):null})});
  return list;
}
const prodDe=id=>produtos.find(p=>p.id===id);
function render(){
  const d=$('#fData').value,sel=$('#fProd').value;
  calc(regs);const dia=regs.filter(r=>r.data===d);
  $('#fProd').innerHTML=produtos.map(p=>`<option value="${p.id}">${esc(p.cod)} · ${esc(p.nome)}${dia.some(r=>r.pid===p.id)?'  ✓':''}</option>`).join('');
  if(sel)$('#fProd').value=sel;info();
  $('#dia').innerHTML=dia.length?`<table><tr><th>Cód.</th><th>Produto</th><th class="n">Estoque</th><th class="n">Desperd.</th><th class="n">Reposto</th><th class="n">Na prateleira</th><th class="n">Vendido*</th><th></th></tr>`+dia.map(r=>`<tr><td>${esc(r.cod)}</td><td>${esc(r.nome)}</td><td class="n">${num(r.est)}</td><td class="n">${num(r.desp)}</td><td class="n">${num(r.rep)}</td><td class="n">${num(r.apos)}</td><td class="n ${r.vend<0?'bad':''}">${r.vend==null?'—':num(r.vend)}</td><td><button class="x sm" data-del="${r.id}">✕</button></td></tr>`).join('')+'</table><p class="hint">*Vendido desde o registro anterior deste produto. Negativo = confira as contagens.</p>':'<p class="hint">Nenhuma reposição registrada nesta data.</p>';
  const need=dia.map(r=>({r,f:Math.max(0,(prodDe(r.pid)?.des||0)-r.apos)})).filter(x=>x.f>0);
  $('#prod-box').innerHTML=`<h3>O que produzir (${fmt(d)})</h3>`+(dia.length?(need.length?`<ul>${need.map(x=>`<li><span>${esc(x.r.cod)} · ${esc(x.r.nome)} <small>(prateleira ${num(x.r.apos)} / desejado ${prodDe(x.r.pid).des})</small></span><b>${num(x.f)}</b></li>`).join('')}</ul>`:'<p>✅ Todos os produtos repostos estão na quantidade desejada.</p>'):'<p class="hint">Registre as reposições para ver o que produzir.</p>')+(need.length?'<button id="pdfBtn" class="gold">Gerar PDF de produção</button>':'');
  const pb=$('#pdfBtn');if(pb)pb.addEventListener('click',()=>pdf(d,need));
  $('#seedBox').innerHTML=produtos.length?'':'<br><button id="seed">Carregar lista inicial de produtos</button>';
  const sb=$('#seed');if(sb)sb.addEventListener('click',seed);
  if(!document.activeElement.closest('#plist'))$('#plist').innerHTML=produtos.map(p=>`<div class="row" data-id="${p.id}"><label>Código<input data-f="cod" value="${esc(p.cod)}"></label><label>Nome<input data-f="nome" value="${esc(p.nome)}"></label><label>Validade<input data-f="val" value="${esc(p.val)}"></label><label>Estoque desejado<input type="number" min="0" data-f="des" value="${p.des}"></label><button class="x" data-delp="${p.id}">✕</button></div>`).join('');
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
  if(regs.some(r=>r.id===id)&&!confirm('Este produto já tem registro nesta data. Substituir?'))return;
  await setDoc(doc(db,'reposicoes',id),{data,pid:p.id,cod:p.cod,nome:p.nome,est:+$('#fEst').value||0,rep:+$('#fRep').value||0,desp:+$('#fDes').value||0,criado:Date.now()});
  ['fEst','fRep','fDes'].forEach(k=>$('#'+k).value='');
  const i=$('#fProd').selectedIndex;if(i<produtos.length-1)$('#fProd').selectedIndex=i+1;info();
});
document.addEventListener('click',async e=>{
  if(e.target.dataset.del&&confirm('Excluir este registro?'))await deleteDoc(doc(db,'reposicoes',e.target.dataset.del));
  if(e.target.dataset.delp&&confirm('Excluir este produto da lista? (o histórico é mantido)'))await deleteDoc(doc(db,'produtos',e.target.dataset.delp));
});
document.addEventListener('change',e=>{
  const f=e.target.dataset.f,id=e.target.closest('[data-id]')?.dataset.id;if(!f||!id)return;
  updateDoc(doc(db,'produtos',id),{[f]:e.target.type==='number'?+e.target.value||0:e.target.value});
});
$('#nAdd').addEventListener('click',async()=>{
  if(!$('#nCod').value||!$('#nNome').value)return alert('Informe código e nome.');
  await addDoc(collection(db,'produtos'),{cod:$('#nCod').value.trim(),nome:$('#nNome').value.trim(),val:$('#nVal').value,des:+$('#nDes').value||0,ordem:Math.max(0,...produtos.map(p=>p.ordem||0))+10});
  ['nCod','nNome','nVal','nDes'].forEach(k=>$('#'+k).value='');
});
async function seed(){const b=writeBatch(db);PRODUTOS.forEach((p,i)=>b.set(doc(collection(db,'produtos')),{...p,ordem:i*10}));await b.commit()}

function pdf(d,need){
  const {jsPDF}=window.jspdf,doc_=new jsPDF();
  doc_.setFillColor(50,74,35);doc_.rect(0,0,210,28,'F');doc_.setTextColor(176,143,50);doc_.setFontSize(22);doc_.text('TATS',14,18);
  doc_.setFontSize(11);doc_.setTextColor(255,255,255);doc_.text('Produção necessária — '+fmt(d),196,17,{align:'right'});
  doc_.autoTable({startY:36,head:[['Código','Produto','Na prateleira','Desejado','PRODUZIR']],
    body:need.map(x=>[x.r.cod,x.r.nome,num(x.r.apos),prodDe(x.r.pid).des,num(x.f)]),
    foot:[['','TOTAL de unidades','','',num(need.reduce((s,x)=>s+x.f,0))]],
    headStyles:{fillColor:[50,74,35],textColor:[176,143,50]},footStyles:{fillColor:[240,236,220],textColor:[50,74,35]},
    columnStyles:{2:{halign:'right'},3:{halign:'right'},4:{halign:'right',fontStyle:'bold'}}});
  doc_.save(`producao_${d}.pdf`);
}

// Relatório
$('#rGo').addEventListener('click',async()=>{
  const de=$('#rDe').value,ate=$('#rAte').value;if(!de||!ate||de>ate)return alert('Confira o período.');
  const s=await getDocs(query(collection(db,'reposicoes'),where('data','>=',addDias(de,-14)),where('data','<=',ate)));
  const all=calc(s.docs.map(x=>({id:x.id,...x.data()})));
  const per=all.filter(r=>r.data>=de);
  const res={};per.forEach(r=>{const o=res[r.pid]??={cod:r.cod,nome:r.nome,rep:0,desp:0,vend:0,regs:0};o.rep+=r.rep;o.desp+=r.desp;o.vend+=r.vend||0;o.regs++});
  relRows={de,ate,resumo:Object.values(res).sort((a,b)=>a.nome.localeCompare(b.nome)),diario:per.sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:a.nome.localeCompare(b.nome))};
  $('#rOut').innerHTML=relRows.resumo.length?`<table><tr><th>Cód.</th><th>Produto</th><th class="n">Reposto</th><th class="n">Desperdício</th><th class="n">Vendido</th><th class="n">Registros</th></tr>`+relRows.resumo.map(o=>`<tr><td>${esc(o.cod)}</td><td>${esc(o.nome)}</td><td class="n">${num(o.rep)}</td><td class="n">${num(o.desp)}</td><td class="n">${num(o.vend)}</td><td class="n">${o.regs}</td></tr>`).join('')+'</table><p class="hint">O vendido do 1º registro de um produto só é calculado se houver registro anterior (até 14 dias antes do período).</p>':'<p class="hint">Sem registros nesse período.</p>';
});
$('#rXls').addEventListener('click',()=>{
  if(!relRows.resumo?.length)return alert('Gere o relatório primeiro.');
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(relRows.resumo.map(o=>({'Código':o.cod,'Produto':o.nome,'Total reposto':o.rep,'Total desperdício':o.desp,'Total vendido':o.vend,'Estoque desejado':prodDe(produtos.find(p=>p.cod===o.cod)?.id)?.des??''}))),'Resumo');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(relRows.diario.map(r=>({'Data':fmt(r.data),'Código':r.cod,'Produto':r.nome,'Estoque na chegada':r.est,'Desperdício':r.desp,'Reposição':r.rep,'Na prateleira após':r.apos,'Vendido desde registro anterior':r.vend??'','Dias desde registro anterior':r.dias??''}))),'Diário');
  XLSX.writeFile(wb,`reposicao_${relRows.de}_a_${relRows.ate}.xlsx`);
});
