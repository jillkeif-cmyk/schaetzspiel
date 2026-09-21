const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const PORT=3839, URL='http://localhost:'+PORT;
const srv=spawn('node',['server.js'],{env:{...process.env,PORT,SECRET:'s',DATABASE_URL:'',ANTHROPIC_API_KEY:'',INVITE_CODE:'',AI_MOCK_MS:'3000'},stdio:['ignore','pipe','pipe']});
let out=''; srv.stdout.on('data',d=>out+=d); let crash=''; srv.stderr.on('data',d=>crash+=d);
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const post=(p,b,t)=>fetch(URL+p,{method:'POST',headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{})},body:JSON.stringify(b)}).then(r=>r.json());
async function play(s, get, label, lobbyWait) {
  s.emit('create'); await sleep(300); s.emit('settings',{ranked:false,maxQuestions:5,quick:true,countdown:10}); await sleep(200);
  s.emit('create_done'); if (lobbyWait) await sleep(lobbyWait); s.emit('start'); const t0=Date.now(); const asked=[]; let last=-1;
  while (get().phase!=='finished' && Date.now()-t0<120000) { await sleep(60); const st=get(); if (st.phase==='question' && st.qIndex!==last) { last=st.qIndex; asked.push(st.question.text); s.emit('answer', st.question.type==='mc'?0:100); } }
  const fresh=asked.filter(q=>/Testfrage/.test(q)).length, classics=asked.filter(q=>/Zähne|Weltkrieg/.test(q));
  console.log(label+':', asked.length, 'Fragen, davon', fresh, 'frisch |', asked.length-fresh, 'aus dem Pool | Klassiker:', classics.length);
  s.emit('leave'); await sleep(400);
}
(async()=>{
  await sleep(1800);
  const a=await post('/api/register',{name:'Nick',password:'geheim1'});
  let st=null; const s=io(URL,{auth:{token:a.token}}); s.on('state',x=>st=x); await sleep(500);
  await play(s, ()=>st, 'Fragen fertig schon in der Lobby', 7000);
  await play(s, ()=>st, 'Sofort gestartet, Fragen kommen während des Countdowns', 0);
  
  console.log('Protokoll:', out.split('\n').filter(l=>l.includes('KI-Prüfung')).slice(-3).join(' | '));
  console.log('Absturz:', crash.split('\n').filter(l=>l.includes('Error')).join('|')||'keiner');
})().catch(e=>console.error('FEHLER',e.message)).finally(()=>{srv.kill();setTimeout(()=>process.exit(),300);});
