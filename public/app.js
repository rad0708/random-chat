
/* global io */
(() => {
  const socket = io();

  // Elements
  const online = document.getElementById('online');
  const nextBtn = document.getElementById('nextBtn');
  const text = document.getElementById('text');
  const send = document.getElementById('send');
  const typingEl = document.getElementById('typing');
  const messages = document.getElementById('messages');
  const pNick = document.getElementById('pNick');
  const pAbout = document.getElementById('pAbout');
  const replyPreview = document.getElementById('replyPreview');
  const themeToggle = document.getElementById('themeToggle');
  const onboard = document.getElementById('onboard');
  const obNick = document.getElementById('obNick');
  const obAbout = document.getElementById('obAbout');
  const obAgree = document.getElementById('obAgree');
  const obStart = document.getElementById('obStart');
  const obLight = document.getElementById('obLight');
  const statusText = document.getElementById('statusText');
  const rttEl = document.getElementById('rtt');
  const scrollLatest = document.getElementById('scrollLatest');
  const quickPrompts = document.getElementById('quickPrompts');
  const ctxMenu = document.getElementById('ctxMenu');

  // State
  let myId = null;
  let partnerId = null;
  let replyTo = null;
  let isTyping = false;
  let typingTimer = null;
  let lastActivity = Date.now();
  let contextTarget = null;

  // Utils
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const storage = {
    get profile(){ try { return JSON.parse(localStorage.getItem('profile')||'null'); } catch { return null; } },
    set profile(v){ localStorage.setItem('profile', JSON.stringify(v)); }
  };

  function showOnboard() { onboard.style.display = 'grid'; obNick.focus(); }
  function hideOnboard() { onboard.style.display = 'none'; }

  function requestNotify() {
    try { if (Notification.permission === 'default') Notification.requestPermission(); } catch {}
  }

  function notify(title, body) {
    try {
      if (document.hidden && Notification.permission === 'granted') {
        navigator.serviceWorker?.ready.then(r => {
          r.showNotification(title, { body, icon: '/assets/icon-192.png', badge: '/assets/icon-192.png' });
        });
      } else if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/assets/icon-192.png' });
      } else {
        // beep fallback
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.001;
          o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 140);
        } catch {}
      }
    } catch {}
  }

  function systemMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg system'; el.textContent = text;
    messages.appendChild(el); autoScroll();
  }

  function renderMessage(msg, isMine=false) {
    const wrap = document.createElement('div');
    wrap.className = 'msg' + (isMine ? ' me' : '');
    wrap.dataset.id = msg.id;
    wrap.tabIndex = 0;

    if (msg.replyTo) {
      const ref = document.querySelector(`.msg[data-id="${msg.replyTo}"] .content`);
      const replyText = ref ? ref.textContent : '(삭제됨)';
      const reply = document.createElement('div');
      reply.className = 'reply'; reply.textContent = replyText; wrap.appendChild(reply);
    }

    const content = document.createElement('div');
    content.className = 'content'; content.textContent = msg.text;
    wrap.appendChild(content);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = document.createElement('span'); time.textContent = fmtTime(msg.ts);
    meta.appendChild(time);

    if (isMine) {
      const read = document.createElement('span');
      read.className = 'badge unread'; read.textContent = '보냄'; read.dataset.role = 'read';
      meta.appendChild(read);
    }
    wrap.appendChild(meta);

    wrap.addEventListener('dblclick', () => { setReply(msg.id, content.textContent); });
    wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); openMenu(e.clientX, e.clientY, wrap, content.textContent, msg.id); });

    messages.appendChild(wrap);
    autoScroll();
  }

  function setReply(id, previewText) {
    replyTo = id; replyPreview.textContent = previewText; replyPreview.classList.add('show'); text.focus();
  }

  function clearReply() {
    replyTo = null; replyPreview.textContent=''; replyPreview.classList.remove('show');
  }

  function setRead(id) {
    const el = document.querySelector(`.msg[data-id="${id}"] [data-role="read"]`);
    if (el) { el.textContent = '읽음'; el.classList.remove('unread'); el.classList.add('read'); }
  }

  function autoScroll() {
    const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 100;
    if (nearBottom) { messages.scrollTop = messages.scrollHeight; scrollLatest.classList.remove('show'); }
    else { scrollLatest.classList.add('show'); }
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

  obLight.addEventListener('click', () => {
    document.documentElement.classList.add('light');
    localStorage.setItem('theme', 'light');
  });

  // Onboard
  function startMatch() {
    const nick = obNick.value.trim();
    if (!nick) { obNick.focus(); return; }
    if (!obAgree.checked) { alert('이용 규칙에 동의해야 시작할 수 있어요.'); return; }
    const about = obAbout.value.trim();
    storage.profile = { nickname: nick, about };
    hideOnboard();
    requestNotify();
    statusText.textContent = '매칭 중';
    socket.emit('join_queue', { profile: { nickname: nick, about } });
  }

  obStart.addEventListener('click', startMatch);
  obNick.addEventListener('keydown', (e)=>{ if (e.key==='Enter') startMatch(); });
  obAbout.addEventListener('keydown', (e)=>{ if (e.key==='Enter') startMatch(); });

  // Quick prompts
  if (quickPrompts) {
    quickPrompts.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        text.value = e.target.textContent;
        text.focus();
      }
    });
  }

  // Typing
  text.addEventListener('input', () => {
    if (!isTyping) { isTyping = true; socket.emit('typing', true); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { isTyping = false; socket.emit('typing', false); }, 800);
  });

  // Keyboard shortcuts
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send.click(); }
    else if (e.key === 'Escape') { clearReply(); }
  });

  // Buttons
  nextBtn.addEventListener('click', () => {
    socket.emit('next');
    pNick.textContent = '새 상대 찾는 중…'; pAbout.textContent = '';
    systemMessage('새로운 상대를 찾는 중…'); statusText.textContent = '매칭 중';
  });

  send.addEventListener('click', () => {
    const value = text.value.trim();
    if (!value) return;
    socket.emit('message', { text: value, replyTo });
    text.value = ''; clearReply();
  });

  scrollLatest.addEventListener('click', () => {
    messages.scrollTop = messages.scrollHeight; scrollLatest.classList.remove('show');
  });

  messages.addEventListener('scroll', autoScroll);

  // Context menu
  function openMenu(x, y, target, contentText, id) {
    contextTarget = { target, contentText, id };
    ctxMenu.style.left = x+'px'; ctxMenu.style.top = y+'px';
    ctxMenu.style.display = 'block'; ctxMenu.setAttribute('aria-hidden','false');
  }
  function closeMenu() {
    ctxMenu.style.display = 'none'; ctxMenu.setAttribute('aria-hidden','true'); contextTarget = null;
  }
  document.addEventListener('click', (e)=>{ if (e.target.closest('#ctxMenu') == null) closeMenu(); });
  ctxMenu.addEventListener('click', (e)=>{
    if (!contextTarget) return;
    if (e.target.dataset.action === 'copy') {
      navigator.clipboard?.writeText(contextTarget.contentText);
    } else if (e.target.dataset.action === 'quote') {
      setReply(contextTarget.id, contextTarget.contentText);
    }
    closeMenu();
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
    systemMessage('상대가 연결되었습니다. 대화를 시작해 보세요.');
  });

  socket.on('partner_left', ({ reason }) => {
    partnerId = null;
    systemMessage(reason || '상대가 나갔습니다.');
    pNick.textContent = '상대를 찾는 중…'; pAbout.textContent = '';
    statusText.textContent = '매칭 중';
  });

  socket.on('typing', (flag) => {
    typingEl.textContent = flag ? '상대가 입력 중…' : '';
  });

  socket.on('message', (msg) => {
    lastActivity = Date.now();
    renderMessage(msg, false);
    notify('새 메시지', msg.text);
    if (!document.hidden) socket.emit('message_read', msg.id);
    else {
      const onFocus = () => { socket.emit('message_read', msg.id); window.removeEventListener('focus', onFocus); };
      window.addEventListener('focus', onFocus);
    }
  });

  socket.on('message_echo', (msg) => { renderMessage(msg, true); });

  socket.on('message_read', ({ id }) => { setRead(id); });

  // Idle hint (client-side)
  setInterval(() => {
    if (Date.now() - lastActivity > 120000 && partnerId) {
      systemMessage('상대가 잠시 자리 비움일 수 있어요.');
      lastActivity = Date.now();
    }
  }, 15000);

  // Ping/RTT
  setInterval(() => {
    const ts = performance.now();
    socket.emit('client_ping', ts);
  }, 4000);
  socket.on('client_pong', (ts) => {
    const rtt = Math.max(1, Math.round(performance.now() - ts));
    rttEl.textContent = rtt;
  });

  // Visibility -> mark last as read
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const last = [...document.querySelectorAll('.msg')].pop();
      if (last && last.classList.contains('me')) {
        socket.emit('message_read', last.dataset.id);
      }
    }
  });

  // Initial boot: show onboarding or auto-fill from storage
  (function boot(){
    const p = storage.profile;
    if (p && p.nickname) {
      obNick.value = p.nickname; obAbout.value = p.about || '';
    }
    showOnboard();
  })();

})();
