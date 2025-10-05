import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.1.7/+esm';
const el = (id)=>document.getElementById(id);
const logs = el('logs'), spinner=el('spinner'), form=el('form'), msg=el('msg');
const myHashEl=el('my-hash'), peerHashEl=el('peer-hash');
const btnFind=el('btn-find'), btnCancel=el('btn-cancel'), btnSkip=el('btn-skip'), btnReport=el('btn-report');
const genderSel=el('gender'), prefSel=el('pref'), nickInput=el('nickname');
let socket, roomId=null, myHash=null, peerHash=null, waiting=false;
function addLog(text, cls='sys'){const d=document.createElement('div'); if(cls==='sys'){d.className='sys';d.textContent=text;}else{d.className='bubble '+cls; d.innerHTML=DOMPurify.sanitize(text);} logs.appendChild(d); logs.scrollTop=logs.scrollHeight;}
function toggleSpinner(s){spinner.classList.toggle('hidden', !s);}
function connect(){ socket = io('/', { transports:['websocket'] });
  socket.on('connect', ()=>{ addLog('서버에 연결되었습니다.'); myHash = socket.id.slice(-10); myHashEl.textContent = myHash; });
  socket.on('matched', (data)=>{ roomId=data.roomId; peerHash=data.peerHash; peerHashEl.textContent=peerHash; waiting=false; btnFind.disabled=true; btnCancel.disabled=false; btnSkip.disabled=false; toggleSpinner(false); addLog(`상대와 연결되었습니다. (상대: ${peerHash})`); });
  socket.on('room_closed', ()=>{ addLog('상대가 나갔습니다. 새로운 상대를 찾아보세요.'); roomId=null; peerHash=null; peerHashEl.textContent='-'; btnFind.disabled=false; btnCancel.disabled=true; btnSkip.disabled=true; });
  socket.on('peer_message', (m)=> addLog(m, 'peer') );
  socket.on('sys', (m)=> addLog(m) );
}
connect();
btnFind.onclick = ()=>{ if(waiting) return; const payload={ nickname:(nickInput.value||'게스트').slice(0,20), gender:genderSel.value, preference:prefSel.value }; waiting=true; toggleSpinner(true); socket.emit('find_partner', payload); addLog('상대를 찾고 있습니다...'); btnFind.disabled=true; btnCancel.disabled=false; };
btnCancel.onclick = ()=>{ waiting=false; toggleSpinner(false); socket.emit('cancel_wait'); btnFind.disabled=false; btnCancel.disabled=true; };
btnSkip.onclick = ()=>{ if(!roomId) return; socket.emit('skip'); addLog('상대를 스킵했습니다. 새로운 상대를 찾는 중...'); waiting=true; toggleSpinner(true); roomId=null; peerHash=null; peerHashEl.textContent='-'; btnFind.disabled=true; btnCancel.disabled=false; };
btnReport.onclick = ()=>{ const reason=prompt('신고 사유를 입력하세요.'); if(!reason) return; socket.emit('report',{ roomId, peerHash, reason }); alert('신고가 접수되었습니다.'); };
form.addEventListener('submit', (e)=>{ e.preventDefault(); if(!roomId) return; const text=msg.value.trim(); if(!text) return; socket.emit('message', text); addLog(text,'me'); msg.value=''; });
document.getElementById('toggle-theme').onclick = ()=> document.body.classList.toggle('light');