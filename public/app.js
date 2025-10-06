
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
  const replyPreview = document.getElementById('replyPreview');
  const themeToggle = document.getElementById('themeToggle');
  const homeBtn = document.getElementById('homeBtn');

  // State
  let myId = null; // socket id known via messages
  let partnerId = null;
  let replyTo = null;
  let isTyping = false;
  let typingTimer = null;
  let readMap = new Map(); // messageId -> read boolean

  // Utils
  const fmtTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const requestNotify = async () => {
    try {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch {}
  };

  function notify(title, body) {
    try {
      if (document.hidden && Notification.permission === 'granted') {
        navigator.serviceWorker?.ready.then(r => {
          r.showNotification(title, {
            body,
            icon: '/assets/icon-192.png',
            badge: '/assets/icon-192.png'
          });
        });
      } else if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/assets/icon-192.png' });
      } else {
        // fallback beep with Web Audio
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.001;
          o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 150);
        } catch {}
      }
    } catch {}
  }

  function systemMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg system';
    el.textContent = text;
    messages.appendChild(el);
    autoScroll();
  }

  function renderMessage(msg, isMine=false) {
    const wrap = document.createElement('div');
    wrap.className = 'msg' + (isMine ? ' me' : '');
    wrap.dataset.id = msg.id;

    if (msg.replyTo) {
      const ref = document.querySelector(`.msg[data-id="${msg.replyTo}"] .content`);
      const replyText = ref ? ref.textContent : '(삭제됨)';
      const reply = document.createElement('div');
      reply.className = 'reply';
      reply.textContent = replyText;
      wrap.appendChild(reply);
    }

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = msg.text;
    wrap.appendChild(content);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = document.createElement('span');
    time.textContent = fmtTime(msg.ts);
    meta.appendChild(time);

    if (isMine) {
      const read = document.createElement('span');
      read.className = 'badge unread';
      read.textContent = '보냄';
      read.dataset.role = 'read';
      meta.appendChild(read);
    }

    wrap.appendChild(meta);
    wrap.addEventListener('dblclick', () => {
      replyTo = msg.id;
      replyPreview.textContent = content.textContent;
      replyPreview.classList.add('show');
      text.focus();
    });

    messages.appendChild(wrap);
    autoScroll();
  }

  function setRead(id) {
    const el = document.querySelector(`.msg[data-id="${id}"] [data-role="read"]`);
    if (el) {
      el.textContent = '읽음';
      el.classList.remove('unread');
      el.classList.add('read');
    }
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
    localStorage.setItem('theme',
      document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });

  // Home
  homeBtn.addEventListener('click', () => location.href = '/');

  // Typing
  text.addEventListener('input', () => {
    if (!isTyping) {
      isTyping = true;
      socket.emit('typing', true);
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      socket.emit('typing', false);
    }, 800);
  });

  // Keyboard shortcuts
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send.click();
    } else if (e.key === 'Escape') {
      replyTo = null;
      replyPreview.classList.remove('show');
      replyPreview.textContent = '';
    }
  });

  // Buttons
  startBtn.addEventListener('click', () => {
    requestNotify();
    socket.emit('join_queue', { profile: { nickname: meNick.value, about: meAbout.value } });
    startBtn.disabled = true;
    nextBtn.disabled = false;
  });
  nextBtn.addEventListener('click', () => {
    socket.emit('next');
    pNick.textContent = '새 상대 찾는 중…';
    pAbout.textContent = '';
    systemMessage('새로운 상대를 찾는 중…');
  });

  send.addEventListener('click', () => {
    const value = text.value.trim();
    if (!value) return;
    const payload = { text: value, replyTo };
    socket.emit('message', payload);
    text.value = '';
    replyTo = null;
    replyPreview.classList.remove('show');
    replyPreview.textContent = '';
  });

  // Socket events
  socket.on('connect', () => { myId = socket.id; });
  socket.on('online_count', (n) => { online.textContent = `접속자 ${n}`; });

  socket.on('system', (p) => systemMessage(p.text || '시스템'));
  socket.on('matched', ({ roomId, partner }) => {
    partnerId = true; // truthy
    pNick.textContent = partner?.nickname || '상대';
    pAbout.textContent = partner?.about || '';
    systemMessage('상대가 연결되었습니다. 대화를 시작해 보세요.');
  });

  socket.on('partner_left', ({ reason }) => {
    partnerId = null;
    systemMessage(reason || '상대가 나갔습니다.');
    pNick.textContent = '상대를 찾는 중…';
    pAbout.textContent = '';
  });

  socket.on('typing', (flag) => {
    typingEl.textContent = flag ? '상대가 입력 중…' : '';
  });

  socket.on('message', (msg) => {
    renderMessage(msg, false);
    notify('새 메시지', msg.text);
    // Immediately acknowledge read if visible
    const el = document.querySelector(`.msg[data-id="${msg.id}"]`);
    if (el && !document.hidden) {
      socket.emit('message_read', msg.id);
    } else {
      // on focus, mark as read
      const onFocus = () => {
        socket.emit('message_read', msg.id);
        window.removeEventListener('focus', onFocus);
      };
      window.addEventListener('focus', onFocus);
    }
  });

  socket.on('message_echo', (msg) => {
    renderMessage(msg, true);
  });

  socket.on('message_read', ({ id }) => {
    setRead(id);
  });

  // Visibility -> mark latest as read
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const last = [...document.querySelectorAll('.msg')].pop();
      if (last && last.classList.contains('me')) {
        const id = last.dataset.id;
        socket.emit('message_read', id);
      }
    }
  });

})();
