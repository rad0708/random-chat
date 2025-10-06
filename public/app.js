
/* global io */
(() => {
  const socket = io();

  // Elements
  const online = document.getElementById('online');
  const startBtn = document.getElementById('startBtn');
  const nextBtn = document.getElementById('nextBtn');
  const text = document.getElementById('text');
  const send = document.getElementById('send');
  const typingEl = document.getElementById('typing');
  const messages = document.getElementById('messages');
  const pNick = document.getElementById('pNick');
  const pAbout = document.getElementById('pAbout');
  const meNick = document.getElementById('meNick');
  const meAbout = document.getElementById('meAbout');
  const themeToggle = document.getElementById('themeToggle');
  const statusText = document.getElementById('statusText');
  const rttEl = document.getElementById('rtt');

  // State
  let myId = null;
  let partnerId = null;
  let isTyping = false;
  let typingTimer = null;
  let lastDateKey = null; // for date separators
  let pendingTimers = new Map(); // tempId -> timeout
  let unsentMap = new Map(); // tempId -> payload

  // Utils
  const fmtTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const dateKey = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  };
  const dateLabel = (ts) => {
    const d = new Date(ts);
    const opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
    return d.toLocaleDateString('ko-KR', opts);
  };
  function requestNotify() {
    try { if (Notification.permission === 'default') Notification.requestPermission(); } catch {}
  }
  function notify(title, body) {
    try {
      if (document.hidden && Notification.permission === 'granted') {
        navigator.serviceWorker?.ready.then(r => r.showNotification(title, { body, icon: '/assets/icon-192.png', badge: '/assets/icon-192.png' }));
      }
    } catch {}
  }
  function addSeparatorIfNeeded(ts) {
    const key = dateKey(ts);
    if (key !== lastDateKey) {
      lastDateKey = key;
      const sep = document.createElement('div');
      sep.className = 'separator';
      sep.textContent = dateLabel(ts);
      messages.appendChild(sep);
    }
  }
  function addSessionEnd() {
    const line = document.createElement('div');
    line.className = 'session-end';
    line.textContent = '대화가 종료되었습니다';
    messages.appendChild(line);
    autoScroll();
  }
  function systemMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg system';
    el.textContent = text;
    messages.appendChild(el);
    autoScroll();
  }
  function renderMessage(msg, isMine=false, opts={}) {
    addSeparatorIfNeeded(msg.ts);
    const wrap = document.createElement('div');
    wrap.className = 'msg' + (isMine ? ' me' : '');
    wrap.dataset.id = msg.id;

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = msg.text;
    wrap.appendChild(content);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = document.createElement('span'); time.textContent = fmtTime(msg.ts);
    meta.appendChild(time);

    if (isMine) {
      const status = document.createElement('span');
      status.className = 'status badge';
      status.dataset.role = 'status';
      status.textContent = opts.pending ? '전송중' : '보냄';
      if (opts.pending) wrap.classList.add('pending', 'dotting');
      meta.appendChild(status);
    }

    wrap.appendChild(meta);
    messages.appendChild(wrap);
    autoScroll();
  }
  function updateMessageStatus(tempId, { ok, fail }={}) {
    const el = document.querySelector(`.msg[data-id="${tempId}"]`);
    if (!el) return;
    const s = el.querySelector('[data-role="status"]');
    el.classList.remove('dotting','pending','failed');
    if (ok) { s.textContent = '보냄'; }
    if (fail) { s.textContent = '실패'; el.classList.add('failed'); }
  }
  function replaceTempWithReal(tempId, realMsg) {
    const el = document.querySelector(`.msg[data-id="${tempId}"]`);
    if (!el) return;
    el.dataset.id = realMsg.id;
    el.querySelector('.content').textContent = realMsg.text;
    el.querySelector('[data-role="status"]').textContent = '보냄';
  }
  function autoScroll() {
    messages.scrollTop = messages.scrollHeight;
  }

  // Theme
  (function initTheme(){
    const saved = localStorage.getItem('theme') || 'dark';
    if (saved === 'light') document.documentElement.classList.add('light');
  })();
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });

  // Join / Next
  startBtn.addEventListener('click', () => {
    requestNotify();
    statusText.textContent = '매칭 중';
    socket.emit('join_queue', { profile: { nickname: meNick.value, about: meAbout.value } });
  });
  nextBtn.addEventListener('click', () => {
    socket.emit('next');
    pNick.textContent = '새 상대 찾는 중…'; pAbout.textContent = '';
    statusText.textContent = '매칭 중';
    addSessionEnd();
  });

  // Typing
  text.addEventListener('input', () => {
    if (!isTyping) { isTyping = true; socket.emit('typing', true); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { isTyping = false; socket.emit('typing', false); }, 800);
  });

  // Send (with pending/timeout/retry)
  function sendMessage() {
    const value = text.value.trim();
    if (!value) return;
    const tempId = 'tmp_' + Math.random().toString(36).slice(2,10);
    const ts = Date.now();
    renderMessage({ id: tempId, text: value, ts }, true, { pending: true });
    // optimistic send
    socket.emit('message', { text: value });
    text.value = '';

    // Save payload for retry
    unsentMap.set(tempId, { text: value, ts });

    // timeout for ack
    const timer = setTimeout(() => {
      updateMessageStatus(tempId, { fail: true });
      // add retry click
      const el = document.querySelector(`.msg[data-id="${tempId}"]`);
      if (el) {
        el.addEventListener('click', () => {
          if (!el.classList.contains('failed')) return;
          // retry
          el.classList.remove('failed');
          el.classList.add('pending','dotting');
          el.querySelector('[data-role="status"]').textContent = '재전송중';
          socket.emit('message', { text: value });
          // new timeout
          const t2 = setTimeout(()=>updateMessageStatus(tempId,{fail:true}), 5000);
          pendingTimers.set(tempId, t2);
        }, { once: true });
      }
    }, 5000);
    pendingTimers.set(tempId, timer);
  }

  send.addEventListener('click', sendMessage);
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Socket events
  socket.on('connect', () => { myId = socket.id; });
  socket.on('online_count', (n) => { online.textContent = `접속자 ${n}`; });

  socket.on('system', (p) => systemMessage(p.text || '시스템'));
  socket.on('matched', ({ roomId, partner }) => {
    partnerId = true;
    pNick.textContent = partner?.nickname || '상대';
    pAbout.textContent = partner?.about || '';
    statusText.textContent = '대화 중';
    systemMessage('상대가 연결되었습니다.');
  });

  socket.on('partner_left', ({ reason }) => {
    partnerId = null;
    systemMessage(reason || '상대가 나갔습니다.');
    pNick.textContent = '상대를 찾는 중…'; pAbout.textContent = '';
    statusText.textContent = '매칭 중';
    addSessionEnd();
  });

  socket.on('typing', (flag) => { typingEl.textContent = flag ? '상대가 입력 중…' : ''; });

  socket.on('message', (msg) => {
    addSeparatorIfNeeded(msg.ts);
    renderMessage(msg, false);
    notify('새 메시지', msg.text);
    if (!document.hidden) socket.emit('message_read', msg.id);
  });

  socket.on('message_echo', (msg) => {
    // find any pending temp message to convert
    const temp = [...unsentMap.keys()][0];
    if (temp) {
      clearTimeout(pendingTimers.get(temp));
      pendingTimers.delete(temp);
      replaceTempWithReal(temp, msg);
      unsentMap.delete(temp);
    } else {
      // if not found (edge), just render as mine (rare)
      renderMessage(msg, true);
    }
  });

  socket.on('message_read', ({ id }) => {
    const el = document.querySelector(`.msg[data-id="${id}"] [data-role="status"]`);
    if (el) el.textContent = '읽음';
  });

  // Ping/RTT
  setInterval(() => { socket.emit('client_ping', performance.now()); }, 4000);
  socket.on('client_pong', (ts) => {
    const rtt = Math.max(1, Math.round(performance.now() - ts));
    rttEl.textContent = rtt;
    // color hint via text content (kept simple)
    rttEl.style.color = rtt < 80 ? 'var(--success)' : (rtt < 200 ? 'gold' : 'var(--danger)');
  });

  // Visibility: mark last as read when focused
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const last = [...document.querySelectorAll('.msg')].pop();
      if (last && last.classList.contains('me')) socket.emit('message_read', last.dataset.id);
    }
  });

})();
