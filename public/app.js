
/* global io */
(() => {
  const socket = io();

  // Elements
  const online = document.getElementById('online');
  const text = document.getElementById('text');
  const send = document.getElementById('send');
  const nextBtn = document.getElementById('nextBtn');
  const messages = document.getElementById('messages');
  const themeToggle = document.getElementById('themeToggle');
  const statusText = document.getElementById('statusText');
  const rttEl = document.getElementById('rtt');
  const onboard = document.getElementById('onboard');
  const obNick = document.getElementById('obNick');
  const obStart = document.getElementById('obStart');
  const obLight = document.getElementById('obLight');

  // State
  let lastDateKey = null;
  let pendingTimers = new Map();
  let pendingQueue = []; // { tempId, text, ts }

  // Utils
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
  const dateLabel = (ts) => new Date(ts).toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
  function requestNotify() { try { if (Notification.permission === 'default') Notification.requestPermission(); } catch{} }
  function notify(title, body) {
    try { if (document.hidden && Notification.permission === 'granted') {
      navigator.serviceWorker?.ready.then(r => r.showNotification(title, { body, icon:'/assets/icon-192.png', badge:'/assets/icon-192.png' }));
    }} catch {}
  }
  function addSeparatorIfNeeded(ts){
    const k = dateKey(ts);
    if (k !== lastDateKey) {
      lastDateKey = k;
      const sep = document.createElement('div');
      sep.className = 'separator';
      sep.textContent = dateLabel(ts);
      messages.appendChild(sep);
    }
  }
  function addSessionEnd(){
    const line = document.createElement('div');
    line.className = 'session-end';
    line.textContent = '대화가 종료되었습니다';
    messages.appendChild(line);
    autoScroll();
  }
  function systemMessage(text){
    const el = document.createElement('div'); el.className='msg system'; el.textContent = text;
    messages.appendChild(el); autoScroll();
  }
  function renderMessage(msg, mine=false, opts={}){
    addSeparatorIfNeeded(msg.ts);
    const wrap = document.createElement('div'); wrap.className='msg'+(mine?' me':'');
    wrap.dataset.id = msg.id;
    const content = document.createElement('div'); content.className='content'; content.textContent = msg.text; wrap.appendChild(content);
    const meta = document.createElement('div'); meta.className='meta';
    const time = document.createElement('span'); time.textContent = fmtTime(msg.ts); meta.appendChild(time);
    if (mine){
      const status = document.createElement('span'); status.className='status badge'; status.dataset.role='status';
      status.textContent = opts.pending ? '전송중' : '보냄';
      if (opts.pending) wrap.classList.add('pending','dotting');
      meta.appendChild(status);
    }
    wrap.appendChild(meta); messages.appendChild(wrap); autoScroll();
  }
  function replaceTemp(tempId, realMsg){
    const el = document.querySelector(`.msg[data-id="${tempId}"]`);
    if (!el) return;
    el.dataset.id = realMsg.id;
    el.classList.remove('pending','dotting','failed');
    const s = el.querySelector('[data-role="status"]'); if (s) s.textContent='보냄';
  }
  function markFailed(tempId){
    const el = document.querySelector(`.msg[data-id="${tempId}"]`);
    if (!el) return;
    el.classList.add('failed'); const s = el.querySelector('[data-role="status"]'); if (s) s.textContent='실패';
    el.addEventListener('click', () => retry(tempId), { once:true });
  }
  function retry(tempId){
    const item = pendingQueue.find(x=>x.tempId===tempId);
    if (!item) return;
    const el = document.querySelector(`.msg[data-id="${tempId}"]`);
    if (el){ el.classList.remove('failed'); el.classList.add('pending','dotting'); el.querySelector('[data-role="status"]').textContent='재전송중'; }
    socket.emit('message', { text: item.text });
    const t2 = setTimeout(()=>markFailed(tempId), 5000); pendingTimers.set(tempId, t2);
  }
  function autoScroll(){ messages.scrollTop = messages.scrollHeight; }

  // Theme
  (function boot(){
    const saved = localStorage.getItem('theme') || 'dark';
    if (saved === 'light') document.documentElement.classList.add('light');
    const savedNick = localStorage.getItem('nickname') || '';
    if (savedNick) obNick.value = savedNick;
    onboard.style.display='grid';
    obNick.focus();
  })();
  themeToggle.addEventListener('click', ()=>{
    document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
  obLight.addEventListener('click', ()=>{
    document.documentElement.classList.add('light'); localStorage.setItem('theme','light');
  });

  // Onboarding start
  function start(){
    const nick = (obNick.value.trim() || 'Guest').slice(0,20);
    localStorage.setItem('nickname', nick);
    onboard.style.display='none';
    requestNotify();
    statusText.textContent = '매칭 중';
    socket.emit('start', { nickname: nick });
  }
  obStart.addEventListener('click', start);
  obNick.addEventListener('keydown', (e)=>{ if (e.key==='Enter') start(); });

  // Next
  nextBtn.addEventListener('click', ()=>{
    socket.emit('next');
    statusText.textContent = '매칭 중';
    addSessionEnd();
  });

  // Typing (no UI badge to keep clean; kept protocol for future)
  text.addEventListener('input', ()=>{
    // could emit typing throttled; omitted to stay minimal on UI
  });

  // Send
  function sendMessage(){
    const value = text.value.trim();
    if (!value) return;
    const tempId = 'tmp_' + Math.random().toString(36).slice(2,10);
    const ts = Date.now();
    renderMessage({ id: tempId, text: value, ts }, true, { pending: true });
    socket.emit('message', { text: value });
    text.value = '';
    pendingQueue.push({ tempId, text: value, ts });
    const t = setTimeout(()=>markFailed(tempId), 5000); pendingTimers.set(tempId, t);
  }
  send.addEventListener('click', sendMessage);
  text.addEventListener('keydown', (e)=>{ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); } });

  // Socket events
  socket.on('online_count', (n)=>{ online.textContent = `접속자 ${n}`; });
  socket.on('system', (p)=> systemMessage(p.text || '시스템'));

  socket.on('matched', ({ partner }) => {
    statusText.textContent = `대화 중 · ${partner?.nickname || '상대'}`;
    systemMessage('상대가 연결되었습니다.');
  });
  socket.on('partner_left', ({ reason }) => {
    statusText.textContent = '매칭 중';
    systemMessage(reason || '상대가 나갔습니다.');
    addSessionEnd();
  });

  socket.on('message', (msg)=>{
    addSeparatorIfNeeded(msg.ts);
    renderMessage(msg, false);
    notify('새 메시지', msg.text);
    if (!document.hidden) socket.emit('message_read', msg.id);
  });
  socket.on('message_echo', (msg)=>{
    const item = pendingQueue.shift();
    if (item){
      clearTimeout(pendingTimers.get(item.tempId)); pendingTimers.delete(item.tempId);
      replaceTemp(item.tempId, msg);
    } else {
      renderMessage(msg, true);
    }
  });
  socket.on('message_read', ({ id }) => {
    const el = document.querySelector(`.msg[data-id="${id}"] [data-role="status"]`);
    if (el) el.textContent = '읽음';
  });

  // RTT
  setInterval(()=> socket.emit('client_ping', performance.now()), 4000);
  socket.on('client_pong', (ts)=>{
    const rtt = Math.max(1, Math.round(performance.now() - ts));
    rttEl.textContent = rtt;
    rttEl.style.color = rtt < 80 ? 'var(--success)' : (rtt < 200 ? 'gold' : 'var(--danger)');
  });
})();