
/* global io */
(() => {
  const socket = io();

  // Elements
  const online = document.getElementById('online');
  const startBtn = document.getElementById('startBtn');
  const nextBtn = document.getElementById('nextBtn');
  const nickname = document.getElementById('nickname');
  const text = document.getElementById('text');
  const send = document.getElementById('send');
  const messages = document.getElementById('messages');
  const themeToggle = document.getElementById('themeToggle');
  const statusText = document.getElementById('statusText');
  const rttEl = document.getElementById('rtt');

  // State
  let lastDateKey = null;
  let pendingTimers = new Map();
  let unsentQueue = [];

  // Utils
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
  const dateLabel = (ts) => new Date(ts).toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'short' });

  function requestNotify() { try { if (Notification.permission === 'default') Notification.requestPermission(); } catch{} }
  function notify(title, body) {
    try {
      if (document.hidden && Notification.permission === 'granted') {
        navigator.serviceWorker?.ready.then(r => r.showNotification(title, { body, icon:'/assets/icon-192.png', badge:'/assets/icon-192.png' }));
      }
    } catch {}
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
  function renderMessage(msg, mine=false, opts={}){
    addSeparatorIfNeeded(msg.ts);
    const wrap = document.createElement('div');
    wrap.className = 'msg' + (mine ? ' me' : '');
    wrap.dataset.id = msg.id;
    const content = document.createElement('div');
    content.className = 'content'; content.textContent = msg.text; wrap.appendChild(content);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = document.createElement('span'); time.textContent = fmtTime(msg.ts); meta.appendChild(time);
    if (mine){
      const status = document.createElement('span'); status.className='status badge'; status.dataset.role='status';
      status.textContent = opts.pending ? '전송중' : '보냄';
      if (opts.pending) wrap.classList.add('pending','dotting');
      meta.appendChild(status);
    }
    wrap.appendChild(meta);
    messages.appendChild(wrap);
    autoScroll();
  }
  function replaceTemp(tempId, realMsg){
    const el = document.querySelector(`.msg[data-id="${tempId}"]`);
    if (!el) return;
    el.dataset.id = realMsg.id;
    const s = el.querySelector('[data-role="status"]');
    if (s) s.textContent = '보냄';
    el.classList.remove('pending','dotting','failed');
  }
  function markFailed(tempId){
    const el = document.querySelector(`.msg[data-id="${tempId}"]`);
    if (!el) return;
    el.classList.add('failed'); const s = el.querySelector('[data-role="status"]'); if (s) s.textContent='실패';
    el.addEventListener('click', () => retry(tempId), { once:true });
  }
  function retry(tempId){
    const item = unsentQueue.find(x => x.tempId === tempId);
    if (!item) return;
    const el = document.querySelector(`.msg[data-id="${tempId}"]`);
    if (el){ el.classList.remove('failed'); el.classList.add('pending','dotting'); el.querySelector('[data-role="status"]').textContent='재전송중'; }
    socket.emit('message', { text: item.text });
    const t = setTimeout(() => markFailed(tempId), 5000);
    pendingTimers.set(tempId, t);
  }
  function autoScroll(){ messages.scrollTop = messages.scrollHeight; }

  // Theme
  (function initTheme(){
    const saved = localStorage.getItem('theme') || 'dark';
    if (saved === 'light') document.documentElement.classList.add('light');
    const savedNick = localStorage.getItem('nickname') || '';
    if (savedNick) nickname.value = savedNick;
  })();
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });

  // Start/Next
  startBtn.addEventListener('click', () => {
    const nick = nickname.value.trim() || 'Guest';
    localStorage.setItem('nickname', nick);
    requestNotify();
    statusText.textContent = '매칭 중';
    socket.emit('start', { nickname: nick });
  });
  nextBtn.addEventListener('click', () => {
    socket.emit('next');
    statusText.textContent = '매칭 중';
    addSessionEnd();
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
    unsentQueue.push({ tempId, text: value, ts });
    const t = setTimeout(() => markFailed(tempId), 5000);
    pendingTimers.set(tempId, t);
  }
  send.addEventListener('click', sendMessage);
  text.addEventListener('keydown', (e)=>{ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); } });

  // Socket events
  socket.on('connect', ()=>{});
  socket.on('online_count', (n) => { online.textContent = `접속자 ${n}`; });

  socket.on('system', (p)=>{
    const el = document.createElement('div'); el.className='msg system'; el.textContent = p.text || '시스템';
    messages.appendChild(el); autoScroll();
  });
  socket.on('matched', ({ partner }) => {
    statusText.textContent = `대화 중 · 상대: ${partner?.nickname || '상대'}`;
  });
  socket.on('partner_left', ({ reason }) => {
    statusText.textContent = '매칭 중';
    const el = document.createElement('div'); el.className='msg system'; el.textContent = reason || '상대가 나갔습니다.';
    messages.appendChild(el); addSessionEnd();
    autoScroll();
  });
  socket.on('typing', (flag)=>{}); // minimized UI (no typing badge to keep clean)

  socket.on('message', (msg) => {
    addSeparatorIfNeeded(msg.ts);
    renderMessage(msg, false);
    notify('새 메시지', msg.text);
    if (!document.hidden) socket.emit('message_read', msg.id);
  });
  socket.on('message_echo', (msg)=>{
    // match with first pending
    const item = unsentQueue.shift();
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
  socket.on('client_pong', (ts) => {
    const rtt = Math.max(1, Math.round(performance.now() - ts));
    rttEl.textContent = rtt;
    rttEl.style.color = rtt < 80 ? 'var(--success)' : (rtt < 200 ? 'gold' : 'var(--danger)');
  });
})();